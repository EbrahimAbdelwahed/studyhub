import json
import os
import random
import re
from typing import List, Optional, Tuple, Dict, Any

from fastapi import HTTPException
from openai import OpenAI

from .models import Card, CardType, CardState, SyllabusUnit
from .scheduler import ensure_next_review


SYSTEM_PROMPT = """Sei un generatore di flashcards per l'ammissione a Medicina/Odontoiatria/Veterinaria.
Produci SOLO JSON valido con una lista 'cards'. Ogni card è MULTIPLE CHOICE (MCQ) o CLOZE.
- Obiettivo: Generare card per il ripasso rapido e il consolidamento di concetti.
- NON generare problemi complessi, calcoli lunghi o scenari intricati.
- Focalizzati su:
    1. CONCETTI TEORICI: Definizioni, principi, leggi, classificazioni, eccezioni.
    2. FORMULE: Richiesta della formula corretta, unità di misura, relazioni di proporzionalità (es. "Se raddoppia il raggio, come cambia la resistenza?").
    3. ARCHETIPI DI RISOLUZIONE: Step logici per risolvere tipologie standard di esercizi (es. "Qual è il primo passaggio per bilanciare una redox in ambiente acido?", "Quale legge di conservazione si applica in un urto anelastico?").

- Lingua: italiano.
- Per MCQ crea 4 opzioni, una sola corretta, ordina in modo plausibile.
- Per CLOZE:
    - La risposta ('cloze_part') DEVE essere una singola parola, un numero o una formula MOLTO BREVE (max 16 caratteri).
    - Se la risposta richiede una formula complessa o lunga, DEVI usare il tipo MCQ.
    - Per le formule semplici in 'cloze_part', usa '*' per la moltiplicazione e '**' per l'elevamento a potenza (es. "m*a", "x**2"). NON usare LaTeX nel campo 'cloze_part' se è una formula matematica da digitare.
- Rispetta il tag DM418 indicato e il contesto del syllabus.
- FORMATTAZIONE LATEX:
    - Usa ESCLUSIVAMENTE $...$ per LaTeX inline e $$...$$ per LaTeX display.
    - NON usare MAI \\(...\\) o \\[...\\] perché il parser non li supporta.
- Aggiungi sempre un campo 'comment': breve spiegazione (2-3 frasi) che rinforzi il concetto o la regola.

Esempi ideali:
- Fisica (Formula/Relazione):
  {
    "type": "MCQ",
    "syllabus_ref": "phys_fluid_dynamics",
    "dm418_tag": "Fluidodinamica",
    "question": "Nell'equazione di continuità per un fluido ideale, come varia la velocità $v$ se la sezione $S$ del condotto si dimezza?",
    "cloze_part": "Raddoppia",
    "mcq_options": ["Raddoppia", "Dimezza", "Quadruplica", "Resta invariata"],
    "comment": "L'equazione è $S_1 v_1 = S_2 v_2$. Se $S_2 = S_1/2$, allora $v_2 = 2v_1$."
  }
- Chimica (Teoria/Eccezione):
  {
    "type": "MCQ",
    "syllabus_ref": "chem_periodic_table",
    "dm418_tag": "Proprietà periodiche",
    "question": "Quale tra i seguenti elementi ha l'energia di prima ionizzazione più elevata?",
    "cloze_part": "Elio",
    "mcq_options": ["Elio", "Idrogeno", "Fluoro", "Neon"],
    "comment": "L'Elio ha la configurazione stabile $1s^2$ e il raggio atomico più piccolo, rendendo difficilissima la rimozione di un elettrone."
  }
- Biologia (Archetipo/Processo):
  {
    "type": "CLOZE",
    "syllabus_ref": "bio_metabolism",
    "dm418_tag": "Glicolisi",
    "question": "Qual è l'enzima chiave che regola la velocità della glicolisi catalizzando la fosforilazione del fruttosio-6-fosfato?",
    "cloze_part": "Fosfofruttochinasi",
    "mcq_options": null,
    "comment": "La fosfofruttochinasi-1 (PFK-1) è il principale punto di controllo allosterico della glicolisi."
  }
- Matematica (Formula Semplice Cloze):
  {
    "type": "CLOZE",
    "syllabus_ref": "math_algebra",
    "dm418_tag": "Prodotti notevoli",
    "question": "Completa il quadrato di binomio: $(a+b)^2 = a^2 + 2ab + ...$",
    "cloze_part": "b**2",
    "mcq_options": null,
    "comment": "Il quadrato di binomio è uguale al quadrato del primo termine, più il doppio prodotto, più il quadrato del secondo."
  }

Formato JSON di uscita:
{
  "cards": [
    {
      "type": "MCQ" | "CLOZE",
      "syllabus_ref": "<id unit>",
      "dm418_tag": "<TAG>",
      "question": "<testo con LaTeX $...$>",
      "cloze_part": "<RISPOSTA CORRETTA ESATTA (max 16 chars)>",
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


def _nearest_numeric_option(cloze_value: Optional[str], options: List[str]) -> Optional[str]:
    if cloze_value is None:
        return None
    if not options:
        return cloze_value
    try:
        target = float(cloze_value)
    except Exception:
        return cloze_value
    best = None
    best_diff = None
    for opt in options:
        try:
            val = float(opt)
        except Exception:
            continue
        diff = abs(val - target)
        if best_diff is None or diff < best_diff:
            best_diff = diff
            best = opt
    return best or cloze_value


def _build_user_prompt(
    units: List[SyllabusUnit],
    tags: Optional[List[str]],
    num_cards: int,
    exclude_questions: Optional[List[str]] = None,
) -> str:
    lines = []
    lines.append(f"Genera {num_cards} card aderenti al syllabus DM418.")
    lines.append("Focalizzati su TEORIA, FORMULE e ARCHETIPI DI RISOLUZIONE.")
    lines.append("EVITA ASSOLUTAMENTE problemi con calcoli complessi o scenari lunghi.")
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
    job_id: Optional[int] = None,
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
            # Align numeric correct answer to nearest option to avoid rounding mismatches
            if _is_numeric(cloze_value):
                nearest = _nearest_numeric_option(cloze_value, mcq_options or [])
                if nearest:
                    cloze_value = nearest
        else:
            if _is_numeric(cloze_value):
                cloze_value = _format_numeric(cloze_value)
        if not comment:
            comment = _fallback_comment(c.get("question") or "", cloze_value, c.get("dm418_tag", ""))

        card = Card(
            syllabus_ref=c["syllabus_ref"],
            dm418_tag=tag_value,
            generator_job_id=job_id,
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
    job_id: Optional[int] = None,
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
            job_id=job_id,
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


def generate_ideas(
    units: List[SyllabusUnit],
    tags: Optional[List[str]],
    num_ideas: int,
    model: str = "gpt-5.1",
) -> List[Dict[str, Any]]:
    client = _get_client()
    lines = []
    lines.append(f"Proponi {num_ideas} idee di flashcards (Teoria, Formule, Archetipi) aderenti al syllabus DM418.")
    if tags:
        lines.append(f"Dai priorità a questi topic/tag: {', '.join(tags)}.")
    lines.append("Non scrivere le domande complete; fornisci solo un breve brief per ciascuna idea (1-2 frasi) con il focus concettuale.")
    lines.append("Evita idee per problemi complessi o calcoli lunghi.")
    lines.append("Output JSON: {\"ideas\": [ {\"syllabus_ref\": \"...\", \"topic\": \"...\", \"idea\": \"breve descrizione\"} ] }")
    lines.append("Syllabus selezionato:")
    for u in units:
        topics = "; ".join(u.topics or [])
        lines.append(f"- {u.id} ({u.title}) -> Topics: {topics}")
    prompt = "\n".join(lines)
    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Sei un planner di flashcards. Genera idee compatte per card di Teoria, Formule o Archetipi."},
                {"role": "user", "content": prompt},
            ],
        )
        payload = resp.choices[0].message.content
        data = json.loads(payload)
        ideas = data.get("ideas", [])
        return ideas
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Errore generazione idee: {exc}")


def generate_card_from_idea(
    idea: Dict[str, Any],
    unit_lookup: Dict[str, SyllabusUnit],
    model: str = "gpt-5.1",
    job_id: Optional[int] = None,
) -> Card:
    client = _get_client()
    syllabus_ref = idea.get("syllabus_ref")
    unit = unit_lookup.get(syllabus_ref)
    if not unit:
        raise HTTPException(status_code=400, detail=f"Syllabus unit {syllabus_ref} non trovata per idea {idea}")
    topic = idea.get("topic") or (unit.topics[0] if unit.topics else unit.title or unit.id)
    brief = idea.get("idea") or ""

    prompt_lines = []
    prompt_lines.append("Crea 1 card aderente al brief dato, rispettando il format JSON richiesto.")
    prompt_lines.append(f"Syllabus unit: {unit.id} ({unit.title})")
    prompt_lines.append(f"Topics: {', '.join(unit.topics or [])}")
    prompt_lines.append(f"Brief: {brief}")
    prompt = "\n".join(prompt_lines)

    try:
        response = client.chat.completions.create(
            model=model,
            temperature=0.25,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Errore chiamata OpenAI (card da idea): {exc}")

    content = response.choices[0].message.content
    try:
        data = json.loads(content)
        payload_cards = data.get("cards", [])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Parsing risposta OpenAI (idea) fallito: {exc}")

    if not payload_cards:
        raise HTTPException(status_code=500, detail="Nessuna card generata dall'idea")

    # Riusa la pipeline standard ma iniettando job_id e lookup
    cards: List[Card] = []
    for c in payload_cards:
        cloze_value = c.get("cloze_part")
        mcq_options = c.get("mcq_options")
        comment = c.get("comment")
        tag_value = (unit.topics[0] if unit.topics else unit.title or unit.id)

        if c.get("type") == CardType.MCQ:
            if not cloze_value:
                inferred = _infer_mcq_answer(client, question=c.get("question"), options=mcq_options or [], model=model)
                cloze_value = inferred or (mcq_options[0] if mcq_options else None)
            if mcq_options and cloze_value not in mcq_options:
                cloze_value = mcq_options[0]
            cloze_value, mcq_options = _normalize_mcq_answer_and_options(cloze_value, mcq_options)
            if _is_numeric(cloze_value):
                nearest = _nearest_numeric_option(cloze_value, mcq_options or [])
                if nearest:
                    cloze_value = nearest
        else:
            if _is_numeric(cloze_value):
                cloze_value = _format_numeric(cloze_value)
        if not comment:
            comment = _fallback_comment(c.get("question") or "", cloze_value, c.get("dm418_tag", ""))

        card = Card(
            syllabus_ref=c.get("syllabus_ref") or unit.id,
            dm418_tag=tag_value,
            generator_job_id=job_id,
            type=c["type"],
            question=c["question"],
            comment=comment,
            cloze_part=cloze_value,
            mcq_options=mcq_options,
            state=CardState.NEW,
        )
        ensure_next_review(card)
        cards.append(card)
    return cards[0]
