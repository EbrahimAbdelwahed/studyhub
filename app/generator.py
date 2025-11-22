import json
import os
from typing import List, Optional, Tuple

from fastapi import HTTPException
from openai import OpenAI

from .models import Card, CardType, CardState, SyllabusUnit
from .scheduler import ensure_next_review


SYSTEM_PROMPT = """Sei un generatore di quesiti per l'ammissione a Medicina/Odontoiatria/Veterinaria.
Produci SOLO JSON valido con una lista 'cards'. Ogni card è MULTIPLE CHOICE (MCQ) o CLOZE.
- Lingua: italiano.
- Per MCQ crea 4 opzioni, una sola corretta, ordina in modo plausibile.
- Per CLOZE usa una sola parola/numero per 'cloze_part' per validare la risposta.
- Rispetta il tag DM418 indicato e il contesto del syllabus.
- Domande concise, difficoltà medio-alta, niente trivia fuori syllabus.
Formato JSON di uscita:
    {
      "type": "MCQ" | "CLOZE",
      "syllabus_ref": "<id unit>",
      "dm418_tag": "<TAG>",
      "question": "<testo>",
      "cloze_part": "<RISPOSTA CORRETTA ESATTA>",
      "mcq_options": ["A", "B", "C", "D"] or null
    }
  ]
}
IMPORTANTE: Per le card MCQ, il campo 'cloze_part' DEVE contenere la stringa esatta della risposta corretta (che deve essere presente anche in mcq_options)."""


def _normalize_question(question: str) -> str:
    """Lowercase and collapse whitespace to spot near-identical questions."""
    return " ".join((question or "").lower().split())


def _build_user_prompt(
    units: List[SyllabusUnit],
    tags: Optional[List[str]],
    num_cards: int,
    exclude_questions: Optional[List[str]] = None,
) -> str:
    lines = []
    lines.append(f"Genera {num_cards} card aderenti al syllabus DM418.")
    if tags:
        lines.append(f"Usa questi TAG di competenza prioritari: {', '.join(tags)}.")
    lines.append("Syllabus selezionato:")
    for u in units:
        topics = "; ".join(u.topics or [])
        lines.append(f"- {u.id} ({u.title}) [{u.primary_competency}] -> Topics: {topics}")
    if exclude_questions:
        lines.append("Non ripetere domande identiche o quasi identiche a queste già presenti:")
        for q in exclude_questions[:20]:  # limita il prompt
            lines.append(f"- {q}")
    return "\n".join(lines)


def _get_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY mancante")
    base_url = os.environ.get("OPENAI_BASE_URL")
    return OpenAI(api_key=api_key, base_url=base_url)


def generate_cards(
    units: List[SyllabusUnit],
    tags: Optional[List[str]],
    num_cards: int,
    model: str = "gpt-5.1",
    exclude_questions: Optional[List[str]] = None,
) -> List[Card]:
    client = _get_client()
    prompt = _build_user_prompt(units, tags, num_cards, exclude_questions)
    try:
        response = client.chat.completions.create(
            model=model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
    except Exception as exc:  # pragma: no cover - network dependent
        raise HTTPException(status_code=502, detail=f"Errore chiamata OpenAI: {exc}") from exc

    content = response.choices[0].message.content
    try:
        data = json.loads(content)
        payload_cards = data.get("cards", [])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Parsing risposta OpenAI fallito: {exc}")

    cards: List[Card] = []
    for c in payload_cards:
        cloze_value = c.get("cloze_part")
        mcq_options = c.get("mcq_options")
        
        # Validation: MCQ must have a cloze_part (the correct answer)
        if c.get("type") == CardType.MCQ:
            if not cloze_value:
                # If the LLM failed to provide the answer key, we cannot use this card safely.
                # We skip it or log it. For now, let's skip adding it to the list.
                print(f"Skipping MCQ card due to missing cloze_part (answer key): {c.get('question')}")
                continue
            
            # Optional: Verify cloze_value is actually in mcq_options
            if mcq_options and cloze_value not in mcq_options:
                 # Try to fuzzy match or just warn? Let's trust the LLM but maybe strip whitespace
                 pass

        card = Card(
            syllabus_ref=c["syllabus_ref"],
            dm418_tag=c["dm418_tag"],
            type=c["type"],
            question=c["question"],
            cloze_part=cloze_value,
            mcq_options=mcq_options,
            state=CardState.NEW,
        )
        ensure_next_review(card)
        cards.append(card)
    return cards


def generate_unique_cards(
    *,
    units: List[SyllabusUnit],
    tags: Optional[List[str]],
    num_cards: int,
    model: str = "gpt-5.1",
    existing_questions: Optional[List[str]] = None,
    max_rounds: int = 3,
) -> Tuple[List[Card], List[str]]:
    """
    Generate cards while filtering duplicates against existing questions and within the batch.
    Returns (new_cards, skipped_questions).
    """
    seen_questions = {_normalize_question(q): q for q in (existing_questions or [])}
    cards: List[Card] = []
    skipped: List[str] = []
    recent_for_prompt: List[str] = list(existing_questions or [])[-20:]

    for _ in range(max_rounds):
        if len(cards) >= num_cards:
            break

        remaining = num_cards - len(cards)
        batch = generate_cards(
            units=units,
            tags=tags,
            num_cards=remaining,
            model=model,
            exclude_questions=recent_for_prompt,
        )

        if not batch:
            break

        for card in batch:
            key = _normalize_question(card.question)
            if key in seen_questions:
                skipped.append(card.question)
                continue

            seen_questions[key] = card.question
            recent_for_prompt.append(card.question)
            if len(recent_for_prompt) > 30:
                recent_for_prompt = recent_for_prompt[-30:]

            ensure_next_review(card)
            cards.append(card)

    return cards, skipped
