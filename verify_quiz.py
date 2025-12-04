import sys
import os

# Add current dir to path
sys.path.append(os.getcwd())

from app.quiz_service import get_quiz_service

def verify():
    print("Initializing QuizService...")
    service = get_quiz_service()
    
    print("Generating Quiz...")
    quiz = service.generate_quiz()
    
    print(f"Generated {len(quiz)} problems.")
    
    if len(quiz) == 0:
        print("ERROR: No problems generated.")
        return

    print("\nSample Problem:")
    p = quiz[0]
    print(f"ID: {p.id}")
    print(f"Chapter: {p.chapter}")
    print(f"Topic: {p.topic}")
    print(f"Text: {p.text[:100]}...")
    print(f"Options: {p.options}")
    print(f"Answer: {p.answer[:100]}...")
    
    # Check if text is empty (extraction failed)
    if not p.text or p.text == "Problem text not found.":
        print("WARNING: Problem text extraction might have failed.")
        
    if not p.answer or p.answer == "Solution not found in text.":
        print("WARNING: Solution extraction might have failed.")

if __name__ == "__main__":
    verify()
