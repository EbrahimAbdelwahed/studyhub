import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

from sqlmodel import SQLModel, Field, Column, JSON


def _utcnow() -> datetime:
    return datetime.utcnow()


class CardType:
    CLOZE = "CLOZE"
    MCQ = "MCQ"


class CardState:
    NEW = "NEW"
    CRITICAL = "CRITICAL"
    CONFIRMATION = "CONFIRMATION"
    CONSOLIDATION = "CONSOLIDATION"


class SyllabusUnit(SQLModel, table=True):
    id: str = Field(primary_key=True)
    title: str
    exam_weight: Optional[int] = None
    primary_competency: Optional[str] = None
    secondary_competency: Optional[str] = None
    topics: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    subject: Optional[str] = None
    source: Optional[str] = None
    total_cfu: Optional[int] = None
    meta_version: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class Card(SQLModel, table=True):
    card_id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True, index=True)
    syllabus_ref: str = Field(foreign_key="syllabusunit.id")
    dm418_tag: str
    type: str
    question: str
    cloze_part: Optional[str] = None
    mcq_options: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    state: str = Field(default=CardState.NEW)
    streak: int = Field(default=0)
    consolidation_level: int = Field(default=0)
    next_review: Optional[datetime] = None
    total_attempts: int = Field(default=0)
    failures: int = Field(default=0)
    avg_time_s: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class Attempt(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    card_id: str = Field(foreign_key="card.card_id")
    outcome: str  # correct | wrong | skip
    duration_s: float
    created_at: datetime = Field(default_factory=_utcnow)


class GeneratorJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    status: str
    requested_tags: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    requested_units: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    num_cards: int = 0
    model: str = "gpt-5.1"
    payload: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
