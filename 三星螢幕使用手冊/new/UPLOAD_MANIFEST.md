# new 手冊上傳清單

用途：本清單是手冊檔名、官方來源與 RAG 納管的稽核記錄。日常新機／手冊換版由每日排程自動發現、驗證並更新 Gemini Files 與 `PDF_MODEL_INDEX`，不需要執行 `/重啟`。只有官方檔案本身非標準 PDF／ZIP 或安全守門失敗時，才列為稽核缺口。

## 檔名規則

- 檔名依 PDF 第一頁實際顯示的所有型號命名。
- 多型號以半形逗號 `,` 分隔，逗號前後不加空白。
- 型號尾端國家碼、銷售碼或顏色碼英文字不進檔名；例如 `S27FG532EC` 要命名為 `S27FG532.pdf`。
- 若官方支援頁明確綁定完整 SKU，但手冊首頁是沒有型號的跨型號手冊，不可把多個支援頁合併成一個假的精確檔名。改以支援頁 SKU 拆成單型號檔，並在 `config/manual_registry.json` 保存 support URL、file ID、版本、日期與 SHA-256；回答仍受「依型號可能不支援」證據守門限制。

## 待上傳 PDF

```text
F22T450,F24T450,F27T450.pdf
S22D300,S22D400,S24D300,S24D400,S27D300,S27D400.pdf
S24C360,S24C366,S27C360,S27C366.pdf
S24D604,S24D606,S27D602,S27D606,S27D706,S27D806,S32D606,S32D702,S32D706,S32D707,S32D800,S32D806,S37D702,S37D802.pdf
S25HG402,S27HG402,S27HG612,S27HG802,S27HG806,S32HG702,S32HG732,S32HG802,S32HG806.pdf
S27A800.pdf
S27AG500,S28AG700,S32AG500,S49AG950.pdf
S27BM500,S32BM80,S32BM702,S32BM703,S32BM801,S43BM700.pdf
S27DM502,S27FM500,S27FM501,S32DM702,S32DM703,S32DM803,S32FM500,S32FM501,S32FM702,S32FM703,S32FM803,S32FM902,S43DM702,S43DM703,S43FM702,S43FM703.pdf
S27FG532.pdf
S27H704,S27H802,S32H704,S32H802,S40H850.pdf
S24F332.pdf
S32CM703.pdf
S34A650.pdf
S34C652.pdf
S49A950.pdf
S49C950.pdf
S49CG954,S49FG916.pdf
S49DG952.pdf
```

## 2026-09-04 官方來源核對

- `S24F332.pdf`：Samsung 台灣 `LS24F332EACXZW` 支援頁的英文 User Manual，版本 `1.0`、File ID `11512139`、頁面日期 `2026-06-19`，SHA-256 `050F4BE1E7AB9F71A17BB7F65C9F447242F50B04C792898F5D7404AFEB2492A9`。首頁只標示 `S24F33*`，因此 registry 設為 `official_support_page_family_pattern` 且 `exactModelInDocument=false`，不可把內容當成完整型號直接出現在文件內的證據。
- `S32CM703.pdf`：Samsung 台灣 `LS32CM703UCXZW` 支援頁的繁中 User Manual，版本 `2510220`，頁面日期 `2026-01-16`，SHA-256 `F6973810B4E9199EEFC50B3D9651360C08A03205D67A65FF6D5BCABDCAFCDC0C`。
- `S49DG952.pdf`：Samsung 台灣 `LS49DG952SCXZW` 支援頁 e-Manual ZIP 內的繁中 PDF，版本 `2312130`，頁面日期 `2024-10-02`，PDF SHA-256 `5E8E314921B56DC49DA2B785C8CA9D31EFC96D1C18A71B5D74427C556DFC0F32`。
- 舊 `S32CM703,S49DG952.pdf` 不再作為新上傳檔；它的內容與 G95SD 官方 ZIP 繁中項目一致，但合併檔名會把 M7 與 G95SD 誤當成同一精確手冊。新單型號檔上傳後會由既有「涵蓋型號較少」排序優先選用，舊檔保留作回復點，不需先刪除。

## 暫不放入的缺口

- `S27F612`：Samsung 台灣官方支援頁提供的公開手冊下載後是 `NASCA DRM` 檔頭，不是標準 PDF；現有同名檔只保留稽核，禁止上傳或寫入 Gemini 手冊索引。
- `S34DG852`：官方 User Manual 是標準 PDF，但第一頁未列出型號；官方 Product Guide 下載後是 `NASCA DRM` 檔頭。依本專案檔名規則，不能只靠頁外資訊硬命名上傳。
