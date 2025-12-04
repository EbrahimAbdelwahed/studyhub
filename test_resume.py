import os
import logging
from extraction import get_last_processed_page, OUTPUT_FILE

# Setup dummy file
with open(OUTPUT_FILE, "w") as f:
    f.write("Some header\n\n--- PAGE 1 ---\nContent 1\n\n--- PAGE 5 ---\nContent 5")

print(f"Created dummy {OUTPUT_FILE}")

# Test
last_page = get_last_processed_page(OUTPUT_FILE)
print(f"Last processed page detected: {last_page}")

if last_page == 5:
    print("✅ Resume logic passed")
else:
    print(f"❌ Resume logic failed. Expected 5, got {last_page}")

# Cleanup
os.remove(OUTPUT_FILE)
