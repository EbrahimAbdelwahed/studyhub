import os
import json
from datetime import datetime, timedelta
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import case, select, or_

from . import db
from .analytics import mastery_by_syllabus, error_taxonomy, velocity_trend
from .generator import generate_cards, generate_unique_cards, _get_client, _infer_mcq_answer
from .models import Card, CardState, CardType, Attempt, GeneratorJob, SyllabusUnit
from .scheduler import ensure_next_review, update_card_state, score_delta


from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
db.init_db()

app = FastAPI(title="MedSprint Backend", version="0.1.0", root_path="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    skipped_duplicates: int = 0


class SyllabusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")
    id: str
    title: str
    exam_weight: Optional[int] = None
    primary_competency: Optional[str] = None
    secondary_competency: Optional[str] = None
    topics: List[str] = Field(default_factory=list)
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
                subject=unit.get("subject") or meta.get("subject"),
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


@app.post("/import/defaults")
def import_defaults():
    files = ["chem.json", "fisica.json"]
    total_imported = 0
    total_units = 0
    
    with db.get_session() as session:
        for filename in files:
            if not os.path.exists(filename):
                continue
                
            with open(filename, "r") as f:
                data = json.load(f)
                
            units = data.get("units", [])
            meta = data.get("meta", {})
            total_units += len(units)
            
            for unit in units:
                unit_obj = SyllabusUnit(
                    id=unit["id"],
                    title=unit["title"],
                    exam_weight=unit.get("exam_weight"),
                    primary_competency=unit.get("primary_competency"),
                    secondary_competency=unit.get("secondary_competency"),
                    topics=unit.get("topics", []),
                    subject=unit.get("subject") or meta.get("subject"),
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
                    total_imported += 1
        session.commit()
        
    return {"imported": total_imported, "total_units": total_units}





@app.post("/generator/run", response_model=GeneratorResponse)
def run_generator(request: GeneratorRequest):
    with db.get_session() as session:
        stmt = select(SyllabusUnit)
        if request.units:
            stmt = stmt.where(SyllabusUnit.id.in_(request.units))
        units = session.exec(stmt).scalars().all()
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

        unit_ids = [u.id for u in units]
        existing_questions_raw = session.exec(select(Card.question).where(Card.syllabus_ref.in_(unit_ids))).all()
        existing_questions = [q[0] if isinstance(q, tuple) else q for q in existing_questions_raw]

        try:
            cards, skipped = generate_unique_cards(
                units=units,
                tags=request.tags,
                num_cards=request.num_cards,
                model=request.model,
                existing_questions=existing_questions,
            )
        except HTTPException as exc:
            job.status = "FAILED"
            job.error = str(exc.detail)
            job.updated_at = datetime.utcnow()
            session.commit()
            raise

        if not cards:
            job.status = "FAILED"
            job.error = "Nessuna card unica generata"
            job.updated_at = datetime.utcnow()
            session.commit()
            raise HTTPException(status_code=400, detail=job.error)

        for card in cards:
            session.add(card)

        job.status = "COMPLETED"
        job.payload = {"units": unit_ids, "tags": request.tags, "skipped_duplicates": len(skipped)}
        job.updated_at = datetime.utcnow()
        session.commit()

        return GeneratorResponse(created=len(cards), job_id=job.id, skipped_duplicates=len(skipped))


@app.get("/generator/jobs", response_model=List[GeneratorJob])
def list_generator_jobs(limit: int = 20):
    with db.get_session() as session:
        jobs = session.exec(select(GeneratorJob).order_by(GeneratorJob.created_at.desc()).limit(limit)).all()
        return jobs


@app.get("/syllabus", response_model=List[SyllabusOut])
def list_syllabus():
    with db.get_session() as session:
        units = session.exec(select(SyllabusUnit)).scalars().all()
        return [SyllabusOut.model_validate(u) for u in units]


@app.get("/cards/next", response_model=List[CardOut])
def fetch_next_cards(limit: int = 10, include_new: bool = True, card_type: Optional[str] = None):
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

        stmt = select(Card).where(or_(*conditions))
        if card_type:
            stmt = stmt.where(Card.type == card_type)

        stmt = stmt.order_by(priority, Card.next_review).limit(limit)
        cards = session.exec(stmt).scalars().all()
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


@app.get("/cards", response_model=List[CardOut])
def list_cards(
    offset: int = 0, limit: int = 50, syllabus_ref: Optional[str] = None
):
    with db.get_session() as session:
        query = select(Card)
        if syllabus_ref:
            query = query.where(Card.syllabus_ref == syllabus_ref)
        query = query.offset(offset).limit(limit)
        cards = session.exec(query).scalars().all()
        return [CardOut(**c.dict()) for c in cards]


class CardUpdate(BaseModel):
    question: Optional[str] = None
    cloze_part: Optional[str] = None
    mcq_options: Optional[List[str]] = None


@app.put("/cards/{card_id}", response_model=CardOut)
def update_card(card_id: str, card_update: CardUpdate):
    with db.get_session() as session:
        card = session.get(Card, card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        
        card_data = card_update.dict(exclude_unset=True)
        for key, value in card_data.items():
            setattr(card, key, value)
            
        session.add(card)
        session.commit()
        session.refresh(card)
        return CardOut(**card.dict())


@app.delete("/cards/{card_id}")
def delete_card(card_id: str):
    with db.get_session() as session:
        card = session.get(Card, card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        session.delete(card)
        session.commit()
        return {"ok": True}


@app.post("/maintenance/heal-mcq-cloze")
def heal_mcq_cloze(try_infer: bool = True, model: str = "gpt-5.1", limit: int = 200):
    """
    Sanitize existing MCQ cards missing cloze_part by inferring the correct option
    (when possible) or defaulting to the first option to avoid UI breakage.
    """
    with db.get_session() as session:
        missing_cards = session.exec(
            select(Card).where(
                Card.type == CardType.MCQ,
                or_(Card.cloze_part.is_(None), Card.cloze_part == "")
            ).limit(limit)
        ).scalars().all()

        if not missing_cards:
            return {"scanned": 0, "updated": 0, "inferred": 0, "defaulted": 0}

        client = _get_client() if try_infer else None
        updated = inferred = defaulted = 0

        for card in missing_cards:
            answer = None
            options = card.mcq_options or []

            if try_infer and client and options:
                answer = _infer_mcq_answer(client, question=card.question, options=options, model=model)
                if answer:
                    inferred += 1

            if not answer and options:
                answer = options[0]
                defaulted += 1

            if not answer:
                continue

            card.cloze_part = answer
            card.updated_at = datetime.utcnow()
            session.add(card)
            updated += 1

        session.commit()
        return {
            "scanned": len(missing_cards),
            "updated": updated,
            "inferred": inferred,
            "defaulted": defaulted,
        }
