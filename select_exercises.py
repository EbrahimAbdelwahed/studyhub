import json
import random

def load_data(filename):
    data = []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    data.append(json.loads(line))
    except FileNotFoundError:
        print(f"Errore: File '{filename}' non trovato.")
        exit(1)
    return data

import re

def get_category(topic):
    t = topic.lower()
    
    def matches(patterns, text):
        for p in patterns:
            if re.search(p, text): return True
        return False

    g1_pats = [r"fluidi", r"idrostatica", r"cinematica", r"dinamica", r"oscillazioni"]
    g2_pats = [r"unità", r"dimensioni", r"termodinamica", r"\bgas\b"]
    g3_pats = [r"elettricità", r"\bcorrenti\b", r"onde", r"acustiche", r"\bem\b"]
    
    if matches(g2_pats, t): return 2
    if matches(g3_pats, t): return 3
    if matches(g1_pats, t): return 1
    return 0

def select_balanced(items, target_n):
    if not items: return []
    if len(items) <= target_n: return items
    
    diff1 = [x for x in items if x.get('difficulty') == 1]
    diff2 = [x for x in items if x.get('difficulty') == 2]
    diff3 = [x for x in items if x.get('difficulty') == 3]
    
    n1 = int(target_n * 0.2)
    n2 = int(target_n * 0.5)
    n3 = target_n - n1 - n2
    
    selected = []
    # Select trying to meet targets
    s1 = random.sample(diff1, min(len(diff1), n1))
    s2 = random.sample(diff2, min(len(diff2), n2))
    s3 = random.sample(diff3, min(len(diff3), n3))
    
    selected.extend(s1 + s2 + s3)
    
    # Fill remaining if needed
    needed = target_n - len(selected)
    if needed > 0:
        remaining = [x for x in items if x not in selected]
        selected.extend(random.sample(remaining, min(len(remaining), needed)))
        
    return selected

def main():
    filename = "analysis_progress.jsonl"
    all_exercises = load_data(filename)
    
    g1, g2, g3 = [], [], []
    for ex in all_exercises:
        cat = get_category(ex.get('topic', ''))
        if cat == 1: g1.append(ex)
        elif cat == 2: g2.append(ex)
        elif cat == 3: g3.append(ex)
        
    # Targets: 30% (6), 30% (6), 40% (8) -> Total 20
    sel1 = select_balanced(g1, 6)
    sel2 = select_balanced(g2, 6)
    sel3 = select_balanced(g3, 8)
    
    final_selection = sel1 + sel2 + sel3
    
    # Fallback if total < 20
    if len(final_selection) < 20:
        print(f"Avviso: Trovati solo {len(final_selection)} esercizi idonei ai criteri (meno di 20).")
        # We do not fill from non-matching topics.
            
    print(f"Selezionati {len(final_selection)} esercizi:\n")
    for ex in final_selection:
        print(f"ID: {ex.get('id')} | Chapter: {ex.get('chapter')} | Topic: {ex.get('topic')} | Difficulty: {ex.get('difficulty')} | Master Eq: {ex.get('master_equation')}")

if __name__ == "__main__":
    main()
