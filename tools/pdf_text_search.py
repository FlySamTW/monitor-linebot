"""
PDF 文字搜尋工具
搜尋 PDF 內是否包含特定關鍵字，用於驗證 AI 回答是否有依據
"""

import os
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("請安裝 PyMuPDF: pip install pymupdf")
    exit(1)


def search_pdf(pdf_path: str, keywords: list, context_chars: int = 100) -> dict:
    """
    搜尋 PDF 內是否包含關鍵字
    
    Args:
        pdf_path: PDF 檔案路徑
        keywords: 要搜尋的關鍵字列表
        context_chars: 顯示前後多少字元的上下文
    
    Returns:
        dict: {keyword: [(page, context_text), ...]}
    """
    results = {kw: [] for kw in keywords}
    
    try:
        doc = fitz.open(pdf_path)
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            text_lower = text.lower()
            
            for kw in keywords:
                kw_lower = kw.lower()
                start = 0
                
                while True:
                    idx = text_lower.find(kw_lower, start)
                    if idx == -1:
                        break
                    
                    # 擷取上下文
                    ctx_start = max(0, idx - context_chars)
                    ctx_end = min(len(text), idx + len(kw) + context_chars)
                    context = text[ctx_start:ctx_end].replace('\n', ' ').strip()
                    
                    # 標記關鍵字
                    highlight_start = idx - ctx_start
                    highlight_end = highlight_start + len(kw)
                    context_highlighted = (
                        context[:highlight_start] + 
                        f"【{context[highlight_start:highlight_end]}】" + 
                        context[highlight_end:]
                    )
                    
                    results[kw].append({
                        "page": page_num + 1,
                        "context": context_highlighted
                    })
                    
                    start = idx + 1
        
        doc.close()
        return results
        
    except Exception as e:
        print(f"❌ 讀取失敗 {pdf_path}: {e}")
        return results


def search_folder(folder_path: str, keywords: list, context_chars: int = 100) -> dict:
    """搜尋資料夾內所有 PDF"""
    folder = Path(folder_path)
    
    if not folder.exists():
        print(f"❌ 資料夾不存在: {folder_path}")
        return {}
    
    pdf_files = list(folder.glob("*.pdf")) + list(folder.glob("*.PDF"))
    
    if not pdf_files:
        print(f"⚠️ 沒有找到 PDF 檔案: {folder_path}")
        return {}
    
    all_results = {}
    
    for pdf_path in sorted(pdf_files):
        results = search_pdf(str(pdf_path), keywords, context_chars)
        
        # 只保留有結果的
        has_match = any(len(matches) > 0 for matches in results.values())
        if has_match:
            all_results[pdf_path.name] = results
    
    return all_results


def print_results(results: dict, keywords: list):
    """美化輸出結果"""
    for kw in keywords:
        print(f"\n{'='*60}")
        print(f"🔍 關鍵字: {kw}")
        print(f"{'='*60}")
        
        found = False
        for filename, file_results in results.items():
            matches = file_results.get(kw, [])
            if matches:
                found = True
                print(f"\n📄 {filename}")
                for i, match in enumerate(matches[:3], 1):  # 每檔最多顯示 3 筆
                    print(f"   [{i}] 第 {match['page']} 頁:")
                    print(f"       {match['context'][:150]}...")
                    
                if len(matches) > 3:
                    print(f"   ... 還有 {len(matches) - 3} 筆結果")
        
        if not found:
            print("   ❌ 沒有找到此關鍵字")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="PDF 文字搜尋工具")
    parser.add_argument("path", help="PDF 檔案或資料夾路徑")
    parser.add_argument("keywords", nargs="+", help="要搜尋的關鍵字 (可多個)")
    parser.add_argument("--context", "-c", type=int, default=100, help="上下文字元數 (預設: 100)")
    
    args = parser.parse_args()
    path = Path(args.path)
    
    print(f"📂 搜尋路徑: {path}")
    print(f"🔑 關鍵字: {', '.join(args.keywords)}")
    print()
    
    if path.is_file():
        results = {path.name: search_pdf(str(path), args.keywords, args.context)}
    elif path.is_dir():
        results = search_folder(str(path), args.keywords, args.context)
    else:
        print(f"❌ 路徑不存在: {path}")
        return
    
    print_results(results, args.keywords)
    
    # 統計
    print(f"\n{'='*60}")
    print("📊 統計")
    print(f"{'='*60}")
    for kw in args.keywords:
        total = sum(len(r.get(kw, [])) for r in results.values())
        files = sum(1 for r in results.values() if len(r.get(kw, [])) > 0)
        print(f"   {kw}: {total} 筆結果，在 {files} 個檔案中")


if __name__ == "__main__":
    main()
