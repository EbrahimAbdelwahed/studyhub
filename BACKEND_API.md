# MedSprint Backend (FastAPI)

## Setup rapido
- Python 3.11 o 3.12 (PyO3/pydantic-core non supporta 3.13/3.14), `pip install -r requirements.txt`
- Env: `OPENAI_API_KEY` (obbligatorio), opzionale `OPENAI_BASE_URL`, `MEDSPRINT_DB_PATH` (default `medsprint.db`).
- Avvio: `uvicorn app.main:app --reload --port 8000`
- Deploy serverless (Vercel):
  - Usa Postgres gestito e imposta `DATABASE_URL` (fallback a SQLite solo in locale).
  - File `api/index.py` + `mangum` forniscono l'handler AWS-style.
  - `vercel.json` è già pronto; configura i secret `DATABASE_URL`, `OPENAI_API_KEY`, opzionale `OPENAI_BASE_URL`.
  - Per il batch notturno usa un cron Vercel che chiama `POST /generator/run`.

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
  Body: `{ "units": ["chem_03_stoichiometry"], "tags": ["CHEM_STOICHIOMETRY_PH"], "num_cards": 10, "model": "gpt-5.1", "two_stage": false }`  
  Seleziona le unit (o tutte se `units` assente), chiama GPT-5.1 e inserisce le card. Response: `{ "created": 10, "job_id": 1 }`.  
  - `two_stage: true` abilita la generazione per-idea: 1) call LLM per brainstorm di idee/brief per unit/topic; 2) una call per card usando ciascun brief → maggiore qualità/precisione, meno batching.
- `GET /generator/jobs` (alias `/api/generator/jobs`) → storico job di generazione.
- `DELETE /generator/jobs/{job_id}/cards` → elimina tutte le card create da uno specifico job (rollback rapido di una generazione).
- `DELETE /cards/by-syllabus/{syllabus_ref}` → elimina tutte le card (più attempts/sketch) di una unit specifica.
- `GET /cards/next?limit=10&include_new=true`  
  Restituisce buffer ordinato per priorità `CRITICAL > CONFIRMATION > CONSOLIDATION > NEW`, includendo card con `next_review` entro 5 minuti o NEW.  
  Response (array): `{ card_id, syllabus_ref, dm418_tag, type, question, cloze_part, mcq_options, state, next_review }`.
- `POST /cards/{card_id}/answer`  
  Body: `{ "outcome": "correct|wrong|skip", "duration_s": 24.5, "user_answer": "..." }`  
  Aggiorna stato/scheduling, logga l'attempt (con risposta e commento) e, se l'esito è `wrong|skip`, restituisce il commento pre-generato della card (nessuna chiamata LLM qui).  
  - CLOZE numeriche: è accettata una tolleranza (2.5% o 0.01 assoluto) tra `user_answer` e `cloze_part` per evitare falsi negativi dovuti ad arrotondamenti.  
  Response: `{ card: <CardOut>, comment: "<tutor feedback if wrong>" }`.
- `GET /cards/wrong?limit=&history_limit=5`  
  Restituisce le card con almeno un errore (tutte se `limit` assente o <=0). Response: `[ { card, stats: { avg_time_s, total_attempts, failures, last_answered_at, last_duration_s, wrong_answers[] }, recent_attempts: [{ outcome, duration_s, created_at, given_answer, comment }] } ]`.
- `GET /cards/{card_id}/sketch` → `{ data_url, updated_at }` (se assente: `{ "data_url": null, "updated_at": null }`)  
- `PUT /cards/{card_id}/sketch` Body: `{ "data_url": "data:image/png;base64,..." }`  
- `DELETE /cards/{card_id}/sketch` → `{ deleted: true|false }`
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
  "comment": "Commento breve su come ragionare e sul concetto chiave.",
  "cloze_part": "2",
  "mcq_options": ["1", "2", "3", "4"],
  "state": "CRITICAL",
  "next_review": "2025-11-21T19:45:00Z"
}
```

## Generator (GPT-5.1)
- Prompt di sistema ottimizzato per domande ammissione Med/Odo/Vet, output solo JSON con lista `cards` e commenti sintetici.
- Input lato backend: lista `syllabus_units` (id, titolo, topics) + `tags` + `num_cards`.
- Richiede `OPENAI_API_KEY`; opzionale `OPENAI_BASE_URL` per proxy/self-host.
- Per formule e simboli matematici il generatore usa LaTeX inline (`$...$` o `\\(...\\)`), compatibile con KaTeX lato frontend.

## Performance UX hint
- `limit` di `/cards/next` default 10 per buffer continuo (target <10s per card coperto).
- Controllare `state` e `next_review` per mostrare badge e countdown.  
- Il front può chiamare `cards/next` in prefetch ogni few secondi per mantenere la coda.

## Note per frontend
- No auth/CORS custom: se serve CORS aggiungerlo in `app/main.py`.
- `skip` = "Non so" gestito come errore per scheduling e error rate.
- Colori errori conformi a Tailwind (`#EF4444`, `#F59E0B`, `#10B981`).
- Mastery status: `SAFE >=80`, `WARNING 50-79.9`, `RISK <50`.
- Il vecchio healer MCQ è stato rimosso. Usare il commento restituito da `/cards/{id}/answer` (pre-generato con la card) per mostrare feedback immediato se l'esito è `wrong|skip`.
- Le sketch note vanno salvate/riprese con gli endpoint `/cards/{id}/sketch` (data URL base64).
