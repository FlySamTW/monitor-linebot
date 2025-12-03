"""
PDF 關鍵字擷取工具
從 PDF 前三頁擷取型號、暱稱、關鍵字，用於建立 KEYWORD_MAP
"""

import os
import re
import json
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("請安裝 PyMuPDF: pip install pymupdf")
    exit(1)


# 三星螢幕型號規則
MODEL_PATTERNS = [
    # 完整型號 (LS開頭)
    r'LS\d{2}[A-Z]{2}\d{3}[A-Z]{2}[A-Z]{4}',  # LS32DG802SCXZW
    r'LS\d{2}[A-Z]{2}\d{3}[A-Z]+',              # LS32DG802SC
    
    # 簡化型號
    r'S\d{2}[A-Z]{2}\d{3}[A-Z]{2}',             # S32DG802SC
    r'S\d{2}[A-Z]\d[A-Z]?',                     # S32G8, S27M7
    
    # G系列代號
    r'G\d{2}[A-Z]{2,3}',                        # G80SD, G81SF, G95SC
    r'G\d{1,2}[A-Z]?',                          # G9, G8, G7, G5
    
    # M系列代號  
    r'M\d{2}[A-Z]?',                            # M80D, M70D
    r'M\d',                                      # M9, M8, M7, M5
    
    # S系列代號
    r'S\d{2}',                                   # S90, S80
]

# 系列暱稱關鍵字
SERIES_KEYWORDS = [
    'Odyssey', 'ViewFinity', 'Smart Monitor', 'SmartMonitor',
    'OLED', 'Neo', 'Odyssey3D', '3D',
    'G9', 'G8', 'G7', 'G6', 'G5',
    'M9', 'M8', 'M7', 'M5',
    'S9', 'S8', 'S6',
]

# 規格關鍵字
SPEC_KEYWORDS = [
    # 尺寸
    '27吋', '32吋', '34吋', '43吋', '49吋', '55吋', '57吋',
    '27"', '32"', '34"', '43"', '49"', '55"', '57"',
    
    # 解析度
    '4K', '2K', '5K', 'UHD', 'QHD', 'WQHD', 'DQHD', 'DUHD', 'FHD',
    '3840x2160', '2560x1440', '5120x1440', '5120x2880',
    
    # 面板
    'OLED', 'QD-OLED', 'VA', 'IPS', 'MiniLED', 'Mini LED',
    
    # 曲率
    '1000R', '1800R', '曲面', 'Curved',
    
    # 更新率
    '144Hz', '165Hz', '180Hz', '240Hz', '360Hz',
    
    # 功能
    'HDR', 'FreeSync', 'G-Sync', 'Tizen', 'SmartThings',
]


def extract_text_from_pdf(pdf_path: str, max_pages: int = 3) -> str:
    """擷取 PDF 前 N 頁文字"""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        pages_to_read = min(max_pages, len(doc))
        
        for page_num in range(pages_to_read):
            page = doc[page_num]
            text += page.get_text() + "\n"
        
        doc.close()
        return text
    except Exception as e:
        print(f"❌ 讀取失敗 {pdf_path}: {e}")
        return ""


def extract_models(text: str) -> list:
    """擷取型號"""
    models = set()
    text_upper = text.upper()
    
    for pattern in MODEL_PATTERNS:
        matches = re.findall(pattern, text_upper)
        models.update(matches)
    
    # 過濾太短或太通用的
    return sorted([m for m in models if len(m) >= 2])


def extract_series(text: str) -> list:
    """擷取系列名稱"""
    series = set()
    text_upper = text.upper()
    
    for keyword in SERIES_KEYWORDS:
        if keyword.upper() in text_upper:
            series.add(keyword)
    
    return sorted(series)


def extract_specs(text: str) -> list:
    """擷取規格關鍵字"""
    specs = set()
    text_upper = text.upper()
    
    for keyword in SPEC_KEYWORDS:
        if keyword.upper() in text_upper:
            specs.add(keyword)
    
    return sorted(specs)


