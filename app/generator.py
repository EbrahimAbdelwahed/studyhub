import json
import os
from typing import List, Optional

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
  "cards": [
    {
      "type": "MCQ" | "CLOZE",
      "syllabus_ref": "<id unit>",
      "dm418_tag": "<TAG>",
      "question": "<testo>",
      "cloze_part": "<string or null>",
      "mcq_options": ["A", "B", "C", "D"] or null
    }
  ]
}"""


def _build_user_prompt(units: List[SyllabusUnit], tags: Optional[List[str]], num_cards: int) -> str:
    lines = []
    lines.append(f"Genera {num_cards} card aderenti al syllabus DM418.")
    if tags:
        lines.append(f"Usa questi TAG di competenza prioritari: {', '.join(tags)}.")
    lines.append("Syllabus selezionato:")
    for u in units:
        topics = "; ".join(u.topics or [])
        lines.append(f"- {u.id} ({u.title}) [{u.primary_competency}] -> Topics: {topics}")
    return "\n".join(lines)


def _get_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY mancante")
    base_url = os.environ.get("OPENAI_BASE_URL")
    return OpenAI(api_key=api_key, base_url=base_url)


def generate_cards(units: List[SyllabusUnit], tags: Optional[List[str]], num_cards: int, model: str = "gpt-5.1") -> List[Card]:
    client = _get_client()
    prompt = _build_user_prompt(units, tags, num_cards)
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
        card = Card(
            syllabus_ref=c["syllabus_ref"],
            dm418_tag=c["dm418_tag"],
            type=c["type"],
            question=c["question"],
            cloze_part=c.get("cloze_part"),
            mcq_options=c.get("mcq_options"),
            state=CardState.NEW,
        )
        ensure_next_review(card)
        cards.append(card)
    return cards
