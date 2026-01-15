
import csv

filename = 'd:\\00_程式\\20251125_GAS客服LineBot\\CLASS_RULES.csv'

with open(filename, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
# Lines 0-45 are 46 lines. Line 46 is the 47th line.
# User says model count is 97. 
# My count: 143 total - 46 header/rule lines = 97 model lines.

seen = set()
duplicates = []
model_rows = []

# Assuming row 46 (0-indexed) is the start of models
start_idx = 46 
for i in range(start_idx, len(lines)):
    line = lines[i].strip()
    if not line: continue
    
    parts = line.split(',')
    key = parts[0].strip()
    
    if key in seen:
        duplicates.append((i+1, key))
    else:
        seen.add(key)
        model_rows.append(key)

print(f"Model Start Line: {start_idx+1}")
print(f"Unique Models: {len(seen)}")
print(f"Duplicates: {duplicates}")
