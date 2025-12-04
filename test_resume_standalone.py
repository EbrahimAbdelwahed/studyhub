import os
import re
import logging

# Mock logger
logging.basicConfig()
logger = logging.getLogger("test")

OUTPUT_FILE = "test_output.md"

def get_last_processed_page(filepath):
    """Scans the output file to find the last processed page number."""
    if not os.path.exists(filepath):
        return 0
    
    last_page = 0
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                match = re.search(r"--- PAGE (\d+) ---", line)
                if match:
                    last_page = int(match.group(1))
    except Exception as e:
        logger.error(f"Error reading progress file: {e}")
    
    return last_page

# Setup dummy file
with open(OUTPUT_FILE, "w") as f:
    f.write("Some header\n\n--- PAGE 1 ---\nContent 1\n\n--- PAGE 5 ---\nContent 5")

print(f"Created dummy {OUTPUT_FILE}")

# Test
last_page = get_last_processed_page(OUTPUT_FILE)
print(f"Last processed page detected: {last_page}")

# Cleanup
os.remove(OUTPUT_FILE)

if last_page == 5:
    print("✅ Resume logic passed")
else:
    print(f"❌ Resume logic failed. Expected 5, got {last_page}")
    exit(1)
