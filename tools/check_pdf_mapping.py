import csv
import os
import re

def check_mappings():
    csv_path = r'd:\00_程式\20251125_GAS客服LineBot\CLASS_RULES.csv'
    pdf_dir = r'd:\00_程式\20251125_GAS客服LineBot\三星螢幕使用手冊(未改檔名)'
    
    # Read PDF filenames
    pdf_files = os.listdir(pdf_dir)
    pdf_files = [f for f in os.listdir(pdf_dir) if f.lower().endswith('.pdf')]
    print(f"Found {len(pdf_files)} PDF files.")
    
    mismatches = []
    
    print("Reading CSV...")
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        for row in reader:
            if not row: continue
            
            # Check if row starts with LS (Model ID)
            if not row[0].startswith('LS'):
                # Try second column if first doesn't match (sometimes swapped)
                if len(row) > 1 and row[1].startswith('LS'):
                    model_id = row[1]
                    model_name_cell = row[0]
                else:
                    continue
            else:
                model_id = row[0]
                model_name_cell = row[1] if len(row) > 1 else ""

            # Extract "S" model from the description cell (e.g., "型號：S27FG900XC")
            match = re.search(r'型號：(S[A-Z0-9]+)', model_name_cell)
            if match:
                s_model = match.group(1)
                
                # Check if this S-model exists in any PDF filename
                found = False
                for pdf in pdf_files:
                    if s_model in pdf:
                        found = True
                        break
                
                if not found:
                    # If exact match not found, check if a "base" version exists
                    potential_match = None
                    for pdf in pdf_files:
                        pdf_name = os.path.splitext(pdf)[0]
                        # PDF filenames can be comma-separated lists of models
                        # e.g. "S27CG552,S27DG502.pdf"
                        pdf_models = [m.strip() for m in pdf_name.split(',')]
                        
                        for pm in pdf_models:
                            # Case: CSV=S27FG900XC, PDF has S27FG900
                            if s_model.startswith(pm) and len(pm) > 5:
                                 potential_match = pdf
                                 break
                        if potential_match:
                            break
                    
                    if potential_match:
                        print(f"Mismatch found: {s_model} -> {potential_match}")
                        mismatches.append((model_id, s_model, potential_match))
                    else:
                        print(f"No PDF found for: {s_model}")
    
    # Read CSV
    mismatches = []
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        for row in reader:
            if not row: continue
            
            # Check if it's a model row (starts with LS)
            print(f"Row: {row}")
            first_col = row[0].strip()
            # print(f"Row[0]: '{first_col}'") 
            if not first_col.startswith('LS'):
                continue
                
            # Extract S-Model from second column "型號：S..."
            second_col = row[1].strip()
            # print(f"Checking row: {second_col}") # Debug
            match = re.match(r'型號[：:]\s*(S[A-Z0-9]+)', second_col)
            
            if match:
                s_model_csv = match.group(1)
                # print(f"  Found model: {s_model_csv}") # Debug
                
                # Check if this exact model exists in any PDF filename
                exact_match = False
                for pdf in pdf_files:
                    if s_model_csv in pdf:
                        exact_match = True
                        break
                
                if not exact_match:
                    # Try to find a partial match (base model)
                    # Heuristic: Remove last 2 chars if they are letters (e.g. XC, SC)
                    # Most Samsung models in this list seem to be S + 2 digits + 2 letters + 3 digits + 2 letters suffix
                    # e.g. S27FG900XC -> S27FG900
                    
                    base_model = s_model_csv
                    # Try removing last 2 chars
                    if len(base_model) > 2:
                        short_model = base_model[:-2]
                        
                        partial_match_pdf = None
                        for pdf in pdf_files:
                            if short_model in pdf:
                                partial_match_pdf = pdf
                                break
                        
                        if partial_match_pdf:
                            mismatches.append({
                                'csv_model': s_model_csv,
                                'suggested_model': short_model,
                                'pdf_file': partial_match_pdf
                            })
                            continue

                    # Try removing last 1 char
                    if len(base_model) > 1:
                        short_model = base_model[:-1]
                        partial_match_pdf = None
                        for pdf in pdf_files:
                            if short_model in pdf:
                                partial_match_pdf = pdf
                                break
                        
                        if partial_match_pdf:
                            mismatches.append({
                                'csv_model': s_model_csv,
                                'suggested_model': short_model,
                                'pdf_file': partial_match_pdf
                            })

    # Output results
    print(f"Found {len(mismatches)} mismatches:")
    for m in mismatches:
        print(f"CSV: {m['csv_model']} -> Suggested: {m['suggested_model']} (Found in {m['pdf_file']})")

if __name__ == '__main__':
    check_mappings()
