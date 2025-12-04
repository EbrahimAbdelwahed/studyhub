from dotenv import load_dotenv
# Load environment variables from .env file immediately
load_dotenv()

import os
import json
import time
from typing import List, Optional
from sqlmodel import Session, select
from app.db import engine
from app.models import Card, CardType
from openai import OpenAI

# Initialize OpenAI client
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("Error: OPENAI_API_KEY not found in environment variables.")
    exit(1)

client = OpenAI(api_key=api_key, base_url=os.environ.get("OPENAI_BASE_URL"))

MODEL = "gpt-5.1"  # Or "gpt-4o"

FIX_PROMPT = """
Sei un esperto correttore di flashcards.
Analizza la card fornita e correggila seguendo RIGOROSAMENTE queste regole:

1. **CLOZE vs MCQ**:
   - Se è una CLOZE e la risposta ('cloze_part') è più lunga di 16 caratteri O contiene LaTeX complesso, TRASFORMALA IN MCQ (Multiple Choice).
   - Se è una CLOZE e la risposta è semplice (numero, parola, formula brevissima come "m*a"), mantienila CLOZE ma assicurati che 'cloze_part' usi '*' per moltiplicazione e '**' per potenza.

2. **LATEX**:
   - Sostituisci TUTTE le occorrenze di `\\(...\\)` con `$ ... $`.
   - Sostituisci TUTTE le occorrenze di `\\[...\\]` con `$$ ... $$`.
   - Assicurati che il LaTeX sia valido.

3. **CONTENUTO**:
   - Mantieni il significato didattico originale della domanda.
   - Se trasformi in MCQ, genera 3 distrattori plausibili.

Restituisci SOLO un JSON valido con la card corretta:
{
  "type": "MCQ" | "CLOZE",
  "question": "...",
  "cloze_part": "...",
  "mcq_options": ["...", "...", "...", "..."] (o null se CLOZE),
  "comment": "..."
}
"""

def needs_fix(card: Card) -> bool:
    # Check 1: Cloze length violation
    if card.type == CardType.CLOZE and card.cloze_part:
        if len(card.cloze_part) > 16:
            return True
        # Check for complex latex in cloze answer (simple * or ** is allowed, but \frac etc is not)
        if "\\" in card.cloze_part or "{" in card.cloze_part:
            return True

    # Check 2: Invalid LaTeX delimiters in question or options
    text_to_check = card.question
    if card.mcq_options:
        text_to_check += " ".join(card.mcq_options)
    
    if "\\(" in text_to_check or "\\[" in text_to_check:
        return True

    # Check 3: Missing backslash for frac (common error)
    # Looks for 'frac' not preceded by '\' and not preceded by 'd' (to allow \dfrac)
    import re
    if re.search(r"(?<!\\)(?<!d)frac", text_to_check):
        return True

    return False

def fix_card(card: Card) -> Optional[dict]:
    print(f"Fixing card {card.card_id}...")
    
    card_json = {
        "type": card.type,
        "question": card.question,
        "cloze_part": card.cloze_part,
        "mcq_options": card.mcq_options,
        "comment": card.comment
    }

    try:
        response = client.chat.completions.create(
            model=MODEL,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": FIX_PROMPT},
                {"role": "user", "content": f"Correggi questa card:\n{json.dumps(card_json)}"}
            ]
        )
        content = response.choices[0].message.content
        fixed_data = json.loads(content)
        return fixed_data
    except Exception as e:
        print(f"Failed to fix card {card.card_id}: {e}")
        return None

def main():
    print("Starting Flashcard Audit...")
    with Session(engine) as session:
        cards = session.exec(select(Card)).all()
        print(f"Found {len(cards)} cards total.")

        count_fixed = 0
        count_errors = 0

        for card in cards:
            if needs_fix(card):
                print(f"\n[VIOLATION FOUND] Card {card.card_id}")
                print(f"Type: {card.type}")
                print(f"Cloze: {card.cloze_part}")
                print(f"Question: {card.question[:50]}...")

                fixed_data = fix_card(card)
                
                if fixed_data:
                    # Update card in place
                    card.type = fixed_data.get("type", card.type)
                    card.question = fixed_data.get("question", card.question)
                    card.cloze_part = fixed_data.get("cloze_part", card.cloze_part)
                    card.mcq_options = fixed_data.get("mcq_options", card.mcq_options)
                    card.comment = fixed_data.get("comment", card.comment)
                    
                    session.add(card)
                    session.commit()
                    session.refresh(card)
                    print("[FIXED] Card updated successfully.")
                    count_fixed += 1
                else:
                    count_errors += 1
                
                # Sleep briefly to avoid rate limits if processing many
                time.sleep(0.5)

        print(f"\nAudit Complete.")
        print(f"Fixed: {count_fixed}")
        print(f"Errors: {count_errors}")

if __name__ == "__main__":
    main()
