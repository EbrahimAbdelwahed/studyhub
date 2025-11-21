import os
from datetime import datetime, timedelta
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import case, select, or_

from . import db
from .analytics import mastery_by_syllabus, error_taxonomy, velocity_trend
from .generator import generate_cards
from .models import Card, CardState, CardType, Attempt, GeneratorJob, SyllabusUnit
from .scheduler import ensure_next_review, update_card_state, score_delta


from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
db.init_db()

app = FastAPI(title="MedSprint Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ImportSyllabusRequest(BaseModel):
    syllabus: dict


class GeneratorRequest(BaseModel):
    units: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    num_cards: int = 10
    model: str = "gpt-5.1"


class AnswerPayload(BaseModel):
    outcome: str = Field(pattern="^(correct|wrong|skip)$")
    duration_s: float = 30.0


class CardOut(BaseModel):
    card_id: str
    syllabus_ref: str
    dm418_tag: str
    type: str
    question: str
    cloze_part: Optional[str] = None
    mcq_options: Optional[List[str]] = None
    state: str
    next_review: Optional[datetime] = None


class GeneratorResponse(BaseModel):
    created: int
    job_id: Optional[int] = None


class SyllabusOut(BaseModel):
    id: str
    title: str
    exam_weight: Optional[int] = None
    primary_competency: Optional[str] = None
    secondary_competency: Optional[str] = None
    topics: List[str] = []
    subject: Optional[str] = None
    source: Optional[str] = None
    total_cfu: Optional[int] = None
    meta_version: Optional[str] = None


LOOKAHEAD = timedelta(minutes=5)


@app.post("/import/syllabus")
def import_syllabus(payload: ImportSyllabusRequest):
    data = payload.syllabus
    units = data.get("units", [])
    meta = data.get("meta", {})
    created = 0
    with db.get_session() as session:
        for unit in units:
            unit_obj = SyllabusUnit(
                id=unit["id"],
                title=unit["title"],
                exam_weight=unit.get("exam_weight"),
                primary_competency=unit.get("primary_competency"),
                secondary_competency=unit.get("secondary_competency"),
                topics=unit.get("topics", []),
                subject=meta.get("subject"),
                source=meta.get("source"),
                total_cfu=meta.get("total_cfu"),
                meta_version=meta.get("version"),
            )
            existing = session.get(SyllabusUnit, unit_obj.id)
            if existing:
                for attr, value in unit_obj.dict(exclude={"id", "created_at", "updated_at"}).items():
                    setattr(existing, attr, value)
            else:
                session.add(unit_obj)
                created += 1
        session.commit()
    return {"imported": created, "total_units": len(units)}


@app.get("/syllabus", response_model=List[SyllabusUnit])
def get_syllabus():
    with db.get_session() as session:
        return session.exec(select(SyllabusUnit)).all()


@app.post("/generator/run", response_model=GeneratorResponse)
def run_generator(request: GeneratorRequest):
    with db.get_session() as session:
        stmt = select(SyllabusUnit)
        if request.units:
            stmt = stmt.where(SyllabusUnit.id.in_(request.units))
        units = session.exec(stmt).all()
        if not units:
            raise HTTPException(status_code=400, detail="Nessuna unit trovata per i parametri richiesti")

        job = GeneratorJob(
            status="RUNNING",
            requested_tags=request.tags,
            requested_units=request.units,
            num_cards=request.num_cards,
            model=request.model,
            payload={"units": [u.id for u in units], "tags": request.tags},
        )
        session.add(job)
        session.commit()
        session.refresh(job)

        try:
            cards = generate_cards(units=units, tags=request.tags, num_cards=request.num_cards, model=request.model)
        except HTTPException as exc:
            job.status = "FAILED"
            job.error = str(exc.detail)
            job.updated_at = datetime.utcnow()
            session.commit()
            raise

        for card in cards:
            ensure_next_review(card)
            session.add(card)

        job.status = "COMPLETED"
        job.updated_at = datetime.utcnow()
        session.commit()

        return GeneratorResponse(created=len(cards), job_id=job.id)


@app.get("/syllabus", response_model=List[SyllabusOut])
def list_syllabus():
    with db.get_session() as session:
        units = session.exec(select(SyllabusUnit)).all()
        return [SyllabusOut(**u.dict()) for u in units]


@app.get("/cards/next", response_model=List[CardOut])
def fetch_next_cards(limit: int = 10, include_new: bool = True):
    now = datetime.utcnow()
    with db.get_session() as session:
        priority = case(
            (Card.state == CardState.CRITICAL, 0),
            (Card.state == CardState.CONFIRMATION, 1),
            (Card.state == CardState.CONSOLIDATION, 2),
            (Card.state == CardState.NEW, 3),
            else_=4,
        )
        conditions = [Card.next_review <= now + LOOKAHEAD]
        if include_new:
            conditions.append(Card.state == CardState.NEW)

        stmt = select(Card).where(or_(*conditions)).order_by(priority, Card.next_review).limit(limit)
        cards = session.exec(stmt).all()
        return [CardOut(**card.dict()) for card in cards]


@app.post("/cards/{card_id}/answer", response_model=CardOut)
def answer_card(card_id: str, payload: AnswerPayload):
    now = datetime.utcnow()
    with db.get_session() as session:
        card = session.get(Card, card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Card non trovata")

        outcome = payload.outcome
        card.total_attempts += 1
        if outcome != "correct":
            card.failures += 1

        prev_avg = card.avg_time_s
        n = card.total_attempts
        card.avg_time_s = ((prev_avg * (n - 1)) + payload.duration_s) / n

        update_card_state(card, outcome, now)
        card.updated_at = now

        attempt = Attempt(card_id=card.card_id, outcome=outcome, duration_s=payload.duration_s, created_at=now)
        session.add(attempt)

        session.commit()
        session.refresh(card)
        return CardOut(**card.dict())


@app.get("/analytics/heatmap")
def heatmap():
    with db.get_session() as session:
        return mastery_by_syllabus(session)


@app.get("/analytics/error-taxonomy")
def error_taxonomy_endpoint():
    with db.get_session() as session:
        return error_taxonomy(session)


@app.get("/analytics/velocity")
def velocity():
    with db.get_session() as session:
        return velocity_trend(session)
