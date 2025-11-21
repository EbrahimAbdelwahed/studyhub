from datetime import datetime, timedelta
from typing import Optional

from .models import Card, CardState


CRITICAL_DELAY = timedelta(minutes=1)
CONFIRMATION_DELAY = timedelta(minutes=10)
CONSOLIDATION_STEPS = [timedelta(days=1), timedelta(days=2), timedelta(days=3)]


def _consolidation_delay(level: int) -> timedelta:
    idx = max(0, min(level - 1, len(CONSOLIDATION_STEPS) - 1))
    return CONSOLIDATION_STEPS[idx]


def ensure_next_review(card: Card, now: Optional[datetime] = None) -> None:
    now = now or datetime.utcnow()
    if card.next_review is None:
        if card.state in (CardState.CRITICAL, CardState.CONFIRMATION):
            card.next_review = now + CRITICAL_DELAY if card.state == CardState.CRITICAL else now + CONFIRMATION_DELAY
        elif card.state == CardState.CONSOLIDATION:
            level = card.consolidation_level if card.consolidation_level > 0 else 1
            card.next_review = now + _consolidation_delay(level)
        else:
            card.next_review = now


def update_card_state(card: Card, outcome: str, now: Optional[datetime] = None) -> None:
    """Mutates card with new state/next_review according to Panic Mode Decay."""
    now = now or datetime.utcnow()

    if outcome == "correct":
        if card.state == CardState.CRITICAL:
            card.state = CardState.CONFIRMATION
            card.streak = 1
            card.next_review = now + CONFIRMATION_DELAY
        elif card.state == CardState.CONFIRMATION:
            card.state = CardState.CONSOLIDATION
            card.consolidation_level = 1
            card.streak = 2
            card.next_review = now + _consolidation_delay(1)
        elif card.state == CardState.CONSOLIDATION:
            card.consolidation_level = min(card.consolidation_level + 1, 3) if card.consolidation_level else 1
            card.state = CardState.CONSOLIDATION
            card.streak += 1
            card.next_review = now + _consolidation_delay(card.consolidation_level)
        else:  # NEW
            card.state = CardState.CONSOLIDATION
            card.consolidation_level = 1
            card.streak = 1
            card.next_review = now + _consolidation_delay(1)
    else:  # wrong or skip
        card.streak = 0
        card.consolidation_level = 0
        card.state = CardState.CRITICAL
        card.next_review = now + CRITICAL_DELAY


def score_delta(outcome: str) -> float:
    return 1.0 if outcome == "correct" else -0.25
