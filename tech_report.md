Capitolato Tecnico: Piattaforma MedSprint-19 (DM 418 Compliant)

Versione: 1.1
Data: 21 Novembre 2025
Obiettivo: Saturazione Syllabus Semestre Filtro (Medicina/Odontoiatria/Vet) in 19 giorni.
Metodologia: Gap Filling Iterativo + Aggressive Decay.

1. Analisi dei Requisiti e Syllabus Mapping

Il sistema non deve generare domande generiche. Ogni Card deve essere taggata con una specifica competenza estratta dagli "Obiettivi Formativi" del DM 418/2025 per permettere un tracciamento granulare delle lacune.

1.1 Tassonomia Competenze: Chimica e Propedeutica Biochimica (18 CFU)

Fonte: Syllabus DM 418 - Obiettivi Specifici

Il sistema classificherà le domande (sia Cloze che MCQ) in queste 5 categorie operative:

Tag Competenza

Descrizione Syllabus

Tipo di Task per l'Utente

CHEM_STOICHIOMETRY_PH

"Eseguire calcoli su concentrazioni, osmolarità e pH"

Calcolo numerico esatto (es. pH tampone, moli, pressione osmotica).

CHEM_STRUCTURAL_ORG

"Scrivere e riconoscere formule e legami dei composti organici"

Identificazione visiva o completamento nome IUPAC/comune di biomolecole.

CHEM_REACTIVITY_MECH

"Applicare meccanismi reazioni organiche a biochimica"

Previsione del prodotto di reazione (es. nucleofilo su carbonile).

CHEM_THERMO_BIO

"Applicare termodinamica ai processi biomedici"

Concettuale: Entalpia, Entropia, Energia Libera in contesto fisiologico.

CHEM_BOND_REDOX

"Riconoscere legami ed eseguire bilanciamenti"

Bilanciamento redox, n. ossidazione, configurazione elettronica.

1.2 Tassonomia Competenze: Fisica (18 CFU)

Fonte: Syllabus DM 418 - Obiettivi Specifici

Tag Competenza

Descrizione Syllabus

Tipo di Task per l'Utente

PHYS_NUMERICAL_SOLVING

"Risolvere problemi ed esercizi numerici"

Calcolo valore finale con unità di misura (es. portata, resistenza equivalente).

PHYS_BIO_APPLICATION

"Interpretare fenomeni molecolari negli organismi viventi"

Applicazione legge fisica a sistema biologico (es. Nernst, stenosi/aneurisma, lenti occhio).

PHYS_LAW_RECALL

"Descrivere le leggi fondamentali della fisica"

Rievocazione formula inversa o definizione teorica (es. enunciati termodinamica).

1.3 Tassonomia Competenze: Biologia (18 CFU)

Fonte: Syllabus DM 418 - Obiettivi Specifici

Tag Competenza

Descrizione Syllabus

Tipo di Task per l'Utente

BIO_MOLECULAR_MECH

"Illustrare meccanismi molecolari espressione/trasmissione"

Dettaglio fine: Enzimi coinvolti, fattori trascrizione, sequenza eventi (Replicazione/Traduzione).

BIO_CELL_TRAFFIC

"Comprendere compartimentalizzazione e traffico"

Sorting proteico, vescicole, segnali di localizzazione (NLS, SRP).

BIO_STRUCT_FUNC

"Descrivere struttura e funzione macromolecole"

Associazione univoca struttura-funzione (es. Citoscheletro, Matrice Extra-Cellulare).

BIO_DATA_INTERP

"Interpretare dati sperimentali"

Analisi logica: Grafici enzimatici, alberi genealogici, esperimenti classici.

2. Algoritmo di Scheduling: "Panic Mode Decay"

Dato il vincolo temporale (19 giorni), non possiamo usare algoritmi a lungo termine (Anki standard). L'algoritmo deve essere aggressivo nel breve periodo.

Macchina a Stati della Card

Ogni associazione (User, Card) possiede uno stato che determina il next_review_timestamp.

Stato NEW (Ingresso)

Le card generate dal Batch Notturno entrano qui.

Priorità: Bassa (riempitivo), a meno che non sia un Gap Filling urgente.

Stato CRITICAL (Panic Loop)

Trigger: Risposta Errata (Score -0.25) o Non So.

Azione: La card viene reinserita nella coda attiva tra 5-10 minuti.

