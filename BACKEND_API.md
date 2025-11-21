# MedSprint Backend (FastAPI)

## Setup rapido
- Python 3.11 o 3.12 (PyO3/pydantic-core non supporta 3.13/3.14), `pip install -r requirements.txt`
- Env: `OPENAI_API_KEY` (obbligatorio), opzionale `OPENAI_BASE_URL`, `MEDSPRINT_DB_PATH` (default `medsprint.db`).
- Avvio: `uvicorn app.main:app --reload --port 8000`

## State Machine & Scheduling
- Stati: `NEW`, `CRITICAL`, `CONFIRMATION`, `CONSOLIDATION` (+ `consolidation_level` 1-3).
- Risposte: `correct` / `wrong` / `skip` (skip trattato come wrong).
- Transizioni:
  - `CRITICAL` + correct → `CONFIRMATION`, `next_review = now + 10 min`.
  - `CONFIRMATION` + correct → `CONSOLIDATION` level 1, `next_review = now + 1 giorno`.
  - `CONSOLIDATION` + correct → livello successivo (max 3), `next_review = {1g, 2g, 3g}`.
  - `NEW` + correct → `CONSOLIDATION` livello 1, `next_review = now + 1 giorno`.
  - Qualsiasi stato + wrong/skip → `CRITICAL`, `next_review = now + 1 min`, azzera streak/livello.
- Stats card: `total_attempts`, `failures`, `avg_time_s` aggiornati su `/cards/{id}/answer`.

## Endpoints (no auth)
- `POST /import/syllabus`  
  Body: `{ "syllabus": <contenuto chem.json o fisica.json> }`  
  Upsert dei `syllabus_units`.  
- `POST /generator/run`  
  Body: `{ "units": ["chem_03_stoichiometry"], "tags": ["CHEM_STOICHIOMETRY_PH"], "num_cards": 10, "model": "gpt-5.1" }`  
  Seleziona le unit (o tutte se `units` assente), chiama GPT-5.1 e inserisce le card. Response: `{ "created": 10, "job_id": 1 }`.
- `GET /cards/next?limit=10&include_new=true`  
  Restituisce buffer ordinato per priorità `CRITICAL > CONFIRMATION > CONSOLIDATION > NEW`, includendo card con `next_review` entro 5 minuti o NEW.  
  Response (array): `{ card_id, syllabus_ref, dm418_tag, type, question, cloze_part, mcq_options, state, next_review }`.
- `POST /cards/{card_id}/answer`  
  Body: `{ "outcome": "correct|wrong|skip", "duration_s": 24.5 }`  
  Aggiorna stato/scheduling e logga attempt. Response: card aggiornata con `next_review`.
- `GET /syllabus`  
  Restituisce la lista completa delle unit con metadati e topics. Usare per costruire mappe `syllabus_ref -> titolo/competenza` lato frontend.
- Analytics (contratti aderenti a `analytics_metrics.md`):
  - `GET /analytics/heatmap` → `[ { "id": "Chimica e Propedeutica Biochimica", "children": [ { "id": "<unit title>", "value": <tot card>, "score": <mastery>, "status": "SAFE|WARNING|RISK" } ] }, ... ]`
  - `GET /analytics/error-taxonomy` (48h) → `[ { "tag": "CHEM_STOICHIOMETRY_PH", "attempts": 12, "failures": 4, "error_rate": 33.3, "color": "#EF4444" }, ... ]`
  - `GET /analytics/velocity` (ultimi 7 giorni) → `[ { "date": "2025-11-18", "cards_processed": 120, "target": <tot_card/19> }, ... ]`

## Card Contract (DB e API)
```json
{
  "card_id": "uuid-v4",
  "syllabus_ref": "chem_03_stoichiometry",
  "dm418_tag": "CHEM_STOICHIOMETRY_PH",
  "type": "CLOZE | MCQ",
  "question": "Calcola il pH di una soluzione 0.01 M di HCl.",
  "cloze_part": "2",
  "mcq_options": ["1", "2", "3", "4"],
  "state": "CRITICAL",
  "next_review": "2025-11-21T19:45:00Z"
}
```

## Generator (GPT-5.1)
- Prompt di sistema ottimizzato per domande ammissione Med/Odo/Vet, output solo JSON con lista `cards`.
- Input lato backend: lista `syllabus_units` (id, titolo, topics) + `tags` + `num_cards`.
- Richiede `OPENAI_API_KEY`; opzionale `OPENAI_BASE_URL` per proxy/self-host.

## Performance UX hint
- `limit` di `/cards/next` default 10 per buffer continuo (target <10s per card coperto).
- Controllare `state` e `next_review` per mostrare badge e countdown.  
- Il front può chiamare `cards/next` in prefetch ogni few secondi per mantenere la coda.

## Note per frontend
- No auth/CORS custom: se serve CORS aggiungerlo in `app/main.py`.
- `skip` = "Non so" gestito come errore per scheduling e error rate.
- Colori errori conformi a Tailwind (`#EF4444`, `#F59E0B`, `#10B981`).
- Mastery status: `SAFE >=80`, `WARNING 50-79.9`, `RISK <50`.
