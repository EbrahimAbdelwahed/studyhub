import json
import os
import random
import re
from typing import List, Optional, Tuple

from fastapi import HTTPException
from openai import OpenAI

from .models import Card, CardType, CardState, SyllabusUnit
from .scheduler import ensure_next_review


SYSTEM_PROMPT = """Sei un generatore di quesiti per l'ammissione a Medicina/Odontoiatria/Veterinaria.
Produci SOLO JSON valido con una lista 'cards'. Ogni card è MULTIPLE CHOICE (MCQ) o CLOZE.
- Prima pensa passo-passo (senza stampare il reasoning) su come costruire un esercizio realistico, poi restituisci solo il JSON finale.
- Lingua: italiano.
- Per MCQ crea 4 opzioni, una sola corretta, ordina in modo plausibile.
- Per CLOZE usa una sola parola/numero per 'cloze_part' per validare la risposta.
- Rispetta il tag DM418 indicato e il contesto del syllabus.
- Domande scenario-based, difficoltà medio-alta: richiedi 1-3 passaggi di ragionamento/calcolo, evita definizioni banali o pura memoria.
- Per numeri e risultati usa al massimo 3 cifre significative; evita precisioni irrealistiche (mai 5+ cifre).
- Ordina le opzioni MCQ in modo da mescolare la corretta (non deve essere sempre la prima); tutte le opzioni devono sembrare plausibili.
- Per espressioni matematiche/simboli usa LaTeX inline delimitato da $...$ (o \\(...\\)) così da essere renderizzato con KaTeX; non fare escape extra.
- Aggiungi sempre un campo 'comment': breve spiegazione (2-3 frasi) che aiuti lo studente a ragionare e ricordare il concetto. Evita di ripetere integralmente la domanda; spiega come arrivare alla risposta corretta.

Esempi reali (stile):
- Fisica MCQ:
  {
    "type": "MCQ",
    "syllabus_ref": "phys_units_vectors",
    "dm418_tag": "Oscillazioni e molle",
    "question": "Una molla orizzontale (massa trascurabile) ha attaccato un cubetto di legno di massa m=7 kg. Il periodo di oscillazione è T=\\pi/3 s. Quanto vale k in SI?",
    "cloze_part": "252",
    "mcq_options": ["252\\pi", "126", "28", "252"],
    "comment": "T=2\\pi\\sqrt{m/k} → k=4\\pi^2 m / T^2. Con m=7 kg e T=\\pi/3, k≈252 N/m."
  }
- Fisica CLOZE:
  {
    "type": "CLOZE",
    "syllabus_ref": "phys_fluids_archimede",
    "dm418_tag": "Galleggiamento e densità",
    "question": "Una zattera di legno (densità 0.8 g/cm^3) di base 4 m e altezza 0.50 m galleggia in acqua. Quale percentuale dell'altezza è immersa?",
    "cloze_part": "80",
    "mcq_options": null,
    "comment": "Spinta di Archimede → immersione = densità_relativa = 0.8. L'80% dell'altezza è sotto il pelo dell'acqua."
  }
- Chimica MCQ:
  {
    "type": "MCQ",
    "syllabus_ref": "chem_inorganic_nomenclature",
    "dm418_tag": "Sali e nomenclatura inorganica",
    "question": "Quale tra le seguenti è la formula chimica del solfato di bario?",
    "cloze_part": "BaSO4",
    "mcq_options": ["BaSO4", "BaSO3", "BaS", "BaHSO4"],
    "comment": "Il solfato è SO4^2− e il bario è Ba^2+: si combinano 1:1 → BaSO4."
  }
- Chimica CLOZE:
  {
    "type": "CLOZE",
    "syllabus_ref": "chem_electrochemistry",
    "dm418_tag": "Elettrochimica e termodinamica",
    "question": "La relazione tra ΔG e il potenziale di cella elettrochimica E è ΔG = …",
    "cloze_part": "-nFE",
    "mcq_options": null,
    "comment": "Per una cella, la variazione di energia libera è legata al lavoro elettrico: ΔG = -nFE."
  }
- Biologia MCQ:
  {
    "type": "MCQ",
    "syllabus_ref": "bio_genetics",
    "dm418_tag": "Genetica mendeliana e estensioni",
    "question": "Il sistema dei gruppi sanguigni AB0 è un classico esempio di:",
    "cloze_part": "Codominanza",
    "mcq_options": ["Codominanza", "Dominanza incompleta", "Eredità poligenica", "Penetranza incompleta"],
    "comment": "Gli alleli IA e IB sono entrambi espressi: fenotipo AB → codominanza."
  }
- Biologia CLOZE:
  {
    "type": "CLOZE",
    "syllabus_ref": "bio_citologia_mitosi",
    "dm418_tag": "Ciclo cellulare e mitosi",
    "question": "Lo stadio mitotico in cui i cromosomi si allineano sulla piastra equatoriale è …, quello in cui iniziano a separarsi è …",
    "cloze_part": "metafase, anafase",
    "mcq_options": null,
    "comment": "Metafase: allineamento; anafase: separazione delle cromatidi."
  }

Formato JSON di uscita:
{
  "cards": [
    {
      "type": "MCQ" | "CLOZE",
      "syllabus_ref": "<id unit>",
      "dm418_tag": "<TAG>",
      "question": "<testo>",
      "cloze_part": "<RISPOSTA CORRETTA ESATTA>",
      "mcq_options": ["A", "B", "C", "D"] or null,
      "comment": "<breve spiegazione>"
    }
  ]
}
IMPORTANTE: Per le card MCQ, il campo 'cloze_part' DEVE contenere la stringa esatta della risposta corretta (che deve essere presente anche in mcq_options)."""