Uscita: Richiede 1 risposta corretta per passare a CONFIRMATION.

Stato CONFIRMATION (Verifica Breve)

Trigger: Risposta Corretta provenendo da CRITICAL.

Azione: La card viene ripresentata dopo 30-60 minuti (nella stessa sessione o inizio successiva).

Logica: Verifica che non sia stata fortuna.

Stato CONSOLIDATION (Mantenimento)

Trigger: Risposta Corretta in CONFIRMATION o NEW.

Decay:

Step 1: 1 Giorno (Domani mattina).

Step 2: 2 Giorni (Alterni).

Step 3: 3 Giorni (Se il tempo lo permette).

Fallimento: Se si sbaglia qui -> Reset immediato a CRITICAL.

3. Architettura e UX Design

Il sistema è progettato per minimizzare la latenza e massimizzare il tempo di studio effettivo.

3.1 Componenti Core

Local Database (SQLite): File unico medsprint.db. Zero config, portabile, velocissimo.

Generator Engine (Python Script):

Input: JSON del Syllabus + Lista Errori del giorno.

Process: Chiama LLM (GPT-4o/Sonnet) per generare batch di domande taggate con la Tassonomia DM 418.

Output: Inserimento righe nel DB.

Quando gira: Di notte (pre-fetching) o su richiesta (Gap Filling).

Frontend (Streamlit/React): Vedi specifiche UX sotto.

Analytics Engine:

Calcola quali tag (CHEM_STOICHIOMETRY_PH, etc.) hanno > 20% errore.

Attiva il Generator Engine su quei tag specifici.

3.2 Data Schema (JSON Representation)

Questo è il contratto dati che useremo nel DB.

{
  "card_id": "uuid-v4",
  "syllabus_ref": "Chimica_UD3_Soluzioni",
  "dm418_tag": "CHEM_STOICHIOMETRY_PH", // Tassonomia definita sopra
  "type": "CLOZE", // o "MCQ"
  "content": {
    "question": "Calcolare il pH di una soluzione 0.01 M di HCl.",
    "cloze_part": "2", // Parola singola per verbatim match
    "mcq_options": null
  },
  "state": {
    "status": "CRITICAL",
    "streak": 0,
    "next_review": "2025-11-21T19:45:00"
  },
  "stats": {
    "total_attempts": 3,
    "failures": 2,
    "avg_time_s": 45
  }
}


3.3 Specifiche UX & Frontend

L'interfaccia utente deve seguire il principio "Navigation-Available, Distraction-Free".

3.3.1 Micro-Navigation (Persistent Sidebar)

Una barra laterale larga massimo 60-80px, sempre visibile (anche durante i Drill), contenente solo icone ad alto contrasto.

Stato: Non deve ricaricare la pagina (SPA behavior).

Voci Menu:

Dashboard (Home): Panoramica macro.

The Drill (Play): Ingresso rapido sessione attiva.

Forensics (Chart): Analisi dettagliata errori.

Syllabus Tree (List): Navigazione gerarchica argomenti.

Generator (Cpu): Pannello di controllo batch notturni.

3.3.2 Dashboard Analitica (Forensics)

Non una semplice lista di numeri, ma uno strumento diagnostico per decidere cosa studiare.

Syllabus Heatmap: Rappresentazione visuale (Treemap o Griglia) degli argomenti del Syllabus DM 418.

Verde Scuro: Mastery > 90% (Consolidation).

Giallo: In progress (New/Review).

Rosso: Critical rate > 30%.

Grigio: Untouched (Gap da colmare).

Metrica "Velocity": Cards completate/ora (per stimare se i 19 giorni bastano).

Error Taxonomy Chart: Grafico a barre orizzontali che mostra gli errori raggruppati per Competency Tag (es. "Stai sbagliando il 60% delle domande CHEM_STOICHIOMETRY_PH"). Questo serve a capire se il problema è la memoria o la capacità di calcolo.

4. Protocollo Operativo (Workflow Utente)

Setup Iniziale: Importazione Syllabus JSON (struttura argomenti).

Fase 1: Assessment (Analisi Lacune):

Generazione domande per ogni voce della sezione del syllabus

Esecuzione rapida.

Identificazione aree rosse (es. "Stoichiometry: 40% errate").

Fase 2: The Loop (Giornaliero):

Mattina (4h): analisi lacune, cards queue + nuove card sbagliate prima.



Pomeriggio (4h):  stessa cosa della mattina