import json
import random
import re
import os
from typing import List, Dict, Optional
from pydantic import BaseModel

class QuizProblem(BaseModel):
    id: str
    chapter: str
    topic: str
    difficulty: int
    master_equation: Optional[str] = None
    text: str
    answer: Optional[str] = None
    options: Optional[List[str]] = None

class QuizService:
    def __init__(self, jsonl_path: str, book_path: str, final_db_path: str = None):
        self.jsonl_path = jsonl_path
        self.book_path = book_path
        self.final_db_path = final_db_path
        self.exercises = self._load_exercises()
        self.book_content = self._load_book()
        self.chapter_indices = self._index_chapters()

    def _load_exercises(self) -> List[Dict]:
        # 1. Try Final Database (JSON Array)
        if self.final_db_path and os.path.exists(self.final_db_path):
            print(f"Loading from Final DB: {self.final_db_path}")
            try:
                with open(self.final_db_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError as e:
                print(f"Error reading final DB: {e}")
        
        # 2. Fallback to Progress JSONL
        data = []
        if not os.path.exists(self.jsonl_path):
            print(f"Warning: {self.jsonl_path} not found")
            return []
            
        print(f"Loading from Progress JSONL: {self.jsonl_path}")
        with open(self.jsonl_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        data.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        return data

    def _load_book(self) -> str:
        if not os.path.exists(self.book_path):
            print(f"Warning: {self.book_path} not found")
            return ""
        with open(self.book_path, 'r', encoding='utf-8') as f:
            return f.read()

    def _index_chapters(self) -> Dict[str, int]:
        # Map "Capitolo X" to start index in book_content
        indices = {}
        # Regex to find chapters like "# Capitolo 1", "# Capitolo 2"
        # We also need to handle "Risposte Capitolo X" later if needed, but for now just content.
        for match in re.finditer(r"^# Capitolo (\d+)", self.book_content, re.MULTILINE):
            chapter_num = match.group(1)
            indices[f"Capitolo {chapter_num}"] = match.start()
        return indices

    def _get_category(self, topic: str) -> int:
        t = topic.lower()
        
        def matches(patterns, text):
            for p in patterns:
                if re.search(p, text): return True
            return False

        g1_pats = [r"fluidi", r"idrostatica", r"cinematica", r"dinamica", r"oscillazioni"]
        g2_pats = [r"unità", r"dimensioni", r"termodinamica", r"\bgas\b"]
        g3_pats = [r"elettricità", r"\bcorrenti\b", r"onde", r"acustiche", r"\bem\b"]
        
        # Priority: G2 > G3 > G1 (as per previous fix)
        if matches(g2_pats, t): return 2
        if matches(g3_pats, t): return 3
        if matches(g1_pats, t): return 1
        return 0

    def select_exercises(self, count: int = 20) -> List[Dict]:
        g1, g2, g3 = [], [], []
        for ex in self.exercises:
            cat = self._get_category(ex.get('topic', ''))
            if cat == 1: g1.append(ex)
            elif cat == 2: g2.append(ex)
            elif cat == 3: g3.append(ex)
            
        def select_balanced_group(items, target_n):
            if not items: return []
            if len(items) <= target_n: return items
            
            diff1 = [x for x in items if x.get('difficulty') == 1]
            diff2 = [x for x in items if x.get('difficulty') == 2]
            diff3 = [x for x in items if x.get('difficulty') == 3]
            
            n1 = int(target_n * 0.2)
            n2 = int(target_n * 0.5)
            n3 = target_n - n1 - n2
            
            selected = []
            selected.extend(random.sample(diff1, min(len(diff1), n1)))
            selected.extend(random.sample(diff2, min(len(diff2), n2)))
            selected.extend(random.sample(diff3, min(len(diff3), n3)))
            
            needed = target_n - len(selected)
            if needed > 0:
                remaining = [x for x in items if x not in selected]
                selected.extend(random.sample(remaining, min(len(remaining), needed)))
            return selected

        # Targets: 30% (6), 30% (6), 40% (8)
        sel1 = select_balanced_group(g1, int(count * 0.3))
        sel2 = select_balanced_group(g2, int(count * 0.3))
        sel3 = select_balanced_group(g3, int(count * 0.4)) # 8
        
        final = sel1 + sel2 + sel3
        
        # If we are short, fill from valid pools without duplicates
        if len(final) < count:
            used_ids = {x['id'] for x in final}
            pool = [x for x in (g1 + g2 + g3) if x['id'] not in used_ids]
            needed = count - len(final)
            if pool:
                final.extend(random.sample(pool, min(len(pool), needed)))
                
        return final

    def extract_problem_text(self, chapter_name: str, problem_id: str) -> str:
        # 1. Identify Chapter Number
        match = re.search(r"Capitolo (\d+)", chapter_name)
        if match:
            chap_key = f"Capitolo {match.group(1)}"
            start_idx = self.chapter_indices.get(chap_key)
        else:
            # Try to find the chapter name directly in indices (e.g. "Fisica Moderna")
            # We might need to fuzzy match or check if it exists as a key
            # Our indexer only indexed "Capitolo \d+". Let's update indexer or search here.
            # Let's search for the header directly in book content
            header_match = re.search(r"^# " + re.escape(chapter_name), self.book_content, re.MULTILINE)
            if header_match:
                start_idx = header_match.start()
            else:
                return f"Chapter '{chapter_name}' not found."
        
        if start_idx is None:
            return f"Chapter found but index missing."
            
        # Find end of chapter
        # We look for the next "# " header (Capitolo or otherwise)
        next_chap_match = re.search(r"^# ", self.book_content[start_idx+1:], re.MULTILINE)
        if next_chap_match:
            end_idx = start_idx + 1 + next_chap_match.start()
            chapter_text = self.book_content[start_idx:end_idx]
        else:
            chapter_text = self.book_content[start_idx:]
            
        # 2. Find Problem ID
        # Pattern: ^\s*{id}[\)\.] (.*)
        # We capture until the next problem ID or end of section
        # Problems are usually "1) ...", "2) ..." or "1. ..."
        
        pattern = re.compile(r"^\s*" + re.escape(problem_id) + r"[\)\.]\s+(.*)", re.MULTILINE)
        prob_match = pattern.search(chapter_text)
        
        if not prob_match:
            return "Problem text not found."
            
        prob_start = prob_match.start(1) # Start of the text group
        prob_end_in_chap = prob_match.end() # End of the first line match
        
        # We need to find where this problem ends.
        # It ends at the next pattern "^\s*\d+[\)\.]" or end of string.
        
        rest_of_chap = chapter_text[prob_match.start():]
        # Find all matches of "^\d+[\)\.]" in the rest
        
        all_probs = list(re.finditer(r"^\s*\d+[\)\.]", rest_of_chap, re.MULTILINE))
        
        current_prob_idx = 0 # It should be at index 0 of rest_of_chap
        
        # Find the end
        if len(all_probs) > 1:
            # The next problem starts at all_probs[1].start()
            # But wait, we need to be careful.
            # If we just take everything until next problem, we might include "www.edises.it" footers etc.
            # For now, let's just take it.
            end_pos = all_probs[1].start()
            full_text = rest_of_chap[:end_pos]
        else:
            full_text = rest_of_chap
            
        # Clean up the text
        # Remove the "ID) " prefix
        full_text = re.sub(r"^\s*" + re.escape(problem_id) + r"\)\s+", "", full_text)
        
        # Remove page headers/footers common in the file
        full_text = re.sub(r"www\.edises\.it", "", full_text)
        full_text = re.sub(r"EdiSES", "", full_text)
        full_text = re.sub(r"--- PAGE \d+ ---", "", full_text)
        
        # Remove "Capitolo X" headers if they appear inside the text
        full_text = re.sub(r"# Capitolo \d+.*", "", full_text)
        
        # Collapse multiple newlines
        full_text = re.sub(r"\n{3,}", "\n\n", full_text)
        
        return full_text.strip()

    def extract_solution(self, chapter_name: str, problem_id: str) -> str:
        # Solutions are at the end, under "Risposte Capitolo X" or similar?
        # Looking at file tail:
        # "Risposte Capitolo 7"
        # "■ Risposte quiz commentati"
        # "1) C. ..."
        
        match = re.search(r"Capitolo (\d+)", chapter_name)
        if not match: return "N/A"
        chap_num = match.group(1)
        
        # Find "Risposte Capitolo {chap_num}"
        # Note: The file seems to have "Risposte Capitolo 7"
        
        # Search for the section
        # Prioritize headers like "# RISPOSTE CAPITOLO X" or "RISPOSTE CAPITOLO X" at start of line
        patterns = [
            r"^#\s*RISPOSTE CAPITOLO " + chap_num,
            r"^RISPOSTE CAPITOLO " + chap_num,
            r"^#\s*Risposte Capitolo " + chap_num,
            r"Risposte Capitolo " + chap_num
        ]
        
        start_idx = -1
        for p in patterns:
            m = re.search(p, self.book_content, re.MULTILINE | re.IGNORECASE)
            # Check if it looks like a TOC entry (followed by dots or number on same line)
            if m:
                line_end = self.book_content.find('\n', m.end())
                line = self.book_content[m.start():line_end]
                if "..." in line or re.search(r"\s+\d+\s*$", line):
                    continue # Skip TOC-like entries
                start_idx = m.start()
                break
        
        if start_idx == -1: return "Solution section not found."
            
        # Find end of this solution section (next Risposte or end)
        next_sec = re.search(r"Risposte Capitolo \d+", self.book_content[start_idx+10:], re.IGNORECASE)
        if next_sec:
            end_idx = start_idx + 10 + next_sec.start()
            sol_text = self.book_content[start_idx:end_idx]
        else:
            sol_text = self.book_content[start_idx:]
            
        # Find the specific answer
        # Pattern: "1) C." or "1) C" or "1) risposta"
        # Sometimes they are in "Risposte quiz commentati" or "Risposte quiz non commentati"
        
        # Let's look for "{id}) "
        # It might appear multiple times (commented vs non-commented).
        # We prefer commented if available.
        
        # Search for "{id}) [A-E]"
        # Regex: ^\s*{id}\)\s+([A-E])
        
        # Try to find the line
        line_match = re.search(r"^\s*" + re.escape(problem_id) + r"[\)\.]\s+([A-E].*)", sol_text, re.MULTILINE)
        if line_match:
            return line_match.group(1).strip()
            
        # Try simple letter only, anywhere in line (for multi-column format)
        # Pattern: "11) E" surrounded by boundaries
        line_match_simple = re.search(r"(?:^|\s)" + re.escape(problem_id) + r"[\)\.]\s+([A-E])(?=\s|$)", sol_text, re.MULTILINE)
        if line_match_simple:
             return line_match_simple.group(1).strip()

        return "Solution not found in text."

    def generate_quiz(self) -> List[QuizProblem]:
        selected = self.select_exercises(20)
        quiz = []
        for item in selected:
            full_text = self.extract_problem_text(item['chapter'], item['id'])
            answer = self.extract_solution(item['chapter'], item['id'])
            
            # Parse options (A. ... B. ...)
            # Regex to find options: start of line or after newline, A. or A) 
            # We want to split the text into "Question Body" and "Options"
            
            options = []
            # Find the first occurrence of "A." or "A)" at start of line
            opt_match = re.search(r"(?:^|\n)\s*A[\.\)]\s+", full_text)
            
            clean_text = full_text
            if opt_match:
                # Everything before A. is the question text
                clean_text = full_text[:opt_match.start()].strip()
                options_text = full_text[opt_match.start():]
                
                # Extract individual options
                # Look for A., B., C., D., E.
                # Pattern: (?:^|\n)\s*([A-E])[\.\)]\s+(.*?)(?=(?:\n\s*[A-E][\.\)])|$)"
                # This regex captures the letter and the content until the next letter or end of string
                
                opt_iter = re.finditer(r"(?:^|\n)\s*([A-E])[\.\)]\s+(.*?)(?=(?:\n\s*[A-E][\.\)])|$)", options_text, re.DOTALL)
                for m in opt_iter:
                    # We might want to keep the letter or just the text. 
                    # Let's keep "A. Text" format for simplicity in display, or just "Text".
                    # Let's keep just text, and we'll add letters in UI.
                    options.append(m.group(2).strip())
            
            quiz.append(QuizProblem(
                id=item['id'],
                chapter=item['chapter'],
                topic=item['topic'],
                difficulty=item['difficulty'],
                master_equation=item.get('master_equation'),
                text=clean_text,
                answer=answer,
                options=options if options else None
            ))
        return quiz

# Singleton instance
_quiz_service = None

def get_quiz_service():
    global _quiz_service
    if _quiz_service is None:
        # Paths relative to where main.py is run usually, but let's use absolute for safety if possible
        # Or relative to project root
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        jsonl = os.path.join(base_dir, "analysis_progress.jsonl")
        book = os.path.join(base_dir, "Full_Book_Raw.md")
        final_db = os.path.join(base_dir, "Physics_Final_Database.json")
        _quiz_service = QuizService(jsonl, book, final_db)
    return _quiz_service
