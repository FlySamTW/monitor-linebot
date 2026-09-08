# 已核對索引套件

此目錄保存人工核對、已登錄 SHA 的不可變索引生成產物，排程優先依原始 JSON checksum 讀取；`output/manual_library/editor_import.json` 只作 fallback 與證據。不將全索引嵌入 root `.gs`。

同一 PDF SHA 的 reviewed promotion 保留既有核對索引，不因 query 端詞彙新映射強制重建。一般新 PDF 仍由本機自動 build，經雲端 PDF／索引 SHA 與 Drive 雙讀回後原子啟用。

F612 官方 ZIP 約 60.5 MB，由本機核 archive SHA 並精確抽取唯一 entry；GAS 不下載整個 ZIP，只接收已登錄 PDF SHA 的 PDF（最多 8 MiB）及索引，在最多 12 MiB 的同一簽章請求中核對後切換。超限失敗保留舊版，不降低 SHA 守門。
