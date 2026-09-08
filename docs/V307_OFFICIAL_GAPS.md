# v307 五項官方手冊缺口重查

## 當次狀態（v29.6.311正式@1492）

F612已補官方英文38頁手冊，印刷封面S27F61*適用性核實、exactModel=false不造假；worker已原子啟用，Chrome16:19自我診斷引用第28頁成功（PDF1／Web0／router0，NT$0.005539）。M9已補官方HTML入口，非PDF索引。D392兩款及M703仍缺台灣適用證據，外區連結只供標示清楚的參考，不當成本款證據。全庫worker報告82/82 active、137 models、49 indexes、missing=[]不代表這三缺口已補齊。最新驗收見[V307_LIVE_ACCEPTANCE](V307_LIVE_ACCEPTANCE.md)。

以下初查與修復提案保留為歷史；「前三款DRM」「尚待修復入口」描述原台灣下載及當時狀態，不代表F612英文補源／M9入口現在未完成。

查核日：2026-09-08（台北）。公開 Samsung HTTP，零供應商／零登入；不改 registry、正式 GAS、Drive 或 deployment。

## 初查結論（歷史）

五項並非都「官方找不到手冊」。前三款當次官方 PDF 下載仍是 NASCA DRM 包裝；M703 的台灣 PDF 封面仍與精確型號矛盾；**M9 官方現在有繁中 HTML 使用者指南，現有 resolver 只收 UM PDF/ZIP 因而漏掉 PM HTML**。M9 可先修復官方手冊入口，但不能冒稱已完成原生 PDF 頁級索引。

