import json
import re

def load_data(filename):
    data = []
    with open(filename, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
    return data

def load_book(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        return f.read()

def extract_problem(book_text, chapter_name, problem_id):
    # Normalize chapter name: "Capitolo 2: Oscillazioni" -> "Capitolo 2"
    # Or just match "Capitolo X"
    match = re.search(r"(Capitolo \d+)", chapter_name)
    if not match:
        # Fallback for "Generale" or others?
        # If chapter is "Generale", maybe it's Chapter 1? Or just search globally?
        # Let's try to search for the specific header in the book.
        # The book has "# Capitolo 1", "# Capitolo 2" etc.
        simple_chapter = chapter_name
    else:
        simple_chapter = match.group(1)

    # Find the start of the chapter in the book
    # Pattern: ^# Capitolo X
    # We need to be careful about "Capitolo 1" vs "Capitolo 10"
    
    # Split book by chapters?
    # Let's try to find the index of "# {simple_chapter}"
    
    # Regex for chapter header
    # Note: Full_Book_Raw.md has "# Capitolo 1"
    
    chapter_pattern = r"^# " + re.escape(simple_chapter)
    chapter_matches = list(re.finditer(chapter_pattern, book_text, re.MULTILINE))
    
    if not chapter_matches:
        return f"Chapter '{simple_chapter}' not found."
    
    start_idx = chapter_matches[0].start()
    
    # Find end of chapter (next # Capitolo or end of file)
    next_chapter_pattern = r"^# Capitolo \d+"
    # Search from start_idx + 1
    next_match = re.search(next_chapter_pattern, book_text[start_idx+1:], re.MULTILINE)
    
    if next_match:
        end_idx = start_idx + 1 + next_match.start()
        chapter_text = book_text[start_idx:end_idx]
    else:
        chapter_text = book_text[start_idx:]
        
    # Now find the problem ID in this text
    # Pattern: ^\s*{id}\) (.*)
    # The ID in JSONL is a string number "73"
    
    prob_pattern = re.compile(r"^\s*" + re.escape(problem_id) + r"\)\s+(.*)", re.MULTILINE)
    prob_match = prob_pattern.search(chapter_text)
    
    if prob_match:
        # We found the start line. We need to capture until the next problem or end of section.
        # Actually, let's just grab the first line for verification now.
        # Or better: grab until the next line that starts with "A." (options) or next number.
        return prob_match.group(1)[:100] + "..."
    else:
        return "Problem ID not found in chapter."

def main():
    data = load_data("analysis_progress.jsonl")
    book = load_book("Full_Book_Raw.md")
    
    # Test with specific known IDs from previous steps
    test_ids = ["73", "75", "8", "1"]
    
    print("--- Testing Extraction ---")
    for item in data:
        if item['id'] in test_ids:
            print(f"\nLooking for ID: {item['id']} in Chapter: {item['chapter']}")
            text = extract_problem(book, item['chapter'], item['id'])
            print(f"Result: {text}")
            test_ids.remove(item['id']) # Only test once per ID
            if not test_ids: break

if __name__ == "__main__":
    main()