_NUMERIC_REGEX = re.compile(r"^-?\d+(\.\d+)?([eE][-+]?\d+)?$")


def _normalize_question(question: str) -> str:
    """Lowercase and collapse whitespace to spot near-identical questions."""
    return " ".join((question or "").lower().split())


def _fallback_comment(question: str, correct: Optional[str], tag: str) -> str:
    base = f"Ripassa il principio chiave legato a {tag.replace('_', ' ')} e applicalo alla traccia."
    if correct:
        return f"{base} La risposta corretta è '{correct}': ragiona su come i dati del testo portano a questo valore."
    return f"{base} Individua le informazioni essenziali e collegale ai passaggi logici necessari."


def _is_numeric(text: Optional[str]) -> bool:
    if not text:
        return False
    stripped = text.strip()
    return bool(
        stripped
        and not any(c.isalpha() for c in stripped)
        and _NUMERIC_REGEX.match(stripped)
    )


def _format_numeric(text: str, sig_figs: int = 3) -> str:
    try:
        val = float(text)
    except Exception:
        return text
    # Use general format to keep significant figures and avoid trailing zeros
    formatted = f"{val:.{sig_figs}g}"
    return formatted


def _normalize_mcq_answer_and_options(cloze_value: Optional[str], options: Optional[List[str]]) -> Tuple[Optional[str], List[str]]:
    opts = options or []
    normalized_options: List[str] = []
    for opt in opts:
        normalized_options.append(_format_numeric(opt) if _is_numeric(opt) else opt)

    formatted_cloze = _format_numeric(cloze_value) if _is_numeric(cloze_value) else cloze_value

    if formatted_cloze:
        if formatted_cloze not in normalized_options:
            normalized_options.append(formatted_cloze)

    # Remove duplicates while preserving order
    deduped: List[str] = []
    seen = set()
    for opt in normalized_options:
        if opt in seen:
            continue
        seen.add(opt)
        deduped.append(opt)
    normalized_options = deduped

    if normalized_options:
        random.shuffle(normalized_options)

    if formatted_cloze and formatted_cloze not in normalized_options:
        normalized_options.append(formatted_cloze)
        random.shuffle(normalized_options)

    final_cloze = formatted_cloze or (normalized_options[0] if normalized_options else cloze_value)
    return final_cloze, normalized_options


def _build_user_prompt(
    units: List[SyllabusUnit],
    tags: Optional[List[str]],
    num_cards: int,
    exclude_questions: Optional[List[str]] = None,
) -> str:
    lines = []
    lines.append(f"Genera {num_cards} card aderenti al syllabus DM418.")
    lines.append("Rendi le domande scenario-based con dati/valori realistici e almeno 2 passaggi di ragionamento; evita definizioni banali.")
    lines.append("Imposta sempre dm418_tag uguale al topic principale (prima voce in 'topics') della unit del syllabus usata.")
    lines.append("Pensa brevemente prima di scrivere il JSON e poi restituisci solo il JSON.")
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


def _infer_mcq_answer(client: OpenAI, *, question: str, options: List[str], model: str) -> Optional[str]:
    """
    Ask the model to pick the correct option when cloze_part is missing.
    Returns the chosen option or None if inference fails.
    """
    if not options:
        return None

    try:
        completion = client.chat.completions.create(
            model=model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Seleziona l'unica risposta corretta tra le opzioni fornite. "
                        "Rispondi solo in JSON: {\"answer\": \"<option_text>\"}"
                    ),
                },
                {
                    "role": "user",
                    "content": f"Domanda: {question}\nOpzioni: {options}",
                },
            ],
        )
        content = completion.choices[0].message.content
        data = json.loads(content)
        answer = data.get("answer")
        if answer in options:
            return answer
    except Exception:
        # Silent fallback: better to return None than break the flow
        return None
    return None


def infer_mcq_answer(question: str, options: List[str], model: str = "gpt-5.1") -> Optional[str]:
    """Public helper to infer the correct MCQ option using the LLM."""
    client = _get_client()
    return _infer_mcq_answer(client, question=question, options=options, model=model)


def generate_cards(
    units: List[SyllabusUnit],
    tags: Optional[List[str]],
    num_cards: int,
    model: str = "gpt-5.1",
    exclude_questions: Optional[List[str]] = None,
) -> List[Card]:
    client = _get_client()
    unit_lookup = {u.id: (u.topics[0] if u.topics else u.title or u.id) for u in units}
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
        comment = c.get("comment")
        tag_value = unit_lookup.get(c.get("syllabus_ref")) or c.get("dm418_tag") or c.get("syllabus_ref")
        
        # Validation: MCQ must have a cloze_part (the correct answer)
        if c.get("type") == CardType.MCQ:
            if not cloze_value:
                # Try to infer the answer using the model to avoid corrupting the UI
                inferred = _infer_mcq_answer(client, question=c.get("question"), options=mcq_options or [], model=model)
                cloze_value = inferred or (mcq_options[0] if mcq_options else None)

            # Ensure cloze_value matches one of the options; if not, default to first option
            if mcq_options and cloze_value not in mcq_options:
                cloze_value = mcq_options[0]
            cloze_value, mcq_options = _normalize_mcq_answer_and_options(cloze_value, mcq_options)
        else:
            if _is_numeric(cloze_value):
                cloze_value = _format_numeric(cloze_value)
        if not comment:
            comment = _fallback_comment(c.get("question") or "", cloze_value, c.get("dm418_tag", ""))

        card = Card(
            syllabus_ref=c["syllabus_ref"],
            dm418_tag=tag_value,
            type=c["type"],
            question=c["question"],
            comment=comment,
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