| 型號／台灣官方支援頁 | 當次來源與 SHA-256 | 角色／範圍與判定 |
|---|---|---|
| [S27D392GAC](https://www.samsung.com/tw/support/model/LS27D392GACXZW/) | WUG_S39GD_ZW_TPE_20250320.pdf，fileID 10114946 / 10114947；847cf3c3fc1cca99f49ea5596ab79d611cd79d107f7133208a8ba6179aea5ee7 | 官方列 User Manual、繁中，4,964,980 bytes；開頭 `<## NASCA DRM FILE - VER1.00 ##>`，非 `%PDF-`。不解保護、不匯入。 |
| [S32D392GAC](https://www.samsung.com/tw/support/model/LS32D392GACXZW/) | 同上 SHA；各下載 URL／fileID 完整保存在 evidence.json | 同一受保護檔；不能因另一尺寸同檔就推論已核實 PDF 型號範圍。 |
| [S27F612EAC](https://www.samsung.com/tw/support/model/LS27F612EACXZW/) | WUG_S61F_ZW_TPE_241101.pdf，fileID 10043230；e11c64d5666a7fabfc0a69c4cc2a5f84dd57429bb4bb189cab2cd262257ab268 | 官方列繁中使用手冊，5,923,188 bytes；同 NASCA DRM 包裝，非標準 PDF。 |
| [S32AM703UC](https://www.samsung.com/tw/support/model/LS32AM703UCXZW/) | BN81-21287A-04_WEB_M50A M70A_ZW_TPE_220331.0.pdf，fileID 8562283；30a0340ab6ed199e04df35293ed8debefab9018330802a0412d70a51f5b2c16b | 真正120頁繁中操作手冊；已抽文及渲染檢視封面，只列 S24AM506NC、S27AM500NC、S32AM500NC、S32AM700UC，未列 M703。維持現行封面矛盾拒收，不能用白／黑色相似推論放寬。 |
| [S32FM902SC](https://www.samsung.com/tw/support/model/LS32FM902SCXZW/) | PM User Manual (HTML)，繁中 fileID 11182097，版本6.5.0；入口 f18ad267b05249161faa7fcf57f225eb332bc90e0db9f66d61f6d39bf5e715d0 | 非產品指南，官方型號支援頁直接綁定的使用者指南；入口、目錄及第一章皆當次 HTTP 成功，包含連接、Smart、影像音效、系統和支援／疑難排解。未驗全章、未證明所有選配功能均適用 M9，不得捏造 PDF 頁碼。 |

## M9 可用的官方原始入口

[繁中使用者指南](https://downloadcenter.samsung.com/content/PM/202511/20251126101919651/ZH2/TPE/start_here.html)

- 首頁標題「使用者指南」，2,643 bytes，SHA 如表。
- [目錄](https://downloadcenter.samsung.com/content/PM/202511/20251126101919651/ZH2/TPE/sidebar.html)：SHA b795f179a836aa7e7367e8ffe691b6e933e122021ce70de9333e354f9c29ebee。
- [第一章](https://downloadcenter.samsung.com/content/PM/202511/20251126101919651/ZH2/TPE/1_tv-guide_1.html)：57,567 bytes，SHA 64db0420721c498fb1ea8aac7d5f769eaa65b868584a6044146f494c5565692b。

## 當時最小修復建議（歷史）與安全界線

1. M9：手冊入口可提供已核實官方 HTML 連結，明確標「HTML 使用者指南」，不放進 PDF active index 或標記 PDF coverage ready。若要內容检索，需獨立 HTML 章節／anchor 引用契約、各章 SHA 與原始段落／選配限制守門，再驗受影響真人路徑；不可把列印轉 PDF 的自編頁數冒充原文頁碼。
2. 三款 DRM：保留可用 QA／RULE 與既有未解部分 Web 補救。未取得 Samsung 公開正常 PDF 前維持 blocked_external_document，不做 NASCA 解封裝，不從非官方鏡像補齊。
3. M703：保持封面守門；官方台灣來源若提供封面涵蓋 M703 的修正版，或另有可核實的精確適用聲明，才重新綁定。同系列／顏色相似不是授權。
4. 此次 public search 未找出另一本可驗證、可直接取代上述台灣檔案的正常官方 PDF；這是本次查核界線，不宣稱全網不存在。

## 可追溯證據

- `output/manual_library/v307_official_gaps_20260908/evidence.json`：完整下載 URL、fileID、時間、SHA、封面文字、非 PDF 標頭與本機檔案。
- 同資料夾的五份型號支援 HTML、原始下載、M703 封面 PNG、M9 原始 HTML。
- `m9_html_evidence.json`：M9 最終 URL／SHA／章節連結。
- 重跑：`$env:PYTHONUTF8='1'; python tools/probe_v307_official_gaps.py`。只產生本機證據，不匯入、不發布。

使用 smart-ui-automation 的結構化 HTTP 路徑；PDF skill 使 M703 封面同時接受文字抽取與實際渲染檢視。無需 GUI 去下載同一公開資料；此文件不等於 Bot 真人旅程驗收。

## 2026-09-08 14:50–14:54 海外官方替代文件補查

**歷史補源階段：****新證據：前三款有正常英文「使用手冊」候選，不能再籠統說官方只有DRM。** 以下PDF均從官方支援頁列出的UM ZIP取出唯一ENG項，沒有解密、沒有處理台灣NASCA檔。封面已逐份渲染檢視，目錄與正文含安裝、Menu、Support、故障排除，角色是真操作手冊而非Product Guide。尚未改registry／GAS／發布，也未把外國版的每項選配／地區功能當台灣已驗證。

| 台灣目標 | 官方來源／封面 | 已取得標準PDF證據 | 判定 |
|---|---|---|---|
| S27D392GAC、S32D392GAC | [英國S27D396GAUXXU支援](https://www.samsung.com/uk/support/model/LS27D396GAUXXU/)及[法國S32D392GAUXEN支援](https://www.samsung.com/fr/support/model/LS32D392GAUXEN/)，封面明列 `S27D39*G S32D39*G` | 37頁；`S39GD_WUG_EU_ENG_20250115.pdf`；SHA `bddf1ace78f5bbef22f4dcc3103101c6695cf9a8ec04fc6b8b6b3fa9713681a5` | 台灣目標核心S27D392G／S32D392G落在明印家族範圍；可作「官方英文家族手冊」候選。不是TW支援頁精確SKU綁定，選配／區域限制仍須守門。 |
| S27F612EAC | [芬蘭S27F612EAUXEN支援](https://www.samsung.com/fi/support/model/LS27F612EAUXEN/)，封面 `S27F61*`，規格頁34及時序表36亦同 | 38頁；`WUG_S61F_EU_L25_241113/WUG_S61F_EU_ENG_241113.pdf`；SHA `7f45f96c4bd8834dff6715a778edc55553768bd076cf1cc93183bd98683a8e16` | S27F612核心在明印家族範圍；可作官方英文家族手冊候選，不推論所有地區選配相同。 |
| S32AM703UC | [中國S32AM703UCXXF精確支援](https://www.samsung.com.cn/support/model/LS32AM703UCXXF/)，封面 `S24AM50* S27AM50* S32AM50* S32AM70*` | 簡中119頁；`BN81-21286A-04_WEB_M50A M70A_XF_S-CHI_220331.0.pdf`；SHA `161763fa0c5d23f50557ddaeb72c050ade4a3e3454ff7d845a989bbe28a2e28c` | 已證明官方另有M703同核心支援與M70家族操作文件；**未找到官方明文說台灣M703等同M700、或允許把台灣M700封面手冊直接視為M703**。中國版Smart服務／地區功能不能當台灣機的確定答案。 |

### 可重取的官方內容位址及ZIP雜湊

- S39GD：[官方ZIP](https://downloadcenter.samsung.com/content/UM/202505/20250503043024001/WUG_S39GD_EU_L25_20250326.zip)，ZIP SHA `1001e97538b14694fb8431e24c97b3f1312ce7fefcd5212f123e8a2012656ef2`。UK fileID10353800／10580900及FR10477064實際得到同ZIP／PDF SHA。
- S61F：[官方ZIP](https://downloadcenter.samsung.com/content/UM/202503/20250322033840001/WUG_S61F_EU_L25_241113.zip)，ZIP SHA `da43bb5f1a324c4e4c11a383a37981dc17d5f65db36a9e1710a08ba11e8036da`。FI列出的四筆fileID10112957／10112959／10113384／10472365均得到同SHA。
- M703：[官方簡中PDF](https://downloadcenter.samsung.com/content/UM/202204/20220403033930001/BN81-21286A-04_WEB_M50A%20M70A_XF_S-CHI_220331.0.pdf)，fileID8562281。原下載服務轉HTTP downloadcenter2本輪逾時；改讀同支援資料VPath對應的官方HTTPS `/content/` URL成功，不涉及保護繞過。
- 另查[澳洲S27D390GAEXXY](https://www.samsung.com/au/support/model/LS27D390GAEXXY/)：正常英文37頁，SHA `979d1c7ae9b4157fedf5290f349456bd4e7ff82019575083a150608780194388`，封面同家族但另列Singapore／Saudi Arabia限定型號，因此保留作交叉來源，不優先於無該段地區列名的EU候選。

### 建议整合邊界

前三款如納入，應新增具有 `official_family_cover` 與語言／來源地區標記的獨立版本，不改寫成 `official_tw_support_page` 或 `exactModelInDocument=true`。先核既有scope matcher能依封面原樣處理萬用字元與型號核心，再按頁保留原文的型號／地區限制；不為了這三款放寬跨型號／SHA守門。M703可先提供標清「中國版／簡中」的官方文件入口，不能據此解決台灣原PDF封面矛盾或Smart服務適用性。

當次程式讀查補充：`tools/audit_manual_library.py:28` 的 `scope_matches` 對印刷萬用字元使用fullmatch。`S27F61*`能匹配完整`S27F612EAC`；`S27D39*G`／`S32D39*G`不能直接匹配帶`AC`尾碼的完整台灣型號。因此D392目前只能列family candidate，須另取得可核實的尾碼／適用契約，不能偷偷擴大regex來啟用。S61F是本輪最直接符合既有封面匹配條件的英文候選。

本次實查source限UK、FI、AU、FR、CN上述五支援頁與其UM檔，不宣稱全網已窮盡。完整metadata／URL／時間／SHA在 `output/manual_library/v307_official_alternates_20260908/evidence.json`，原始PDF与封面PNG同資料夾；重查工具 `tools/probe_v307_official_alternates.py` 只產生本機證據。

## S27F612EAC 已建立可匯入版本（待主責Chrome讀回）

不再停在候選：已在 `config/manual_registry.json` 加入唯一登錄 `S61F_F612_EN_PRINTED_FAMILY_241113`。原始PDF保存於 `三星螢幕使用手冊/verified/7f45f96c4bd8834d/S27F612.pdf`。既有 `unique_printed_cover_v1` 以封面S27F61*實際驗證，不更改scope matcher；英文／EU來源、原FI支援URL、ZIP entry/SHA及地區差異註記均保留。官方fileVersion實讀241128、刊登日2025-03-21，不使用ZIP路徑日期冒充刊登日。

- **單一Chrome匯入檔**：`output/manual_library/v307_f612/editor_import.json`，115,568 bytes、1 record、完整38頁。
- indexChecksum：`1de245a1c37998a06a77160b381946333177dbfebeff7d867687ca79de7f7b4f`。
- `manual_page_rag_data.gs`只新增metadata；新增entry無data/dataRef、groups空，完整索引只在本機匯入包。逐物件檢查其他81筆未改。
- 預期匯入後82登錄／137型號／48不同索引；目前不能把本機完成冒充雲端active。
- `tools/build_v307_f612_import.py`沿用真正validate_registry、build_document、build_runtime_catalog，只建本次38頁並合併metadata，不重建／覆蓋其他手冊。
- `test_runner/verify_f612_import_v307.js`真正importer驗證SHA、Drive讀回、未匯入不ready、匯入後38頁ready、重送不增檔，英文Self Diagnosis第28頁／Eye Saver Mode第23頁召回；零供應商。頁28另已渲染檢視。
- 中文「護眼模式怎麼開」可召回23頁；純中文「自我診斷怎麼做」缺少既有跨語術語映射，目前pages=[]。不得說完整中文真人已通；英文Self Diagnosis可定位原文，通用詞彙映射須另驗。
- 同步三款D392／M703的 `manual_official_alternatives.gs` 外區URI參考資料；標籤明列英文家族／中國版參考，`referenceIsModelEvidence=false`，真正測試確認三款仍`hasReadyManualIndexForModel_=false`。M9官方HTML資料不變。

主責需先把metadata StageOnly，再使用上述單包匯入，核對新docKey、PDF SHA、indexChecksum與active讀回，最後才進入既有發布流程。本分工未提交、未發布。
# F612 補充：跨語詞彙與正式啟用阻擋（2026-09-08）

**整合方案更新：主責已指定沿用既有 worker activation，由 worker 代理新增 `queueReviewedRegisteredManualFromTestUi`（editor-only、registry-bound）；下方 atomic bridge 為必要安全契約，不表示應另造第二條 activation。** runtime 已補 `officialArchiveSha256`、`archiveEntryName`、`sourceFormat`、`bindingPolicy` 與直達 HTTPS content ZIP URL，原索引 SHA 不變。當次 HTTP/ZIP 實測：ZIP 60,494,562 bytes、26 entries；選定英文 PDF 5,513,523 bytes、deflate 壓縮 5,081,919 bytes。完整 ZIP 超過既有 GAS 48MB 下載守門，不能單純提高上限；需由本機 worker 解包並驗 archive/PDF SHA，GAS 取得小型 PDF artifact 後再次讀回 SHA。主責已收到此限制，正式啟用與 editor 實際結果另由主責記錄。

`config/manual_lexicon.json` 新增通用 `self_diagnosis`：Self Diagnosis／自我診斷／自行診斷。`python tools/update_manual_lexicon_metadata.py` 使用既有 runtime writer，只更新 lexicon，82 個 document metadata 完全相同、零重建索引。真 retrieval 英文 Self Diagnosis、SelfDiagnosis、中文「自我診斷怎麼做？」及「自行診斷怎麼做？」均以頁 28 為首筆；英文 PDF 的實際標題為 Self Diagnosis，不宣稱中文翻譯是台灣版本印刷字樣。

**重要：上文單獨 editor index 匯入通過，只證明沒有衝突 Manifest 的離線情境，不足以表示正式啟用。** 新增真 Manifest 測試：`LS27F612EACXZW` 舊 DRM SHA `e11c64d5666a7fabfc0a69c4cc2a5f84dd57429bb4bb189cab2cd262257ab268` 時，真正 `readManualRevision_` 回 null，真正 `importManualIndexRecordFromTestUi` 拋 `INDEX_SOURCE_REVISION_CHANGED`，ready=false；不繞過。

現有入口不足：

- `maintenance_reliability.gs` 的 `importManualIndexRecordFromTestUi` 先檢查 Manifest 修訂，因此不能先匯入新版；`promoteOfficialManualToRoot_` 又先要求新版 active index，存在這個外區已審核來源的先後依賴。
- `registerReviewedOfficialManualAliasFromTestUi` 強制台灣完整 SKU、台灣精確 support URL，ZIP archiveEntry 還禁止子目錄；不符合真 FI 來源，不可假造 TW 來源鏈。
- `queueVerifiedManualWorkerCanaryFromTestUi` 亦先要求 `readManualRevision_` 成立，不能用它繞過舊 Manifest。
- `adminUploadManualPdfFromBase64` 是 PDF 上傳路徑，不提供此次 PDF＋index＋Manifest 一致啟用保證。

主責需新增 editor-only registry-bound promotion bridge（本次未改 gs logic），建議契約：只收 docKey、已審核 PDF bytes、既有 index record；以部署內登錄 source SHA/indexChecksum/models/coverPatterns/FI support URL/EN 語言/地區為權威，不能由 client 改 binding。檢查 `%PDF`、PDF SHA、index 解壓 SHA/頁數/來源修訂；先寫不可變 PDF 與 index 至 Drive 並各自讀回 SHA，再於短鎖中重查舊 Manifest 未變及登錄未變，保存 prior Manifest/active，成對更新正確 FI 來源的 Manifest 與 active pointer。失敗保留既有有效版、不清 Manifest、不以 pending 暫存 URI 宣告成功；須保留 PDF 的 Drive ID 以供原檔取用。不能把這個外區 binding 寫成 official_support_page_archive_entry 台灣頁綁定。

新增入口完成後的 editor 操作順序：先 StageOnly 同步 lexicon/登錄與 bridge；呼叫 bridge 匯入 `三星螢幕使用手冊/verified/7f45f96c4bd8834d/S27F612.pdf` 加 `output/manual_library/v307_f612/editor_import.json`；再呼叫既有 `runReliabilityMaintenanceFromTestUi('library_report', token)` 讀回 ready 與索引，另讀回 Manifest 的 EN/FI 來源、PDF SHA、Drive PDF SHA；最後真 TestUI 中文自我診斷問題核頁 28。若 bridge 尚未存在，應停止在「已備妥、安全啟用待完成」，不能宣稱完整 PDF 可用。import checksum 仍為 `1de245a1c37998a06a77160b381946333177dbfebeff7d867687ca79de7f7b4f`。
