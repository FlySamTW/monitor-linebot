#!/usr/bin/env python3
"""
GAS Sheet LOG 下載工具
下載 Google Sheet 中的 LOG 頁面資料供本地分析
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# 設定路徑
SCRIPT_DIR = Path(__file__).parent.parent
LOGS_DIR = SCRIPT_DIR / "logs"
CREDENTIALS_FILE = SCRIPT_DIR / "service_account.json"

# Sheet 設定 - 請修改為你的 Sheet ID
SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE"  # ← 替換成你的 Sheet ID
SHEET_NAME = "LOG"


def setup_google_api():
    """設定 Google API 認證"""
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError:
        print("❌ 缺少必要套件，正在安裝...")
        os.system("pip install google-api-python-client google-auth")
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    
    if not CREDENTIALS_FILE.exists():
        print(f"❌ 找不到認證檔案：{CREDENTIALS_FILE}")
        print("\n請參考 tools/README.md 設定 Service Account")
        sys.exit(1)
    
    credentials = service_account.Credentials.from_service_account_file(
        str(CREDENTIALS_FILE),
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    
    service = build('sheets', 'v4', credentials=credentials)
    return service


def download_log(service):
    """下載 LOG 頁資料"""
    if SPREADSHEET_ID == "YOUR_SPREADSHEET_ID_HERE":
        print("❌ 請先設定 SPREADSHEET_ID！")
        print(f"   編輯 {__file__}")
        print("   找到 SPREADSHEET_ID = \"YOUR_SPREADSHEET_ID_HERE\"")
        print("   替換成你的 Google Sheet ID")
        sys.exit(1)
    
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_NAME}!A:B"
        ).execute()
        
        rows = result.get('values', [])
        return rows
        
    except Exception as e:
        if "404" in str(e):
            print(f"❌ 找不到 Sheet！請確認 SPREADSHEET_ID 正確")
        elif "403" in str(e):
            print(f"❌ 沒有權限！請將 Sheet 分享給 Service Account")
            print("   Service Account Email 在 service_account.json 的 client_email 欄位")
        else:
            print(f"❌ 下載失敗：{e}")
        sys.exit(1)


def save_log(rows):
    """儲存 LOG 到本地檔案"""
    LOGS_DIR.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = LOGS_DIR / f"log_{timestamp}.txt"
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(f"=== GAS LOG 下載於 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===\n")
        f.write(f"=== 共 {len(rows)} 筆記錄 ===\n\n")
        
        for row in rows:
            if len(row) >= 2:
                f.write(f"[{row[0]}] {row[1]}\n")
            elif len(row) == 1:
                f.write(f"{row[0]}\n")
    
    print(f"✅ 已儲存 {len(rows)} 筆記錄到 {filename}")
    return filename


def download_conversation_log(service):
    """額外下載「所有紀錄」頁的對話記錄"""
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range="所有紀錄!A:F"
        ).execute()
        
        rows = result.get('values', [])
        if not rows:
            return
        
        LOGS_DIR.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = LOGS_DIR / f"conversation_{timestamp}.txt"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"=== 對話紀錄下載於 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===\n")
            f.write(f"=== 共 {len(rows)} 筆記錄 ===\n\n")
            
            for row in rows:
                # 格式：時間, ContextID, UserID, 訊息, 角色, 標記
                if len(row) >= 5:
                    time = row[0] if row[0] else ""
                    role = row[4] if len(row) > 4 else ""
                    msg = row[3] if len(row) > 3 else ""
                    marker = f" [{row[5]}]" if len(row) > 5 and row[5] else ""
                    f.write(f"[{time}] ({role}){marker}: {msg}\n")
        
        print(f"✅ 對話紀錄已儲存到 {filename}")
        
    except Exception as e:
        print(f"⚠️ 對話紀錄下載失敗（可忽略）：{e}")


def main():
    print("正在連接 Google Sheets API...")
    service = setup_google_api()
    
    print(f"正在下載 {SHEET_NAME} 頁資料...")
    rows = download_log(service)
    save_log(rows)
    
    print("\n正在下載對話紀錄...")
    download_conversation_log(service)
    
    print("\n✅ 全部完成！")


if __name__ == "__main__":
    main()
