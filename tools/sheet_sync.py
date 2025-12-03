"""
Google Sheet 同步工具
讀取/寫入 GAS 專案的 Sheet 資料 (QA, CLASS_RULES)
"""

import os
import json
from pathlib import Path

try:
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
except ImportError:
    print("請安裝 Google API: pip install google-api-python-client google-auth")
    exit(1)


# Google Sheet 設定
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SHEET_NAMES = {
    'QA': 'QA',
    'CLASS_RULES': 'CLASS_RULES',
    'LOG': 'LOG',
    'RECORDS': '所有紀錄',
}


class SheetSync:
    """Google Sheet 同步類別"""
    
    def __init__(self, spreadsheet_id: str, credentials_path: str = None):
        """
        初始化
        
        Args:
            spreadsheet_id: Google Sheet ID (從網址取得)
            credentials_path: 服務帳戶 JSON 金鑰路徑
        """
        self.spreadsheet_id = spreadsheet_id
        
        # 尋找憑證檔案
        if credentials_path is None:
            # 預設路徑
            default_paths = [
                'credentials.json',
                'service_account.json',
                os.path.expanduser('~/.config/gcloud/service_account.json'),
            ]
            for p in default_paths:
                if os.path.exists(p):
                    credentials_path = p
                    break
        
        if credentials_path is None or not os.path.exists(credentials_path):
            raise FileNotFoundError(
                "找不到 Google 服務帳戶憑證。\n"
                "請下載服務帳戶 JSON 並放在以下位置之一：\n"
                "  - ./credentials.json\n"
                "  - ./service_account.json\n"
                "或使用 --credentials 指定路徑"
            )
        
        creds = Credentials.from_service_account_file(credentials_path, scopes=SCOPES)
        self.service = build('sheets', 'v4', credentials=creds)
        self.sheet = self.service.spreadsheets()
    
    def read_sheet(self, sheet_name: str, range_str: str = None) -> list:
        """
        讀取 Sheet 資料
        
        Args:
            sheet_name: Sheet 名稱 (如 'QA', 'CLASS_RULES')
            range_str: 範圍 (如 'A2:A100')，None 則讀取全部
        
        Returns:
            二維陣列
        """
        full_range = f"'{sheet_name}'!{range_str}" if range_str else f"'{sheet_name}'"
        
        result = self.sheet.values().get(
            spreadsheetId=self.spreadsheet_id,
            range=full_range
        ).execute()
        
        return result.get('values', [])
    
    def append_row(self, sheet_name: str, row: list) -> dict:
        """
        新增一行資料
        
        Args:
            sheet_name: Sheet 名稱
            row: 資料列表
        
        Returns:
            API 回應
        """
        body = {'values': [row]}
        
        result = self.sheet.values().append(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{sheet_name}'!A:A",
            valueInputOption='USER_ENTERED',
            insertDataOption='INSERT_ROWS',
            body=body
        ).execute()
        
        return result
    
    def update_cell(self, sheet_name: str, cell: str, value: str) -> dict:
        """
        更新單一儲存格
        
        Args:
            sheet_name: Sheet 名稱
            cell: 儲存格位置 (如 'A1', 'B3')
            value: 新值
        """
        body = {'values': [[value]]}
        
        result = self.sheet.values().update(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{sheet_name}'!{cell}",
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
        
        return result
    
    # ========== 專案特化方法 ==========
    
    def get_qa_list(self) -> list:
        """取得 QA 清單"""
        rows = self.read_sheet('QA', 'A2:A1000')
        return [row[0] for row in rows if row]
    
    def get_class_rules(self) -> list:
        """取得 CLASS_RULES 清單"""
        rows = self.read_sheet('CLASS_RULES', 'A2:A1000')
        return [row[0] for row in rows if row]
    
    def add_qa(self, category: str, subcategory: str, question: str, answer: str, source: str = 'Python') -> dict:
        """
        新增 QA
        
        Args:
            category: 分類 (如 '一、產品諮詢')
            subcategory: 子分類 (如 '00.AI紀錄')
            question: 問題
            answer: 答案
            source: 來源
        """
        from datetime import datetime
        date_str = datetime.now().strftime('%Y/%m/%d')
        
        # 格式：日期, 分類, 子分類, 問題, 答案, 來源
        combined = f"{date_str}, {category}, {subcategory}, {question}, {answer}, {source}"
        
        return self.append_row('QA', [combined])
    
    def add_class_rule(self, keyword: str, definition: str, note: str, description: str) -> dict:
        """
        新增 CLASS_RULE
        
        Args:
            keyword: 關鍵字 (型號)
            definition: 定義/類型
            note: 備註
            description: 完整說明
        """
        # 格式：關鍵字, 定義, 備註, 說明
        combined = f"{keyword}, {definition}, {note}, {description}"
        
        return self.append_row('CLASS_RULES', [combined])
    
    def export_to_csv(self, sheet_name: str, output_path: str):
        """匯出 Sheet 為 CSV"""
        rows = self.read_sheet(sheet_name)
        
        with open(output_path, 'w', encoding='utf-8-sig') as f:
            for row in rows:
                # 處理逗號
                escaped = [f'"{cell}"' if ',' in str(cell) else str(cell) for cell in row]
                f.write(','.join(escaped) + '\n')
        
        print(f"✅ 已匯出至: {output_path}")
    
    def import_from_csv(self, sheet_name: str, csv_path: str, skip_header: bool = True):
        """從 CSV 匯入 Sheet"""
        import csv
        
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        if skip_header and rows:
            rows = rows[1:]
        
        for row in rows:
            if row:
                self.append_row(sheet_name, row)
        
        print(f"✅ 已匯入 {len(rows)} 行至 {sheet_name}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Google Sheet 同步工具")
    parser.add_argument("--sheet-id", "-s", required=True, help="Google Sheet ID")
    parser.add_argument("--credentials", "-c", help="服務帳戶 JSON 路徑")
    
    subparsers = parser.add_subparsers(dest="command", help="指令")
    
    # 讀取指令
    read_parser = subparsers.add_parser("read", help="讀取 Sheet")
    read_parser.add_argument("sheet_name", help="Sheet 名稱")
    read_parser.add_argument("--range", "-r", help="範圍 (如 A2:A10)")
    
    # 匯出指令
    export_parser = subparsers.add_parser("export", help="匯出為 CSV")
    export_parser.add_argument("sheet_name", help="Sheet 名稱")
    export_parser.add_argument("output", help="輸出 CSV 路徑")
    
    # 匯入指令
    import_parser = subparsers.add_parser("import", help="從 CSV 匯入")
    import_parser.add_argument("sheet_name", help="Sheet 名稱")
    import_parser.add_argument("csv_path", help="CSV 檔案路徑")
    
    # 新增 QA 指令
    qa_parser = subparsers.add_parser("add-qa", help="新增 QA")
    qa_parser.add_argument("--question", "-q", required=True, help="問題")
    qa_parser.add_argument("--answer", "-a", required=True, help="答案")
    qa_parser.add_argument("--category", default="一、產品諮詢", help="分類")
    
    # 新增 Rule 指令
    rule_parser = subparsers.add_parser("add-rule", help="新增 CLASS_RULE")
    rule_parser.add_argument("--keyword", "-k", required=True, help="關鍵字")
    rule_parser.add_argument("--definition", "-d", required=True, help="定義")
    rule_parser.add_argument("--description", required=True, help="說明")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    sync = SheetSync(args.sheet_id, args.credentials)
    
    if args.command == "read":
        rows = sync.read_sheet(args.sheet_name, args.range)
        for i, row in enumerate(rows[:20], 1):
            print(f"{i}. {row}")
        if len(rows) > 20:
            print(f"... 還有 {len(rows) - 20} 行")
    
    elif args.command == "export":
        sync.export_to_csv(args.sheet_name, args.output)
    
    elif args.command == "import":
        sync.import_from_csv(args.sheet_name, args.csv_path)
    
    elif args.command == "add-qa":
        result = sync.add_qa(args.category, "00.Python匯入", args.question, args.answer)
        print(f"✅ 已新增 QA: {result}")
    
    elif args.command == "add-rule":
        result = sync.add_class_rule(args.keyword, args.definition, "Python", args.description)
        print(f"✅ 已新增 Rule: {result}")


if __name__ == "__main__":
    main()
