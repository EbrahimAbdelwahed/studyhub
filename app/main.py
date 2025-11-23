import os
import json
from datetime import datetime, timedelta
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import case, select, or_

from . import db
from .analytics import mastery_by_syllabus, error_taxonomy, velocity_trend
from .generator import generate_cards, generate_unique_cards, generate_ideas, generate_card_from_idea
from .models import Card, CardState, Attempt, CardSketch, GeneratorJob, SyllabusUnit
from .scheduler import ensure_next_review, update_card_state


from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
db.init_db()

app = FastAPI(title="MedSprint Backend", version="0.1.0", root_path="/api")

# CORS: allow explicit origins; if wildcard, disable credentials to satisfy browser rules.
raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()] or ["*"]
allow_credentials = os.environ.get("ALLOW_CREDENTIALS", "true").lower() == "true"
if "*" in allowed_origins:
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
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
    two_stage: bool = False


class AnswerPayload(BaseModel):
    outcome: str = Field(pattern="^(correct|wrong|skip)$")
    duration_s: float = 30.0
    user_answer: Optional[str] = None


class CardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")
    card_id: str
    syllabus_ref: str
    dm418_tag: str
    type: str
    question: str
    comment: Optional[str] = None
    cloze_part: Optional[str] = None
    mcq_options: Optional[List[str]] = None
    state: str
    next_review: Optional[datetime] = None


class AttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")
    outcome: str
    duration_s: float
    created_at: datetime
    given_answer: Optional[str] = None
    comment: Optional[str] = None


class CardStatsOut(BaseModel):
    avg_time_s: float
    total_attempts: int
    failures: int
    last_answered_at: Optional[datetime] = None
    last_duration_s: Optional[float] = None
    wrong_answers: List[str] = Field(default_factory=list)


class WrongCardOut(BaseModel):
    card: CardOut
    stats: CardStatsOut
    recent_attempts: List[AttemptOut]


class GeneratorResponse(BaseModel):
    created: int
    job_id: Optional[int] = None
    skipped_duplicates: int = 0


class CardAnswerResponse(BaseModel):
    card: CardOut
    comment: Optional[str] = None


class SketchPayload(BaseModel):
    data_url: str


class SketchOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    data_url: Optional[str] = None
    updated_at: Optional[datetime] = None


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
NUMERIC_REL_TOL = 0.025  # 2.5% tolerance for numeric cloze/answer matching
NUMERIC_ABS_TOL = 0.01


