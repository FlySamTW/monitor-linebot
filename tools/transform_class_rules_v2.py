import csv
import re

input_file = 'd:\\00_程式\\20251125_GAS客服LineBot\\CLASS_RULES.csv'
output_file = 'd:\\00_程式\\20251125_GAS客服LineBot\\CLASS_RULES_NEW.csv'

def transform_row(row):
    if not row:
        return row
    
    first_col = row[0].strip()
    
    # Check if it's a model row (starts with LS or LF or LC)
    if re.match(r'^L[SFC]', first_col):
        # Find the column that contains "型號："
        model_col_index = -1
        for i, col in enumerate(row):
            if "型號：" in col or "型號:" in col:
                model_col_index = i
                break
        
        if model_col_index != -1:
            # Swap first column with model column
            # Actually, user said: "LS...,型號：S..." -> "型號：S...,LS..."
            # So we just swap column 0 and column model_col_index
            # But usually model_col_index is 1.
            
            # Let's just move the model column to the front
            model_col = row[model_col_index]
            
            # Remove it from original position
            row.pop(model_col_index)
            
            # Insert at 0
            row.insert(0, model_col)
            
            # If the original first column (LS...) was at 0, it is now at 1 (because we inserted at 0)
            # Wait, if model_col_index was 1:
            # [LS, Model, Desc] -> pop(1) -> [LS, Desc] -> insert(0, Model) -> [Model, LS, Desc]
            # This is exactly what we want.
            
            return row
            
    return row

with open(input_file, 'r', encoding='utf-8') as f_in, \
     open(output_file, 'w', encoding='utf-8', newline='') as f_out:
    
    reader = csv.reader(f_in)
    writer = csv.writer(f_out)
    
    for row in reader:
        new_row = transform_row(row)
        writer.writerow(new_row)

print("Transformation complete.")