def analyze_pdf(pdf_path: str) -> dict:
    """分析單一 PDF"""
    text = extract_text_from_pdf(pdf_path, max_pages=3)
    
    if not text:
        return None
    
    result = {
        "file": os.path.basename(pdf_path),
        "models": extract_models(text),
        "series": extract_series(text),
        "specs": extract_specs(text),
        "suggested_keywords": [],
    }
    
    # 建議關鍵字 (優先順序：完整型號 > 簡化型號 > 系列名)
    suggested = []
    
    # 優先使用 G/M 開頭的簡化型號
    for m in result["models"]:
        if re.match(r'^G\d{2}[A-Z]{2,3}$', m):  # G80SD, G81SF
            suggested.append(m)
        elif re.match(r'^LS\d{2}', m):  # 完整型號
            suggested.append(m)
    
    # 加入系列名
    for s in result["series"]:
        if s not in suggested:
            suggested.append(s)
    
    result["suggested_keywords"] = suggested[:5]  # 最多 5 個
    
    return result


def analyze_folder(folder_path: str) -> list:
    """分析資料夾內所有 PDF"""
    results = []
    folder = Path(folder_path)
    
    if not folder.exists():
        print(f"❌ 資料夾不存在: {folder_path}")
        return results
    
    pdf_files = list(folder.glob("*.pdf")) + list(folder.glob("*.PDF"))
    
    if not pdf_files:
        print(f"⚠️ 沒有找到 PDF 檔案: {folder_path}")
        return results
    
    print(f"📁 找到 {len(pdf_files)} 個 PDF 檔案\n")
    
    for pdf_path in sorted(pdf_files):
        print(f"🔍 分析中: {pdf_path.name}")
        result = analyze_pdf(str(pdf_path))
        
        if result:
            results.append(result)
            print(f"   型號: {', '.join(result['models'][:5]) or '無'}")
            print(f"   系列: {', '.join(result['series']) or '無'}")
            print(f"   建議關鍵字: {', '.join(result['suggested_keywords']) or '無'}")
            print()
    
    return results


def generate_keyword_map(results: list) -> dict:
    """生成 KEYWORD_MAP 格式"""
    keyword_map = {}
    
    for r in results:
        filename = r["file"]
        
        for kw in r["suggested_keywords"]:
            if kw not in keyword_map:
                keyword_map[kw] = []
            if filename not in keyword_map[kw]:
                keyword_map[kw].append(filename)
    
    return keyword_map


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="PDF 關鍵字擷取工具")
    parser.add_argument("path", help="PDF 檔案或資料夾路徑")
    parser.add_argument("--output", "-o", help="輸出 JSON 檔案路徑")
    parser.add_argument("--pages", "-p", type=int, default=3, help="讀取頁數 (預設: 3)")
    
    args = parser.parse_args()
    path = Path(args.path)
    
    if path.is_file():
        result = analyze_pdf(str(path))
        if result:
            print(json.dumps(result, ensure_ascii=False, indent=2))
    elif path.is_dir():
        results = analyze_folder(str(path))
        
        if results:
            # 生成 KEYWORD_MAP
            keyword_map = generate_keyword_map(results)
            
            print("=" * 50)
            print("📊 KEYWORD_MAP 建議")
            print("=" * 50)
            print(json.dumps(keyword_map, ensure_ascii=False, indent=2))
            
            if args.output:
                output_data = {
                    "files": results,
                    "keyword_map": keyword_map,
                }
                with open(args.output, "w", encoding="utf-8") as f:
                    json.dump(output_data, f, ensure_ascii=False, indent=2)
                print(f"\n✅ 已輸出至: {args.output}")
    else:
        print(f"❌ 路徑不存在: {path}")


if __name__ == "__main__":
    main()