def _fallback_comment(card: Card, user_answer: Optional[str]) -> str:
    correct = card.cloze_part or "la risposta corretta"
    base = "Ripassa il concetto chiave e i passaggi logici che portano alla soluzione."
    if user_answer:
        return f"{base} La tua risposta '{user_answer}' non centra il punto; la risposta corretta è '{correct}'."
    return f"{base} La risposta corretta è '{correct}'."


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
            if request.two_stage:
                ideas = generate_ideas(units=units, tags=request.tags, num_ideas=request.num_cards, model=request.model)
                unit_lookup = {u.id: u for u in units}
                cards = []
                skipped: List[str] = []
                for idea in ideas:
                    try:
                        card = generate_card_from_idea(idea, unit_lookup=unit_lookup, model=request.model, job_id=job.id)
                        norm_q = card.question.lower().strip()
                        if norm_q in {q.lower().strip() for q in existing_questions}:
                            skipped.append(card.question)
                            continue
                        cards.append(card)
                        existing_questions.append(card.question)
                    except HTTPException:
                        skipped.append(str(idea))
                if not cards:
                    raise HTTPException(status_code=400, detail="Nessuna card generata dalle idee")
            else:
                cards, skipped = generate_unique_cards(
                    units=units,
                    tags=request.tags,
                    num_cards=request.num_cards,
                    model=request.model,
                    existing_questions=existing_questions,
                    job_id=job.id,
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


@app.post("/generator/run-async", response_model=GeneratorResponse)
def run_generator_async(request: GeneratorRequest, background_tasks: BackgroundTasks):
    with db.get_session() as session:
        stmt = select(SyllabusUnit)
        if request.units:
            stmt = stmt.where(SyllabusUnit.id.in_(request.units))
        units = session.exec(stmt).scalars().all()
        if not units:
            raise HTTPException(status_code=400, detail="Nessuna unit trovata per i parametri richiesti")

        job = GeneratorJob(
            status="QUEUED",
            requested_tags=request.tags,
            requested_units=request.units,
            num_cards=request.num_cards,
            model=request.model,
            payload={"units": [u.id for u in units], "tags": request.tags, "mode": "two_stage" if request.two_stage else "per_card"},
        )
        session.add(job)
        session.commit()
        session.refresh(job)

    background_tasks.add_task(_process_generator_job, job.id, request)
    return GeneratorResponse(created=0, job_id=job.id, skipped_duplicates=0)


@app.get("/generator/jobs", response_model=List[GeneratorJob])
@app.get("/api/generator/jobs", response_model=List[GeneratorJob])  # alias for double-prefix setups
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


@app.post("/cards/{card_id}/answer", response_model=CardAnswerResponse)
def answer_card(card_id: str, payload: AnswerPayload):
    now = datetime.utcnow()
    with db.get_session() as session:
        card = session.get(Card, card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Card non trovata")

        outcome = payload.outcome

        # Numeric tolerance for CLOZE when user's answer is close to the correct value
        if outcome != "correct" and card.type == "CLOZE" and payload.user_answer and card.cloze_part:
            try:
                user_val = float(str(payload.user_answer).replace(",", "."))
                target_val = float(str(card.cloze_part).replace(",", "."))
                diff = abs(user_val - target_val)
                rel = diff / max(abs(target_val), 1e-9)
                if diff <= NUMERIC_ABS_TOL or rel <= NUMERIC_REL_TOL:
                    outcome = "correct"
            except Exception:
                pass

        card.total_attempts += 1
        if outcome != "correct":
            card.failures += 1

        prev_avg = card.avg_time_s
        n = card.total_attempts
        card.avg_time_s = ((prev_avg * (n - 1)) + payload.duration_s) / n

        update_card_state(card, outcome, now)
        card.updated_at = now

        feedback_comment = None
        if outcome != "correct":
            feedback_comment = card.comment or _fallback_comment(card, payload.user_answer)

        attempt = Attempt(
            card_id=card.card_id,
            outcome=outcome,
            duration_s=payload.duration_s,
            given_answer=payload.user_answer,
            comment=feedback_comment,
            created_at=now,
        )
        session.add(attempt)

        session.commit()
        session.refresh(card)
        return CardAnswerResponse(card=CardOut(**card.dict()), comment=feedback_comment)


@app.get("/cards/wrong", response_model=List[WrongCardOut])
def list_wrong_cards(limit: Optional[int] = None, history_limit: int = 5):
    history_limit = max(1, min(history_limit, 20))
    with db.get_session() as session:
        stmt = select(Card).where(Card.failures > 0).order_by(Card.updated_at.desc())
        if limit and limit > 0:
            stmt = stmt.limit(limit)
        cards = session.exec(stmt).scalars().all()

        payload: List[WrongCardOut] = []
        for card in cards:
            attempts = (
                session.exec(
                    select(Attempt)
                    .where(Attempt.card_id == card.card_id)
                    .order_by(Attempt.created_at.desc())
                    .limit(history_limit)
                )
                .scalars()
                .all()
            )
            last_attempt = attempts[0] if attempts else None
            wrong_answers: List[str] = []
            seen_answers = set()
            for a in attempts:
                if a.outcome == "correct":
                    continue
                if a.given_answer and a.given_answer not in seen_answers:
                    seen_answers.add(a.given_answer)
                    wrong_answers.append(a.given_answer)
            payload.append(
                WrongCardOut(
                    card=CardOut(**card.dict()),
                    stats=CardStatsOut(
                        avg_time_s=card.avg_time_s,
                        total_attempts=card.total_attempts,
                        failures=card.failures,
                        last_answered_at=last_attempt.created_at if last_attempt else None,
                        last_duration_s=last_attempt.duration_s if last_attempt else None,
                        wrong_answers=wrong_answers,
                    ),
                    recent_attempts=[AttemptOut.model_validate(a) for a in attempts],
                )
            )
        return payload


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


@app.delete("/cards/by-syllabus/{syllabus_ref}")
def delete_cards_by_syllabus(syllabus_ref: str):
    with db.get_session() as session:
        cards = session.exec(select(Card).where(Card.syllabus_ref == syllabus_ref)).scalars().all()
        if not cards:
            return {"deleted_cards": 0, "deleted_attempts": 0, "deleted_sketches": 0}

        card_ids = [c.card_id for c in cards]

        deleted_attempts = 0
        deleted_sketches = 0

        if card_ids:
            attempts = session.exec(select(Attempt).where(Attempt.card_id.in_(card_ids))).scalars().all()
            for att in attempts:
                session.delete(att)
            deleted_attempts = len(attempts)

            sketches = session.exec(select(CardSketch).where(CardSketch.card_id.in_(card_ids))).scalars().all()
            for sk in sketches:
                session.delete(sk)
            deleted_sketches = len(sketches)

        for card in cards:
            session.delete(card)

        session.commit()
        return {
            "deleted_cards": len(cards),
            "deleted_attempts": deleted_attempts,
            "deleted_sketches": deleted_sketches,
            "syllabus_ref": syllabus_ref,
        }


@app.delete("/generator/jobs/{job_id}/cards")
def delete_cards_by_job(job_id: int):
    with db.get_session() as session:
        job = session.get(GeneratorJob, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Generator job not found")
        deleted = session.exec(select(Card).where(Card.generator_job_id == job_id)).scalars().all()
        count = len(deleted)
        for card in deleted:
            session.delete(card)
        session.commit()
        return {"deleted": count, "job_id": job_id}


@app.get("/cards/{card_id}/sketch", response_model=SketchOut)
def get_card_sketch(card_id: str):
    with db.get_session() as session:
        sketch = session.get(CardSketch, card_id)
        if not sketch:
            return SketchOut()
        return SketchOut(**sketch.dict())


@app.put("/cards/{card_id}/sketch", response_model=SketchOut)
def save_card_sketch(card_id: str, payload: SketchPayload):
    now = datetime.utcnow()
    with db.get_session() as session:
        card = session.get(Card, card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")

        sketch = session.get(CardSketch, card_id)
        if not sketch:
            sketch = CardSketch(card_id=card_id, data_url=payload.data_url, updated_at=now)
        else:
            sketch.data_url = payload.data_url
            sketch.updated_at = now

        session.add(sketch)
        session.commit()
        session.refresh(sketch)
        return SketchOut(**sketch.dict())


@app.delete("/cards/{card_id}/sketch")
def delete_card_sketch(card_id: str):
    with db.get_session() as session:
        sketch = session.get(CardSketch, card_id)
        if not sketch:
            return {"deleted": False}
        session.delete(sketch)
        session.commit()
        return {"deleted": True}
def _process_generator_job(job_id: int, request: GeneratorRequest):
    # Background worker: per-card generation to avoid long synchronous requests.
    with db.get_session() as session:
        job = session.get(GeneratorJob, job_id)
        if not job:
            return
        # Prepare units
        stmt = select(SyllabusUnit)
        if request.units:
            stmt = stmt.where(SyllabusUnit.id.in_(request.units))
        units = session.exec(stmt).scalars().all()
        if not units:
            job.status = "FAILED"
            job.error = "Nessuna unit trovata per i parametri richiesti"
            job.updated_at = datetime.utcnow()
            session.commit()
            return

    unit_lookup = {u.id: u for u in units}
    existing_questions_raw = session.exec(select(Card.question).where(Card.syllabus_ref.in_(list(unit_lookup.keys())))).all()
    existing_questions = [q[0] if isinstance(q, tuple) else q for q in existing_questions_raw]

    created = 0
    skipped = 0
    ideas_cache: List[Dict[str, str]] = []

    # Two-stage: pre-brainstorm ideas
    if request.two_stage:
        try:
            ideas_cache = generate_ideas(units=units, tags=request.tags, num_ideas=request.num_cards, model=request.model)
        except HTTPException as exc:
            with db.get_session() as session:
                job = session.get(GeneratorJob, job_id)
                job.status = "FAILED"
                job.error = str(exc.detail)
                job.updated_at = datetime.utcnow()
                session.commit()
            return

    with db.get_session() as session:
        job = session.get(GeneratorJob, job_id)
        job.status = "RUNNING"
        job.updated_at = datetime.utcnow()
        job.payload = {"units": [u.id for u in units], "tags": request.tags, "mode": "two_stage" if request.two_stage else "per_card"}
        session.commit()

    for i in range(request.num_cards):
        try:
            if request.two_stage:
                if i < len(ideas_cache):
                    idea = ideas_cache[i]
                else:
                    # Fallback: generate a new idea if not enough
                    idea = {
                        "syllabus_ref": request.units[0] if request.units else units[0].id,
                        "topic": unit_lookup.get(request.units[0] if request.units else units[0].id).topics[0] if unit_lookup.get(request.units[0] if request.units else units[0].id).topics else "",
                        "idea": "Esercizio applicativo sui concetti principali della unit.",
                    }
                card = generate_card_from_idea(idea, unit_lookup=unit_lookup, model=request.model, job_id=job_id)
                norm_q = _normalize_question(card.question)
                if norm_q in {_normalize_question(q) for q in existing_questions}:
                    skipped += 1
                    continue
                existing_questions.append(card.question)
            else:
                # Per-card direct generation: one LLM call per card
                cards, _ = generate_unique_cards(
                    units=units,
                    tags=request.tags,
                    num_cards=1,
                    model=request.model,
                    existing_questions=existing_questions,
                    max_rounds=1,
                    job_id=job_id,
                )
                if not cards:
                    skipped += 1
                    continue
                card = cards[0]
                existing_questions.append(card.question)

            with db.get_session() as session:
                session.add(card)
                session.commit()
            created += 1
        except HTTPException:
            skipped += 1
            continue
        except Exception as exc:
            skipped += 1
            continue

        # Update progress periodically
        if created % 5 == 0 or (created + skipped) == request.num_cards:
            with db.get_session() as session:
                job = session.get(GeneratorJob, job_id)
                job.payload = {**(job.payload or {}), "created": created, "skipped": skipped}
                job.updated_at = datetime.utcnow()
                session.commit()

    with db.get_session() as session:
        job = session.get(GeneratorJob, job_id)
        job.status = "COMPLETED"
        job.payload = {**(job.payload or {}), "created": created, "skipped": skipped}
        job.updated_at = datetime.utcnow()
        session.commit()
