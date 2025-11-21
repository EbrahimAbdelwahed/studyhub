3.4 Analytics & Metrics Engine (Specifiche Matematiche)

Il motore analitico non deve limitarsi a contare le risposte giuste, ma deve proiettare la fattibilità dell'obiettivo (19 giorni).

3.4.1 Definizioni Matematiche

1. Mastery Score (M 
s
​	
 ) per Argomento La Mastery non è la percentuale di risposte esatte storiche, ma lo stato attuale del deck. Misura quanto del syllabus è "al sicuro" (Consolidated).

M 
s
​	
 (Topic)= 
N 
Total
​	
 
N 
Consolidation
​	
 +(0.5⋅N 
Confirmation
​	
 )
​	
 ×100
Logica: Una card in CONSOLIDATION vale 1 punto. Una in CONFIRMATION vale 0.5 (è incerta). CRITICAL e NEW valgono 0.

Query SQL (concettuale):

SQL
SELECT 
  syllabus_ref,
  (COUNT(CASE WHEN state = 'CONSOLIDATION' THEN 1 END) * 1.0 + 
   COUNT(CASE WHEN state = 'CONFIRMATION' THEN 1 END) * 0.5) / COUNT(*) * 100 as mastery_score
FROM cards
GROUP BY syllabus_ref
2. Velocity (V) & Burn-up Chart Misura la velocità di processamento netta per stimare la fine.

Finestra Temporale (W): Ultimi 3 giorni (Rolling Window) per smussare i picchi di un singolo giorno "buono".

Formula:

V 
avg
​	
 = 
∑ 
i=t−3
t
​	
 Hours 
Study
​	
 
∑ 
i=t−3
t
​	
 (Cards 
New
​	
 +Cards 
Review
​	
 )
​	
 
Time to Completion (TTC):

TTC 
days
​	
 = 
V 
avg
​	
 ×Hours 
Daily_Budget
​	
 
N 
Total_Syllabus_Items
​	
 −N 
Done
​	
 
​	
 
3. Error Rate (E 
r
​	
 ) per Competency Tag Fondamentale per il feedback loop. Deve pesare di più gli errori recenti.

E 
r
​	
 (Tag)= 
Attempts 
Last_48h
​	
 
Failures 
Last_48h
​	
 
​	
 ×100
Nota: Usiamo una finestra di 48h. Se ho sbagliato una settimana fa ma ieri ho risposto giusto, l'errore è "sanato" e non deve apparire rosso nel grafico.

3.4.2 Soglie di Allerta (Thresholds)

Il frontend deve applicare queste classi CSS/Stati in base ai valori calcolati:

Metrica	Range Valore	Stato Sistema	Azione UI / Trigger
Error Rate (E 
r
​	
 )	>30%	CRITICAL (Red)	Trigger immediato Generator Engine: "Crea 10 varianti per questo Tag".
Error Rate (E 
r
​	
 )	10%−30%	WARNING (Yellow)	Suggerimento ripasso teorico nella Dashboard.
Error Rate (E 
r
​	
 )	<10%	SAFE (Green)	Nessuna azione.
Mastery (M 
s
​	
 )	<50% (a T-7gg)	RISK (Red)	Alert "Aumentare ore studio" sulla Dashboard.
Staleness	>3gg senza review	STALE (Grey)	Le card tornano in priorità Review forzata.
3.4.3 Strutture Dati per Visualizzazione (JSON Contracts)

Questi sono i formati esatti che le API di Analytics devono restituire al Frontend per popolare i grafici senza calcoli lato client.

A. Syllabus Heatmap (Treemap Data) Struttura gerarchica per visualizzare a colpo d'occhio le aree rosse.

JSON
[
  {
    "id": "Chimica",
    "children": [
      {
        "id": "Stechiometria",
        "value": 150, // Numero totale card (dimensione blocco)
        "score": 45.5, // Mastery Score (colore: Rosso < 50, Verde > 80)
        "status": "WARNING"
      },
      {
        "id": "Organica",
        "value": 200,
        "score": 92.0,
        "status": "SAFE"
      }
    ]
  },
  { "id": "Fisica", "children": [...] }
]
B. Error Taxonomy Chart (Horizontal Bar Chart) Per diagnosticare il "TIPO" di errore (non l'argomento).

JSON
[
  {
    "tag": "CHEM_STOICHIOMETRY_PH", // Label asse Y
    "attempts": 45, // Totale provate nelle ultime 48h
    "failures": 22, // Totale sbagliate
    "error_rate": 48.8, // (failures/attempts)*100 -> Determina lunghezza barra rossa
    "color": "#EF4444" // Tailwind red-500 (calcolato backend)
  },
  {
    "tag": "BIO_STRUCT_FUNC",
    "attempts": 120,
    "failures": 5,
    "error_rate": 4.1,
    "color": "#10B981" // Tailwind emerald-500
  }
]
C. Velocity Trend (Line Chart) Per capire se stiamo rallentando.

JSON
[
  { "date": "2025-11-18", "cards_processed": 120, "target": 100 },
  { "date": "2025-11-19", "cards_processed": 145, "target": 100 },
  { "date": "2025-11-20", "cards_processed": 80,  "target": 110 } // Sotto target -> Alert
]