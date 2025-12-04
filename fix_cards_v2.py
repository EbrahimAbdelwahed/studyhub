from dotenv import load_dotenv
# Load environment variables from .env file immediately
load_dotenv()

import os
import json
import time
import logging
from typing import List, Optional, Dict, Any
from sqlmodel import Session, select
from app.db import engine
from app.models import Card, CardType
from openai import OpenAI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("audit.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    logger.error("OPENAI_API_KEY not found in environment variables.")
    exit(1)

client = OpenAI(api_key=api_key, base_url=os.environ.get("OPENAI_BASE_URL"))

MODEL = "gpt-5.1"

AUDIT_PROMPT = """
Sei un QA (Quality Assurance) per flashcards scientifiche.
Analizza la card fornita e determina se è VALIDA o INVALIDA basandoti su queste regole RIGOROSE:

1. **LaTeX**:
   - Il LaTeX deve essere valido e renderizzabile.
   - I comandi devono avere il backslash (es. `\\frac`, `\\sqrt`, `\\text`). Se vedi `frac`, `sqrt`, `text` senza backslash, è INVALIDA.
   - I delimitatori devono essere ESCLUSIVAMENTE `$...$` (inline) o `$$...$$` (display). Se vedi `\\(`, `\\[`, è INVALIDA.
   - Parentesi bilanciate.

2. **Cloze**:
   - Se `type` è CLOZE, la risposta (`cloze_part`) deve essere BREVE (max 16 caratteri).
   - Se la risposta è una formula complessa (frazioni, integrali, ecc.), è INVALIDA (dovrebbe essere MCQ).
   - Se la risposta è una formula semplice, deve usare `*` per moltiplicazione e `**` per potenza (es. `m*a`, `x**2`). Se usa LaTeX nella risposta cloze, è INVALIDA.

3. **Contenuto**:
   - La domanda deve essere chiara e in italiano.

Rispondi SOLO con un JSON:
{
  "status": "VALID" | "INVALID",
  "reason": "Spiegazione breve se INVALID, null se VALID"
}
"""

FIX_PROMPT = """
Sei un esperto correttore di flashcards.
Correggi la card fornita per renderla conforme agli standard.

Regole di Correzione:
1. **LaTeX**: Usa SOLO `$...$` e `$$...$$`. Aggiungi backslash mancanti (es. `frac` -> `\\frac`).
2. **Cloze vs MCQ**:
   - Se era CLOZE ma la risposta è lunga/complessa, convertila in MCQ con 3 distrattori plausibili.
   - Se la risposta è semplice, mantieni CLOZE ma usa sintassi `*` e `**` per la matematica.
3. **Qualità**: Migliora la chiarezza se necessario.

Restituisci SOLO il JSON della card corretta:
{
  "type": "MCQ" | "CLOZE",
  "question": "...",
  "cloze_part": "...",
  "mcq_options": ["...", ...] (o null),
  "comment": "..."
}
"""

def audit_card(card: Card) -> Dict[str, Any]:
    card_json = {
        "type": card.type,
        "question": card.question,
        "cloze_part": card.cloze_part,
        "mcq_options": card.mcq_options
    }
    
    try:
        response = client.chat.completions.create(
            model=MODEL,
            temperature=0.0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": AUDIT_PROMPT},
                {"role": "user", "content": json.dumps(card_json)}
            ]
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"Audit failed for card {card.card_id}: {e}")
        return {"status": "ERROR", "reason": str(e)}

def fix_card(card: Card, reason: str) -> Optional[Dict[str, Any]]:
    logger.info(f"Fixing card {card.card_id} (Reason: {reason})...")
    
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
                {"role": "user", "content": f"Correggi questa card (Problema rilevato: {reason}):\n{json.dumps(card_json)}"}
            ]
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"Fix failed for card {card.card_id}: {e}")
        return None

def main():
    import argparse
    from datetime import datetime, timedelta

    parser = argparse.ArgumentParser(description="Audit and fix flashcards.")
    parser.add_argument("--hours", type=int, help="Process only cards created in the last N hours.")
    args = parser.parse_args()

    logger.info("Starting LLM-Based Flashcard Audit (v2)...")
    
    with Session(engine) as session:
        query = select(Card)
        
        if args.hours:
            cutoff_time = datetime.utcnow() - timedelta(hours=args.hours)
            query = query.where(Card.created_at >= cutoff_time)
            logger.info(f"Filtering for cards created after {cutoff_time} (last {args.hours} hours).")
        
        cards = session.exec(query).all()
        logger.info(f"Found {len(cards)} cards to audit.")

        count_valid = 0
        count_fixed = 0
        count_errors = 0

        for i, card in enumerate(cards):
            # Use \r for progress bar effect in console if desired, but simple logging is safer for persistence
            if i % 5 == 0:
                logger.info(f"Progress: [{i+1}/{len(cards)}] Auditing {card.card_id}...")
            
            audit_result = audit_card(card)
            
            if audit_result.get("status") == "INVALID":
                reason = audit_result.get("reason")
                logger.warning(f"[INVALID] {card.card_id}: {reason}")
                
                fixed_data = fix_card(card, reason)
                if fixed_data:
                    card.type = fixed_data.get("type", card.type)
                    card.question = fixed_data.get("question", card.question)
                    card.cloze_part = fixed_data.get("cloze_part", card.cloze_part)
                    card.mcq_options = fixed_data.get("mcq_options", card.mcq_options)
                    card.comment = fixed_data.get("comment", card.comment)
                    
                    session.add(card)
                    session.commit()
                    session.refresh(card)
                    logger.info(f"[FIXED] Card {card.card_id} updated.")
                    count_fixed += 1
                else:
                    logger.error(f"[ERROR] Could not fix card {card.card_id}.")
                    count_errors += 1
            elif audit_result.get("status") == "VALID":
                count_valid += 1
            else:
                count_errors += 1
            
            # Rate limit protection
            time.sleep(0.2)

        logger.info("Audit Complete.")
        logger.info(f"Valid: {count_valid}")
        logger.info(f"Fixed: {count_fixed}")
        logger.info(f"Errors: {count_errors}")

if __name__ == "__main__":
    main()
