from datetime import datetime, timedelta
from typing import List, Dict, Any

from sqlalchemy import func, case, select
from sqlmodel import Session

from .models import Card, Attempt, SyllabusUnit


def mastery_by_syllabus(session: Session) -> List[Dict[str, Any]]:
    stmt = (
        select(
            Card.syllabus_ref,
            SyllabusUnit.subject,
            SyllabusUnit.title,
            func.count().label("total"),
            func.count(case((Card.state == "CONSOLIDATION", 1))).label("consolidation"),
            func.count(case((Card.state == "CONFIRMATION", 1))).label("confirmation"),
        )
        .join(SyllabusUnit, SyllabusUnit.id == Card.syllabus_ref)
        .group_by(Card.syllabus_ref, SyllabusUnit.subject, SyllabusUnit.title)
    )
    results = session.exec(stmt).all()
    grouped: Dict[str, Dict[str, Any]] = {}
    for syllabus_ref, subject, title, total, consolidation, confirmation in results:
        if total == 0:
            continue
        mastery = ((consolidation * 1.0) + (confirmation * 0.5)) / total * 100
        status = "SAFE" if mastery >= 80 else "WARNING" if mastery >= 50 else "RISK"
        subj_key = subject or "Syllabus"
        grouped.setdefault(subj_key, {"id": subj_key, "children": []})
        grouped[subj_key]["children"].append(
            {
                "id": title or syllabus_ref,
                "value": total,
                "score": round(mastery, 1),
                "status": status,
            }
        )
    return list(grouped.values())


def error_taxonomy(session: Session, lookback_hours: int = 48) -> List[Dict[str, Any]]:
    cutoff = datetime.utcnow() - timedelta(hours=lookback_hours)
    stmt = (
        select(
            Card.dm418_tag,
            func.count(Attempt.id).label("attempts"),
            func.count(case((Attempt.outcome != "correct", 1))).label("failures"),
        )
        .join(Attempt, Attempt.card_id == Card.card_id)
        .where(Attempt.created_at >= cutoff)
        .group_by(Card.dm418_tag)
    )
    rows = session.exec(stmt).all()
    payload = []
    for tag, attempts, failures in rows:
        if attempts == 0:
            continue
        rate = failures / attempts * 100
        color = "#EF4444" if rate > 30 else "#F59E0B" if rate >= 10 else "#10B981"
        payload.append(
            {
                "tag": tag,
                "attempts": attempts,
                "failures": failures,
                "error_rate": round(rate, 1),
                "color": color,
            }
        )
    return payload


def velocity_trend(session: Session, days: int = 7) -> List[Dict[str, Any]]:
    today = datetime.utcnow().date()
    start_date = today - timedelta(days=days - 1)
    stmt = (
        select(
            func.date(Attempt.created_at).label("d"),
            func.count(Attempt.id).label("processed"),
        )
        .where(Attempt.created_at >= datetime.combine(start_date, datetime.min.time()))
        .group_by(func.date(Attempt.created_at))
    )
    rows = {str(row[0]): row[1] for row in session.exec(stmt).all()}
    total_cards = session.exec(select(func.count(Card.card_id))).one()
    if not isinstance(total_cards, int):
        total_cards = total_cards[0]
    daily_target = max(1, total_cards // 19)  # 19 giorni obiettivo

    payload = []
    for i in range(days):
        day = start_date + timedelta(days=i)
        processed = rows.get(day.isoformat(), 0)
        payload.append({"date": day.isoformat(), "cards_processed": processed, "target": daily_target})
    return payload
