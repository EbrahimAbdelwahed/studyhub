import sqlite3
import os

def inspect_db():
    db_path = "medsprint 2.db"
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("--- MCQs with missing cloze_part ---")
    query = "SELECT card_id, question, cloze_part, mcq_options FROM card WHERE type='MCQ' AND (cloze_part IS NULL OR cloze_part = '')"
    cursor.execute(query)
    rows = cursor.fetchall()
    
    print(f"Found {len(rows)} MCQs with missing cloze_part.")
    for row in rows[:5]:
        print(f"ID: {row[0]}")
        print(f"Question: {row[1]}")
        print(f"Cloze Part: '{row[2]}'")
        print(f"Options: {row[3]}")
        print("-" * 20)

    print("\n--- Total MCQs ---")
    cursor.execute("SELECT count(*) FROM card WHERE type='MCQ'")
    total = cursor.fetchone()[0]
    print(f"Total MCQs: {total}")

    conn.close()

if __name__ == "__main__":
    inspect_db()
