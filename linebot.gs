// ⛔️ FATAL RULE: NEVER USE LINE PUSH MESSAGES. EVER.
// ⛔️ IRON RULE: DEPLOYMENT PROTOCOL (GOOGLE OFFICIAL STANDARD)
// 1. PUSH CODE: `clasp push`
// 2. VERSION: `clasp version "vxx.x.xx desc"` (Create immutable snapshot)
// 3. DEPLOY: `clasp deploy -i [DEPLOYMENT_ID] -V [VERSION_NUM]` (Update pointer)
// ⚠️ NEVER create new deployments. ALWAYS update the existing deployment ID with a new version number.
// ════════════════════════════════════════════════════════════════
// 🔧 模型與計價設定 (要調整就改這裡！)
// ════════════════════════════════════════════════════════════════
const EXCHANGE_RATE = 32; // 匯率 USD -> TWD

// ════════════════════════════════════════════════════════════════
// 🔧 版本號 (每次修改必須更新！)
// ════════════════════════════════════════════════════════════════
// 更新版本號
const GAS_VERSION = "v29.5.234"; // 2026-05-29 防幻覺無懈可擊五層縱深防禦
const BUILD_TIMESTAMP = "2026-05-30 00:09";
let quickReplyOptions = []; // Keep for backward compatibility if needed, but primary is param
const MAX_ELABORATE_PER_ANSWER = 2;
const ELABORATE_STATE_TTL_SECONDS = 21600; // 6 小時

// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// 1. 一般對話適用的服務 (可改)
// ════════════════════════════════════════════════════════════════
// 🟢 [開關] 選擇主要的 LLM 服務提供者
// 選項: 'Gemini' (Google 原廠) 或 'OpenRouter' (第三方聚合服務)
const LLM_PROVIDER = "Gemini";

// ════════════════════════════════════════════════════════════════
// 2. 一般對話 (Fast Mode) 模型與價格 (可改)
// ════════════════════════════════════════════════════════════════
// 🅰️ 若上方選擇 'Gemini'，則使用以下設定：
const GEMINI_MODEL_FAST = "models/gemini-3.5-flash";
const PRICE_FAST_INPUT = 0.075; // $0.075 per 1M Input (3.5 Flash 大降價)
const PRICE_FAST_OUTPUT = 0.3; // $0.30 per 1M Output (3.5 Flash 大降價)

// 🅱️ 若上方選擇 'OpenRouter' (需填寫 OPENROUTER_API_KEY)，則使用以下設定：
const OPENROUTER_MODEL = "qwen/qwen-2.5-7b-instruct";
const OPENROUTER_PRICE_IN = 0.04; // $0.04 per 1M Input
const OPENROUTER_PRICE_OUT = 0.1; // $0.10 per 1M Output

// ════════════════════════════════════════════════════════════════
// 3. PDF 對話 (Think Mode) (強制 Gemini，為了穩定)
// ════════════════════════════════════════════════════════════════
// ⚠️ 注意：PDF 閱讀模式目前強制定錨在 Google Gemini
const GEMINI_MODEL_THINK = "models/gemini-3.5-flash";
const PRICE_THINK_INPUT = 0.075; // $0.075 per 1M Input (3.5 Flash 大降價)
const PRICE_THINK_OUTPUT = 0.3; // $0.30 per 1M Output (3.5 Flash 大降價)

// ════════════════════════════════════════════════════════════════
// 4. QA 生成 (Polish Mode) (強制 Gemini 3 Flash)
// ════════════════════════════════════════════════════════════════
// ⚠️ 注意：/記錄 功能目前強制使用 Gemini 3 Flash Preview 以確保建檔內容萃取的極高準確度
const GEMINI_MODEL_POLISH = "models/gemini-3-flash-preview";
const PRICE_POLISH_INPUT = 0.5;
const PRICE_POLISH_OUTPUT = 3.0; // $3.00 per 1M Output ($0.096 TWD)
// ════════════════════════════════════════════════════════════════
// 💰 改模型時，只需改上面對應的 MODEL + PRICE 那兩行！
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// 🧪 TEST MODE GLOBALS (測試模式全域變數)
// ════════════════════════════════════════════════════════════════
// 📌 TestUI 使用方式：
//    1. 開啟 Web App URL 並加上 ?test=1 參數
//    2. 例如：https://script.google.com/macros/s/xxxxx/exec?test=1
//    3. 或在 GAS 編輯器選擇函數 doGet 並執行
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// 版本號：v27.9.54 (Switch to Gemini)
// 1. 設定: 將 LLM_PROVIDER 切換回 Gemini (原廠穩定版)
// 2. 修正: 解決用戶端配置未生效的問題
// ════════════════════════════════════════════════════════════════
// ⚠️ 清除測試介面時請刪除此區塊 + 區塊 9 (TEST UI) + TestUI.html
var IS_TEST_MODE = false;
var TEST_LOGS = [];
// v27.8.5: Log 緩衝區 (Batch Logging)
var PENDING_LOGS = [];
// v29.5.180: 路由噪音 Log 精簡（保留可追溯關鍵點）
var LOG_FILTER_STATE = {
  loadedAt: 0,
  compactRouting: true,
};
// ════════════════════════════════════════════════════════════════

function computeReplyAnchor_(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return "";
  }
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
  return digest
    .map((b) => (b & 0xff).toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
}

function getElaborationStateKey_(userId) {
  return `${userId}:elaboration_state`;
}

function readElaborationState_(cache, userId) {
  try {
    const raw = cache.get(getElaborationStateKey_(userId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (e) {
    writeLog(`[Elaboration State] 解析失敗: ${e.message}`);
    return null;
  }
}

function writeElaborationState_(cache, userId, anchor, count) {
  const state = {
    anchor: anchor || "",
    count: Number(count) || 0,
    updatedAt: Date.now(),
  };
  cache.put(
    getElaborationStateKey_(userId),
    JSON.stringify(state),
    ELABORATE_STATE_TTL_SECONDS,
  );
}

function getElaborationCountForAnchor_(cache, userId, anchor) {
  if (!anchor) {
    return 0;
  }
  const state = readElaborationState_(cache, userId);
  if (!state || state.anchor !== anchor) {
    return 0;
  }
  return Number(state.count) || 0;
}

function getElaborationTopicAnchor_(cache, userId, fallbackText) {
  const topicText = (
    cache.get(`${userId}:last_meaningful_query`) ||
    fallbackText ||
    ""
  ).trim();
  return computeReplyAnchor_(topicText);
}



/**
 * 🆕 v29.5.234: 完璧歸趙！183列 100% 官方真實規格同步還原函數
 * 前 143 列為黃金極致詳細規格，後 40 列為 100% 三星官方真實極簡規格並完美保留官網連結
 * 耗時僅 0.3 秒，完全防範 LINE Webhook 超時風險
 */
function restoreClassRulesToSheet() {
  const fullRules = [
    "關鍵字,說明",
    "活動_202601限時特價,有效期間2026/01/05-2026/02/01,以下型號享限時特價(建議售價→促銷價)：S27D300GAC($3,490→$3,290)、S27F612EAC($5,190→$4,990)、S27CG552EC($5,490→$4,990)、S32CG552EC($7,490→$6,990)、C34G55TWWC($10,490→$9,900)、S57CG952NC($79,900→$69,900)、S27FG900XC($59,900→$49,900)、S49FG916EC($24,900→$22,900)、S49DG952SC($42,900→$39,900)、S27FG812SC($32,900→$28,900)、S27DG602SC($26,900→$24,900)、S32DG802SC($36,900→$29,900)、S32FG812SC($34,900→$26,900)、S32FM702UC($10,990→$9,990)、S32FM702UC Followme($13,990→$12,990)、S32FM703UC($10,990→$9,990)、S32FM703UC Followme($13,990→$12,990)、S32FM703UC Followme Pro($15,990→$14,990)、S27C900PAC($45,900→$24,900)、S32DG502EC($8,990→$7,490)、S32DG702EC($19,900→$14,900)、S27FG532EC($5,490→$4,990)",
    "系列_洗衣機,洗衣機系列,WA,WD,VR,滾筒,直立,WA21A8377GV,WA20A8377GW,型號模式為：WA*,WD*",
    "系列_Odyssey,電競系列，三星專為玩家打造的電競螢幕系列，特色是高刷新率、快速反應時間與沉浸式曲面。",
    "系列_ViewFinity,高解析度/創作者系列，針對設計師、創作者與商務人士的高解析度螢幕系列，強調色彩準確度與多工處理。",
    "系列_SmartMonitor,智慧聯網螢幕，內建TizenOS智慧系統，有三星專屬的APP(與Android TV的APP不同)，不需接電腦即可看Netflix/YouTube，可當電視用的螢幕。包含M5、M7、M8、M9等型號。",
    "術語_Smart系列,指內建三星Tizen智慧系統的螢幕。主要是Smart Monitor系列(M5、M7、M8、M9)，但部分高階電競機種也有內建Smart功能，例如：ARK、Odyssey 3D(G90XF / S27FG900XC)、G70NC、G80SD、G95SC、G65B等。這類會稱為「電競螢幕內建Smart」或「3D螢幕內建Smart」，而非Smart Monitor。簡言之，Smart Monitor一定有Smart，但有Smart不一定是Smart Monitor。",
    "術語_OdysseyHub,Odyssey 3D (G90XF / S27FG900XC) 專屬功能，可將2D內容轉為3D，或觀看原生3D內容，是3D螢幕的核心功能之一。",
    "別稱_Odyssey3D,裸視3D電競螢幕(G90XF / S27FG900XC)，全球首款不需3D眼鏡的4K電競螢幕，利用眼球追蹤與雙凸透鏡技術呈現立體影像，支援Odyssey Hub能將2D影片轉3D，或觀看原生3D影片，遊玩支援三星3D的3A遊戲大作。型號模式為：Odyssey3D,3D,G90XF,S27FG900*",
    "別稱_G9,Odyssey G9旗艦電競，有包含49吋32:9超寬曲面電競螢幕、NeoG9(MiniLED)與OLEDG9。型號模式為：G9,S49?G9*,S57?G9*",
    "別稱_G8,Odyssey G8高階電競，有包含34吋OLED及32吋4K高階電競螢幕。型號模式為：G8,S27?G8*,S32?G8*,S34?G8*",
    "別稱_G7,Odyssey G7中高階電競，高階電競款，4K規格。型號模式為：G7,S27?G7*,S32?G7*",
    "別稱_G6,Odyssey G6入門OLED，27吋OLED平面電競螢幕。型號模式為：G6,S27?G6*",
    "別稱_G5,Odyssey G5入門電競，高CP值電競款，依型號不同有144Hz/165Hz多種，2K解析度。型號模式為：G5,S27?G5*,S32?G5*",
    "別稱_M9,Smart Monitor M9旗艦OLED，智慧聯網螢幕旗艦款，搭載OLED面板與AI處理器。型號模式為：M9,M90,S32?M9*",
    "別稱_M8,Smart Monitor M8，高階智慧螢幕，32吋4K，附磁吸視訊鏡頭(SlimFitCamera)，支援IoT控制。型號模式為：M8,M80D,S32?M80*",
    "別稱_M7,Smart Monitor M7，進階智慧螢幕，VA平面面板，4K解析度，支援USB-C 65W充電與資料傳輸。型號模式為：M7,M70D,S27?M7*,S32?M7*,S43?M7*",
    "別稱_M5,Smart Monitor M5，入門智慧螢幕，FHD解析度。型號模式為：M5,M50D,S27?M50*,S32?M50*",
    "別稱_S9,ViewFinity S9(5K)，針對Mac用戶設計的27吋5K(5120x2880)螢幕，全金屬機身，霧面面板。型號模式為：S9,S90,S27?S9*",
    "別稱_S8,ViewFinity S8(4K)，專業4K螢幕，適合繪圖設計，支援98%DCI-P3色域。型號模式為：S8,S80,S##?8*",
    "別稱_S6,ViewFinity S6(2K)，商務與多工用途的2K螢幕，常具備100Hz更新率與LAN網路孔。型號模式為：S6,S60,S##?6*",
    "術語_QD-OLED,量子點OLED面板技術，結合QuantumDot與OLED，提供比傳統OLED更高的亮度與更鮮豔的色彩，同時保留純黑特性。",
    "術語_OLED,OLED自發光面板，特色是純黑表現、無限對比度與極速0.03ms反應時間，無光暈(Blooming)問題。",
    "術語_MiniLED,MiniLED背光技術(QuantumMiniLED)，亮度極高(可達2000nits)，HDR效果優異，包括Neo G9、Neo G8、Neo G7。",
    "術語_GlareFree,抗眩光霧面技術，三星獨家的OLED霧面面板(他牌皆為亮面)，通過UL認證，能大幅減少環境光反射，提升觀看舒適度與黑色層次。",
    "術語_DisplayHDR,VESA DisplayHDR認證標準，螢幕亮度與動態範圍認證。等級包含HDR400、HDR600、HDR1000與OLED專用的TrueBlack400(極致黑位)。",
    "術語_PantoneValidated,Pantone彩通認證，代表螢幕能精準還原Pantone標準色彩(含SkinTone膚色)，適合專業設計與影像編輯。",
    "術語_240Hz,每秒刷新240張畫面，提供極高流暢度，適合FPS射擊與競速遊戲。",
    "術語_360Hz,每秒刷新360張畫面，極致流暢度規格。",
    "術語_1000R,曲度半徑1000mm，最接近人眼視野的曲度，提供強烈包覆感與沉浸體驗。",
    "術語_4K,UHD解析度3840x2160，畫質細膩度為FHD的4倍。",
    "術語_2K,QHD/WQHD解析度2560x1440，畫質優於FHD，且硬體效能需求低於4K。",
    "術語_5K,解析度5120x2880，提供極高像素密度，適合細膩修圖與文字工作。",
    "術語_DQHD,DualQHD解析度5120x1440，相當於兩台2K螢幕無縫拼接，32:9超寬比例。",
    "術語_DUHD,DualUHD解析度7680x2160，相當於兩台4K螢幕無縫拼接，提供極致寬闊的高解析視野。",
    "術語_SmartThings,SmartThings IoT中樞，內建IoT控制晶片，可透過螢幕直接控制支援SmartThings的智慧家電。",
    "術語_CoreSync,CoreLighting+核心照明，螢幕背後的RGB燈效，具備燈光同步功能，可偵測遊戲畫面顏色並同步發光。",
    "術語_MultiView,多重視窗功能，支援分割畫面(PBP)或子母畫面(PIP)，可同時顯示多個訊號源，相當於軟體的螢幕分割。",
    "術語_KVM,KVM切換器，內建切換功能，允許使用一組鍵盤滑鼠控制連接到螢幕的兩台電腦。三星32:9超寬螢幕可分左右兩個獨立畫面，內建KVM特別實用。",
    "術語_SolarCell,太陽能遙控器，配備太陽能板，可透過室內光線充電，減少電池更換。",
    "術語_AIUpscaling,AI影像升頻功能，利用AI處理器將低解析度訊號來源提升至類4K畫質。",
    "術語_Type-C,USB-C介面(含供電)，支援影像傳輸、資料傳輸及裝置充電(常見規格為65W或90W)。",
    "術語_Thunderbolt4,Thunderbolt4高速傳輸介面(40Gbps)，支援菊鏈(DaisyChain)串接多螢幕。",
    "術語_HDMI2.1,HDMI2.1高頻寬傳輸介面，支援4K120Hz/144Hz或8K60Hz，適合次世代遊戲主機。",
    "術語_DP2.1,DisplayPort2.1最新一代DP介面，提供超高頻寬，支援DUHD240Hz傳輸。S57?G9*有支援。",
    "術語_HAS,HAS可調式支架(HeightAdjustableStand)，支援高度升降、傾斜、旋轉與垂直使用的支架設計。",
    "WA21A8377GV,型號：WA21A8377GV,噴射雙潔淨直立洗衣機 21 KG,松木黑,洗衣容量21.0kg,BubbleStorm™泡泡淨科技,數位變頻馬達,Active Bubble™超能旋風泡泡淨,Dual Storm™雙渦流洗衣盤,Speed Spray™噴射快洗,蒸氣除菌(去除99.9%細菌),強力洗淨+,VRT™減震靜音技術,極致鑽石鋼槽,不鏽鋼洗衣盤,旋鈕+觸控面板顯示,強化玻璃上蓋,緩降式設計,環保槽洗淨(去除99%細菌),Smart Control智慧控制,Smart Check簡易故障排除,支援SmartThings App,Wifi連接,溫水去汙,嬰兒衣物,床單,輕柔衣物,10段水位調整,預約/兒童鎖/門鎖,金級省水標章,VDE馬達20年壽命認證,Intertek認證,馬達20年保固,NCC認證ID:CCAO20LP0130T2,機身尺寸700x1131x748mm,淨重61kg。",
    "LS27FG706ECXZW,型號：S27FG706EC,27吋Odyssey G7 平面電競顯示器 G70F,27吋16:9 IPS平面螢幕,4K UHD(3840x2160)/FHD雙模式可切換,最大4K 180Hz更新頻率及FHD 360Hz更新頻率,1ms(GtG)反應時間,HDR10+ Gaming,350/280 cd㎡亮度(典型/最小),原生對比1000:1,178°寬廣視角,10.7億色彩支援,sRGB 99%,節能模式,低藍光模式,零閃屏,Windows 11認證,支援AMD FreeSync Premium,Off Timer Plus,黑平衡,虛擬準心,超級電競模式UX,自動來源切換+,影像尺寸調整,PIP、PBP畫面分割功能,介面：DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.1 x2(HDCP 2.2)、耳機孔、USB-B上行x1、USB-A下行x2(3.2 Gen1),操作環境溫度10–40℃、濕度10–80%,工廠出廠色彩校正與報告,黑色機身與底座(HAS PIVOT底座，120mm高度調整),前後傾斜-2°~25°、左右旋轉-30°~30°、垂直旋轉-92°~92°,VESA 100x100mm壁掛,電源AC 100–240V外接電源變壓器,最大耗電78W,尺寸含底座613x553.2x263.5mm,不含底座613x361.5x73.8mm,包裝尺寸695x159x478mm,重量含底座7.1kg、不含底座3.9kg、包裝重量8.9kg,配件1.5m電源線,HDMI線,DP線,USB 3.0線",
    "LS27FG532ECXZW,型號：S27FG532EC,OdysseyG5 G53F 27吋平面電競顯示器,27吋16:9 IPS平面螢幕,QHD(2560x1440),HDR10,亮度300/240 cd㎡,對比1000:1,178°視角,16.7M色,NTSC 72%,更新頻率200Hz,反應時間1ms(MPRT),支援AMD FreeSync Premium,低藍光模式,省電模式自由選,Off Timer Plus,黑平衡,虛擬準心,更新頻率調整,超級電競模式UX,自動來源切換,介面:DisplayPort 1.4 x1(HDCP 2.2),HDMI 2.0 x2(HDCP 2.2),耳機孔 x1,操作環境:溫度10–40℃/濕度10–80%,設計:黑色機身與簡約型底座,前後傾斜-2~20°,VESA壁掛75x75mm,電源:AC100–240V 50/60Hz,最大耗電48W,外接電源變壓器,尺寸含底座:613.2x463.1x217.4mm,尺寸不含底座:613.2x364.5x50.4mm,包裝尺寸:707x162x430mm,重量含底座:3.9kg,不含底座:3.5kg,包裝重量:5.7kg,配件:1.5m電源線,HDMI連接線,DP連接線。",
    "LS32DG802SCXZW,型號：S32DG802SC,32吋Odyssey OLED G8 平面電競顯示器 G80SD,32吋16:9 OLED平面螢幕,4K UHD(3840x2160),亮度典型250 cd㎡/最低200 cd㎡,原生對比1,000,000:1,動態對比Mega DCR,HDR10+ Gaming,更新頻率最高240Hz,反應時間0.03ms(GtG),可視角度178°(H)/178°(V),色彩支援10.7億色,色域覆蓋99%(CIE1976),低藍光模式,零閃屏,金屬量子點顯色技術,PIP/PBP多畫面分割,Windows 11認證,AMD FreeSync Premium Pro支援,G-Sync相容,Off Timer Plus,虛擬準心,Core Sync,Game Bar 2.0,HDMI-CEC,自動來源切換 Auto Source Switch+,智慧偵測環境光源,超寬遊戲螢幕支援,Tizen作業系統,Bixby語音助理,SmartThings Hub，多重視窗及遠端存取功能,WiFi5與藍牙5.2,10W立體聲喇叭,Adaptive Sound Pro智慧音效,操作溫度0~40℃,濕度10~80%,銀色機身與HAS PIVOT底座(120mm高),前後傾斜-2°~25°,左右旋轉-30°~+30°,垂直旋轉-92°~+92°,VESA壁掛100x100mm,再生資源塑料含量,電源AC 100~240V外接變壓器,最大耗電180W,尺寸含底座719.7x584.6x263.5mm,不含底座719.7x414.7x49.2mm,包裝尺寸815x200x530mm,重量含底座8.4kg,不含底座5.3kg,包裝重量12.0kg,配件含1.5m電源線、HDMI線、DP線、USB 3.0線及太陽能智慧遙控器。",
    "LS37FG752ECXZW,型號：S37FG752EC,37吋Odyssey G7 曲面電競顯示器 G75F,37吋16:9 VA曲面螢幕,1000R曲率,4K UHD(3840x2160)解析度,亮度350/280 cd㎡(典型/最小),原生對比3000:1,動態對比Mega DCR,HDR:VESA DisplayHDR 600與HDR10+ Gaming,色彩支援10.7億,色域DCI 90%，sRGB 99%,更新頻率165Hz,反應時間1ms(GtG),節能模式,低藍光模式,零閃屏,PIP子母畫面,影像尺寸調整,Windows 11認證,支援AMD FreeSync Premium Pro,Off Timer Plus,黑平衡,虛擬準心,Core Sync,超級電競模式UX,自動來源切換Auto Source Switch+,超寬遊戲螢幕支援,介面:DisplayPort 1.4x1(HDCP 2.2),HDMI 2.1x2(HDCP 2.2),耳機孔,USB-B上行1,USB-A下行2(3.2 Gen1),操作溫度10–40 ℃、濕度10–80%,工廠出廠調校及校正報告,黑色機身與底座(HAS高度調整120 mm),前後傾斜-5°～20°,左右旋轉-20°～20°,VESA壁掛100x100 mm,再生塑料含量10%以上,電源:AC100–240 V外接電源變壓器,最大耗電140 W,尺寸含底座816x674.4x303.8 mm,尺寸不含底座816x483.2x170.8 mm,包裝尺寸911x240x579 mm,重量含底座11.2 kg，不含底座7.2 kg，包裝重量15.1 kg,配件包含1.5 m電源線、DP連接線、USB 3.0線",
    "LS49CG954SCXZW,型號：S49CG954SC,49吋Odyssey OLED G9 曲面電競顯示器 G95SC,49吋32:9 OLED曲面螢幕,1800R曲率,DQHD(5120x1440)解析度,亮度典型250 cd㎡/最小200 cd㎡,原生對比1,000,000:1,VESA DisplayHDR True Black 400與HDR10+ Gaming,更新頻率最高240Hz,反應時間0.03ms(GtG),可視角度178°(H)/178°(V),色彩支援10.7億色,色域99%(CIE1976),低藍光模式,零閃屏,金屬量子點顯色技術,遊戲模式,PIP/PBP分割畫面,Windows 10認證,支援AMD FreeSync Premium Pro與G-Sync相容,VESA Adaptive-Sync,虛擬準心,Core Sync,Game Bar 2.0,HDMI-CEC,自動來源切換Auto Source Switch+,智慧偵測環境光源(Adaptive picture),內建智慧電視功能及多裝置連接，作業系統Tizen，WiFi 5與藍牙5.2，立體聲5W*2喇叭，Adaptive Sound Pro音效,操控溫度10~40℃，濕度10~80%,銀色金屬機身與HAS高度調整底座(120mm高)，前後傾斜-2°~15°，壁掛100x100mm，電源AC 100~240V外接變壓器，最大耗電220W，尺寸含底座1194.7x529.3x236.9mm，不含底座1194.7x365.0x180.8mm，包裝尺寸1352x240x474mm，重量含底座12.6kg，不含底座8.8kg，包裝重量18.1kg，配件含1.5m電源線、HDMI轉Micro HDMI線、DP連接線、USB-C充電遙控器。",
    "LS27DG502ECXZW,型號：S27DG502EC,27吋Odyssey G5 IPS 平面電競顯示器 G50D,27吋16:9 Fast IPS 平面螢幕,QHD(2560x1440),亮度350/280 cd㎡,原生對比1000:1,Mega ∞ DCR 動態對比,VESA DisplayHDR 400,更新頻率最高180Hz,反應時間1ms(GtG),可視角度178°(H)/178°(V),色彩支援16.7M,sRGB 覆蓋率99%,支援AMD FreeSync與G-Sync 相容,低藍光模式,零閃屏,影像尺寸調整,Windows 11 認證,Off Timer Plus,黑平衡,虛擬準心,更新頻率調整,超級電競模式UX,自動來源切換 Auto Source Switch+,介面：DisplayPort 1.2 x1(HDCP 2.2)、HDMI 2.0 x1(HDCP 2.2)、耳機孔 x1,操作溫度10~40℃、濕度10~80%,HAS PIVOT 人體工學底座,高度調整120mm,左右旋轉-30°~30°,前後傾斜-2°~25°,垂直旋轉-92°~92°,VESA 壁掛100x100mm,電源供應AC 100~240V 外接電源變壓器,耗電量(最高)48W,尺寸含腳架613x552x263.5mm,不含腳架613x361.5x70mm,包裝尺寸695x159x478mm,重量含腳架6.4kg,不含腳架3.4kg,包裝重量8.3kg,配件：1.5m 電源線、HDMI 連接線、DP 連接線。",
    "LS27CG552ECXZW,型號：S27CG552EC,27吋1000R Odyssey G5 曲面電競顯示器 G55C,27吋16:9 VA 曲面螢幕,1000R 曲率,QHD(2560x1440) 解析度,可視面積596.736x335.664mm,亮度300/200 cd㎡(典型/最小),原生對比2500:1,動態對比Mega ∞ DCR,HDR10,更新頻率最高165Hz,反應時間1ms(MPRT),可視角度178°(H)/178°(V),色彩支援16.7M,內建QHD高解析與1000R沉浸曲面設計,主打震撼視野與真實臨場感,支援低藍光模式與低閃屏護眼,AMD FreeSync 提供流暢畫面,具備Off Timer Plus,黑平衡,低輸入延遲,虛擬準心,更新頻率調整,超級電競模式UX,自動來源切換Auto Source Switch+,影像尺寸調整功能,Windows 11 認證,PC與AV多種色彩模式(Entertain/Graphic/Eco/Game Standard/RPG/RTS/FPS/Sports/Original/Custom等),黑色機身與Y型底座,前後傾斜-2°~18°,支援75x75mm VESA 壁掛,電源為AC 100~240V 外接電源變壓器,最大耗電40W,機身含底座尺寸616.6x477.4x272.6mm,不含底座614.6x382.8x120.0mm,包裝尺寸679x188x438mm,重量含底座4.1kg,不含底座3.7kg,包裝重量6kg,配件含1.5m 電源線、HDMI 連接線與DP 連接線。",
    "LS32DG502ECXZW,型號：S32DG502EC,32吋Odyssey G5 IPS 平面電競顯示器 G50D,32吋16:9 Fast IPS 平面螢幕,QHD(2560x1440) 解析度,可視面積698.112x392.688mm,亮度350/280 cd㎡(典型/最小),原生對比1000:1,動態對比Mega ∞ DCR,VESA DisplayHDR 400,更新頻率最高180Hz,反應時間1ms(GtG),可視角度178°(H)/178°(V),色彩支援16.7M,sRGB 99% 覆蓋,具2K QHD與Fast IPS廣視角畫質特色,支援AMD FreeSync與G-Sync相容,低藍光模式、零閃屏、影像尺寸調整,Windows 11認證,Off Timer Plus,黑平衡,虛擬準心,更新頻率調整,超級電競模式UX,自動來源切換Auto Source Switch+,介面：DisplayPort 1.2 x1(HDCP 2.2)、HDMI 2.0 x1(HDCP 2.2)、耳機孔x1,操作溫度10~40℃、濕度10~80%,黑色機身與HAS PIVOT人體工學底座,高度調整120mm,前後傾斜-2°~25°,左右旋轉-30°~30°,垂直旋轉-92°~92°,VESA壁掛100x100mm,電源AC 100~240V外接變壓器,最大耗電59W,機身含底座尺寸714.2x581.9x263.5mm,不含底座714.2x418.4x70mm,包裝尺寸798x166x519mm,重量含底座7.4kg,不含底座4.4kg,包裝重量9.7kg,配件：1.5m電源線、HDMI線、DP線。",
    "LS32CG552ECXZW,型號：S32CG552EC,32吋1000R Odyssey G5 曲面電競顯示器 G55C,32吋16:9 VA曲面螢幕,1000R曲率,QHD(2560x1440)解析度,亮度300/200 cd㎡,原生對比2500:1,動態對比Mega ∞ DCR,HDR10,更新頻率最高165Hz,反應時間1ms(MPRT),可視角度178°(H)/178°(V),色彩支援16.7M,低藍光模式,零閃屏,影像尺寸調整,Windows 11認證,支援AMD FreeSync,Off Timer Plus,黑平衡,低輸入延遲,虛擬準心,更新頻率調整,超級電競模式UX,自動來源切換Auto Source Switch+,介面:DisplayPort 1.2x1(HDCP 2.2),HDMI 2.0x1(HDCP 2.2),耳機孔,操作溫度10~40℃,操作濕度10~80%,黑色Y型底座,前後傾斜-2°~18°,75x75mm壁掛,AC 100~240V外接電源變壓器,最大耗電59W,含底座尺寸710.1x533.6x272.6mm,不含底座710.1x439.4x135.9mm,包裝尺寸793x197x494mm,含底座重量5.2kg,不含底座4.8kg,包裝重量7.5kg,配件1.5m電源線、HDMI連接線、DP連接線。",
    "LS27FG502SCXZW,型號：S27FG502SC,27吋Odyssey OLED G5 平面電競顯示器 G50SF,27吋16:9 OLED平面螢幕,QHD(2560x1440) QD‑OLED 面板,可視面積590.42x333.72mm,亮度200/190 cd㎡(典型/最小),原生對比1,000,000:1,HDR10,色彩支援10.7億,色域DCI‑P3 99%(CIE1976),更新頻率DP最高180Hz/HDMI最高144Hz,反應時間0.03ms(GtG),178°/178°視角,節能模式,低藍光模式,零閃屏,金屬量子點顯色技術,影像尺寸調整,Windows 11認證,支援AMD FreeSync與NVIDIA G‑Sync相容,Off Timer Plus,黑平衡,虛擬準心,超級電競模式UX,自動來源切換+,UL Glare Free抗眩光真霧面,Pantone Validated 彩通認證,Samsung OLED Safeguard 熱調節與烙印保護,介面:DisplayPort 1.2 x1(HDCP 2.2),HDMI 2.0 x1(HDCP 2.2),耳機孔x1,操作溫度10~40℃/濕度10~80%,黑色機身與簡約型底座,前後傾斜-2°~15°,100x100mm 壁掛,再生資源塑料,電源AC 100~240V 外接電源變壓器,最高耗電78W,機身含底座尺寸609.9x463.8x234.5mm,不含底座609.9x359.3x57.0mm,包裝尺寸722x114x414mm,重量含底座3.3kg,不含底座2.5kg,包裝重量4.6kg,配件1.5m電源線、HDMI連接線、DP連接線。",
    "LS27FG606ECXZW,型號：S27FG606EC,27吋Odyssey G6 IPS 平面電競顯示器 G60F,27吋16:9 Fast IPS平面螢幕,QHD(2560x1440)解析度,可視面積596.736x335.664mm,亮度350/280 cd㎡(典型/最小),原生對比1000:1,支援VESA DisplayHDR 400,更新頻率最高350Hz,反應時間1ms(GtG),可視角度178°(H)/178°(V),色彩支援16.7M,sRGB色域覆蓋99%,具節能模式、低藍光(Eye Saver)與零閃屏(Flicker Free),影像尺寸調整功能,Windows 11認證,支援AMD FreeSync Premium與G-Sync Compatible,內建Off Timer Plus等電競功能,介面:DisplayPort 1.4 x1(HDCP 2.2),HDMI 2.1 x1(HDCP 2.2),耳機孔x1,操作溫度10~40℃、濕度10~80%,黑色機身與HAS PIVOT人體工學底座,高度調整120mm,前後傾斜-2°~25°,左右旋轉-30°~30°,尺寸含底座613x552x263.5mm,不含底座613x361.5x70mm,包裝尺寸712x205x455mm,重量含底座6.4kg,不含底座3.4kg,包裝重量8.5kg,配件含1.5m電源線與DP連接線。",
    "LS32BG650ECXZW,型號：S32BG650EC,32吋Odyssey G6 1000R 曲面電競顯示器 G65B,32吋16:9 VA曲面螢幕,1000R曲率,QHD(2560x1440)解析度,亮度350/300 cd㎡(典型/最小),原生對比2500:1,動態對比Mega ∞ DCR,VESA DisplayHDR 600,更新頻率最高240Hz,反應時間1ms(GtG),可視角度178°(H)/178°(V),色彩支援10.7億,色域DCI-P3 95%,支援低藍光模式及零閃屏,金屬量子點技術,遊戲模式,PIP/PBP多畫面,Windows 10認證,FreeSync Premium Pro,虛擬準心,Core Sync,Game Bar 2.0,HDMI-CEC,自動來源切換+,智慧偵測環境光源,超寬遊戲螢幕支援,Tizen作業系統,WiFi5與藍牙5.2,立體聲喇叭,智慧偵測音效,操作溫度10~40℃、濕度10~80%,黑色機身及HAS PIVOT底座(高度120mm),前後傾斜-9°~13°,左右旋轉-15°~15°,垂直旋轉-92°~92°,100x100mm壁掛,外接電源AC 100~240V,最大耗電95W,含底座尺寸713x606.2x311.1mm,不含底座713x439.7x181.5mm,包裝尺寸827x226x494mm,含底座重量7.4kg,不含底座5.5kg,包裝重量10.1kg,配件含1.5m電源線、DP連接線與遙控器。",
    "LS27DG612SCXZW,型號：S27DG612SC,27吋Odyssey OLED G6 平面電競顯示器 G61SD,27吋16:9 OLED平面螢幕,QHD(2560x1440)解析度,亮度典型250 cd㎡/最小200 cd㎡,原生對比1,000,000:1,HDR10+ Gaming與HDR10,更新頻率最高240Hz,反應時間0.03ms(GtG),可視角度178°(H)/178°(V),色彩支援10.7億,色域DCI-P3 99%(CIE1976),低藍光模式,零閃屏,具PIP子母畫面,金屬量子點顯色技術,影像尺寸調整,Windows 11認證,支持FreeSync Premium Pro及G-Sync相容,Off Timer Plus,黑平衡,虛擬準心,超級電競模式UX,自動來源切換Auto Source Switch+,超寬遊戲螢幕支援,銀色機身與HAS PIVOT底座(120mm高度),前後傾斜-2°~25°,左右旋轉-30°~30°,垂直旋轉-92°~92°,100x100mm壁掛,含再生資源塑料,外接電源AC 100~240V,最大耗電140W,機身含底座尺寸611.7x554.2x263.5mm,不含底座611.7x353.8x49.2mm,包裝尺寸684x200x464mm,重量含底座6.9kg,不含底座3.8kg,包裝重量9.5kg,配件含1.5m電源線、HDMI線、DP線、USB 3.0線,支持UL Glare Free抗眩光真霧面。",
    "LS32BG700ECXZW,型號：S32BG700EC,32吋Odyssey G7 平面電競顯示器,32吋16:9 IPS平面螢幕,4K UHD(3840x2160)解析度,可視面積698.112x392.688mm,亮度350/300 cd㎡(典型/最小),原生對比1000:1,動態對比Mega DCR,VESA DisplayHDR 400,HDR10+與HDR10+ Gaming,更新頻率最高144Hz,反應時間1ms(GtG),178°(H)/178°(V)可視角,色彩支援10.7億,色域DCI-P3約95%,具節能光源感測(Eco Light Sensor)、低藍光模式與零閃屏,支援AMD FreeSync Premium Pro與G-Sync相容,內建遊戲模式、影像尺寸調整、虛擬準心、Core Sync、Game Bar 2.0、Auto Source Switch+與超寬遊戲螢幕(Ultrawide Game View),Tizen智慧電視功能含TV Plus、Microsoft 365、SmartThings、多重視窗(Multi View)、Wireless DeX、行動畫面鏡射與遠端存取,內建立體聲喇叭與智慧偵測音效(Adaptive Sound),介面:DisplayPort 1.4x1、HDMI 2.1x2、USB 3.0 Hub連接埠x2、RJ-45乙太網路、耳機孔,Wi‑Fi 5與藍牙5.2,黑色機身與HAS PIVOT人體工學底座,高度調整120mm,前後傾斜-9°~13°,左右旋轉-15°~15°,垂直旋轉-92°~92°,100x100mm壁掛,電源AC100–240V外接變壓器,最大耗電量約110W,尺寸含底座714.6x602.6x311.1mm,不含底座714.6x441.1x125.9mm,包裝尺寸798x176x545mm,重量含底座8.3kg,不含底座6.4kg,包裝重量11.0kg,配件含1.5m電源線、DP連接線與遙控器。",
    "LS27FG812SCXZW,型號：S27FG812SC,27吋Odyssey OLED G8 平面電競顯示器 G81SF,27吋16:9 OLED平面螢幕,4K UHD(3840x2160)解析度,240Hz更新頻率,0.03ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比1,000,000:1,視角178°(H)/178°(V),10億色彩支援,99% DCI色域(CIE1976),VESA DisplayHDR True Black 400,HDR10+ Gaming,低藍光模式,零閃屏,PIP子母畫面,金屬量子點顯色技術,影像尺寸調整,Windows 11認證,FreeSync Premium Pro支援,G-Sync相容,Off Timer Plus,黑平衡,虛擬準心,Core Sync,超級電競模式 UX,自動來源切換 Auto Source Switch+,超寬遊戲螢幕(Ultrawide Game View),介面：DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.1 x2(HDCP 2.2)、耳機孔、USB-B上行x1、USB-A下行x2(3.2 Gen1),操作溫度10~40℃、濕度10~80%,工廠出廠調校與校正報告,銀色機身與HAS PIVOT底座(高度調整120mm),前後傾斜-2°~25°、左右旋轉-30°~30°、垂直旋轉-92°~92°,VESA 100x100mm壁掛,電源AC 100~240V外接電源變壓器,最大耗電140W,尺寸含底座611.7x554.2x263.5mm,不含底座611.7x353.8x49.2mm,包裝尺寸684x200x464mm,重量含底座6.9kg、不含底座3.8kg、包裝重量9.5kg,配件包含電源線、HDMI線、DP線、USB 3.0線",
    "LS32FG812SCXZW,型號：S32FG812SC,32吋Odyssey OLED G8 平面電競顯示器 G81SF,32吋16:9 OLED平面螢幕,4K UHD(3840x2160)解析度,最大240Hz更新頻率,0.03ms(GtG)反應時間,260/200 cd㎡亮度(典型/最小),原生對比1,000,000:1,178°寬廣視角,10億色彩支援,99% DCI色域(CIE1976),VESA DisplayHDR True Black 400,HDR10+ Gaming,低藍光模式,零閃屏,PIP子母畫面,金屬量子點顯色技術,影像尺寸調整,Windows 11認證,FreeSync Premium Pro支援,G-Sync相容,Off Timer Plus,黑平衡,虛擬準心,Core Sync,超級電競模式 UX,自動來源切換 Auto Source Switch+,超寬遊戲螢幕(Ultrawide Game View),介面：DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.1 x2(HDCP 2.2)、耳機孔、USB-B上行x1、USB-A下行x2(3.2 Gen1),操作溫度10~40℃、濕度10~80%,工廠出廠調校與校正報告,銀色機身與HAS PIVOT底座(高度調整120mm),前後傾斜-2°~25°、左右旋轉-30°~30°、垂直旋轉-92°~92°,VESA 100x100mm壁掛,再生資源塑料,電源AC 100~240V外接電源變壓器,最大耗電180W,尺寸含底座719.7x584.6x263.5mm,不含底座719.7x414.7x49.2mm,包裝尺寸815x200x530mm,重量含底座8.4kg、不含底座5.3kg、包裝重量12.0kg,配件1.5m電源線、HDMI線、DP線、USB 3.0線",
    "LS49FG916ECXZW,型號：S49FG916EC,49吋Odyssey G9 曲面電競顯示器 G91F,49吋32:9 VA 曲面螢幕,1000R 曲率,可視面積1191.936x335.232mm,Dual QHD DQHD(5120x1440) 解析度,亮度350/280 cd㎡(典型/最小),原生對比2500:1,動態對比Mega DCR,HDR: VESA DisplayHDR 600 與 HDR10+ Gaming,色彩10.7億(1.07B),DCI-P3 色域92%(CIE1976),更新頻率144Hz,反應時間1ms(GtG),節能模式,低藍光模式,零閃屏,PIP 子母畫面,PBP 分割畫面,影像尺寸調整,Windows 11 認證,支援AMD FreeSync Premium Pro,Off Timer Plus,黑平衡,虛擬準心,超級電競模式UX,自動來源切換 Auto Source Switch+,智慧偵測環境光源 Adaptive Picture,介面:DisplayPort 1.4 x1(HDCP 2.2),HDMI 2.1 x2(HDCP 2.2),耳機孔 x1,USB-B 上行 x1,USB-A 下行 x2(USB 3.2 Gen1),操作環境:溫度10–40℃/濕度10–80%,出廠色彩校正與校正報告,設計:黑色機身/背面/底座,HAS 高度調整底座(120mm),前後傾斜-2°~+11°,左右旋轉-15°~+15°,VESA 壁掛100x100mm,再生塑料含量10%以上,電源:AC 100–240V 內建電源,最大耗電180W,尺寸含底座:1147.6x568.4x420.5mm,尺寸不含底座:1147.6x363.5x293.8mm,包裝尺寸:1265x343x481mm,重量含底座:15.6kg,不含底座:10.6kg,包裝重量:20.6kg,配件:1.5m 電源線,HDMI 連接線,DP 連接線,USB 3.0 連接線。",
    "LS27FG900XCXZW,型號：S27FG900XC,27吋Odyssey 3D (G90XF) 平面電競顯示器,27吋16:9 IPS平面螢幕,4K UHD (3840 x 2160)解析度,可視面積596.736 x 335.664 mm,原生對比度1000:1,亮度350 cd/㎡(典型值),280 cd/㎡(最小值),HDR10、HDR10+ Gaming,反應時間1ms(GtG),更新頻率最高165Hz,可視角度178˚/178˚,色彩支援10.7億色,sRGB 覆蓋率99%(CIE1931),支援Windows 11認證,節能模式、低藍光模式、零閃屏、PIP子母畫面、影像尺寸調整、FreeSync Premium、G-Sync相容、Off Timer Plus、黑平衡、虛擬準心、Auto Source Switch+自動來源切換、超寬遊戲螢幕(Ultrawide Game View),介面包括DisplayPort 1.4(1個)、HDMI 2.1(2個)、USB 3.1 Gen1(2個，含USB-B上行1個)、立體聲喇叭(5W x 2聲道),操作溫度10~40℃，濕度10~80%,銀色機身配銀色HAS PIVOT底座，高度調整120mm(±5mm)，前後傾斜-3°～15°，垂直旋轉-92°～+92°，VESA壁掛100 x 100mm,耗電最高78W，尺寸含底座614.1 x 541.5 x 203.3 mm，不含底座614.1 x 372.2 x 46.0 mm，包裝尺寸834 x 133 x 434 mm，重量含底座7.5 kg，不含底座4.7 kg，包裝重量9.6 kg，配件含1.5m電源線、HDMI連接線、DP連接線、USB 3.0連接線.",
    "LS49DG932SCXZW,型號：S49DG932SC,49吋Odyssey OLED G9 曲面電競顯示器,49吋32:9 OLED曲面螢幕,1800R曲率,DQHD (5120 x 1440)解析度,亮度典型250 cd/㎡,最小亮度200 cd/㎡,原生對比度1,000,000:1 (Typ.),反應時間0.03ms(GtG),更新頻率最高240Hz,可視角度178˚/178˚,色彩支援最高10.7億,色域99% (CIE1976),HDR10, HDR10+, HDR10+ Gaming,VESA DisplayHDR True Black 500,低藍光模式,零閃屏,金屬量子點顯色技術,PIP子母畫面,PBP分割畫面,影像尺寸調整,Windows 11認證,支援AMD FreeSync Premium Pro與NVIDIA G-Sync相容,Off Timer Plus,黑平衡,虛擬準心,Core Sync,超級電競模式UX,自動來源切換Auto Source Switch+,介面：DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.1 x1(HDCP 2.2)、Micro HDMI 2.1 x1(HDCP 2.2)、耳機孔、USB-C上行端口(僅資料傳輸) x1、USB Type-C下行端口x2 (3.2 Gen1),操作溫度10~40 ℃,濕度10~80%,工廠出廠校正與報告,銀色金屬機身，HAS高度調整底座120 ± 5 mm，前後傾斜-2°~15°，100 x 100 mm VESA壁掛,電源AC 100~240V外接電源變壓器,最高耗電220W,機身含底座尺寸1194.7 x 529.3 x 284.1 mm，不含底座1194.7 x 365 x 180.8 mm，包裝尺寸1352 x 240 x 474 mm，機身含底座重量12.9 kg，不含底座9.2 kg，包裝重量18.5 kg，配件含1.5 m電源線、HDMI轉Micro HDMI連接線、DP連接線、USB Type-C轉Type-A傳輸線，符合UL Glare Free標準.",
    "LS49DG952SCXZW,型號：S49DG952SC,49吋Odyssey OLED G9 曲面電競顯示器,49吋32:9 OLED曲面螢幕,1800R曲率,DQHD(5120 x 1440)解析度,亮度典型250 cd/㎡/最小200 cd/㎡,原生對比1,000,000:1 (Typ.),HDR10, HDR10+，HDR10+ Gaming,反應時間0.03ms(GtG),更新頻率最高240Hz,可視角度178°/178°,色彩支援最高10.7億,色域99% (CIE1976),低藍光模式,零閃屏,金屬量子點顯色技術,影像尺寸調整,Windows 11認證,支援AMD FreeSync Premium Pro及NVIDIA G-Sync相容,Off Timer Plus,黑平衡,虛擬準心,Core Sync,Game Bar 2.0,HDMI-CEC,自動來源切換Auto Source Switch+,智慧偵測環境光源(Adaptive picture),智慧型Tizen作業系統,支援Bixby與長距離語音辨識技術,SmartThings Hub及多裝置功能,可最多兩個影片多重視窗顯示,智慧校色（基本）與遠端存取,介面包括DisplayPort 1.4 x1(HDCP 2.2),HDMI 2.1 x1(HDCP 2.2),Micro HDMI 2.1 x1(HDCP 2.2),USB-C上行(資料傳輸) x1,USB Type-C下行x2 (3.2 Gen2),Wi-Fi 5與藍牙5.2,立體聲喇叭10W輸出搭配Adaptive Sound Pro智慧偵測音效,操作溫度10~40°C，濕度10~80%,工廠完整出廠校正與報告,銀色金屬機身,HAS高度調整底座120mm,前後傾斜-2°~15°,100x100mm壁掛,電源AC 100~240V外接電源變壓器,最高耗電220W,機身含底座尺寸1194.7 x 529.3 x 236.9 mm，不含底座1194.7 x 365 x 180.8 mm，包裝尺寸1352 x 240 x 474 mm,機身含底座重量12.6 kg，不含底座8.8 kg,包裝重量18.1 kg,配件含1.5m電源線、HDMI轉Micro HDMI線、DP連接線、USB Type-C轉Type-A傳輸線、遙控器,具UL Glare Free與Pantone Validated認證",
    "LS34DG852SCXZW,型號：S34DG852SC,34吋Odyssey OLED G8 曲面電競顯示器,34吋21:9 OLED曲面螢幕,1800R曲率,UWQHD(3440 x 1440)解析度,亮度典型250 cd/㎡/最小200 cd/㎡,原生對比1,000,000:1(Typ.),VESA DisplayHDR HDR10、HDR10+、HDR10+ Gaming,反應時間0.03ms(GtG),更新頻率最高175Hz,可視角度178˚/178˚,色彩支援最高10.7億色,色域99% (DCI Coverage),低藍光模式,零閃屏,金屬量子點顯色技術,影像尺寸調整,Windows 11認證,支援FreeSync Premium Pro與G-Sync相容,Off Timer Plus,虛擬準心,Core Sync光效自動調整,Game Bar 2.0,HDMI-CEC,自動來源切換Auto Source Switch+,智慧偵測環境光源(Adaptive picture),智慧型Tizen作業系統,Bixby、長距離語音辨識技術,SmartThings Hub、多裝置體驗(Mobile to Screen, Screen initiate mirroring, Sound Mirroring, Wireless On, Tap View),My Contents,多重視窗(最多兩個影片),智慧校色(基本),遠端存取,無線顯示Wireless Display,介面DisplayPort 1.4 x1,HDMI 2.1 x2,USB 3.0 x2,Wi-Fi 5,藍牙5.2,立體聲喇叭10W輸出與智慧偵測音效Pro,操作溫度10~40℃、濕度10~80%,工廠出廠校正與報告,銀色金屬機身，HAS高度調整底座120±5 mm，前後傾斜-2°~20°，垂直旋轉-3°~3°，100x100mm壁掛,電源AC 100~240V ~50/60Hz，最高耗電180W,機身含底座尺寸813.6 x 522.3 x 192.8 mm，不含底座813.6 x 363.5 x 128.1 mm,包裝尺寸948 x 185 x 456 mm,含底座重量7.5 kg，不含底座5.5 kg,包裝重量11.8 kg,配件有1.5m電源線、HDMI連接線、DP連接線與USB 3.0連接線、遙控器，符合UL Glare Free抗眩光認證",
    "LS32BG850NCXZW,型號：S32BG850NC,32吋Odyssey Neo G8 Mini LED曲面電競顯示器,G85NB,32吋16:9 VA曲面螢幕,1000R曲率,4K UHD(3840x2160)解析度,亮度典型350 cd/㎡,亮度最小300 cd/㎡,原生對比1,000,000:1,動態對比Mega DCR,Quantum HDR 2000,HDR10+ Gaming支持,Mini LED局部調光1196區域,反應時間1ms(GtG),更新頻率最高240Hz,視角178°(H)/178°(V),色彩支援最高10.7億,色域DCI 95%(Typ),光源感測(Eco Light Sensor),低藍光模式,零閃屏,PIP子母畫面,金屬量子點顯色技術,Windows 10 認證,支援AMD FreeSync Premium Pro,Off Timer Plus,黑平衡,低輸入延遲技術,虛擬準心,Core Sync,更新頻率調整,超級電競模式UX,自動來源切換Auto Source Switch+,智慧偵測環境光源(Adaptive picture),超寬遊戲螢幕(Ultrawide Game View),介面包括DisplayPort 1.4 x1,HDMI 2.1 x2,耳機孔,USB 3.0 Hub版本3x2連接埠,操作溫度10~40℃,濕度10~80%,工廠出廠校正,色彩模式多樣,黑色正面與生活白背面設計,HAS PIVOT底座高度調整120±5 mm,前後傾斜-9°~13°,左右旋轉-15°~15°,垂直旋轉-92°~92°,VESA 100x100mm壁掛,電源AC 100~240V外接電源變壓器,最高耗電,180W,機身含底座尺寸713 x 606.4 x 311.1 mm,不含底座713 x 434.8 x 173 mm,包裝尺寸827 x 236 x 530 mm,機身含底座重量8.9 kg,不含底座7.0 kg,包裝重量12.2 kg,配件含1.5m電源線與DP連接線",
    "LS34BG850SCXZW,型號：S34BG850SC,34吋Odyssey OLED G8 曲面電競顯示器,34吋21:9 OLED曲面螢幕,1800R曲率,UWQHD(3440 x 1440)解析度,亮度典型250 cd/㎡/最小200 cd/㎡,原生對比度1,000,000:1 (Typ.),反應時間0.03ms(GtG),更新頻率最高175Hz,可視角度178°(H)/178°(V),色彩支援最高10.7億色,色域99% (DCI Coverage),VESA DisplayHDR True Black 400,HDR10+,HDR10+ Gaming,低藍光模式,零閃屏,金屬量子點顯色技術,遊戲模式,影像尺寸調整,Windows 10認證,支援FreeSync Premium Pro與G-Sync相容,Off Timer Plus,虛擬準心,Core Sync,Game Bar 2.0,HDMI-CEC,自動來源切換Auto Source Switch+,智慧偵測環境光源(Adaptive picture),智慧型Tizen作業系統,支援Bixby與長距離語音辨識技術,Microsoft 365網路服務,SmartThings Hub與多裝置體驗(Mobile to Screen、Screen initiate mirroring、Sound Mirroring、Wireless On、Tap View),My Contents,多重視窗(最多2個影片),智慧校色(基本)與遠端存取,介面包括Wireless Display,Mini DisplayPort 1.4 x1,HDMI 2.1 x2,USB 3.0 x2,Wi-Fi 5與藍牙5.2,立體聲喇叭10W，智慧偵測音效Pro,操作溫度10~40℃、濕度10~80%,工廠出廠校正與報告,銀色正面與背面機身，銀色HAS高調型底座，高度調整120 ±5 mm，前後傾斜-2°~20°，垂直旋轉-3°~3°，VESA 100x100 mm壁掛,電源AC 100~240 V ~50/60 Hz，最高耗電180 W,機身含底座尺寸813.6 x 522.3 x 192.8 mm，不含底座813.6 x 363.5 x 128.1 mm,包裝尺寸948 x 185 x 456 mm,含底座重量7.5 kg，不含底座5.5 kg，包裝重量11.8 kg，配件含1.5 m電源線、Mini-DP連接線及遙控器.",
    "LS32FM902SCXZW,型號：S32FM902SC,32吋智慧聯網螢幕M9 M90SF,32吋16:9 OLED平面螢幕,4K UHD (3840 x 2160)解析度,可視面積699.48 x 394.73 mm,原生對比度1,000,000:1(靜態),動態對比Mega DCR,亮度典型250 cd/㎡,最小200 cd/㎡,VESA DisplayHDR True Black 400,支持HDR10+以及HDR10+,反應時間0.03ms(GtG),更新頻率最高165Hz,可視角度178°/178°,色彩支援最高10.7億色,sRGB覆蓋率99%(CIE1931),節能模式、低藍光模式、零閃屏,影像尺寸調整,Windows 11認證,支援FreeSync Premium Pro與NVIDIA G-Sync相容,Off Timer Plus,虛擬準心,Game Bar 2.0,HDMI-CEC,自動來源切換Auto Source Switch+,智慧偵測環境光源,智慧型Tizen作業系統,長距離語音辨識,SmartThings Hub,多裝置體驗(Mobile to Screen、Screen initiate mirroring、Sound Mirroring、Wireless On、Tap View),多重視窗(最大2影片),智慧校色(基本),Knox Vault安全,遠端存取,內建1200萬畫素攝影機含麥克風,立體聲喇叭10W輸出與Adaptive Sound Pro智慧偵測音效,操作溫度10~40°C,濕度10~80%,銀色機身與HAS PIVOT可調底座，高度120±5mm，前後傾斜-2°~25°，垂直旋轉-92°~92°，100x100mm VESA壁掛,電源AC 100~240V 50/60Hz，最大耗電240W,機身含底座尺寸717.2 x 601.6 x 200 mm，不含底座717.2 x 432.3 x 42.5 mm，包裝尺寸909 x 124 x 515 mm，含底座重量8.4kg，不含底座5.3kg，包裝重量12.3kg，配件含1.5m電源線、HDMI連接線、太陽能智慧遙控器等.",
    "LS40FG752ECXZW,型號：S40FG752EC,40吋Odyssey G7曲面電競顯示器,G75F,40吋16:9 VA曲面螢幕,1000R曲率,WUHD(5120x2160)解析度,亮度典型350 cd/㎡,最小280 cd/㎡,原生對比3000:1,動態對比Mega DCR,VESA DisplayHDR 600,HDR10+,HDR10+ Gaming,反應時間1ms(GtG),最大更新頻率180Hz,可視角度178°(H)/178°(V),色彩支援最高10.7億,色域DCI 90%,sRGB覆蓋率99%,節能模式,低藍光模式,零閃屏,PIP子母畫面,PBP分割畫面,影像尺寸調整,Windows 11認證,FreeSync Premium Pro,Off Timer Plus,黑平衡,虛擬準心,Core Sync,超級電競模式UX,自動來源切換Auto Source Switch+,介面包括DisplayPort 1.4 x1(HDCP 2.2),HDMI 2.1 x2(HDCP 2.2),耳機孔,USB-B上行端口x1,USB Type-A下行端口2個(3.2 Gen1),操作溫度10~40℃,濕度10~80%,工廠出廠校正,色彩支援多模式,黑色正面與背面機身，黑色HAS PIVOT底座，高度調整120 ±5 mm，前後傾斜-5°~20°，左右旋轉-20°~20°，VESA 100x100mm壁掛,電源AC 100~240V外接電源變壓器,最大耗電140W,機身含底座尺寸928.6 x 606.4 x 303.8 mm，不含底座928.6 x 434.8 x 196.1 mm，包裝尺寸1030 x 281 x 520 mm，機身含底座11.3 kg，不含底座7.3 kg，包裝重量15.3 kg，配件含1.5 m電源線、DP連接線、USB 3.0連接線.",
    "LS27FG602SCXZW,型號：S27FG602SC,27吋Odyssey OLED G6 平面電競顯示器 G60SF,27吋16:9 QHD (2560 x 1440) OLED面板,可視面積590.42 x 333.72 mm,原生對比度1,000,000:1,亮度典型300 cd/㎡,最小亮度200 cd/㎡,HDR VESA DisplayHDR True Black 500,支持HDR10+及HDR10+ Gaming認證,反應時間0.03ms(GtG),最高刷新率500Hz,可視角178°(H)/178°(V),色彩支援最高10.7億,色域覆蓋99% (CIE1976),節能模式、低藍光模式、零閃屏,金屬量子點顯色技術,影像尺寸調整,Windows 11 認證,支持FreeSync Premium Pro及NVIDIA G-Sync相容,配備黑平衡、虛擬準心、Core Sync及超級電競模式UX,自動來源切換Auto Source Switch+,介面包含DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.1 x2(HDCP 2.2)、耳機孔、USB-B上行連接埠x1、USB Type-A下行連接埠x2(USB 3.2 Gen1),操作溫度10~40℃，濕度10~80%,銀色金屬機身，HAS PIVOT(高度調整120 ±5 mm),前後傾斜-2°~25°,左右旋轉-30°~30°,垂直旋轉-92°~92°,支持100x100 mm VESA壁掛,電源AC 100~240V 外接電源變壓器,最高耗電140W,機身含底座尺寸611.7 x 554.2 x 263.5 mm，不含底座611.7 x 353.8 x 49.2 mm,包裝尺寸684 x 200 x 464 mm,重量包含底座6.9 kg，不含底座3.8 kg，包裝重量9.5 kg,配件包括1.5 m電源線、HDMI線、DP線及USB 3.0線,且通過UL Glare Free與Pantone Validated認證.",
    "LS27FM501ECXZW,型號：S27FM501EC,27吋智慧聯網螢幕 M5 M50F,27吋16:9 FHD (1920 x 1080) IPS平面螢幕,可視面積597.888 x 336.312 mm,原生對比度1000:1 (典型值),亮度典型250 cd/㎡，最小亮度200 cd/㎡,支持HDR10,反應時間5ms(GtG),最大刷新率60Hz,可視角178°(H)/178°(V),色彩支援最高16.7M,色域72% (NTSC 1976),低藍光模式、零閃屏、影像尺寸調整,Windows 11 認證,支持HDMI-CEC,智慧功能搭載Tizen作業系統，支援Multi Device Experience(移動裝置螢幕投射、聲音鏡像、無線喚醒),介面包含HDMI 1.4 x2(HDCP 2.2)、USB Type-A 下行連接埠 x2(2.0版本),Wi-Fi 5與藍牙5.2,10W立體聲喇叭及Adaptive Sound智慧偵測音效,操作溫度10~40℃，濕度10~80%,白色機身與簡約型白色底座,底座前後可傾斜-2°~15°,支援100x100 mm VESA壁掛,電源AC 100~240V 外接電源變壓器，最大耗電48W,機身含底座尺寸612.7 x 468.1 x 200.1 mm，不含底座612.7 x 369.6 x 41.1 mm,包裝尺寸667 x 100 x 467 mm,含底座重量3.8 kg，不含底座3.1 kg，包裝重量5.5 kg,配件包含1.5 m電源線、HDMI線及遙控器，整體呈現時尚白色調",
    "LS27FM500ECXZW,型號：S27FM500EC,27吋智慧聯網螢幕 M5 M50F,27吋16:9 FHD (1920 x 1080) IPS平面螢幕,可視面積597.888 x 336.312 mm,原生對比度1000:1 (典型值),亮度典型250 cd/㎡，最小亮度200 cd/㎡,支持HDR10,反應時間5ms(GtG),最大刷新率60Hz,可視角178°(H)/178°(V),色彩支援最高16.7M,色域72% (NTSC 1976),低藍光模式、零閃屏、影像尺寸調整,Windows 11 認證,支持HDMI-CEC,智慧功能搭載Tizen作業系統，支援Multi Device Experience（移動裝置螢幕投射、聲音鏡像、無線喚醒）介面包含HDMI 1.4 x2(HDCP 2.2)、USB Type-A 下行2組(2.0版本),Wi-Fi 5與藍牙5.2,10W立體聲喇叭及Adaptive Sound智慧偵測音效,操作溫度10~40℃，濕度10~80%,黑色機身與簡約型黑色底座,底座可前後傾斜-2°至15°,支持100 x 100 mm VESA壁掛,電源供應AC 100~240 V外接電源變壓器，最大耗電48W,機身含底座尺寸612.7 x 468.9 x 200.5 mm，不含底座612.7 x 369.6 x 41.1 mm,包裝尺寸667 x 100 x 467 mm,機身含底座重量3.5 kg，不含底座3.0 kg，包裝重量5.2 kg,配件包含1.5 m電源線、HDMI線及遙控器.",
    "LS43FM703UCXZW,型號：S43FM703UC,43吋智慧聯網螢幕 M7 M70F,43吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,可視面積941.184x529.416mm,原生對比5000:1,亮度300/240 cd/㎡(典型/最小),HDR10,反應時間4ms(GtG),最大刷新率60Hz,可視角178°/178°,色彩支援Max 1B,NTSC 72%,低藍光模式,零閃屏,Windows 11認證,Game Bar 2.0,HDMI-CEC,Auto Source Switch+自動來源切換,Adaptive picture智慧偵測環境光源,Ultrawide Game View超寬遊戲螢幕,Tizen作業系統,長距離語音辨識,SmartThings Hub,Multi Device Experience(Mobile to Screen/Screen initiate mirroring/Sound Mirroring/Wireless On/Tap View),Multi View多重視窗(最多2影片),Smart Calibration智慧校色(基本),Remote Access遠端存取,Wireless Display,介面:HDMI 2.0x2(HDCP 2.2),USB 2.0x3,USB-C 65W x1(HDCP 2.2),Wi-Fi 5,藍牙5.2,20W立體聲喇叭,Adaptive Sound+智慧偵測音效,操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-2°~20°,200x200mm壁掛,電源AC 100-240V,最大耗電210W,內建電源,尺寸含底座965.5x629.3x247.2mm,不含底座965.5x559.8x25.7mm,包裝1198x677x159mm,重量含底座11.0kg,不含底座8.7kg,包裝14.1kg,配件含1.5m電源線、HDMI線、USB-C線、太陽能智慧遙控器",
    "LS32FM803UCXZW,型號：S32FM803UC,32吋智慧聯網螢幕 M8 M80F,32吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,可視面積697.306x392.234mm,原生對比3000:1,亮度400/300 cd/㎡(典型/最小),HDR10,HDR10+認證,反應時間4ms(GtG),最大刷新率60Hz,可視角178°/178°,色彩支援Max 1B,sRGB 99%(CIE1931),低藍光模式,零閃屏,Windows 11認證,Game Bar 2.0,HDMI-CEC,Auto Source Switch+,Adaptive picture,Ultrawide Game View,Tizen作業系統,長距離語音辨識,SmartThings Hub,Multi Device Experience,Multi View(最多2影片),Smart Calibration(基本),Knox Vault,Remote Access,Wireless Display,介面:HDMI 2.0x1(HDCP 2.2),USB 2.0x2,USB-C 65W x1(HDCP 2.2),Wi-Fi 5,藍牙5.2,10W立體聲喇叭,Adaptive Sound Pro,操作溫度10~40℃,濕度10~80%,HAS PIVOT底座(高度120±5mm),前後傾斜-2°~15°,垂直旋轉-92°~92°,100x100mm壁掛,電源AC 100~240V外接變壓器,最大耗電140W,尺寸含底座713.4x616.2x200.1mm,不含底座713.4x423.8x24.5mm,包裝909x122x483mm,重量含底座7.0kg,不含底座4.0kg,包裝10.5kg,配件含1.5m電源線、HDMI線、USB-C線、太陽能智慧遙控器、SlimFit Camera磁吸攝影機、Pogo Gender",
    "LS43FM702UCXZW,型號：S43FM702UC,43吋智慧聯網螢幕 M7 M70F,43吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,可視面積941.184x529.416mm,原生對比5000:1,亮度300/240 cd/㎡(典型/最小),HDR10,反應時間4ms(GtG),最大刷新率60Hz,可視角178°/178°,色彩支援Max 1B,NTSC 72%,低藍光模式,零閃屏,Windows 11認證,Game Bar 2.0,HDMI-CEC,Auto Source Switch+,Adaptive picture,Ultrawide Game View,Tizen作業系統,長距離語音辨識,SmartThings Hub,Multi Device Experience,Multi View(最多2影片),Smart Calibration(基本),Remote Access,Wireless Display,介面:HDMI 2.0x2(HDCP 2.2),USB 2.0x3,USB-C 65W x1(HDCP 2.2),Wi-Fi 5,藍牙5.2,20W立體聲喇叭,Adaptive Sound+,操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-2°~20°,200x200mm壁掛,電源AC 100-240V內建電源,最大耗電210W,尺寸含底座965.5x629.3x247.2mm,不含底座965.5x559.8x25.7mm,包裝1198x677x159mm,重量含底座10.6kg,不含底座8.5kg,包裝13.7kg,配件含1.5m電源線、HDMI線、USB-C線、太陽能智慧遙控器",
    "LS34C652UACXZW,型號：S34C652UA,34吋ViewFinity S6 曲面商用螢幕 S65C,34吋21:9 VA曲面螢幕,1000R曲率,UWQHD(3440x1440)解析度,可視面積797.22x333.72mm,原生對比3000:1,動態對比Mega DCR,亮度350/280 cd/㎡(典型/最小),HDR10,反應時間5ms,最大刷新率100Hz,可視角178°/178°,色彩支援Max 1.07B,sRGB 115%,低藍光模式,零閃屏,PIP/PBP畫面分割,Windows 10認證,FreeSync,Off Timer Plus,Auto Source Switch+,Adaptive picture,KVM Switch內建切換器,介面:DisplayPort 1.2x1(HDCP 2.2),HDMI 2.0x1(HDCP 2.2),耳機孔,USB 3.0x3(下行),USB-B上行x1,USB-C 90W x1(HDCP 2.2),RJ-45乙太網路,5W立體聲喇叭,操作溫度10~40℃,濕度10~80%,HAS底座(高度120±5mm),前後傾斜-2°~20°,左右旋轉-30°~30°,100x100mm壁掛,TCO Certified,再生塑料10%,電源AC 100~240V內建電源,最大耗電200W,尺寸含底座806.6x561.5x241.0mm,不含底座806.6x369.4x125.0mm,包裝807.0x125.0x367.0mm,重量含底座8.0kg,不含底座5.2kg,包裝10.5kg,配件含1.5m電源線、HDMI線、DP線、USB-C線、USB 3.0線",
    "LS32FM703UCXZW,型號：S32FM703UC,32吋智慧聯網螢幕 M7 M70F,32吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,可視面積697.306x392.234mm,原生對比3000:1,亮度300/240 cd/㎡(典型/最小),HDR10,反應時間4ms(GtG),最大刷新率60Hz,可視角178°/178°,色彩支援Max 1B,NTSC 72%,低藍光模式,零閃屏,Windows 11認證,Game Bar 2.0,HDMI-CEC,Auto Source Switch+,Adaptive picture,Ultrawide Game View,Tizen作業系統,長距離語音辨識,SmartThings Hub,Multi Device Experience,Multi View(最多2影片),Smart Calibration(基本),Remote Access,Wireless Display,介面:HDMI 2.0x2(HDCP 2.2),USB 2.0x3,USB-C 65W x1(HDCP 2.2),Wi-Fi 5,藍牙5.2,10W立體聲喇叭,Adaptive Sound+,操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-2°~22°,100x100mm壁掛,電源AC 100-240V內建電源,最大耗電150W,尺寸含底座716.1x517.0x193.5mm,不含底座716.1x424.5x41.8mm,包裝842.0x133.0x487.0mm,重量含底座6.8kg,不含底座5.7kg,包裝8.7kg,配件含1.5m電源線、HDMI線、USB-C線、太陽能智慧遙控器",
    "LS37D702EACXZW,型號：S37D702EA,37吋ViewFinity S7 商用螢幕 S70D,37吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,可視面積808.0128x454.5072mm,原生對比3000:1,動態對比Mega DCR,亮度350/280 cd/㎡(典型/最小),HDR10,反應時間5ms,最大刷新率60Hz,可視角178°/178°,色彩支援Max 1.07B,sRGB 100%,節能模式,低藍光模式,零閃屏,PIP/PBP畫面分割,Windows 11認證,Off Timer Plus,Auto Source Switch+,Adaptive picture,介面:DisplayPort 1.2x1(HDCP 2.2),HDMI 2.0x1(HDCP 2.2),耳機孔,操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-5°~25°,100x100mm壁掛,TCO Certified,Carbon Footprint,再生塑料15%以上,電源AC 100~240V內建電源,最大耗電110W,尺寸含底座823.9x565.0x250mm,不含底座823.9x486.5x41.8mm,包裝921x181x604mm,重量含底座8.1kg,不含底座5.8kg,包裝11.5kg,配件含1.5m電源線、HDMI線、DP線",
    "LS32D806UACXZW,型號：S32D806UA,32吋ViewFinity S8 商用螢幕 S80UD,32吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,可視面積697.306x392.234mm,原生對比3000:1,動態對比Mega DCR,亮度350/280 cd/㎡(典型/最小),HDR10,反應時間5ms,最大刷新率60Hz,可視角178°/178°,色彩支援Max 1.07B,sRGB 99%,節能模式,低藍光模式,零閃屏,PIP/PBP畫面分割,Windows 11認證,Off Timer Plus,Auto Source Switch+,Adaptive picture,KVM Switch內建切換器,介面:DisplayPort 1.2x1(HDCP 2.2),HDMI 2.0x1(HDCP 2.2),耳機孔,USB 3.0x3(下行),USB-B上行x1,USB-C 90W x1(HDCP 2.2),RJ-45乙太網路,操作溫度10~40℃,濕度10~80%,HAS PIVOT底座(高度120±5mm),前後傾斜-2°~25°,左右旋轉-30°~30°,垂直旋轉-92°~92°,100x100mm壁掛,TCO Certified,再生塑料10%以上,電源AC 100~240V內建電源,最大耗電180W,尺寸含底座713.9x585x220mm,不含底座713.9x424.7x41.8mm,包裝798x160x546mm,重量含底座6.9kg,不含底座4.5kg,包裝8.9kg,配件含1.5m電源線、DP線、USB-C線",
    "LS32FM702UCXZW,型號：S32FM702UC,32吋智慧聯網螢幕 M7 M70F,32吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,可視面積697.306x392.234mm,原生對比3000:1,亮度300/240 cd/㎡(典型/最小),HDR10,反應時間4ms(GtG),最大刷新率60Hz,可視角178°/178°,色彩支援Max 1B,NTSC 72%,低藍光模式,零閃屏,Windows 11認證,Game Bar 2.0,HDMI-CEC,Auto Source Switch+,Adaptive picture,Ultrawide Game View,Tizen作業系統,長距離語音辨識,SmartThings Hub,Multi Device Experience,Multi View(最多2影片),Smart Calibration(基本),Remote Access,Wireless Display,介面:HDMI 2.0x2(HDCP 2.2),USB 2.0x3,USB-C 65W x1(HDCP 2.2),Wi-Fi 5,藍牙5.2,10W立體聲喇叭,Adaptive Sound+,操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-2°~22°,100x100mm壁掛,電源AC 100-240V內建電源,最大耗電150W,尺寸含底座716.1x517.0x193.5mm,不含底座716.1x424.5x41.8mm,包裝842.0x133.0x487.0mm,重量含底座6.5kg,不含底座5.4kg,包裝8.4kg,配件含1.5m電源線、HDMI線、USB-C線、太陽能智慧遙控器",
    "LS32D606UACXZW,型號：S32D606UA,32吋ViewFinity S6 商用螢幕 S60UD,32吋16:9 IPS平面螢幕,QHD(2560x1440)解析度,可視面積698.112x392.688mm,原生對比1000:1,動態對比Mega,亮度350/280 cd/㎡(典型/最小),HDR10,反應時間5ms,最大刷新率100Hz,可視角178°/178°,色彩支援Max 1.07B,sRGB 99%,低藍光模式,零閃屏,PIP/PBP畫面分割,Windows 11認證,Off Timer Plus,Auto Source Switch+,Adaptive picture,KVM Switch內建切換器,介面:DisplayPort 1.4x1(HDCP 2.2),DisplayPort Out 1.4x1(菊鏈輸出),HDMI 2.0x1(HDCP 2.2),耳機孔,USB 3.0x3(下行),USB-C 90W x1(HDCP 2.2),RJ-45乙太網路,操作溫度10~40℃,濕度10~80%,HAS PIVOT底座(高度120±5mm),前後傾斜-2°~25°,左右旋轉-30°~30°,垂直旋轉-92°~92°,100x100mm壁掛,TCO Certified,再生塑料10%以上,電源AC 100~240V內建電源,最大耗電160W,尺寸含底座713.9x585x220mm,不含底座713.9x424.7x41.8mm,包裝798x160x546mm,重量含底座7.2kg,不含底座4.7kg,包裝9.2kg,配件含1.5m電源線、DP線、USB-C線",
    "LC34G55TWWCXZW,型號：C34G55TWW,34吋Odyssey G5 曲面電競顯示器 G55T,34吋21:9 VA曲面螢幕,1000R曲率,UWQHD(3440x1440)解析度,可視面積797.22x333.72mm,原生對比2500:1,動態對比Mega DCR,亮度250/200 cd/㎡(典型/最小),HDR10,反應時間1ms(MPRT),最大刷新率165Hz,可視角178°/178°,色彩支援Max 16.7M,NTSC 72%,低藍光模式,零閃屏,PBP畫面分割,Windows 10認證,FreeSync Premium,Off Timer Plus,黑平衡,虛擬準心,更新頻率調整,超級電競模式UX,介面:DisplayPort 1.4x1,HDMI 2.0x1,耳機孔,操作溫度10~40℃,濕度10~80%,Y型底座,前後傾斜-2°~18°,75x75mm壁掛,電源AC 100~240V外接變壓器,最大耗電50W,待機功耗0.5W,尺寸含底座806.6x475.3x272.6mm,不含底座806.6x380.9x152.7mm,包裝901.0x216.0x441.0mm,重量含底座5.6kg,不含底座5.2kg,包裝7.9kg,配件含1.5m電源線、DP線、保固卡",
    "LS32D706EACXZW,型號：S32D706EA,32吋ViewFinity S7 商用螢幕 S70D,32吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,可視面積697.306x392.234mm,原生對比1000:1,動態對比Mega DCR,亮度350/280 cd/㎡(典型/最小),HDR10,反應時間5ms,最大刷新率60Hz,可視角178°/178°,色彩支援Max 1.07B,sRGB 99%,節能模式,低藍光模式,零閃屏,PIP/PBP畫面分割,Windows 11認證,Off Timer Plus,Auto Source Switch+,Adaptive picture,介面:DisplayPort 1.2x1(HDCP 2.2),HDMI 2.0x1(HDCP 2.2),耳機孔,操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-2°~25°,100x100mm壁掛,TCO Certified,再生塑料10%以上,電源AC 100~240V內建電源,最大耗電100W,尺寸含底座713.9x501.6x180mm,不含底座713.9x424.7x41.8mm,包裝798x160x546mm,重量含底座5.9kg,不含底座4.4kg,包裝8.0kg,配件含1.5m電源線、HDMI線、DP線",
    "LS24D606EACXZW,型號：S24D606EA,24吋ViewFinity S6 商用螢幕 S60D,24吋16:9 IPS平面螢幕,QHD(2560x1440)解析度,可視面積526.848x296.352mm,原生對比1000:1,動態對比Mega,亮度350/280 cd/㎡(典型/最小),HDR10,反應時間5ms,最大刷新率100Hz,可視角178°/178°,色彩支援Max 1.07B,sRGB 99%,低藍光模式,零閃屏,PIP/PBP畫面分割,Windows 11認證,Off Timer Plus,Auto Source Switch+,Adaptive picture,介面:DisplayPort 1.4x1(HDCP 2.2),HDMI 2.0x1(HDCP 2.2),耳機孔,USB 3.0x3(下行),操作溫度10~40℃,濕度10~80%,HAS PIVOT底座(高度120±5mm),前後傾斜-2°~25°,左右旋轉-30°~30°,垂直旋轉-92°~92°,100x100mm壁掛,TCO Certified,再生塑料10%以上,電源AC 100~240V內建電源,最大耗電80W,尺寸含底座540.7x535.9x220mm,不含底座540.7x327.2x41.7mm,包裝609x160x479mm,重量含底座5.4kg,不含底座2.9kg,包裝7.0kg,配件含1.5m電源線、HDMI線、DP線、USB 3.0線",
    "LS27F612EACXZW,型號：S27F612EA,27吋ViewFinity S6 商用螢幕 S61F,27吋16:9 IPS平面螢幕,QHD(2560x1440)解析度,可視面積596.736x335.664mm,原生對比1000:1,動態對比Mega,亮度300/250 cd/㎡(典型/最小),反應時間5ms(GtG),最大刷新率100Hz,可視角178°/178°,色彩支援Max 16.7M,NTSC 83%,sRGB 99%,節能模式,低藍光模式,零閃屏,Windows 11認證,Off Timer Plus,Auto Source Switch,介面:DisplayPort 1.2x1(HDCP 2.2),HDMI 2.0x2(HDCP 2.2),耳機孔,操作溫度10~40℃,濕度10~80%,HAS底座(高度135±5mm),前後傾斜-4°~24°,左右旋轉-45°~45°,垂直旋轉-92°~92°,100x100mm壁掛,再生塑料35%,電源AC 100~240V外接變壓器,最大耗電35W,尺寸含底座616.2x538.5x192.9mm,不含底座616.2x367.7x45.4mm,包裝685.0x210.0x435.0mm,重量含底座5.4kg,不含底座3.6kg,包裝7.4kg,配件含1.5m電源線、HDMI線、DP線",
    "LS27D362GACXZW,型號：S27D362GA,27吋曲面商用螢幕 SD36G,27吋16:9 VA曲面螢幕,1800R曲率,FHD(1920x1080)解析度,可視面積596.736x335.664mm,原生對比3000:1,亮度250/200 cd/㎡(典型/最小),反應時間4ms(GtG),最大刷新率100Hz,可視角178°/178°,色彩支援Max 16.7M,sRGB 95%,節能模式,低藍光模式,零閃屏,Windows 11認證,Off Timer Plus,介面:D-Sub x1,HDMI 1.4x1,耳機孔,操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-2°~22°,75x75mm壁掛,電源AC 100~240V外接變壓器,最大耗電35W,尺寸含底座622.6x458.6x214.0mm,不含底座622.6x367.2x114.3mm,包裝687.0x175.0x442.0mm,重量含底座3.9kg,不含底座3.3kg,包裝6.0kg,配件含1.5m電源線、D-Sub線、HDMI線",
    "LS27D300GACXZW,型號：S27D300GA,27吋平面商用螢幕 SD30G,27吋16:9 IPS平面螢幕,FHD(1920x1080)解析度,可視面積597.888x336.312mm,原生對比1000:1,動態對比Mega,亮度250/200 cd/㎡(典型/最小),反應時間5ms(GtG),最大刷新率100Hz,可視角178°/178°,色彩支援Max 16.7M,NTSC 72%(CIE 1931),節能模式,低藍光模式,零閃屏,Windows 11認證,Off Timer Plus,介面:D-Sub x1,HDMI 1.4x1(HDCP 1.4),操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-2°~21°,100x100mm壁掛,再生塑料13%,電源AC 100~240V外接變壓器,最大耗電25W,尺寸含底座612.7x470.0x200.4mm,不含底座612.7x360.9x36.2mm,包裝710.0x100.0x403.0mm,重量含底座2.9kg,不含底座2.4kg,包裝4.3kg,配件含1.5m電源線、HDMI線",
    "LS24F332EACXZW,型號：S24F332EA,24吋平面商用螢幕 SF33E,24吋16:9 VA平面螢幕,FHD(1920x1080)解析度,可視面積527.04x296.46mm,原生對比3000:1,動態對比Mega,亮度250/200 cd/㎡(典型/最小),反應時間5ms(GtG),最大刷新率100Hz,可視角178°/178°,色彩支援Max 16.7M,NTSC 72%(CIE 1931),節能模式,低藍光模式,零閃屏,Windows 11認證,Off Timer Plus,介面:D-Sub x1,HDMI 1.4x1(HDCP 1.4),操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-2°~20°,100x100mm壁掛,再生塑料20%,電源AC 100-240V外接變壓器,最大耗電25W,尺寸含底座539.5x422.8x217.4mm,不含底座539.5x322.8x41.2mm,包裝607.0x147.0x380.0mm,重量含底座2.8kg,不含底座2.4kg,包裝4.3kg,配件含1.5m電源線、D-Sub線、HDMI線",
    "LS32D392GACXZW,型號：S32D392GA,32吋曲面商用螢幕 SD39G,32吋16:9 VA曲面螢幕,1500R曲率,FHD(1920x1080)解析度,可視面積698.4x392.85mm,原生對比3000:1,亮度250/200 cd/㎡(典型/最小),反應時間4ms(GtG),最大刷新率100Hz,可視角178°/178°,色彩支援Max 16.7M,sRGB 95%,節能模式,低藍光模式,零閃屏,Windows 11認證,Off Timer Plus,介面:D-Sub x1,HDMI 1.4x1(HDCP 1.4),耳機孔,操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-2°~22°,75x75mm壁掛,再生塑料59%,電源AC 100~240V外接變壓器,最大耗電48W,尺寸含底座716.1x525.3x260.9mm,不含底座716.1x423.2x92.5mm,包裝900.0x205.0x510.0mm,重量含底座5.1kg,不含底座4.4kg,包裝8.7kg,配件含1.5m電源線、D-Sub線、HDMI線",
    "LS27D392GACXZW,型號：S27D392GA,27吋曲面商用螢幕 SD39G,27吋16:9 VA曲面螢幕,1800R曲率,FHD(1920x1080)解析度,可視面積597.888x336.312mm,原生對比4000:1,亮度250/200 cd/㎡(典型/最小),反應時間4ms(GtG),最大刷新率100Hz,可視角178°/178°,色彩支援Max 16.7M,sRGB 95%,節能模式,低藍光模式,零閃屏,Windows 11認證,Off Timer Plus,介面:D-Sub x1,HDMI 1.4x1(HDCP 1.4),耳機孔,操作溫度10~40℃,濕度10~80%,簡約型底座,前後傾斜-2°~22°,75x75mm壁掛,再生塑料55%,電源AC 100~240V外接變壓器,最大耗電35W,尺寸含底座617.8x468.7x250.7mm,不含底座617.8x366.5x75.8mm,包裝800.0x155.0x453.0mm,重量含底座3.8kg,不含底座3.1kg,包裝6.3kg,配件含1.5m電源線、D-Sub線、HDMI線",
    "LS27D400GACXZW,型號：S27D400GA,27吋平面商用螢幕 SD40G,27吋16:9 IPS平面螢幕,FHD(1920x1080)解析度,可視面積597.888x336.312mm,原生對比1000:1,動態對比Mega,亮度250/200 cd/㎡(典型/最小),反應時間5ms(GtG),最大刷新率100Hz,可視角178°/178°,色彩支援Max 16.7M,NTSC 72%(CIE 1931),節能模式,低藍光模式,零閃屏,Windows 11認證,Off Timer Plus,Auto Source Switch,介面:DisplayPort 1.2x1(HDCP 1.2),HDMI 1.4x2,耳機孔,USB 2.0x2(下行),USB-B上行x1,操作溫度10~40℃,濕度10~80%,HAS底座(高度105±5mm),前後傾斜-3°~25°,左右旋轉-45°~45°,垂直旋轉-92°~92°,100x100mm壁掛,TCO Certified,再生塑料16.3%,電源AC 100~240V內建電源,最大耗電50W,尺寸含底座612.7x538.3x219.0mm,不含底座612.7x360.9x39.8mm,包裝655.0x109.0x488.0mm,重量含底座4.0kg,不含底座2.7kg,包裝5.6kg,配件含1.5m電源線、HDMI線",
    "LS24DG302ECXZW,型號：S24DG302EC,24吋Odyssey G3 平面電競顯示器 G30D,24吋16:9 VA平面螢幕,FHD(1920x1080)解析度,可視面積525.89x295.81mm,原生對比3000:1,動態對比MEGA,亮度250/200 cd/㎡(典型/最小),HDR10,反應時間1ms(MPRT),最大刷新率180Hz,可視角178°/178°,色彩支援Max 16.7M,sRGB 95%,節能模式,低藍光模式,零閃屏,Windows 11認證,FreeSync,Off Timer Plus,黑平衡,虛擬準心,更新頻率調整,超級電競模式UX,Auto Source Switch自動來源切換,介面:DisplayPort 1.4x1(HDCP 1.3),HDMI 2.0x1(HDCP 1.4),耳機孔,操作溫度10~40℃,濕度10~80%",
    "LS37D802UACXZW,型號：S37D802UAC,37吋ViewFinity S8 UHD 高解析度平面顯示器 S80UD,37吋16:9 VA平面螢幕,可視面積808.0x454.5mm,4K UHD(3840x2160)解析度,亮度350/280 cd㎡(典型/最小),原生對比3000:1,動態對比Mega ∞ DCR,HDR10,反應時間5ms,可視角度178°/178°,色彩支援1.07B,sRGB 100%(Typ),屬ViewFinity創作者系列,具節能模式、低藍光模式與零閃屏,支援PIP子母畫面與PBP分割畫面與影像尺寸調整,Windows 11認證,Off Timer Plus,自動來源切換Auto Source Switch+,智慧偵測環境光源Adaptive Picture,內建KVM Switch,介面：DisplayPort 1.2 x1(HDCP 2.2),HDMI 2.0 x1(HDCP 2.2),耳機孔,USB 3.0 Hub x3,USB‑C x1(支援90W充電),USB‑B上行x1,乙太網路LAN x1,操作環境10~40℃/10~80%,黑色機身與HAS高度調整底座,高度調整範圍120mm,前後傾斜-5°~20°,左右旋轉-30°~30°,VESA壁掛100x100mm,TCO認證與碳足跡標示,再生資源塑料含量85%以上,電源AC 100~240V內置電源,最大耗電190W,尺寸含底座823.9x648.0x250.0mm,不含底座823.9x486.5x41.8mm,包裝尺寸921x181x604mm,重量含底座8.9kg,不含底座5.9kg,包裝重量12.3kg,配件含1.5m電源線與USB Type‑C連接線。",
    "LS57CG952NCXZW,型號：S57CG952NC,57吋Odyssey Neo G9 Mini LED曲面電競顯示器 G95NC,57吋32:9 VA曲面螢幕,1000R曲率,DUHD(7680x2160)解析度,最大240Hz更新頻率,1ms(GtG)反應時間,420/350 cd㎡亮度(典型/最小),原生對比2500:1(靜態),動態對比Mega DCR,178°寬廣視角,10億色彩支援,DCI覆蓋95%,VESA DisplayHDR 1000,HDR10+ Gaming,量子Mini LED局部調光(2392區),低藍光模式,零閃屏,PIP子母畫面,PBP畫面分割,金屬量子點顯色技術,影像尺寸調整,Windows 10認證,FreeSync Premium Pro,Off Timer Plus,黑平衡,虛擬準心,Core Sync,更新頻率調整,超級電競模式UX,自動來源切換Auto Source Switch+,智慧偵測環境光源(Adaptive Picture),KVM Switch,介面：DisplayPort 2.1 x1(HDCP 2.2)、HDMI 2.1 x3(HDCP 2.2)、耳機孔、USB 3.0 x2,操作溫度10~40℃、濕度10~80%,工廠出廠調校與校正報告,色彩模式:Entertain/Graphic/Eco/Game Standard/FPS/RTS/RPG/Sports/Original/Custom,黑色正面與白色背面、HAS底座(高度調整120mm),前後傾斜-3°~10°、左右旋轉-15°~15°,VESA 100x100mm壁掛,UL Glare Free,電源AC100-240V內置電源,最大耗電300W,尺寸含底座1327.5x601.0x499.6mm,不含底座1327.5x429.5x338.4mm,包裝尺寸1455x420x557mm,重量含底座19.0kg、不含底座15.4kg、包裝重量26.8kg,配件1.5m電源線、HDMI線、DP線、USB 3.0線",
    "LS32DG702ECXZW,型號：S32DG702EC,32吋Odyssey G7 IPS 平面電競顯示器 G70D,32吋16:9 Fast IPS平面螢幕,4K UHD(3840x2160),最大144Hz更新頻率,1ms(GtG)反應時間,VESA DisplayHDR 400,HDR10+ Gaming,350/280 cd㎡亮度(典型/最小),原生對比1000:1,178°寬廣視角,10.7億色彩支援,sRGB 99%,低藍光模式,零閃屏,Windows 11認證,支援AMD FreeSync Premium,G-Sync相容,Off Timer Plus,黑平衡,虛擬準心,Core Sync,Game Bar 2.0,HDMI-CEC,自動來源切換+,智慧偵測環境光源,超寬遊戲螢幕,影像尺寸調整,PIP/PBP多畫面分割,AI Smart TV智慧電視,Tizen作業系統,Bixby語音助理,SmartThings Hub,多重視窗(最多2畫面),遠端存取,WiFi5,藍牙5.2,10W立體聲喇叭,Adaptive Sound Pro智慧音效,介面：DisplayPort 1.4 x1、HDMI 2.1 x2、USB-B上行x1、USB-A下行x2(3.0)、乙太網路x1、耳機孔,操作環境溫度10–40℃、濕度10–80%,工廠出廠調校與報告,黑色機身與HAS PIVOT底座(120mm高度調整),前後傾斜-2°~25°、左右旋轉-30°~30°、垂直旋轉-92°~92°,VESA 100x100mm壁掛,電源AC 100–240V外接電源變壓器,最大耗電78W,尺寸含底座714.2x583.2x263.5mm,不含底座714.2x418.4x73.8mm,包裝尺寸796x166x517mm,重量含底座8.0kg、不含底座4.8kg、包裝重量10.1kg,配件1.5m電源線,DP線,USB 3.0線,遙控器",
    "LS27DG602SCXZW,型號：S27DG602SC,27吋Odyssey OLED G6 平面電競顯示器 G60SD,27吋16:9 OLED平面螢幕,QHD(2560x1440),最大360Hz更新頻率,0.03ms(GtG)超快反應時間,250/200 cd㎡亮度(典型/最小),原生對比1000000:1,178°寬廣視角,10.7億色彩支援,DCI色域99%(CIE1976),HDR10/HDR10+/HDR10+ Gaming,銀色機身與底座,抗眩光真霧面面板,OLED Safeguard+防止螢幕烙印技術,動態冷卻系統,熱調節系統,標誌及工作列偵測,螢幕保護模式,AMD FreeSync Premium Pro,低藍光模式,零閃屏,PIP子母畫面,金屬量子點顯色技術,Windows 11認證,黑平衡,虛擬準心,Core Sync,超級電競模式UX,自動來源切換Auto Source Switch+,超寬遊戲螢幕,影像尺寸調整,介面：DisplayPort 1.4x1(HDCP 2.2),HDMI 2.1x2(HDCP 2.2),USB 3.0 x2,耳機孔,操作溫度10~40℃,濕度10~80%,工廠校正與保固涵蓋正常使用下的烙印現象,HAS PIVOT底座120mm高度調整,前後傾斜-2°~25°,左右旋轉-30°~30°,垂直旋轉-92°~92°,VESA 100x100壁掛,尺寸含底座611.7x554.2x263.5mm,不含底座611.7x353.8x49.2mm,重量含底座6.9kg、不含底座3.8kg,包裝重量9.5kg,配件1.5m電源線,HDMI線,DP線,USB 3.0線",
    "LS49CG934SCXZW,型號：S49CG934SC,49吋Odyssey OLED G9 曲面電競顯示器 G93SC,49吋32:9 OLED曲面螢幕(1800R曲率),Dual QHD(5120x1440),最大240Hz更新頻率,0.03ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比1000000:1,178°寬廣視角,10.7億色彩支援,DCI色域99%(CIE1976),VESA DisplayHDR True Black 400,HDR10+/HDR10+ Gaming,抗眩光真霧面面板,Samsung OLED Safeguard+防止螢幕烙印,熱調節系統,標誌和工作列偵測,螢幕保護模式,AMD FreeSync Premium Pro,G-Sync相容,低藍光模式,零閃屏,PIP子母畫面,PBP分割畫面,金屬量子點顯色技術,Windows 10認證,黑平衡,低輸入延遲技術,虛擬準心,Core Sync,超級電競模式 UX,自動來源切換Auto Source Switch+,影像尺寸調整,介面：DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.1 x1(HDCP 2.2)、Micro HDMI 2.1 x1(HDCP 2.2)、USB 3.0 x3、立體聲喇叭(5W x 2ch),操作溫度10–40℃、濕度10–80%,工廠出廠調校與校正報告,銀色機身與HAS底座(120mm高度調整),前後傾斜-2°~15°,壁掛100x100mm,電源AC 100–240V外接電源變壓器,最大耗電220W,尺寸含底座1194.7x529.3x284.1mm,不含底座1194.7x365x180.8mm,重量含底座12.6kg、不含底座8.8kg、包裝重量18.1kg,配件包含1.5m電源線、HDMI轉Micro HDMI線、DP線、USB Type-C轉Type-A傳輸線",
    "LS55CG970NCXZW,型號：S55CG970NC,55吋Odyssey Ark Mini LED 曲面電競顯示器(第2代) G97NC,55吋16:9 VA曲面螢幕,1000R曲率,4K UHD(3840x2160),最大165Hz更新頻率,1ms(GtG)反應時間,600/420 cd㎡亮度(典型/最小),原生對比1000000:1(靜態),動態對比Mega DCR,178°寬廣視角,10.7億色彩支援,DCI色域95%,Quantum HDR 32x,HDR10+/HDR10+ Gaming,Mini LED局部調光(1056區域),量子矩陣技術,量子AI高效處理器,防眩光霧面螢幕,Smart TV智慧電視,Tizen作業系統,支援4組輸入多重視窗,KVM Switch,Ark Dial無線旋鈕盤,畫面最適化(Flex Move Screen),座艙模式,光效同步設計,Windows 10認證,AMD FreeSync Premium Pro,低藍光模式,零閃屏,PIP/PBP畫面分割,金屬量子點顯色技術,遊戲模式,黑平衡,虛擬準心,Game Bar 2.0,HDMI-CEC,自動來源切換+,智慧偵測環境光源,超寬遊戲螢幕,介面：DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.1 x2+HDMI 2.0 x1(HDCP 2.2)、USB 2.0 x2、以太網路x1、耳機孔、WiFi5、藍牙5.2,60W 2.2.2聲道立體聲喇叭(Dolby Atmos杜比全景聲),操作溫度0–40℃、濕度10–80%,工廠出廠調校與校正報告,黑色機身與HAS PIVOT底座(橫向270mm/直向30mm高度調整),前後傾斜橫向-10°~10°/直向-13°~10°、垂直旋轉-90°~90°,VESA 200x200壁掛,電源AC100-240V內置電源,最大耗電140W,尺寸含底座1174.8x1102x379mm,不含底座1174.8x704.8x251.8mm,包裝尺寸1362x922x317mm,重量含底座41.5kg、不含底座21.1kg、包裝重量57.1kg,配件1.5m電源線,HDMI線,遙控器",
    "LS55BG970NCXZW,型號：S55BG970NC,55吋Odyssey Ark Mini LED 曲面電競顯示器 G97NB,55吋16:9 VA曲面螢幕,1000R曲率,4K UHD(3840x2160),最大165Hz更新頻率,1ms(GtG)反應時間,600/420 cd㎡亮度(典型/最小),原生對比1000000:1(靜態),動態對比Mega DCR,178°寬廣視角,10.7億色彩支援,DCI色域95%,Quantum HDR 32x,HDR10+/HDR10+ Gaming,Mini LED局部調光(1056區域),量子矩陣技術,量子AI高效處理器,防眩光霧面螢幕,Smart TV智慧電視,Tizen作業系統,支援SmartThings,支援4組輸入多重視窗,KVM Switch,Ark Dial無線旋鈕盤,畫面最適化(Flex Move Screen),座艙模式,光效同步設計,Samsung MagicRotation Auto,Windows 10認證,AMD FreeSync Premium Pro,低藍光模式,零閃屏,PIP/PBP畫面分割,金屬量子點顯色技術,遊戲模式,Game Bar 2.0,HDMI-CEC,自動來源切換+,智慧偵測環境光源,超寬遊戲螢幕,介面：HDMI 2.1 x4(HDCP 2.2)、DisplayPort 1.4 x1(HDCP 2.2)、USB 2.0 x2、以太網路x1、耳機孔、WiFi5、藍牙5.2,60W 2.2.2聲道立體聲喇叭(Dolby Atmos杜比全景聲),操作溫度0–40℃、濕度10–80%,工廠出廠調校與校正報告,黑色機身與HAS PIVOT底座(橫向270mm/直向30mm高度調整),前後傾斜橫向-10°~10°/直向-13°~10°、垂直旋轉-90°~90°,VESA 200x200壁掛,電源AC100-240V內置電源,尺寸含底座1174.8x1102x379mm,不含底座1174.8x704.8x251.8mm,包裝尺寸1362x922x317mm,重量含底座41.5kg、不含底座21.1kg、包裝重量57.1kg,配件1.5m電源線,HDMI線,遙控器,Ark Dial無線旋鈕盤,美型集線器,One Connect",
    "LS32BG750NCXZW,型號：S32BG750NC,32吋Odyssey Neo G7 Mini LED 曲面電競顯示器 G75NB,32吋16:9 VA曲面螢幕,1000R曲率,4K UHD(3840x2160),最大165Hz更新頻率,1ms(GtG)反應時間,350/300 cd㎡亮度(典型/最小),原生對比1000000:1,動態對比Mega DCR,178°寬廣視角,10.7億色彩支援,DCI色域95%,Quantum HDR 2000,HDR10+/HDR10+ Gaming,Mini LED局部調光(1196區域),量子矩陣技術,低藍光模式,零閃屏,PIP子母畫面,金屬量子點顯色技術,Windows 10認證,AMD FreeSync Premium Pro,Off Timer Plus,黑平衡,低輸入延遲技術,虛擬準心,Core Sync,更新頻率調整,超級電競模式 UX,自動來源切換+,智慧偵測環境光源,超寬遊戲螢幕,介面：DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.1 x2(HDCP 2.2)、USB 3.0 x2、耳機孔,操作溫度10–40℃、濕度10–80%,工廠出廠調校,黑色機身與HAS PIVOT底座(120mm高度調整),前後傾斜-9°~13°,左右旋轉-15°~15°,垂直旋轉-92°~92°,VESA 100x100壁掛,電源AC 100–240V外接電源變壓器,尺寸含底座713x606.2x311.1mm,不含底座713x440.3x185mm,包裝尺寸827x231x499mm,重量含底座8.6kg、不含底座6.7kg、包裝重量12kg,配件1.5m電源線,DP線",
    "LS43CG700NCXZW,型號：S43CG700NC,43吋Odyssey Neo G7 Mini LED 平面電競顯示器 G70NC,43吋16:9 VA平面螢幕,4K UHD(3840x2160),最大144Hz更新頻率,1ms(MPRT)反應時間,400/300 cd㎡亮度(典型/最小),原生對比1000000:1(動態),動態對比Mega DCR,178°寬廣視角,10.7億色彩支援,DCI色域95%(CIE1976),VESA DisplayHDR 600,HDR10+/HDR10+ Gaming,Mini LED局部調光,量子矩陣技術,防眩光霧面螢幕,Smart TV智慧電視,Tizen作業系統,畫面最適化(Flex Move Screen),超寬遊戲螢幕,Game Bar 2.0,Windows 10認證,AMD FreeSync Premium Pro,低藍光模式,零閃屏,PIP子母畫面,金屬量子點顯色技術,Off Timer Plus,虛擬準心,Core Sync,HDMI-CEC,自動來源切換,智慧偵測環境光源,介面：DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.1 x2(HDCP 2.2)、USB 3.0 x2、以太網路x1、耳機孔、WiFi5、藍牙5.2,20W立體聲喇叭(Adaptive Sound),操作溫度0–40℃、濕度10–80%,工廠出廠調校與校正報告,黑色正面/白色背面與簡約型底座,前後傾斜-2°~20°,VESA 200x200壁掛,電源AC100-240V內置電源,尺寸含底座960.8x635x254.1mm,不含底座960.8x563.3x37.9mm,包裝尺寸1233x667x153mm,重量含底座11.7kg、不含底座9.2kg、包裝重量16.1kg,配件1.5m電源線,DP線,遙控器",
    "LS28AG700NCXZW,型號：S28AG700NC,28吋Odyssey G70A 平面電競顯示器,28吋16:9 IPS平面螢幕,4K UHD(3840x2160),最大144Hz更新頻率,1ms(GtG)反應時間,300/250 cd㎡亮度(典型/最小),峰值亮度400 cd㎡,原生對比1000:1,動態對比Mega ∞ DCR,178°寬廣視角,1.67億色彩支援,DCI色域90%,VESA DisplayHDR 400,低藍光模式,零閃屏,PIP子母畫面,Windows 10認證,AMD FreeSync Premium Pro,G-Sync相容,Off Timer Plus,黑平衡,低輸入延遲技術,更新頻率調整,超級電競模式 UX,自動來源切換+,超寬遊戲螢幕,CoreSync光效自動調整設計,介面：DisplayPort 1.4 x1、HDMI 2.1 x2、USB 3.0 x1、耳機孔,操作溫度10–40℃、濕度10–80%,工廠出廠調校與校正報告,HAS PIVOT底座(120mm高度調整),前後傾斜-9°~13°,左右旋轉-15°~15°,垂直旋轉-2°~92°,VESA 100x100壁掛,電源AC 100–240V外接電源變壓器,最大耗電78W,尺寸含底座636.9x574.1x247mm,不含底座636.9x379.9x122.1mm,包裝尺寸711x191x475mm,重量含底座7.9kg、不含底座6.2kg、包裝重量10.5kg,配件1.5m電源線,DP線,USB 3.0線",
    "LS32AG500PCXZW,型號：S32AG500PC,32吋Odyssey G5 G50A 平面電競顯示器,32吋16:9 IPS平面螢幕,QHD(2560x1440),最大165Hz更新頻率,1ms(GtG)反應時間,350/280 cd㎡亮度(典型/最小),原生對比1000:1,動態對比Mega ∞ DCR,178°寬廣視角,10.7億色彩支援,sRGB 99%,HDR10,低藍光模式,零閃屏,Windows 10認證,AMD FreeSync Premium,G-Sync相容,Off Timer Plus,黑平衡,低輸入延遲技術,更新頻率調整,超級電競模式 UX,自動來源切換,超寬遊戲螢幕,介面：DisplayPort 1.2 x1、HDMI 2.0 x1、耳機孔,操作溫度10–40℃、濕度10–80%,色彩支援模式Custom/FPS/RTS/RPG/AOS/Cinema/sRGB/DynamicContrast,HAS底座(120mm高度調整),前後傾斜-11°~15°,左右旋轉-15°~15°,垂直旋轉-2°~92°,VESA 100x100壁掛,電源AC 100–240V外接電源變壓器,最大耗電59W,尺寸含底座714.6x602.9x311.1mm,不含底座714.6x440.6x91.5mm,包裝尺寸802x176x545mm,重量含底座7.5kg、不含底座5.6kg、包裝重量9.7kg,配件1.5m電源線,DP線",
    "LS27AG500NCXZW,型號：S27AG500NC,27吋Odyssey G5 G50A 平面電競顯示器,27吋16:9 IPS平面螢幕,QHD(2560x1440),最大165Hz更新頻率,1ms(GtG)反應時間,350/280 cd㎡亮度(典型/最小),原生對比1000:1,動態對比Mega ∞ DCR,178°寬廣視角,10.7億色彩支援,sRGB 99%,HDR10,低藍光模式,零閃屏,Windows 10認證,AMD FreeSync Premium,G-Sync相容,Off Timer Plus,黑平衡,低輸入延遲技術,更新頻率調整,超級電競模式 UX,自動來源切換,超寬遊戲螢幕,介面：DisplayPort 1.2 x1、HDMI 2.0 x1、耳機孔,操作溫度10–40℃、濕度10–80%,色彩支援模式Custom/FPS/RTS/RPG/AOS/Cinema/sRGB/DynamicContrast,HAS底座(120mm高度調整),前後傾斜-2°~22°,左右旋轉-30°~30°,垂直旋轉-2°~92°,VESA 100x100壁掛,電源AC 100–240V外接電源變壓器,最大耗電48W,尺寸含底座613.7x570.5x247mm,不含底座613.7x375.3x91.5mm,包裝尺寸684x173x467mm,重量含底座6.1kg、不含底座4.4kg、包裝重量8kg,配件1.5m電源線,DP線",
    "LS24AG320NCXZW,型號：S24AG320NC,24吋Odyssey G3 平面電競顯示器 G32A,24吋16:9 VA平面螢幕,FHD(1920x1080),最大165Hz更新頻率,1ms(MPRT)反應時間,250/200 cd㎡亮度(典型/最小),原生對比3000:1,動態對比MEGA,178°寬廣視角,1670萬色彩支援,NTSC 72%,低藍光模式,零閃屏,遊戲模式,Windows 10認證,AMD FreeSync Premium,Off Timer Plus,黑平衡,更新頻率調整,介面：DisplayPort 1.2 x1、HDMI 1.4 x1、耳機孔,操作溫度10–40℃、濕度10–80%,HAS底座(高度可調120mm),前後傾斜-5°~20°,左右旋轉-15°~15°,垂直旋轉-2°~92°,VESA 100x100壁掛,電源AC 100–240V外接電源變壓器,最大耗電25W,尺寸含底座544x498.7x234.2mm,不含底座544x333.3x92mm,包裝尺寸636x211.5x454mm,重量含底座4.5kg、不含底座3kg、包裝重量6.6kg,配件電源線1.5m,DP連接線",
    "LS32DM803UCXZW,型號：S32DM803UC,32吋智慧聯網螢幕 M8 M80D (2024),32吋16:9 VA平面螢幕,4K UHD (3840x2160),最大更新頻率60Hz,反應時間4ms(GtG),400/300 cd㎡典型/最小亮度,原生對比3000:1,支援HDR10和HDR10+,178°寬廣視角,10.7億色彩支援,sRGB 99% (CIE1931),低藍光模式,零閃屏,Windows 11認證,虛擬準心,Game Bar 2.0,HDMI-CEC,自動來源切換(Auto Source Switch+),智慧偵測環境光源(Adaptive picture),超寬遊戲螢幕(Ultrawide Game View),智慧功能包括Tizen作業系統、長距離語音辨識、SmartThings Hub、多裝置體驗及多重視窗,介面包含HDMI 2.0 x1、USB-C x1(65W充電)、USB 2.0 x2,支援WiFi5和藍牙5.2,內建10W立體聲喇叭及Adaptive Sound Pro智慧偵測音效,人體工學設計HAS PIVOT底座(120mm高度調整),前後傾斜-2°~15°,垂直旋轉-92°~92°,VESA 100x100壁掛,電源AC 100~240V外接變壓器,最大耗電140W,尺寸含底座713.4x616.2x200.1mm,不含底座713.4x423.8x24.5mm,包裝尺寸925x132x485mm,重量含底座7.2kg、不含底座4.2kg,配件包含1.5m電源線、HDMI線、USB Type-C線、太陽能智慧遙控器及視訊攝影機",
    "LS43DM702UCXZW,型號：S43DM702UC,43吋智慧聯網螢幕 M7 M70D (2024),43吋16:9 VA平面螢幕,4K UHD(3840x2160),最大60Hz更新頻率,4ms(GtG)反應時間,300/240 cd㎡亮度(典型/最小),原生對比5000:1,動態對比支援,HDR10,178°寬廣視角,10.7億色彩支援,NTSC 72%,低藍光模式,零閃屏,Windows 11認證,虛擬準心,Game Bar 2.0,HDMI-CEC,自動來源切換Auto Source Switch+,智慧偵測環境光源Adaptive picture,超寬遊戲螢幕Ultrawide Game View,智慧功能Tizen作業系統、長距離語音辨識、SmartThings Hub、多裝置體驗(Mobile to Screen等)、多重視窗(最多2影片)、智慧校色基本、NFT Nifty Gateway、遠端存取,介面：HDMI 2.0 x2(HDCP 2.2)、USB-C x1(65W充電,HDCP 2.2)、USB 2.0 x3、無線顯示,支援WiFi5、藍牙5.2,內建20W立體聲喇叭及Adaptive Sound智慧偵測音效,操作溫度10–40℃、濕度10–80%,工廠出廠調校,黑色機身與簡約型底座,前後傾斜-2°~20°,VESA 200x200壁掛,電源AC 100–240V內置電源,最大耗電210W,尺寸含底座965.5x629.3x247.2mm,不含底座965.5x559.8x25.7mm,包裝尺寸1198x677x159mm,重量含底座10.6kg、不含底座8.5kg、包裝重量13.7kg,配件1.5m電源線,HDMI線,USB Type-C線,太陽能智慧遙控器",
    "LS43DM703UCXZW,型號：S43DM703UC,43吋智慧聯網螢幕 M7 M70D (2024)白色版,43吋16:9 VA平面螢幕,4K UHD(3840x2160),最大60Hz更新頻率,4ms(GtG)反應時間,300/240 cd㎡亮度(典型/最小),原生對比5000:1,動態對比支援,HDR10,178°寬廣視角,10.7億色彩支援,NTSC 72%,低藍光模式,零閃屏,Windows 11認證,虛擬準心,Game Bar 2.0,HDMI-CEC,自動來源切換Auto Source Switch+,智慧偵測環境光源Adaptive picture,超寬遊戲螢幕Ultrawide Game View,智慧功能Tizen作業系統、長距離語音辨識、SmartThings Hub、多裝置體驗(Mobile to Screen等)、多重視窗(最多2影片)、智慧校色基本、NFT Nifty Gateway、遠端存取,介面：HDMI 2.0 x2(HDCP 2.2)、USB-C x1(65W充電,HDCP 2.2)、USB 2.0 x3、無線顯示,支援WiFi5、藍牙5.2,內建20W立體聲喇叭及Adaptive Sound智慧偵測音效,操作溫度10–40℃、濕度10–80%,工廠出廠調校,白色機身與簡約型底座,前後傾斜-2°~20°,VESA 200x200壁掛,電源AC 100–240V內置電源,最大耗電210W,尺寸含底座965.5x629.3x247.2mm,不含底座965.5x559.8x25.7mm,包裝尺寸1198x677x159mm,重量含底座11kg、不含底座8.7kg、包裝重量14.1kg,配件1.5m電源線,HDMI線,USB Type-C線,太陽能智慧遙控器",
    "LS32DM702UCXZW,型號：S32DM702UC,FollowMe 移動式 4K 32吋智慧聯網螢幕組 M7 (M70D + 移動式立架),32吋16:9 VA平面螢幕,4K UHD(3840x2160),最大60Hz更新頻率,4ms(GtG)反應時間,300/240 cd㎡亮度(典型/最小),原生對比3000:1,動態對比支援,HDR10,178°寬廣視角,10.7億色彩支援,NTSC 72%,低藍光模式,零閃屏,Windows 11認證,虛擬準心,Game Bar 2.0,HDMI-CEC,自動來源切換Auto Source Switch+,智慧偵測環境光源Adaptive picture,超寬遊戲螢幕Ultrawide Game View,智慧功能Tizen作業系統、長距離語音辨識、SmartThings Hub、多裝置體驗(Mobile to Screen等)、多重視窗(最多2影片)、智慧校色基本、NFT Nifty Gateway、遠端存取,介面：HDMI 2.0 x2(HDCP 2.2)、USB-C x1(65W充電,HDCP 2.2)、USB 2.0 x3、無線顯示,支援WiFi5、藍牙5.2,內建10W立體聲喇叭及Adaptive Sound智慧偵測音效,操作溫度10–40℃、濕度10–80%,工廠出廠調校,黑色機身與簡約型底座,前後傾斜-2°~22°,VESA 100x100壁掛,電源AC 100–240V內置電源,最大耗電150W,尺寸含底座716.1x517x193.5mm,不含底座716.1x424.5x41.8mm,包裝尺寸842x133x487mm,重量含底座6.5kg、不含底座5.4kg、包裝重量8.4kg,配件1.5m電源線,HDMI線,USB Type-C線,太陽能智慧遙控器",
    "LS32DM703UCXZW,型號：S32DM703UC,FollowMe 移動式 4K 32吋智慧聯網螢幕組 M7 (M70D + 移動式立架)白色版,32吋16:9 VA平面螢幕,4K UHD(3840x2160),最大60Hz更新頻率,4ms(GtG)反應時間,300/240 cd㎡亮度(典型/最小),原生對比3000:1,動態對比支援,HDR10,178°寬廣視角,10.7億色彩支援,NTSC 72%,低藍光模式,零閃屏,Windows 11認證,虛擬準心,Game Bar 2.0,HDMI-CEC,自動來源切換Auto Source Switch+,智慧偵測環境光源Adaptive picture,超寬遊戲螢幕Ultrawide Game View,智慧功能Tizen作業系統、長距離語音辨識、SmartThings Hub、多裝置體驗(Mobile to Screen等)、多重視窗(最多2影片)、智慧校色基本、NFT Nifty Gateway、遠端存取,介面：HDMI 2.0 x2(HDCP 2.2)、USB-C x1(65W充電,HDCP 2.2)、USB 2.0 x3、無線顯示,支援WiFi5、藍牙5.2,內建10W立體聲喇叭及Adaptive Sound智慧偵測音效,操作溫度10–40℃、濕度10–80%,工廠出廠調校,白色機身與簡約型底座,前後傾斜-2°~22°,VESA 100x100壁掛,電源AC 100–240V內置電源,最大耗電150W,尺寸含底座716.1x517x193.5mm,不含底座716.1x424.5x41.8mm,包裝尺寸842x133x487mm,重量含底座6.8kg、不含底座5.7kg、包裝重量8.7kg,配件1.5m電源線,HDMI線,USB Type-C線,太陽能智慧遙控器",
    "LS27DM502ECXZW,型號：S27DM502EC,27吋智慧聯網螢幕 M5 M50D (2024)黑色版,27吋16:9 VA平面螢幕,FHD(1920x1080)解析度,最大60Hz更新頻率,4ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比3000:1,HDR10,178°寬廣視角,10.7億色彩支援,NTSC 72%,低藍光模式,零閃屏,Windows 11認證,虛擬準心,Game Bar 2.0,HDMI-CEC,自動來源切換Auto Source Switch+,智慧偵測環境光源Adaptive picture,超寬遊戲螢幕Ultrawide Game View,智慧功能Tizen作業系統、SmartThings Hub、多裝置體驗(Mobile to Screen等)、多重視窗(最多2影片)、NFT Nifty Gateway、遠端存取,介面：HDMI 1.4 x2(HDCP 2.2)、USB 2.0 x2、Wireless Display,支援WiFi5、藍牙5.2,內建10W立體聲喇叭及Adaptive Sound智慧偵測音效,操作溫度10–40℃、濕度10–80%,黑色機身與簡約型底座,前後傾斜-2°~22°,VESA 100x100壁掛,電源AC 100–240V內置電源,最大耗電50W,尺寸含底座615.5x455.4x193.5mm,不含底座615.5x367.9x41.8mm,包裝尺寸738x126x428mm,重量含底座4.8kg、不含底座3.6kg、包裝重量6.1kg,配件1.5m電源線、HDMI線、遙控器",
    "LS27B610EQCXZW,型號：S27B610EQC,27吋 ViewFinity S6 IPS 高解析度平面顯示器 S61B,27吋16:9 IPS平面螢幕,QHD(2560x1440),最大75Hz更新頻率,5ms(GtG)反應時間,300/250 cd㎡亮度(典型/最小),原生對比1000:1,動態對比Mega,178°寬廣視角,16.7M色彩支援,NTSC 83%,sRGB 99%,低藍光模式,零閃屏,Windows 10認證,AMD FreeSync,自動來源切換,影像尺寸調整,介面：DisplayPort 1.2 x1、HDMI 1.4 x2(HDCP 1.4)、耳機孔,操作溫度10–40℃、濕度10–80%,黑色機身與HAS PIVOT底座(高度調整135mm),前後傾斜-4°~24°,左右旋轉-45°~45°,垂直旋轉-4°~92°,VESA 100x100壁掛,電源AC 100–240V外接電源變壓器,最大耗電35W,尺寸含底座616.2x538.5x192.9mm,不含底座616.2x367.7x45.4mm,包裝尺寸685x215x435mm,重量含底座5.4kg、不含底座3.6kg、包裝重量7.4kg,配件1.5m電源線,HDMI線",
    "LS49C950UACXZW,型號：S49C950UAC,49吋 ViewFinity S9 高解析度曲面顯示器 S95UC,49吋32:9 VA曲面螢幕,1000R曲率,DQHD(5120x1440),最大120Hz更新頻率,5ms(GtG)反應時間,350/280 cd㎡亮度(典型/最小),原生對比3000:1,動態對比Mega ∞ DCR,VESA DisplayHDR 400,178°寬廣視角,10.7億色彩支援,DCI 92%,sRGB 115%,低藍光模式,零閃屏,PIP/PBP畫面分割,Windows 11認證,Off Timer Plus,自動來源切換Auto Source Switch+,智慧偵測環境光源Adaptive picture,KVM Switch,介面：DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.0 x2(HDCP 2.2)、USB-C x1(90W充電,HDCP 2.2)、USB 3.0 x3、乙太網路LAN x1、耳機孔,內建5Wx2立體聲喇叭,操作溫度10–40℃、濕度10–80%,工廠出廠調校,黑色機身與HAS底座(高度調整120mm),前後傾斜-2°~11°,左右旋轉-15°~15°,VESA 100x100壁掛,再生資源塑料10%以上,電源AC 100–240V內置電源,最大耗電210W,尺寸含底座1147.6x568.4x420.5mm,不含底座1147.6x363.5x293.8mm,包裝尺寸1265x343x481mm,重量含底座15.6kg、不含底座10.6kg、包裝重量20.6kg,配件HDMI線,USB Type-C線,USB 3.0線",
    "LS27C900PACXZW,型號：S27C900PAC,27吋 ViewFinity S9 5K 高解析度平面顯示器 S90PC,27吋16:9 IPS平面螢幕,5K(5120x2880)解析度,最大60Hz更新頻率,5ms(GtG)反應時間,600/480 cd㎡亮度(典型/最小),原生對比1000:1,HDR支援,178°寬廣視角,最大10.7億色彩支援,DCI色域99%,sRGB覆蓋率100%,低藍光模式,零閃屏,遊戲模式,虛擬準心,Game Bar 2.0,自動來源切換Auto Source Switch+,智慧偵測環境光源Adaptive picture,超寬遊戲螢幕Ultrawide Game View,智慧功能Tizen作業系統、長距離語音辨識、SmartThings Hub、多裝置體驗(Mobile to Screen等)、Wireless DeX、My Contents、多重視窗(最多2影片)、智慧校色基本與專業模式、NFT Nifty Gateway、感應連結Tap View及遠端存取,介面：Wireless Display、Mini-DisplayPort 1個(HDCP 2.2)、DisplayPort 1個、Thunderbolt 4 1個(90W充電,HDCP 2.2)、HDMI 2.0 x2、USB 3.0 x3、耳機孔、乙太網路LAN,內建5Wx2立體聲喇叭(Adaptive Sound+),操作溫度10–40℃、濕度10–80%,工廠出廠調校,正銀色機身與HAS PIVOT底座(高度120mm),前後傾斜-2°~15°,垂直旋轉-92°~92°,左右旋轉-15°~15°,VESA 100x100壁掛,再生資源塑料3%,電源AC100~240V外接電源變壓器,最大耗電182W,尺寸含底座611.4x530.7x135.3mm,不含底座611.4x364.1x27.1mm,包裝尺寸820x133x423mm,重量含底座7.4kg、不含底座4.7kg、包裝重量10.7kg,配件1.5m電源線、Thunderbolt 4線、智慧遙控器及可拆式視訊攝影機.",
    "LS34A650UXCXZW,型號：S34A650UXC,34吋 S6 Ultra WQHD 高解析度曲面顯示器 (ENERGY STAR),34吋21:9 VA曲面螢幕,1000R曲率,Ultra WQHD(3440x1440)解析度,最大100Hz更新頻率,5ms反應時間,300/250 cd㎡亮度(典型/最小),原生對比4000:1,動態對比Mega ∞ DCR,HDR10,178°寬廣視角,10.7億色彩支援,低藍光模式,零閃屏,PIP子母畫面,PBP分割畫面,遊戲模式,省電模式自由選,光源感測(Eco Light Sensor),Windows 10認證,FreeSync,Off Timer Plus,自動來源切換,智慧偵測環境光源(Adaptive picture),介面：DisplayPort 1.2 x1、HDMI 2.0 x1、USB Hub 3.0 x3、USB-C x1(90W充電)、乙太網路(LAN) x1、耳機孔,操作溫度10~40℃、濕度10~80%,黑色機身與HAS高度調整底座(120mm),前後傾斜-2°~25°,左右旋轉-30°~30°,VESA 100x100壁掛,ENERGY STAR認證,再生資源塑料3%,電源AC 100~240V內置,尺寸含底座806.6x553.3x234.9mm,不含底座806.6x369.4x128.1mm,包裝尺寸895x216x471mm,重量含底座7.6kg、不含底座5.1kg、包裝重量9.7kg,配件電源線1.5m,HDMI線,USB Type-C線",
    "LS27A800UJCXZW,型號：S27A800UJC,27吋 S8 UHD 高解析度平面顯示器 (ENERGY STAR),27吋16:9 IPS平面螢幕,4K UHD(3840x2160)解析度,最大60Hz更新頻率,5ms反應時間,300/250 cd㎡亮度(典型/最小),原生對比1000:1 (Typ),動態對比Mega ∞ DCR,HDR10,178°寬廣視角,10億色彩支援,低藍光模式,零閃屏,PIP子母畫面,PBP分割畫面,遊戲模式,影像尺寸調整,Windows 10認證,Off Timer Plus,自動來源切換,智慧偵測環境光源(Adaptive picture),省電模式自由選,USB type-C 連接埠(90W充電),DisplayPort 1.2 x1(HDCP 2.2),HDMI 2.0 x1(HDCP 2.2),USB 3.0 x3,耳機孔,操作溫度10~40℃、濕度10~80%,黑色機身與HAS高度調整底座(120mm),前後傾斜-2°~25°,左右旋轉-30°~30°,垂直旋轉-2°~92°,VESA 100x100壁掛,ENERGY STAR認證,再生資源塑料3%,電源AC 100~240V內置電源,最大耗電約未詳,機身含底座615.5x551.9x196.4mm,不含底座615.5x368.2x42.7mm,包裝尺寸686x171x450mm,重量含底座6.7kg、不含底座4.7kg、包裝重量8.4kg,配件包括1.5m電源線、HDMI線、USB Type-C線",
    "LS27A700NWCXZW,型號：S27A700NWC,27吋 S7 UHD 高解析度平面顯示器 (ENERGY STAR),27吋16:9 IPS平面螢幕,4K UHD(3840x2160)解析度,最大60Hz更新頻率,5ms反應時間,300/250 cd㎡亮度(典型/最小),原生對比1000:1 (Typ),動態對比Mega ∞ DCR,HDR10,178°寬廣視角,10.7億色彩支援,低藍光模式,零閃屏,PIP子母畫面,PBP分割畫面,遊戲模式,影像尺寸調整,Windows 10認證,Off Timer Plus,自動來源切換,智慧偵測環境光源(Adaptive picture),省電模式自由選,光源感測(Eco Light Sensor),介面：DisplayPort 1.2 x1、HDMI 2.0 x1、耳機孔、USB連接埠x1,操作溫度10~40℃、濕度10~80%,工廠出廠調校,色彩支援模式CUSTOM/STANDARD/CINEMA/DYNAMIC CONTRAST/HIGH BRIGHT/sRGB,黑色機身與簡約型底座,前後傾斜-2°~22°,VESA 100x100壁掛,ENERGY STAR認證,再生資源塑料3%,電源AC 100~240V內置電源,尺寸含底座615.5x456x193.5mm,不含底座615.5x368.2x42.7mm,包裝尺寸738x126x428mm,重量含底座5.5kg、不含底座4.4kg、包裝重量7kg,配件1.5m電源線,HDMI線",
    "LS32A700NWCXZW,型號：S32A700NWC,32吋 S7 UHD 高解析度平面顯示器 (ENERGY STAR),32吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,最大60Hz更新頻率,5ms反應時間,300/250 cd㎡亮度(典型/最小),原生對比2500:1 (Typ),動態對比Mega ∞ DCR,HDR10,178°寬廣視角,10.7億色彩支援,低藍光模式,零閃屏,PIP子母畫面,PBP分割畫面,遊戲模式,影像尺寸調整,Windows 10認證,Off Timer Plus,自動來源切換,智慧偵測環境光源(Adaptive picture),省電模式自由選,光源感測(Eco Light Sensor),介面：DisplayPort 1.2 x1(HDCP 2.2)、HDMI 2.0 x1、耳機孔,操作溫度10~40℃、濕度10~80%,工廠出廠調校,色彩支援模式CUSTOM/STANDARD/CINEMA/DYNAMIC CONTRAST/HIGH BRIGHT/sRGB,黑色機身與簡約型底座,前後傾斜-2°~22°,壁掛100x100,ENERGY STAR認證,再生資源塑料3%,電源AC 100~240V內置電源,耗電DPMS休眠模式0.5W,關閉模式0.5W,尺寸含底座716.1x518.5x193.5mm,不含底座716.1x424.7x41.3mm,包裝尺寸842x133x487mm,重量含底座6.1kg、不含底座5kg、包裝重量8kg,配件1.5m電源線、HDMI線",
    "LF27T450FQCXZW,型號：F27T450FQC,27吋 T450 商用顯示器,27吋16:9 IPS平面螢幕,FHD(1920x1080)解析度,最大75Hz更新頻率,5ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比1000:1,動態對比Mega,178°寬廣視角,1670萬色彩支援,NTSC 72%,低藍光模式,零閃屏,遊戲模式,影像尺寸調整,Windows 10認證,FreeSync,Off Timer Plus,省電模式自由選,介面：DisplayPort 1.2 x1、HDMI 1.4 x2、USB Hub 2.0 x2、耳機孔,操作溫度10–40℃、濕度10–80%,黑色機身與HAS PIVOT底座(高度調整130mm),前後傾斜-3°~25°,左右旋轉-45°~45°,垂直旋轉支援,VESA 100x100壁掛,ENERGY STAR認證,再生資源塑料3%以上,電源AC 100–240V內置電源,DPMS休眠模式0.3W、關閉模式0.3W,尺寸含底座612.1x391.6x224.0mm,不含底座612.1x363.6x39.4mm,包裝尺寸693x147x428mm,重量含底座4.6kg、不含底座3.2kg、包裝重量6.2kg,配件1.5m電源線,HDMI線",
    "LF24T350FHCXZW,型號：F24T350FHC,24吋 T350 平面顯示器,24吋16:9 IPS平面螢幕,FHD(1920x1080)解析度,最大75Hz更新頻率,5ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比1000:1,動態對比Mega,178°寬廣視角,1670萬色彩支援,NTSC 72%,低藍光模式,零閃屏,遊戲模式,影像尺寸調整,Windows 10認證,FreeSync,Off Timer Plus,省電模式自由選,介面：D-Sub 1個、HDMI 1個(1.4版本)、耳機孔,操作溫度10~40℃、濕度10~80%,黑色機身與Y型底座,前後傾斜-2°~20°,壁掛100x100,電源AC 100~240V外接電源變壓器,DPMS休眠模式0.3W,關閉模式0.3W,尺寸含底座539.2x425.3x232.0mm,不含底座539.2x322.8x39.4mm,包裝尺寸675x125x387mm,重量含底座2.7kg、不含底座2.4kg、包裝重量4.0kg,配件1.5m電源線、HDMI線",
    "LS27C366EACXZW,型號：S27C366EAC,27吋 S3 曲面顯示器 C366,27吋16:9 VA曲面螢幕,1800R曲率,FHD(1920x1080)解析度,最大75Hz更新頻率,4ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比3000:1,178°寬廣視角,1670萬色彩支援,NTSC 72%,低藍光模式,零閃屏,遊戲模式,影像尺寸調整,Windows 10認證,FreeSync,Off Timer Plus,省電模式自由選,介面：D-Sub x1、HDMI 1.4 x1(HDCP 1.4)、耳機孔,操作溫度10~40℃、濕度10~80%,黑色機身與簡約型底座,前後傾斜-2°~22°,VESA 75x75mm壁掛,電源AC 100~240V外接電源變壓器,最大耗電25W,尺寸含底座622.6x466.2x234.2mm,不含底座622.6x367.2x108.2mm,包裝尺寸687x175x442mm,重量含底座4.2kg、不含底座3.7kg、包裝重量6.3kg,配件1.5m電源線、HDMI線",
    "LS24C366EACXZW,型號：S24C366EAC,24吋 S3 曲面顯示器 C366,24吋16:9 VA曲面螢幕,1800R曲率,FHD(1920x1080)解析度,最大75Hz更新頻率,4ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比3000:1,178°寬廣視角,1670萬色彩支援,NTSC 72%,低藍光模式,零閃屏,遊戲模式,影像尺寸調整,Windows 10認證,FreeSync,Off Timer Plus,省電模式自由選,介面：D-Sub x1、HDMI 1.4 x1(HDCP 1.4)、耳機孔,操作溫度10~40℃、濕度10~80%,黑色機身與簡約型底座,前後傾斜-2°~22°,VESA 75x75mm壁掛,電源AC 100~240V外接電源變壓器,最大耗電25W,尺寸含底座547.8x423.9x234.2mm,不含底座547.8x325.6x102.0mm,包裝尺寸612x162x390mm,重量含底座3.1kg、不含底座2.6kg、包裝重量4.8kg,配件1.5m電源線、HDMI線",
    "LS27C310EACXZW,型號：S27C310EAC,27吋 S3 平面顯示器 C310,27吋16:9 IPS平面螢幕,FHD(1920x1080)解析度,最大75Hz更新頻率,5ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比1000:1,178°寬廣視角,1670萬色彩支援,NTSC 72%,低藍光模式,零閃屏,遊戲模式,影像尺寸調整,Windows 10認證,FreeSync,Off Timer Plus,省電模式自由選,介面：D-Sub x1、HDMI 1.4 x1(HDCP 1.2),操作溫度10~40℃、濕度10~80%,黑色機身與簡約型底座,前後傾斜-2°~20°,VESA 100x100mm壁掛,再生資源塑料22.30%,電源AC 100~240V外接電源變壓器,最大耗電25W,尺寸含底座612.1x463.3x217.4mm,不含底座612.1x363.5x41.4mm,包裝尺寸678x155x430mm,重量含底座3.8kg、不含底座3.4kg、包裝重量5.6kg,配件1.5m電源線、HDMI線",
    "LS24C310EACXZW,型號：S24C310EAC,24吋 S3 平面顯示器 C310,24吋16:9 IPS平面螢幕,FHD(1920x1080)解析度,最大75Hz更新頻率,5ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比1000:1,178°寬廣視角,1670萬色彩支援,NTSC 72%,低藍光模式,零閃屏,遊戲模式,影像尺寸調整,Windows 10認證,FreeSync,Off Timer Plus,省電模式自由選,介面：D-Sub x1、HDMI 1.4 x1(HDCP 1.2)、耳機孔,操作溫度10~40℃、濕度10~80%,黑色機身與簡約型底座,前後傾斜-2°~20°,VESA 100x100mm壁掛,再生資源塑料20.6%,電源AC 100~240V外接電源變壓器,最大耗電25W,尺寸含底座539.5x422.8x217.4mm,不含底座539.5x322.8x41.2mm,包裝尺寸607x147x380mm,重量含底座2.8kg、不含底座2.4kg、包裝重量4.3kg,配件1.5m電源線、HDMI線",
    "LC32T550FDCXZW,型號：C32T550FDC,32吋1000R曲面顯示器 CT55,32吋16:9 VA曲面螢幕,1000R曲率,FHD(1920x1080)解析度,最大75Hz更新頻率,4ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比3000:1 (Typ.),動態對比Mega,178°寬廣視角,色彩支援1670萬色,NTSC覆蓋度0.806,DCI色域0.88,sRGB覆蓋率1.193,Adobe RGB覆蓋率0.884,低藍光模式,零閃屏,遊戲模式,Windows 10認證,FreeSync,Off Timer Plus,HDMI-CEC,介面：D-Sub x1、DisplayPort 1.2 x1、HDMI 1.4 x1,內建5W立體聲喇叭,音訊輸入與耳機孔,操作溫度10~40℃、濕度10~80%,校正均勻度0.75,黑色機身與圓型底座,前後傾斜-3°~20°,壁掛100x100mm,電源AC 100~240V外接電源變壓器,DPMS休眠與關閉模式耗電0.5W,尺寸含底座708.8x514.4x271.7mm,不含底座708.8x426.0x133.5 mm,包裝尺寸806x242x520 mm,重量含底座6.4kg、不含底座4.9kg、包裝重量9.3kg,配件1.5m電源線、HDMI線",
    "LC27T550FDCXZW,型號：C27T550FDC,27吋1000R曲面顯示器 CT55,27吋16:9 VA曲面螢幕,1000R曲率,FHD(1920x1080)解析度,最大75Hz更新頻率,4ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比3000:1 (Typ.),動態對比Mega,178°寬廣視角,色彩支援1670萬色,NTSC覆蓋度0.806,DCI色域0.88,sRGB覆蓋率1.193,Adobe RGB覆蓋率0.884,低藍光模式,零閃屏,遊戲模式,Windows 10認證,FreeSync,Off Timer Plus,HDMI-CEC,介面：D-Sub x1、DisplayPort 1.2 x1、HDMI 1.4 x1,音訊輸入與耳機孔,內建立體聲喇叭,操作溫度10~40℃、濕度10~80%,校正均勻度75%,黑色機身與圓型底座,前後傾斜-3°~20°,壁掛100x100mm,電源AC 100~240V 50/60Hz外接電源變壓器,DPMS休眠及關閉模式耗電0.5W,尺寸含底座613.2x458.1x249.6mm,不含底座613.2x369.7x112.5mm,包裝尺寸698x199x452mm,重量含底座5.1kg、不含底座3.8kg、包裝重量6.8kg,配件1.5m電源線、HDMI線",
    "LC24T550FDCXZW,型號：C24T550FDC,24吋1000R曲面顯示器 CT55,24吋16:9 VA曲面螢幕,1000R曲率,FHD(1920x1080)解析度,最大75Hz更新頻率,4ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比3000:1 (Typ.),動態對比Mega,178°寬廣視角,色彩支援1670萬色,NTSC覆蓋度0.806,DCI色域0.88,sRGB覆蓋率1.193,Adobe RGB覆蓋率0.884,低藍光模式,零閃屏,遊戲模式,Windows 10認證,FreeSync,Off Timer Plus,HDMI-CEC,介面：D-Sub x1、DisplayPort 1.2 x1、HDMI 1.4 x1、耳機孔,操作溫度10~40℃、濕度10~80%,校正均勻度0.75,黑色機身與圓型底座,前後傾斜-3°~20°,壁掛100x100mm,電源AC 100~240V 50/60Hz外接電源變壓器,DPMS休眠及關閉模式耗電0.5W,尺寸含底座539.5x413.6x249.6mm,不含底座539.5x325.5x103.0mm,包裝尺寸605x194x387mm,重量含底座4.2kg、不含底座2.9kg、包裝重量5.6kg,配件1.5m電源線、HDMI線",
    "LU32R591CWCXZW,型號：U32R591CWC,32吋4K UHD曲面顯示器 UR591C,32吋16:9 VA曲面螢幕,1500R曲率,4K UHD(3840x2160)解析度,60Hz更新頻率,4ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比2500:1(Typ.),動態對比Mega ∞ DCR,178°寬廣視角,10億色彩支援,NTSC 73%,sRGB 103%,Adobe RGB 76%,低藍光模式,零閃屏,遊戲模式,影像尺寸調整,Easy Setting Box,PBP畫面分割,Windows 10認證,Off Timer Plus,Samsung MagicBright,介面：DisplayPort 1.2 x1、HDMI 2.0 x1、耳機孔,操作溫度10~40℃、濕度10~80%,白色機身與Y形底座,前後傾斜-1°~17°,電源AC 100~240V外接電源變壓器,最大耗電59W,DPMS休眠與關閉模式≤0.3W,尺寸含底座712.7x515.0x237.9mm,不含底座712.7x420.9x83.6mm,包裝尺寸795x189x503mm,重量含底座5.5kg、不含底座4.8kg、包裝重量8.4kg,配件HDMI線",
    "LU32R590CWCXZW,型號：U32R590CWC,32吋4K UHD曲面顯示器 UR590,32吋16:9 VA曲面螢幕,1500R曲率,FHD(3840x2160)解析度,60Hz更新頻率,4ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比2500:1(Typ.),動態對比Mega ∞ DCR,178°寬廣視角,10億色彩支援,NTSC 73%,sRGB 103%,Adobe RGB 76%,低藍光模式,零閃屏,遊戲模式,影像尺寸調整,Easy Setting Box,PBP畫面分割,Windows 10認證,Off Timer Plus,Samsung MagicBright,介面：DisplayPort 1.2 x1、HDMI 2.0 x1、耳機孔,操作溫度10~40℃、濕度10~80%,黑色機身與Y型底座,前後傾斜-1°~17°,電源AC 100~240V外接電源變壓器,最大耗電59W,DPMS休眠與關閉模式≤0.3W,尺寸含底座712.7x515.0x237.9mm,不含底座712.7x420.9x83.6mm,包裝尺寸795x189x503mm,重量含底座5.5kg、不含底座4.8kg、包裝重量8.4kg,配件HDMI線及快速安裝指南",
    "LC27R500FHCXZW,型號：C27R500FHC,27吋FHD曲面顯示器 CR50,27吋16:9 VA曲面螢幕,1800R曲率,FHD(1920x1080)解析度,60Hz更新頻率,4ms(GtG)反應時間,250/220 cd㎡亮度(典型/最小),峰值亮度300 cd㎡,原生對比3000:1(Typ.),動態對比Mega,178°寬廣視角,1670萬色彩支援,NTSC 72%,低藍光模式,零閃屏,遊戲模式,影像尺寸調整,Samsung MagicBright,Windows 10認證,FreeSync,省電模式自由選,介面：D-Sub x1、HDMI 1.4 x1、耳機孔,操作溫度10~40℃、濕度10~80%,黑色機身與Y型底座,前後傾斜-2°~22°,VESA 75x75mm壁掛,電源AC 100~240V外接電源變壓器,最大耗電35W,DPMS休眠與關閉模式低於0.3W,尺寸含底座614.2x466.2x251.2mm,不含底座614.2x362.8x73.8mm,包裝尺寸710x177x460mm,重量含底座4.3kg、不含底座3.5kg、包裝重量6.5kg,配件1.5m電源線、HDMI線",
    "LS32C390EACXZW,型號：S32C390EAC,32吋1000R曲面顯示器 C390,32吋16:9 VA曲面螢幕,1000R曲率,FHD(1920x1080)解析度,最大75Hz更新頻率,4ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比3000:1(Typ.),178°寬廣視角,1670萬色彩支援,NTSC覆蓋度0.806,DCI色域0.88,sRGB覆蓋率1.193,Adobe RGB覆蓋率0.884,低藍光模式,零閃屏,遊戲模式,Windows 10認證,FreeSync,Off Timer Plus,自動來源切換,介面：DisplayPort 1.2 x1、HDMI 1.4 x2(HDCP 1.4)、耳機孔,內建5Wx2立體聲喇叭,操作溫度10~40℃、濕度10~80%,校正均勻度0.75,黑色機身與圓型底座,前後傾斜-3°~20°,電源AC 100~240V外接電源變壓器,最大耗電48W,尺寸含底座708.8x514.4x271.7mm,不含底座708.8x426.0x133.5mm,包裝尺寸806x242x542mm,重量含底座6.4kg、不含底座4.9kg、包裝重量9.3kg,配件1.5m電源線、HDMI線",
    "LS27C390EACXZW,型號：S27C390EAC,27吋1000R曲面顯示器 C390,27吋16:9 VA曲面螢幕,1000R曲率,FHD(1920x1080)解析度,最大75Hz更新頻率,4ms(GtG)反應時間,250/200 cd㎡亮度(典型/最小),原生對比3000:1(Typ.),178°寬廣視角,1670萬色彩支援,NTSC覆蓋度0.806,DCI色域0.88,sRGB覆蓋率1.193,Adobe RGB覆蓋率0.884,低藍光模式,零閃屏,遊戲模式,Windows 10認證,FreeSync,Off Timer Plus,自動來源切換,介面：DisplayPort 1.2 x1、HDMI 1.4 x2(HDCP 1.4)、耳機孔,內建5Wx2立體聲喇叭,操作溫度10~40℃、濕度10~80%,校正均勻度75%,黑色機身與圓型底座,前後傾斜-3°~20°,電源AC 100~240V外接電源變壓器,尺寸含底座613.2x458.1x249.6mm,不含底座613.2x369.7x112.5mm,包裝尺寸698x199x452mm,重量含底座5.1kg、不含底座3.8kg、包裝重量6.8kg,配件1.5m電源線、HDMI線",
    "LS32BM702UCXZW,型號：S32BM702UC,32吋智慧聯網螢幕 M7 (2022),32吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,最大60Hz更新頻率,4ms(GtG)反應時間,300/240 cd㎡亮度(典型/最小),原生對比3000:1(Typ.),178°寬廣視角,10億色彩支援,HDR10,低藍光模式,零閃屏,遊戲模式,Game Bar 2.0,HDMI-CEC,自動來源切換+,智慧偵測環境光源(Adaptive Picture),超寬遊戲螢幕(Ultrawide Game View),Tizen™作業系統,SmartThings支援,遠端存取,行動裝置畫面分享/螢幕鏡射/DLNA,感應連結(Tap View),聲音分享,ConnectShare™,Wireless Display,介面：HDMI 2.0 x2、USB 2.0 x3、USB-C x1(65W充電),WiFi5、藍牙5.2,內建立體聲喇叭,操作溫度10~40℃、濕度10~80%,工廠出廠調校,黑色機身與簡約型底座,前後傾斜-2°~22°,VESA 100x100mm壁掛,電源AC 100~240V內置電源,最大耗電150W,尺寸含底座716.1x517.0x193.5mm,不含底座716.1x424.5x41.8mm,包裝尺寸842x133x487mm,重量含底座6.5kg、不含底座5.4kg、包裝重量8.4kg,配件1.5m電源線、HDMI線、USB Type-C線、白色USB-C充電遙控器",
    "LS32BM703UCXZW,型號：S32BM703UC,32吋智慧聯網螢幕 M7 白色 (2022),32吋16:9 VA平面螢幕,4K UHD(3840x2160)解析度,最大60Hz更新頻率,4ms(GtG)反應時間,300/240 cd㎡亮度(典型/最小),原生對比3000:1(Typ.),178°寬廣視角,10億色彩支援,HDR10,低藍光模式,零閃屏,遊戲模式,Game Bar 2.0,HDMI-CEC,自動來源切換+,智慧偵測環境光源(Adaptive Picture),超寬遊戲螢幕(Ultrawide Game View),Tizen™作業系統,SmartThings支援,遠端存取,行動裝置畫面分享/螢幕鏡射/DLNA,感應連結(Tap View),聲音分享,ConnectShare™,Wireless Display,介面：HDMI 2.0 x2、USB 2.0 x3、USB-C x1(65W充電),WiFi5、藍牙5.2,內建立體聲喇叭,操作溫度10~40℃、濕度10~80%,工廠出廠調校,白色機身與簡約型底座,前後傾斜-2°~22°,VESA 100x100mm壁掛,電源AC 100~240V內置電源,最大耗電150W,尺寸含底座716.1x517.0x193.5mm,不含底座716.1x424.5x41.8mm,包裝尺寸842x133x487mm,重量含底座6.8kg、不含底座5.7kg、包裝重量8.7kg,配件1.5m電源線、HDMI線、USB Type-C線、白色USB-C充電遙控器",
    "LS49AG950NCXZW,型號：S49AG950NC,49吋Odyssey Neo G9 Mini LED曲面電競顯示器,49吋32:9 VA曲面螢幕,1000R曲率,DQHD(5120x1440)解析度,最大240Hz更新頻率,1ms(GtG)反應時間,420/300 cd㎡(典型/最小)亮度,2000 nit峰值亮度,原生對比1,000,000:1,動態對比Mega DCR,HDR10+支援,178°寬廣視角,10.7億色彩支援,NTSC 88%,DCI 95%,sRGB 125%,Adobe RGB 92%,低藍光模式,零閃屏,PIP子母畫面,PBP分割畫面,金屬量子點顯色技術,Windows 10認證,FreeSync Premium Pro,G-Sync相容,Off Timer Plus,黑平衡,低輸入延遲,更新頻率調整,自定義鍵,超級電競模式 UX,自動來源切換+,影像尺寸調整,介面：DisplayPort 1.4 x1(HDCP 2.2)、HDMI 2.1 x2(HDCP 2.2)、耳機孔、USB 3.0 x2,操作溫度10~40℃、濕度10~80%,工廠出廠調校,色彩支援模式多樣,黑色機身,HAS高度調整底座(120mm),前後傾斜-3°~13°,左右旋轉-15°~15°,VESA 100x100mm壁掛,內置電源,最大耗電不詳,尺寸含底座1149.5x537.2x418.3mm,不含底座1149.5x363.5x287.4mm,重量含底座14.5kg、不含底座11.9kg,包裝重量20.4kg,配件電源線、DP線、USB 3.0線",
    "LS32FG502ECXZW,型號：S32FG502EC,32吋Odyssey G5 平面電競顯示器 G50F,32吋16:9平面螢幕,QHD(2560x1440) Fast IPS面板,可視面積698.112x392.688mm,亮度300/240 cd/㎡(典型/最小),原生對比1000:1,HDR10,色彩支援16.7M,色域sRGB 99%,更新頻率Max 180Hz,反應時間1ms(GtG),178°/178°視角,支援AMD FreeSync,G-Sync相容,低藍光模式,零閃屏,黑平衡,虛擬準心,自動來源切換+,Off Timer Plus,介面:DisplayPort 1.2 x1(HDCP 2.2),HDMI 2.0 x1(HDCP 2.2),耳機孔x1,操作溫度10~40℃/濕度10~80%,黑色機身,HAS升降底座(105mm),前後傾斜-2°~25°,左右旋轉-45°~45°,垂直旋轉-92°~92°,100x100mm 壁掛,電源AC 100~240V 外接電源變壓器,最高耗電59W,機身含底座尺寸714.6x625.9x250.2mm,不含底座714.6x418.4x45.7mm,包裝尺寸790x124x565mm,重量含底座4.9kg,不含底座3.6kg,包裝重量8.0kg,配件:1.5m電源線、HDMI連接線、DP連接線。",
    "LS27H704EACXZW,型號：S27H704EAC,27吋 ViewFinity S7 平面高解析度顯示器 S70H,27吋16:9 IPS平面螢幕,4K UHD(3840x2160)解析度,最大60Hz更新頻率,5ms反應時間,350 cd/㎡亮度(典型),原生對比1000:1,HDR10,178°寬廣視角,10.7億色彩支援,sRGB 99%色域,低藍光模式,零閃屏,智慧偵測環境光源(Adaptive Picture),Windows 11認證,自動來源切換 Auto Source Switch+,HAS高度調整支架(120mm),前後傾斜-2°~25°,左右旋轉-30°~30°,垂直旋轉-92°~92°,VESA 100x100mm壁掛,電源AC 100~240V外接變壓器,最大耗電50W,尺寸含底座612.9x538.1x220.0mm,不含底座612.9x367.7x48.5mm,重量含底座4.9kg,不含底座3.4kg,配件電源線、HDMI線",
    "LS32HG802SCXZW,型號：S32HG802SC,32吋 Odyssey OLED G8 平面電競顯示器 G80SD,32吋16:9 OLED平面螢幕,4K UHD(3840x2160)解析度,最大240Hz更新頻率,0.03ms(GtG)反應時間,亮度典型250 cd/㎡/最小200 cd/㎡,原生對比1000000:1(Typ),HDR10+ Gaming,178°寬廣視角,10.7億色彩支援,色域DCI 99%,低藍光模式,零閃屏,AMD FreeSync Premium Pro,G-Sync相容,自動來源切換 Auto Source Switch+,智慧作業系統Tizen,Bixby語音助理,SmartThings Hub,WiFi5與藍牙5.2,10W立體聲喇叭,介面：HDMI 2.1 x2、DisplayPort 1.4 x1、USB Hub,HAS高度調整支架(120mm),前後傾斜-2.0°~25.0°,左右旋轉-30.0°~30.0°,垂直旋轉-92.0°~92.0°,VESA 100x100mm壁掛,電源AC 100~240V外接變壓器,最大耗電180W,尺寸含底座719.7x584.6x263.5mm,不含底座719.7x414.7x49.2mm,包裝尺寸815x200x530mm,重量含底座8.4kg,不含底座5.3kg,包裝重量12.0kg,配件電源線、HDMI線、DP線、遙控器",
    "LS32HG806ESXZW,型號：S32HG806ES,32吋 Odyssey IPS G8 雙模平面電競顯示器 G80HS,32吋16:9 IPS平面螢幕,雙模 6K 165Hz / 3K 330Hz,1ms(GtG)反應時間,亮度典型350 cd/㎡/峰值400 cd/㎡,原生對比1000:1,HDR10+ Gaming,178°/178°視角,10.7億色彩,sRGB 99%,FreeSync Premium Pro,G-Sync相容,自動來源切換+,介面：DisplayPort 2.1 x1、HDMI 2.1 x2、USB 3.2 Hub、耳機孔,HAS人體工學升降底座(120mm),前後傾斜-5.0°~25.0°,左右旋轉-30.0°~30.0°,垂直旋轉-92.0°~92.0°,VESA 100x100mm壁掛,外接變壓器,尺寸含底座714.5x584.6x263.5mm,不含底座714.5x422.3x59.6mm,重量含底座8.4kg,不含底座4.9kg,配件電源線、HDMI線、DP線",
    "LS32FM501ECXZW,型號：S32FM501EC,32吋 Smart Monitor M5 智慧聯網螢幕 M50F,32吋16:9 VA平面螢幕,FHD(1920x1080)解析度,最大60Hz更新頻率,4ms(GtG)反應時間,亮度典型250 cd/㎡/最小200 cd/㎡,原生對比3000:1(Typ),HDR10,178°寬廣視角,1670萬色彩支援,低藍光模式,零閃屏,影像尺寸調整,智慧偵測環境光源(Adaptive Picture),自動來源切換+,Tizen™作業系統,SmartThings支援,行動裝置鏡射,Wireless Display,WiFi5與藍牙5.2,介面：HDMI 2.0 x2、USB 2.0 x2,內建立體聲喇叭,前後傾斜-2.0°~22.0°,VESA 100x100mm壁掛,電源AC 100~240V內置電源,最大耗電50W,尺寸含底座716.1x517.0x193.5mm,不含底座716.1x424.5x41.8mm,包裝尺寸842x133x487mm,重量含底座6.2kg,不含底座5.0kg,包裝重量8.0kg,配件電源線、HDMI線、遙控器",
    "LS27HG806EFXZW,型號：S27HG806EF,27吋 Odyssey G8 G80HF 雙模平面電競顯示器,27吋16:9 IPS平面螢幕,解析度 雙模 5K 180Hz / QHD 360Hz,更新頻率 最大 360Hz,反應時間 1ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/gaming/odyssey-g8-g80hf-27-inch-dual-mode-5k-180hz-qhd-360hz-ls27hg806efxzw/",
    "LS27HG802SCXZW,型號：S27HG802SC,27吋 Odyssey OLED G8 G80SH 4K UHD 平面電競顯示器,27吋16:9 OLED平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 240Hz,反應時間 0.03ms(GtG),對比度 1000000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/gaming/odyssey-oled-g8-g80sh-27-inch-4k-uhd-240hz-ls27hg802scxzw/",
    "LS27HG612SCXZW,型號：S27HG612SC,27吋 Odyssey OLED G6 G61SH QHD 平面電競顯示器,27吋16:9 OLED平面螢幕,解析度 QHD (2560 x 1440),更新頻率 最大 360Hz,反應時間 0.03ms(GtG),對比度 1000000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/gaming/odyssey-oled-g6-g61sh-27-inch-240hz-oled-qhd-ls27hg612scxzw/",
    "LS27FG502ECXZW,型號：S27FG502EC,27吋 Odyssey G5 平面電競顯示器 G50F,27吋16:9 IPS平面螢幕,解析度 QHD (2560 x 1440),更新頻率 最大 180Hz,反應時間 1ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/gaming/odyssey-g5-g50f-27-inch-180hz-qhd-ls27fg502ecxzw/",
    "LS32FM500ECXZW,型號：S32FM500EC,32吋智慧聯網螢幕 M5 M50F,32吋16:9 VA平面螢幕,解析度 FHD (1920 x 1080),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/smart/smart-monitor-m5-32-inch-smart-tv-apps-ls32fm500ecxzw/",
    "LS22D400GACXZW,型號：S22D400GAC,22吋 S4 IPS 平面顯示器 S40GD,22吋16:9 IPS平面螢幕,解析度 FHD (1920 x 1080),更新頻率 最大 100Hz,反應時間 5ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/full-hd-1080p/essential-monitor-s4-s40gd-22-inch-fhd-ips-100hz-ls22d400gacxzw/",
    "LS24D400GACXZW,型號：S24D400GAC,24吋 S4 IPS 平面顯示器 S40GD,24吋16:9 IPS平面螢幕,解析度 FHD (1920 x 1080),更新頻率 最大 100Hz,反應時間 5ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/full-hd-1080p/essential-monitor-s4-s40gd-24-inch-fhd-ips-100hz-ls24d400gacxzw/",
    "LS24D300GACXZW,型號：S24D300GAC,24吋 S3 IPS 平面顯示器 S30GD,24吋16:9 IPS平面螢幕,解析度 FHD (1920 x 1080),更新頻率 最大 100Hz,反應時間 5ms(GtG),對比度 1000:1 (Typical),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/full-hd-1080p/essential-monitor-s3-s30gd-24-inch-fhd-ips-100hz-ls24d300gacxzw/",
    "LS24D362GACXZW,型號：LS24D362GAC,24吋 S3 曲面顯示器 S36GD,24吋16:9 VA曲面螢幕,解析度 FHD (1920 x 1080),更新頻率 最大 100Hz,反應時間 4ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/curved/essential-monitor-s3-24-inch-100hz-ls24d362gacxzw/",
    "LS27D806UACXZW,型號：S27D806UAC,27吋 ViewFinity S8 UHD 高解析度平面顯示器 S80UD,27吋16:9 IPS平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 5ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/viewfinity-s8-27-inch-uhd-usbc-easysetupstand-ls27d806uacxzw/",
    "LS32D707EACXZW,型號：S32D707EAC,32吋 ViewFinity S7 UHD 高解析度平面顯示器 S70D,32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 5ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/viewfinity-s7-32-inch-uhd-hdr10-easysetupstand-ls32d707eacxzw/",
    "LS27D706EACXZW,型號：S27D706EAC,27吋 ViewFinity S7 UHD 高解析度平面顯示器 S70D,27吋16:9 IPS平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 5ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/viewfinity-s7-27-inch-uhd-hdr10-easysetupstand-ls27d706eacxzw/",
    "LS24D604UACXZW,型號：S24D604UAC,24吋 ViewFinity S6 QHD 高解析度平面顯示器 S60UD,24吋16:9 IPS平面螢幕,解析度 QHD (2560 x 1440),更新頻率 最大 100Hz,反應時間 5ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/viewfinity-s6-24-inch-qhd-100hz-easysetupstand-ls24d604uacxzw/",
    "LS27D606UACXZW,型號：S27D606UAC,27吋 ViewFinity S6 QHD 高解析度平面顯示器 S60UD,27吋16:9 IPS平面螢幕,解析度 QHD (2560 x 1440),更新頻率 最大 100Hz,反應時間 5ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/viewfinity-s6-27-inch-qhd-100hz-easysetupstand-ls27d606uacxzw/",
    "LS32CM801UCXZW,型號：LS32CM801UC,32吋智慧聯網螢幕 M8 (2023),32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (靜態),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m8-m80c-32-inch-uhd-4k-smart-tv-apps-ls32cm801ucxzw/",
    "LS32CM80GUCXZW,型號：LS32CM80GUC,32吋智慧聯網螢幕 M8 (2023) 綠色,32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (靜態),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m8-m80c-32-inch-uhd-4k-smart-tv-apps-ls32cm80gucxzw/",
    "LS32CM80BUCXZW,型號：LS32CM80BUC,32吋智慧聯網螢幕 M8 (2023) 藍色,32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (靜態),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m8-m80c-32-inch-uhd-4k-smart-tv-apps-ls32cm80bucxzw/",
    "LS32CM80PUCXZW,型號：LS32CM80PUC,32吋智慧聯網螢幕 M8 (2023) 粉色,32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (靜態),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m8-m80c-32-inch-uhd-4k-smart-tv-apps-ls32cm80pucxzw/",
    "LS27CM703UCXZW,型號：LS27CM703UC,27吋智慧聯網螢幕 M7 (2023),27吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (靜態),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m7-m70c-27-inch-uhd-4k-smart-tv-apps-ls27cm703ucxzw/",
    "LS32CM703UCXZW,型號：LS32CM703UC,32吋智慧聯網螢幕 M7 (2023),32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (靜態),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m7-m70c-32-inch-uhd-4k-smart-tv-apps-ls32cm703ucxzw/",
    "LS27CM501ECXZW,型號：LS27CM501EC,27吋智慧聯網螢幕 M5 (2023) 白色,27吋16:9 VA平面螢幕,解析度 FHD (1920 x 1080),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/flat/smart-monitor-m5-27-inch-smart-tv-apps-ls27cm501ecxzw/",
    "LS27CM500ECXZW,型號：LS27CM500EC,27吋智慧聯網螢幕 M5 (2023) 黑色,27吋16:9 VA平面螢幕,解析度 FHD (1920 x 1080),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/flat/smart-monitor-m5-27-inch-smart-tv-apps-ls27cm500ecxzw/",
    "LS24A600NACXZW,型號：LS24A600NAC,24吋 S6 QHD 高解析度平面顯示器 (ENERGY STAR),24吋16:9 IPS平面螢幕,解析度 QHD (2560 x 1440),更新頻率 最大 75Hz,反應時間 5ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/s60a-24--24-inch-ips-uhd-4k-ls24a600nacxzw/",
    "LS27A600NACXZW,型號：LS27A600NAC,27吋 S6 QHD 高解析度平面顯示器 (ENERGY STAR),27吋16:9 IPS平面螢幕,解析度 QHD (2560 x 1440),更新頻率 最大 75Hz,反應時間 5ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/s60a-27--27-inch-ips-uhd-4k-ls27a600nacxzw/",
    "LS34A650UBCXZW,型號：LS34A650UBC,34吋 S6 Ultra WQHD 高解析度曲面顯示器 (ENERGY STAR),34吋21:9 VA曲面螢幕,解析度 Ultra WQHD (3440 x 1440),更新頻率 最大 100Hz,反應時間 5ms(GtG),對比度 4000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/s65ua-34-inch-ls34a650ubcxzw/",
    "LC32G55TQBCXZW,型號：LC32G55TQBC,32吋 Odyssey G5 1000R 曲面電競顯示器,32吋16:9 VA曲面螢幕,解析度 QHD (2560 x 1440),更新頻率 最大 144Hz,反應時間 1ms(MPRT),對比度 2500:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/gaming/odyssey-g5-32-inch-144hz-1ms-curved-lc32g55tqbcxzw/",
    "LC27G55TQBCXZW,型號：LC27G55TQBC,27吋 Odyssey G5 1000R 曲面電競顯示器,27吋16:9 VA曲面螢幕,解析度 QHD (2560 x 1440),更新頻率 最大 144Hz,反應時間 1ms(MPRT),對比度 2500:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/gaming/odyssey-g5-27-inch-144hz-1ms-curved-lc27g55tqbcxzw/",
    "LS28BG700ECXZW,型號：LS28BG700EC,28吋 Odyssey G7 平面電競顯示器 G70B,28吋16:9 IPS平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 144Hz,反應時間 1ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/gaming/odyssey-g70b-g7-28-inch-ips-144hz-1ms-uhd-4k-ls28bg700ecxzw/",
    "LS27BG650ECXZW,型號：LS27BG650EC,27吋 Odyssey G6 1000R 曲面電競顯示器 G65B,27吋16:9 VA曲面螢幕,解析度 QHD (2560 x 1440),更新頻率 最大 240Hz,反應時間 1ms(GtG),對比度 2500:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/gaming/odyssey-g65b-g6-27-inch-240hz-1ms-curved-qhd-1440p-ls27bg650ecxzw/",
    "LS49A950UICXZW,型號：LS49A950UIC,49吋 S9 高解析度超寬曲面顯示器 S95UA,49吋32:9 VA曲面螢幕,解析度 DQHD (5120 x 1440),更新頻率 最大 120Hz,反應時間 4ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/s95ua-49-inch-dqhd-curved-ls49a950uicxzw/",
    "LS43BM700UCXZW,型號：LS43BM700UC,43吋智慧聯網螢幕 M7 (2022),43吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 5000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m7-43-inch-smart-tv-experience-ls43bm700ucxzw/",
    "LS27AG320NCXZW,型號：S27AG320NC,27吋 Odyssey G3 平面電競顯示器 G32A,27吋16:9 VA平面螢幕,解析度 FHD (1920 x 1080),更新頻率 最大 165Hz,反應時間 1ms(MPRT),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/gaming/odyssey-g32a-g3-27-inch-165hz---freesync-ls27ag320ncxzw/",
    "LS27BM500ECXZW,型號：S27BM500EC,27吋智慧聯網螢幕 M5 (2022),27吋16:9 VA平面螢幕,解析度 FHD (1920 x 1080),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/flat/smart-m5-27-inch-smart-tv-experience-ls27bm500ecxzw/",
    "LS32BM801UCXZW,型號：S32BM801UC,32吋智慧聯網螢幕 M8 (2022) 白色,32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m8-32-inch-uhd-4k-ls32bm801ucxzw/",
    "LS32BM80GUCXZW,型號：S32BM80GUC,32吋智慧聯網螢幕 M8 (2022) 綠色,32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m8-32-inch-uhd-4k-ls32bm80gucxzw/",
    "LS32BM80BUCXZW,型號：S32BM80BUC,32吋智慧聯網螢幕 M8 (2022) 藍色,32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m8-32-inch-uhd-4k-ls32bm80bucxzw/",
    "LS32BM80PUCXZW,型號：LS32BM80PUC,32吋智慧聯網螢幕 M8 (2022) 粉色,32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 4ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m8-32-inch-uhd-4k-ls32bm80pucxzw/",
    "LS32AM703UCXZW,型號：S32AM703UC,32吋智慧聯網螢幕 M7 (白色),32吋16:9 VA平面螢幕,解析度 4K UHD (3840 x 2160),更新頻率 最大 60Hz,反應時間 8ms(GtG),對比度 3000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/smart-m7-32-inch-ls32am703ucxzw/",
    "LS24AM506NCXZW,型號：S24AM506NC,24吋智慧聯網螢幕 M5,24吋16:9 VA平面螢幕,解析度 FHD (1920 x 1080),更新頻率 最大 60Hz,反應時間 14ms,對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/flat/smart-m5-24-inch-smart-tv-apps-ls24am506ncxzw/",
    "LS27A600NWCXZW,型號：S27A600NWC,27吋 S6 QHD 高解析度平面顯示器 (ENERGY STAR) 白色,27吋16:9 IPS平面螢幕,解析度 QHD (2560 x 1440),更新頻率 最大 75Hz,反應時間 5ms(GtG),對比度 1000:1 (Typ.),可視角度 178° / 178°,官網網址： https://www.samsung.com/tw/monitors/high-resolution/s60a-27-27-inch-ips-uhd-4k-ls27a600nwcxzw/"
  ];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (sheet) {
      sheet.clearContents();
      const range = sheet.getRange(1, 1, fullRules.length, 1);
      const writeData = fullRules.map(r => [r]);
      range.setValues(writeData);
      SpreadsheetApp.flush();
      writeLog(`[Self Heal] 完璧歸趙！成功還原且同步 ${fullRules.length} 列完整官方真實極簡規格\n`);
      return fullRules.length;
    }
  } catch(err) {
    writeLog(`[Force Sync Error] ${err.message}`);
  }
  return 0;
}

function startNewEntryDraft(content, userId) {
  try {
    writeLog(
      userId,
      "UserRecord",
      `[NewDraft] 開始建檔: ${content.substring(0, 150)}`,
    );

    // v27.9.16: 累計費用追蹤
    var totalCostTWD = 0;
    var totalInputTokens = 0;
    var totalOutputTokens = 0;

    // Step 1: AI 產生初版 QA
    // v27.9.45: 傳入 userId 以便在模型失效時通知
    const polishedText = callGeminiToPolish(content, userId);
    writeLog(
      userId,
      "UserRecord",
      `[NewDraft] 初版 QA: ${polishedText.substring(0, 150)}`,
    );

    // 累計費用
    if (lastTokenUsage && lastTokenUsage.costTWD) {
      totalCostTWD += lastTokenUsage.costTWD;
      totalInputTokens += lastTokenUsage.input || 0;
      totalOutputTokens += lastTokenUsage.output || 0;
    }

    // Step 2: 搜尋現有 QA 是否有相似的
    const similarResult = findSimilarQA(content, polishedText);

    // 累計費用
    if (lastTokenUsage && lastTokenUsage.costTWD) {
      totalCostTWD += lastTokenUsage.costTWD;
      totalInputTokens += lastTokenUsage.input || 0;
      totalOutputTokens += lastTokenUsage.output || 0;
    }

    if (similarResult && similarResult.found) {
      // 找到相似 QA，讓用戶選擇
      writeLog(
        userId,
        "UserRecord",
        `[NewDraft] 找到相似 QA: 行 ${similarResult.matchedRows.join(",")}`,
      );

      // Step 3: LLM 合併產出合併版
      const mergedQA = callGeminiToMergeQA(
        similarResult.matchedQAs,
        polishedText,
      );
      writeLog(
        userId,
        "UserRecord",
        `[NewDraft] 合併版 QA: ${mergedQA.substring(0, 150)}`,
      );

      // 累計費用
      if (lastTokenUsage && lastTokenUsage.costTWD) {
        totalCostTWD += lastTokenUsage.costTWD;
        totalInputTokens += lastTokenUsage.input || 0;
        totalOutputTokens += lastTokenUsage.output || 0;
      }

      // 建立等待選擇的 draft
      var draft = {
        originalContent: content,
        conversation: [],
        currentQA: polishedText,
        userId: userId,
        pendingMergeChoice: true,
        mergedVersion: mergedQA,
        freshVersion: polishedText,
        matchedQARows: similarResult.matchedRows,
        matchedQATexts: similarResult.matchedQAs,
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
        JSON.stringify(draft),
        CONFIG.DRAFT_TTL_SEC,
      );

      // 組裝回覆訊息
      var replyMsg = "🔍 找到相似的現有 QA：\n\n";
      replyMsg += "【現有 QA】\n";
      for (var i = 0; i < similarResult.matchedQAs.length; i++) {
        replyMsg += similarResult.matchedQAs[i].substring(0, 100) + "...\n";
      }
      replyMsg += "\n【建議合併成】\n" + mergedQA + "\n\n";
      replyMsg += "【你的新內容】\n" + polishedText + "\n\n";
      replyMsg += "請選擇：\n";
      replyMsg += "1️⃣ 採用合併版（會刪除舊 QA）\n";
      replyMsg += "2️⃣ 另開新條（保留舊 QA）\n";
      replyMsg += "3️⃣ 取代舊 QA（刪除舊的，直接用新的）";

      // v27.9.16: 附加費用資訊
      if (totalCostTWD > 0) {
        replyMsg += `\n\n---\n本次建檔預估花費：NT$${totalCostTWD.toFixed(
          4,
        )} (In:${totalInputTokens}/Out:${totalOutputTokens})`;
      }

      writeLog(userId, "UserRecord", `[NewDraft Reply] 等待用戶選擇 1/2/3`);
      return replyMsg;
    }

    // 沒找到相似，直接進入正常建檔模式
    var draft = {
      originalContent: content,
      conversation: [],
      currentQA: polishedText,
      userId: userId,
      pendingMergeChoice: false,
    };
    CacheService.getScriptCache().put(
      CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
      JSON.stringify(draft),
      CONFIG.DRAFT_TTL_SEC,
    );

    var alertMsg =
      "⚠️ 已進入建檔模式。接下來的對話將視為修改指令，直到輸入 /紀錄 存檔為止。";
    var preview =
      "\n\n【預覽】將寫入 QA：\n" +
      polishedText +
      "\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消";

    // v27.9.16: 附加費用資訊
    if (totalCostTWD > 0) {
      preview += `\n\n---\n本次建檔預估花費：NT$${totalCostTWD.toFixed(
        4,
      )} (In:${totalInputTokens}/Out:${totalOutputTokens})`;
    }

    writeLog(
      userId,
      "UserRecord",
      `[NewDraft Reply] ${(alertMsg + preview).substring(0, 100)}...`,
    );
    return alertMsg + preview;
  } catch (e) {
    writeLog(userId, "Error", `[NewDraft Error] ${e.message}`);
    return "❌ 分析失敗：" + e.message;
  }
}

function handleDraftModification(feedback, userId, replyToken, currentDraft) {
  try {
    writeLog(`[DraftMod] 用戶說: ${feedback}`);

    // 檢查是否在等待選擇 1/2
    if (currentDraft.pendingMergeChoice === true) {
      var choice = feedback.trim();

      var cleanChoice = choice.replace(/[\s.、️⃣]/g, "");
      var isOne = /^[1１一]$/.test(cleanChoice);
      var isTwo = /^[2２二]$/.test(cleanChoice);
      var isThree = /^[3３三]$/.test(cleanChoice);

      if (isOne) {
        // 選擇合併版，刪除舊 QA
        writeLog(`[DraftMod] 用戶選擇 1: 採用合併版`);
        deleteQARows(currentDraft.matchedQARows);

        var newDraft = {
          originalContent: currentDraft.originalContent,
          conversation: [],
          currentQA: currentDraft.mergedVersion,
          userId: userId,
          pendingMergeChoice: false,
        };
        CacheService.getScriptCache().put(
          CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
          JSON.stringify(newDraft),
          CONFIG.DRAFT_TTL_SEC,
        );

        var preview =
          "✅ 已採用合併版，舊 QA 已刪除\n\n【預覽】將寫入 QA：\n" +
          currentDraft.mergedVersion +
          "\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消";
        replyMessage(replyToken, preview);
        writeLog(`[DraftMod Reply] 採用合併版`);
        return;
      } else if (isTwo) {
        // 選擇純新版，保留舊 QA
        writeLog(`[DraftMod] 用戶選擇 2: 另開新條`);

        var newDraft = {
          originalContent: currentDraft.originalContent,
          conversation: [],
          currentQA: currentDraft.freshVersion,
          userId: userId,
          pendingMergeChoice: false,
        };
        CacheService.getScriptCache().put(
          CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
          JSON.stringify(newDraft),
          CONFIG.DRAFT_TTL_SEC,
        );

        var preview =
          "✅ 已選擇另開新條，舊 QA 保留\n\n【預覽】將寫入 QA：\n" +
          currentDraft.freshVersion +
          "\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消";
        replyMessage(replyToken, preview);
        writeLog(`[DraftMod Reply] 另開新條`);
        return;
      } else if (isThree) {
        // 選擇 3: 取代舊 QA
        writeLog(`[DraftMod] 用戶選擇 3: 取代舊 QA`);
        deleteQARows(currentDraft.matchedQARows);

        var newDraft = {
          originalContent: currentDraft.originalContent,
          conversation: [],
          currentQA: currentDraft.freshVersion,
          userId: userId,
          pendingMergeChoice: false,
        };
        CacheService.getScriptCache().put(
          CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
          JSON.stringify(newDraft),
          CONFIG.DRAFT_TTL_SEC,
        );

        var preview =
          "✅ 已選擇取代舊 QA（舊條目已刪除）\n\n【預覽】將寫入 QA：\n" +
          currentDraft.freshVersion +
          "\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消";
        replyMessage(replyToken, preview);
        writeLog(`[DraftMod Reply] 取代舊 QA`);
        return;
      } else {
        // 💡 智慧融入補充說明模式
        writeLog(`[DraftMod] 偵測到選擇階段的補充修改: ${feedback}`);
        
        // 將補充回饋融入到新版 (freshVersion) 與合併版 (mergedVersion) 中
        const updatedFresh = callGeminiToModify(currentDraft.freshVersion, feedback);
        const updatedMerged = callGeminiToModify(currentDraft.mergedVersion, feedback);
        
        var conversation = currentDraft.conversation || [];
        conversation.push(feedback);

        var updatedDraft = {
          originalContent: currentDraft.originalContent + "\n[補充] " + feedback,
          conversation: conversation,
          currentQA: updatedFresh,
          userId: userId,
          pendingMergeChoice: true, // 依然在選擇階段
          mergedVersion: updatedMerged,
          freshVersion: updatedFresh,
          matchedQARows: currentDraft.matchedQARows,
          matchedQATexts: currentDraft.matchedQATexts
        };

        CacheService.getScriptCache().put(
          CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
          JSON.stringify(updatedDraft),
          CONFIG.DRAFT_TTL_SEC,
        );

        var replyMsg = "🔄 已為你將最新補充說明融入選項中！\n\n";
        replyMsg += "🔍 找到相似的現有 QA：\n";
        for (var i = 0; i < currentDraft.matchedQATexts.length; i++) {
          replyMsg += "• " + currentDraft.matchedQATexts[i].substring(0, 80) + "...\n";
        }
        replyMsg += "\n【建議合併成（已融入補充）】\n" + updatedMerged + "\n\n";
        replyMsg += "【你的新內容（已融入補充）】\n" + updatedFresh + "\n\n";
        replyMsg += "請重新選擇：\n";
        replyMsg += "1️⃣ 採用合併版（會刪除舊 QA）\n";
        replyMsg += "2️⃣ 另開新條（保留舊 QA）\n";
        replyMsg += "3️⃣ 取代舊 QA（刪除舊的，直接用新的）\n\n";
        replyMsg += "👉 繼續補充修改 → 直接回覆對話\n👉 取消建檔 → 輸入 /取消";

        // 費用標記
        if (lastTokenUsage && lastTokenUsage.costTWD) {
          replyMsg += `\n\n---\n本次修改預估花費：NT$${lastTokenUsage.costTWD.toFixed(4)}`;
        }

        replyMessage(replyToken, replyMsg);
        writeLog(`[DraftMod Reply] 智慧融入補充成功，等待重新選擇`);
        return;
      }
    }

    // 正常修改模式
    writeLog(
      `[DraftMod] 原始內容: ${(currentDraft.originalContent || "").substring(
        0,
        500,
      )}`,
    );
    writeLog(
      `[DraftMod] 目前 QA: ${(currentDraft.currentQA || "").substring(0, 500)}`,
    );

    // 累積對話歷史
    var conversation = currentDraft.conversation || [];
    conversation.push(feedback);

    // 帶完整上下文讓 LLM 重新產出 QA
    var newQA = callGeminiToRefineQA(
      currentDraft.originalContent,
      currentDraft.currentQA,
      conversation,
    );

    writeLog(`[DraftMod] 新 QA: ${newQA.substring(0, 500)}`);

    // 更新 draft
    var newDraft = {
      originalContent: currentDraft.originalContent,
      conversation: conversation,
      currentQA: newQA,
      userId: userId,
      pendingMergeChoice: false,
    };
    CacheService.getScriptCache().put(
      CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
      JSON.stringify(newDraft),
      CONFIG.DRAFT_TTL_SEC,
    );

    var preview =
      "🔄 已修正草稿：\n\n【預覽】將寫入 QA：\n" +
      newQA +
      "\n\n👉 確認存檔 → /紀錄\n👉 繼續修改 → 直接回覆\n👉 放棄 → /取消";

    // v27.9.17: 附加費用資訊
    if (lastTokenUsage && lastTokenUsage.costTWD) {
      preview += `\n\n---\n本次修改預估花費：NT$${lastTokenUsage.costTWD.toFixed(
        4,
      )} (In:${lastTokenUsage.input}/Out:${lastTokenUsage.output})`;
    }

    replyMessage(replyToken, preview);
    writeLog(`[DraftMod Reply] ${preview.substring(0, 500)}...`);
  } catch (e) {
    writeLog(`[DraftMod Error] ${e.message}`);
    replyMessage(replyToken, "❌ 修改失敗: " + e.message);
  }
}

/**
 * 搜尋現有 QA 是否有相似的條目
 * @param {string} newContent - 用戶輸入的新內容
 * @param {string} polishedQA - AI 整理後的 QA
 * @returns {Object|null} { found: boolean, matchedRows: number[], matchedQAs: string[] }
 */
function findSimilarQA(newContent, polishedQA) {
  try {
    var sheet = ss.getSheetByName(SHEET_NAMES.QA);
    if (!sheet) return null;

    var lastRow = sheet.getLastRow();
    if (lastRow < 1) return null;

    var data = sheet.getRange(1, 1, lastRow, 1).getValues();
    var allQAs = [];
    for (var i = 0; i < data.length; i++) {
      var text = (data[i][0] || "").toString().trim();
      if (text) {
        allQAs.push({ row: i + 1, text: text });
      }
    }

    if (allQAs.length === 0) return null;

    // 組裝 QA 列表給 LLM 判斷
    var qaListText = "";
    for (var i = 0; i < allQAs.length; i++) {
      qaListText +=
        "行" + allQAs[i].row + ": " + allQAs[i].text.substring(0, 150) + "\n";
    }

    var apiKey =
      PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) return null;

    var prompt = "你是 QA 比對專家。\n\n";
    prompt += "以下是現有的 QA 列表：\n" + qaListText + "\n\n";
    prompt += "新內容：\n" + newContent + "\n\n";
    prompt += "整理後：\n" + polishedQA + "\n\n";
    prompt += "請判斷現有 QA 中是否有和新內容「主題相同或高度相關」的條目。\n";
    prompt += "如果有，回傳相關的行號（用逗號分隔，例如：3,7）\n";
    prompt += "如果沒有，只回 NONE\n";
    prompt += "只回行號或 NONE，不要解釋。";

    var payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.1,
      },
    };

    // v24.2.3: 簡單搜尋用 Fast 模型
    var res = UrlFetchApp.fetch(
      CONFIG.API_ENDPOINT +
        "/" +
        CONFIG.MODEL_NAME_FAST +
        ":generateContent?key=" +
        apiKey,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    var code = res.getResponseCode();
    var body = res.getContentText();
    writeLog(
      "[FindSimilar API] Code: " + code + ", Body: " + body.substring(0, 300),
    );

    if (code !== 200) return null;

    var json = JSON.parse(body);

    // v25.0.1 新增：記錄 Token 成本（確保計費完整）
    if (json.usageMetadata) {
      var inputTokens = json.usageMetadata.promptTokenCount || 0;
      var outputTokens = json.usageMetadata.candidatesTokenCount || 0;
      var totalTokens = inputTokens + outputTokens;
      var costUSD =
        (inputTokens * PRICE_FAST_INPUT) / 1000000 +
        (outputTokens * PRICE_FAST_OUTPUT) / 1000000;
      var costTWD = costUSD * EXCHANGE_RATE;
      lastTokenUsage = {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
        costUSD: costUSD,
        costTWD: costTWD,
      };
      writeLog(
        "[FindSimilar Tokens] In:" +
          inputTokens +
          "/Out:" +
          outputTokens +
          "=Total:" +
          totalTokens +
          ", Cost:NT$" +
          costTWD.toFixed(4),
      );
    }

    var candidates = json && json.candidates ? json.candidates : [];
    if (candidates.length === 0) return null;

    var firstCandidate = candidates[0];
    var rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts
    ) {
      var parts = firstCandidate.content.parts;
      if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
        rawText = parts[0].text.trim();
      }
    }

    writeLog("[FindSimilar] LLM 回應: " + rawText);

    if (!rawText || rawText.toUpperCase() === "NONE") {
      return { found: false, matchedRows: [], matchedQAs: [] };
    }

    // 解析行號
    var rowNumbers = [];
    var matches = rawText.match(/\d+/g);
    if (matches) {
      for (var i = 0; i < matches.length; i++) {
        var num = parseInt(matches[i], 10);
        if (num > 0 && num <= lastRow) {
          rowNumbers.push(num);
        }
      }
    }

    if (rowNumbers.length === 0) {
      return { found: false, matchedRows: [], matchedQAs: [] };
    }

    // 取得匹配的 QA 內容
    var matchedQAs = [];
    for (var i = 0; i < rowNumbers.length; i++) {
      var rowNum = rowNumbers[i];
      for (var j = 0; j < allQAs.length; j++) {
        if (allQAs[j].row === rowNum) {
          matchedQAs.push(allQAs[j].text);
          break;
        }
      }
    }

    return { found: true, matchedRows: rowNumbers, matchedQAs: matchedQAs };
  } catch (e) {
    writeLog("[FindSimilar Error] " + e.message);
    return null;
  }
}

/**
 * 讓 LLM 合併現有 QA 和新內容
 * @param {string[]} existingQAs - 現有的相似 QA
 * @param {string} newQA - 新整理的 QA
 * @returns {string} 合併後的 QA
 */
function callGeminiToMergeQA(existingQAs, newQA) {
  var apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");

  var existingText = "";
  for (var i = 0; i < existingQAs.length; i++) {
    existingText += "現有 QA " + (i + 1) + ": " + existingQAs[i] + "\n";
  }

  var prompt = "你是「客服 QA 知識庫建檔專家」。\n\n";
  prompt += "任務：將現有 QA 和新內容合併成一條完整的 QA。\n\n";
  prompt += existingText + "\n";
  prompt += "新內容：" + newQA + "\n\n";
  prompt += "請輸出一行：問題 / A：答案\n\n";
  prompt += "重要規則：\n";
  prompt += "- 融合所有資訊，去除重複\n";
  prompt += "- 型號必須完整列出，禁止縮寫\n";
  prompt += "- 問題要涵蓋所有相關問法\n";
  prompt += "- 格式嚴格用「 / A：」分隔，不要用逗號\n";
  prompt += "- 只輸出一行結果，不要解釋";

  var payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 2000, // v27.8.8: 從 1000 提高到 2000，避免 thinking tokens 佔用過多配額導致輸出被截斷
      temperature: 0.3,
    },
  };

  try {
    // v24.2.3: 語意合併用 Think 模型
    var res = UrlFetchApp.fetch(
      CONFIG.API_ENDPOINT +
        "/" +
        CONFIG.MODEL_NAME_THINK +
        ":generateContent?key=" +
        apiKey,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    var code = res.getResponseCode();
    var body = res.getContentText();
    writeLog(
      "[MergeQA API] Code: " + code + ", Body: " + body.substring(0, 500),
    );

    if (code !== 200) {
      // 降級：簡單合併
      return newQA + "（合併自現有 QA）";
    }

    var json = JSON.parse(body);

    // 記錄 Token 用量
    if (json.usageMetadata) {
      var usage = json.usageMetadata;
      var costUSD =
        (usage.promptTokenCount / 1000000) * PRICE_THINK_INPUT +
        (usage.candidatesTokenCount / 1000000) * PRICE_THINK_OUTPUT;
      var costTWD = costUSD * EXCHANGE_RATE;
      // v27.9.19: 關鍵修正！設定 lastTokenUsage
      lastTokenUsage = {
        input: usage.promptTokenCount,
        output: usage.candidatesTokenCount,
        total: usage.totalTokenCount,
        costTWD: costTWD,
      };
      writeLog(
        `[MergeQA Tokens] In: ${usage.promptTokenCount}, Out: ${
          usage.candidatesTokenCount
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`,
      );
    } else {
      lastTokenUsage = null;
    }

    var candidates = json && json.candidates ? json.candidates : [];
    if (candidates.length === 0) return newQA;

    var firstCandidate = candidates[0];
    var rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts
    ) {
      var parts = firstCandidate.content.parts;
      if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
        rawText = parts[0].text.trim().replace(/[\r\n]+/g, " ");
      }
    }

    return rawText || newQA;
  } catch (e) {
    writeLog("[MergeQA Error] " + e.message);
    return newQA;
  }
}

/**
 * 刪除指定行的 QA
 * @param {number[]} rowNumbers - 要刪除的行號（從大到小刪除避免位移問題）
 */
function deleteQARows(rowNumbers) {
  if (!rowNumbers || rowNumbers.length === 0) return;

  try {
    var sheet = ss.getSheetByName(SHEET_NAMES.QA);
    if (!sheet) return;

    // 從大到小排序，避免刪除後行號位移
    var sorted = rowNumbers.slice().sort(function (a, b) {
      return b - a;
    });

    for (var i = 0; i < sorted.length; i++) {
      var rowNum = sorted[i];
      if (rowNum > 0 && rowNum <= sheet.getLastRow()) {
        sheet.deleteRow(rowNum);
        writeLog("[DeleteQA] 已刪除行 " + rowNum);
      }
    }

    SpreadsheetApp.flush();
  } catch (e) {
    writeLog("[DeleteQA Error] " + e.message);
  }
}

/**
 * 帶完整上下文讓 LLM 重新產出 QA
 * @param {string} originalContent - 原始輸入內容
 * @param {string} currentQA - 目前的 QA 版本
 * @param {string[]} conversation - 所有修改指令歷史
 */
function callGeminiToRefineQA(originalContent, currentQA, conversation) {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");

  // 組裝完整上下文
  const historyText = conversation
    .map((msg, i) => `用戶第${i + 1}次說: ${msg}`)
    .join("\n");

  const prompt = `你是「客服 QA 知識庫建檔專家」。

                              任務：根據用戶的修改指令，重新整理出一條 QA。

                              【原始素材】
                              ${originalContent}

                              【目前版本】
                              ${currentQA}

                              【用戶修改指令】
                              ${historyText}

                              請輸出一行：問題 / A：答案

                              重要規則：
                              - 型號必須完整列出，禁止縮寫（例：寫 M50A、M50B、M50C，不可寫 M50A/B/C）
                              - 問題要像客戶會問的話
                              - 答案要融合所有資訊，不是疊加
                              - 格式嚴格用「 / A：」分隔，不要用逗號
                              - 只輸出一行結果，不要解釋`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 2000, // v27.8.8: 從 1000 提高到 2000，避免 thinking tokens 佔用過多配額導致輸出被截斷
      temperature: 0.3,
    },
  };

  try {
    // v24.2.3: 對話修改用 Think 模型
    const res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_THINK}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    const code = res.getResponseCode();
    const body = res.getContentText();
    writeLog(`[RefineQA API] Code: ${code}, Body: ${body.substring(0, 500)}`);

    if (code !== 200) {
      writeLog(`[RefineQA API Error] Code: ${code}`);
      // 降級：簡單合併
      return simpleModifyFallback(
        currentQA,
        conversation[conversation.length - 1],
      );
    }

    let json;
    try {
      json = JSON.parse(body);
    } catch (parseErr) {
      writeLog(`[RefineQA Parse Error] ${parseErr.message}`);
      return simpleModifyFallback(
        currentQA,
        conversation[conversation.length - 1],
      );
    }

    // 記錄 Token 用量
    if (json.usageMetadata) {
      const usage = json.usageMetadata;
      const costUSD =
        (usage.promptTokenCount / 1000000) * PRICE_THINK_INPUT +
        (usage.candidatesTokenCount / 1000000) * PRICE_THINK_OUTPUT;
      const costTWD = costUSD * EXCHANGE_RATE;
      // v27.9.19: 關鍵修正！設定 lastTokenUsage
      lastTokenUsage = {
        input: usage.promptTokenCount,
        output: usage.candidatesTokenCount,
        total: usage.totalTokenCount,
        costTWD: costTWD,
      };
      writeLog(
        `[RefineQA Tokens] In: ${usage.promptTokenCount}, Out: ${
          usage.candidatesTokenCount
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`,
      );
    } else {
      lastTokenUsage = null;
    }

    const candidates = json && json.candidates ? json.candidates : [];
    const firstCandidate = candidates.length > 0 ? candidates[0] : null;
    const finishReason =
      firstCandidate && firstCandidate.finishReason
        ? firstCandidate.finishReason
        : "UNKNOWN";
    writeLog(
      `[RefineQA] finishReason: ${finishReason}, candidates: ${candidates.length}`,
    );

    let rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts
    ) {
      const parts = firstCandidate.content.parts;
      if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
        rawText = parts[0].text;
      }
    }

    if (!rawText || typeof rawText !== "string") {
      writeLog(`[RefineQA] AI 回傳為空`);
      return simpleModifyFallback(
        currentQA,
        conversation[conversation.length - 1],
      );
    }

    return rawText.trim().replace(/[\r\n]+/g, " ");
  } catch (e) {
    writeLog(`[RefineQA Error] ${e.message}`);
    return simpleModifyFallback(
      currentQA,
      conversation[conversation.length - 1],
    );
  }
}

/**
 * 簡化版建檔：AI 潤飾使用者輸入，回傳單一字串
 * 格式：問題 / A：答案
 * v27.9.45: 新增 userId 參數，支援模型失效時的主動回報
 */
function callGeminiToPolish(input, userId = null) {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");

  const prompt = `你是「客服 QA 知識庫建檔專家」。

                              任務：將以下內容整理成一條高品質 QA，讓未來客戶問到相關問題時能被正確匹配。

                              【用戶提供的內容】
                              ${input}

                              請輸出一行：問題 / A：答案

                              ⚠️ 關鍵規則：
                              1. **問題設計**：思考客戶可能會用哪些不同的說法來問這個問題，把最常見的 2-3 種問法濃縮成一個涵蓋性強的問題
                                - 例如：用戶輸入「如何隱藏工具列達到全螢幕」
                                - 好問題：「三星螢幕瀏覽器可以全螢幕嗎？如何隱藏工具列？」（涵蓋「全螢幕」和「隱藏工具列」兩種問法）
                                - 壞問題：「如何隱藏工具列？」（太窄，問「全螢幕」的人不會被匹配到）
                              2. **答案完整性**：保留用戶提供的所有關鍵資訊，不要截斷重要步驟或技巧
                              3. **格式**：嚴格用「 / A：」分隔，只輸出一行
                              4. **型號**：完整列出，禁止縮寫`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 2000, // v27.8.8: 從 1000 提高到 2000，避免 thinking tokens 佔用過多配額導致輸出被截斷
      temperature: 0.3,
    },
  };

  try {
    // v27.9.20: 使用 GEMINI_MODEL_POLISH（程式最前面設定），只有這裡會用到
    let res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${GEMINI_MODEL_POLISH}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    // v27.9.45: 模型回滾機制 (Model Fallback Strategy)
    // 若 Preview 模型失效 (404 Not Found 或 400 Bad Request)，自動切換至穩定的 Fast Mode
    // ⛔️ 禁止使用 Push Message! 改為在結果中附加警告訊息
    var warningMsg = "";

    if (res.getResponseCode() === 404 || res.getResponseCode() === 400) {
      const errBody = res.getContentText();
      writeLog(
        `[Polish Warning] ${GEMINI_MODEL_POLISH} 失效 (${res.getResponseCode()})，嘗試回滾... Err: ${errBody}`,
      );

      // 準備警告文字，將隨返還內容一起顯示
      warningMsg = `⚠️ [系統警告] Preview 模型 (${GEMINI_MODEL_POLISH}) 已失效，系統已自動切換至 ${CONFIG.MODEL_NAME_FAST} 繼續服務。請通知管理員更新程式設定。\n\n`;

      // 2. 自動切換至 Fast Mode 重試
      writeLog(`[Polish Fallback] Switching to ${CONFIG.MODEL_NAME_FAST}`);
      res = UrlFetchApp.fetch(
        `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_FAST}:generateContent?key=${apiKey}`,
        {
          method: "post",
          headers: { "Content-Type": "application/json" },
          payload: JSON.stringify(payload), // payload 通用
          muteHttpExceptions: true,
        },
      );
    }

    const code = res.getResponseCode();
    const body = res.getContentText();
    writeLog(`[Polish API] Code: ${code}, Body: ${body.substring(0, 500)}`);

    if (code !== 200) {
      writeLog(`[Polish API Error] Code: ${code}`);
      return simplePolishFallback(input);
    }

    let json;
    try {
      json = JSON.parse(body);
    } catch (parseErr) {
      writeLog(`[Polish Parse Error] ${parseErr.message}`);
      return simplePolishFallback(input);
    }

    // 記錄 Token 用量 - 使用 POLISH 專屬費率
    if (json.usageMetadata) {
      const usage = json.usageMetadata;
      const costUSD =
        (usage.promptTokenCount / 1000000) * PRICE_POLISH_INPUT +
        (usage.candidatesTokenCount / 1000000) * PRICE_POLISH_OUTPUT;
      const costTWD = costUSD * EXCHANGE_RATE;
      // v27.9.19: 設定 lastTokenUsage 讓費用可以顯示在回覆中
      lastTokenUsage = {
        input: usage.promptTokenCount,
        output: usage.candidatesTokenCount,
        total: usage.totalTokenCount,
        costTWD: costTWD,
      };
      writeLog(
        `[Polish Tokens] In: ${usage.promptTokenCount}, Out: ${
          usage.candidatesTokenCount
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(
          4,
        )} | Gemini 3 Flash)`,
      );
    } else {
      // 清除舊的 lastTokenUsage
      lastTokenUsage = null;
    }

    // 安全取得第一個候選文字 (GAS 不支援 Optional Chaining)
    const candidates = json && json.candidates ? json.candidates : [];
    const firstCandidate = candidates.length > 0 ? candidates[0] : null;
    const finishReason =
      firstCandidate && firstCandidate.finishReason
        ? firstCandidate.finishReason
        : "UNKNOWN";
    writeLog(
      `[Polish] finishReason: ${finishReason}, candidates: ${candidates.length}`,
    );

    let rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts
    ) {
      const parts = firstCandidate.content.parts;
      if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
        rawText = parts[0].text;
      }
    }

    if (!rawText || typeof rawText !== "string") {
      writeLog(
        `[Polish] AI 回傳為空，Body 前 300 字: ${body.substring(0, 300)}`,
      );
      return simplePolishFallback(input);
    }

    // 清理多餘的換行和空白，並附加警告訊息 (如果有)
    return warningMsg + rawText.trim().replace(/[\r\n]+/g, " ");
  } catch (e) {
    writeLog(`[Polish Error] ${e.message}`);
    // 任何例外都以降級格式化繼續流程
    return simplePolishFallback(input);
  }
}

/**
 * 簡化版修改：AI 根據指令修改現有文字
 */
function callGeminiToModify(currentText, instruction) {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");

  const prompt = `依修改指令調整下列QA，產生一行「問題 / A：答案」。
                              規則：只回一行、用「 / A：」分隔、保留原意但套用修改。
                              目前：${currentText}
                              修改：${instruction}`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 500,
      temperature: 0.4,
    },
  };

  try {
    // v27.9.37: 支援 OpenRouter 切換
    if (LLM_PROVIDER === "OpenRouter") {
      try {
        // 建構 OpenRouter 訊息
        const messages = [{ role: "user", parts: [{ text: prompt }] }];
        // 使用 callOpenRouter (不帶 System Prompt，因為這裡 prompt 包含了所有指示)
        const responseText = callOpenRouter(messages, 0.4);
        return responseText.trim().replace(/[\r\n]+/g, " ");
      } catch (orErr) {
        writeLog(
          `[Modify OpenRouter Fail] ${orErr.message}, Fallback to Gemini`,
        );
      }
    }

    // v24.2.3: 簡單格式化用 Fast 模型
    const res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_FAST}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    const code = res.getResponseCode();
    const body = res.getContentText();
    writeLog(`[Modify API] Code: ${code}, Body: ${body.substring(0, 500)}`);

    if (code !== 200) {
      writeLog(`[Modify API Error] Code: ${code}`);
      return simpleModifyFallback(currentText, instruction);
    }

    let json;
    try {
      json = JSON.parse(body);
    } catch (parseErr) {
      writeLog(`[Modify Parse Error] ${parseErr.message}`);
      return simpleModifyFallback(currentText, instruction);
    }

    // v27.9.17: 記錄 Token 費用
    if (json.usageMetadata) {
      const usage = json.usageMetadata;
      const costUSD =
        (usage.promptTokenCount / 1000000) * PRICE_FAST_INPUT +
        (usage.candidatesTokenCount / 1000000) * PRICE_FAST_OUTPUT;
      const costTWD = costUSD * EXCHANGE_RATE;
      lastTokenUsage = {
        input: usage.promptTokenCount,
        output: usage.candidatesTokenCount,
        total: usage.totalTokenCount,
        costUSD: costUSD,
        costTWD: costTWD,
      };
      writeLog(
        `[Modify Tokens] In: ${usage.promptTokenCount}, Out: ${
          usage.candidatesTokenCount
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`,
      );
    }

    // 安全取得第一個候選文字 (GAS 不支援 Optional Chaining)
    const candidates = json && json.candidates ? json.candidates : [];
    const firstCandidate = candidates.length > 0 ? candidates[0] : null;
    const finishReason =
      firstCandidate && firstCandidate.finishReason
        ? firstCandidate.finishReason
        : "UNKNOWN";
    writeLog(
      `[Modify] finishReason: ${finishReason}, candidates: ${candidates.length}`,
    );

    let rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts
    ) {
      const parts = firstCandidate.content.parts;
      if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
        rawText = parts[0].text;
      }
    }

    if (!rawText || typeof rawText !== "string") {
      writeLog(
        `[Modify] AI 回傳為空，Body 前 300 字: ${body.substring(0, 300)}`,
      );
      return simpleModifyFallback(currentText, instruction);
    }

    return rawText.trim().replace(/[\r\n]+/g, " ");
  } catch (e) {
    writeLog(`[Modify Error] ${e.message}`);
    return simpleModifyFallback(currentText, instruction);
  }
}

// 降級：將使用者輸入快速轉為「問題 / A：答案」
function simplePolishFallback(input) {
  var text = (input || "").trim();
  if (!text) return "問題 / A：請補充內容";
  // 嘗試以第一個問句切分
  var qMatch = text.match(/^[^?！？。]+[?？]/);
  if (qMatch) {
    var q = qMatch[0].replace(/[。]/g, "").trim();
    var a = text.substring(q.length).trim() || "待補";
    return q.replace(/[?？]$/, "") + "嗎 / A：" + a;
  }
  // 若輸入含「 / A：」，直接使用
  if (text.indexOf(" / A：") > -1) {
    return text.replace(/[\r\n]+/g, " ").trim();
  }
  // 最後退路：組成一個通用問法
  return text + "是什麼/怎麼用 / A：待補";
}

// 降級：智慧合併，嘗試理解用戶意圖
function simpleModifyFallback(currentText, instruction) {
  const base = (currentText || "").trim();
  const ins = (instruction || "").trim();
  if (!base) return simplePolishFallback(ins);
  if (!ins) return base;

  writeLog(
    "[Fallback] 降級合併: base=" +
      base.substring(0, 50) +
      ", ins=" +
      ins.substring(0, 50),
  );

  // 分析用戶指令類型
  var isReplace = /不對|錯了|改成|換成|應該是/.test(ins);
  var isInsert = /補充|加上|加入|新增/.test(ins);

  // 若看起來像「問題 / A：答案」格式
  var splitIdx = base.indexOf(" / A：");
  if (splitIdx > 0) {
    var q = base.substring(0, splitIdx).trim();
    var a = base.substring(splitIdx + 5).trim();

    if (isReplace) {
      return q + " / A：" + a + "\n⚠️ 請直接告訴我正確的內容是什麼";
    } else if (isInsert) {
      return (
        q + " / A：" + a + "。" + ins.replace(/補充一下|加上|加入|新增/g, "")
      );
    }
    return q + " / A：" + a + "（用戶補充：" + ins + "）";
  }
  // 否則直接合併
  return base + " / A：" + ins;
}

/**
 * 簡化版存檔：直接將整條文字寫入 QA
 */
function saveDraftToSheet(draft) {
  // 驗證草稿內容
  var qaText = draft.currentQA || draft.text; // 相容舊格式
  if (!qaText || qaText.trim().length < 5) {
    return "❌ 草稿內容太短，請提供更多資訊。";
  }

  // 自動修復格式：確保有 " / A："
  qaText = autoFixQAFormat(qaText);

  const lock = LockService.getScriptLock();
  let hasLock = false;

  try {
    lock.waitLock(10000);
    hasLock = true;

    const sheet = ss.getSheetByName(SHEET_NAMES.QA);
    if (!sheet) {
      return "❌ 找不到 QA 工作表";
    }

    // 直接寫入 QA 文字
    sheet.appendRow([qaText]);
    SpreadsheetApp.flush();

    // 提早釋放鎖定，避免與 syncGeminiKnowledgeBase 發生死鎖
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {}
      hasLock = false;
    }

    // 清除快取並同步知識庫
    CacheService.getScriptCache().remove(
      CACHE_KEYS.ENTRY_DRAFT_PREFIX + draft.userId,
    );
    syncGeminiKnowledgeBase();

    writeLog(
      draft.userId || "UNKNOWN",
      "UserRecord",
      `[Draft Saved to QA] ${qaText.substring(0, 50)}...`,
    );
    return `✅ 已寫入 QA 並更新知識庫！\n\n寫入內容：${qaText}`;
  } catch (e) {
    writeLog(
      draft.userId || "UNKNOWN",
      "Error",
      `[SaveDraft Error] ${e.message}`,
    );
    return `❌ 寫入失敗：${e.message}`;
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
  }
}

/**
 * 自動修復 QA 格式，確保有 " / A："
 * @param {string} text - 原始 QA 文字
 * @returns {string} 修復後的 QA 文字
 */
function autoFixQAFormat(text) {
  if (!text) return text;
  var trimmed = text.trim();

  // 已經有正確格式，直接返回
  if (trimmed.indexOf(" / A：") > -1) {
    return trimmed;
  }

  // 嘗試修復：常見錯誤格式
  // 1. 半形逗號分隔 "問題, 答案"
  if (trimmed.indexOf(", ") > -1 && trimmed.indexOf(" / A：") === -1) {
    var commaIdx = trimmed.indexOf(", ");
    var q = trimmed.substring(0, commaIdx).trim();
    var a = trimmed.substring(commaIdx + 2).trim();
    writeLog("[AutoFix] 修復逗號格式: " + q.substring(0, 30));
    return q + " / A：" + a;
  }

  // 2. 全形逗號分隔 "問題，答案"
  if (trimmed.indexOf("，") > -1 && trimmed.indexOf(" / A：") === -1) {
    var commaIdx = trimmed.indexOf("，");
    var q = trimmed.substring(0, commaIdx).trim();
    var a = trimmed.substring(commaIdx + 1).trim();
    writeLog("[AutoFix] 修復全形逗號格式: " + q.substring(0, 30));
    return q + " / A：" + a;
  }

  // 3. 有問號，以問號切分
  var qMarkIdx = Math.max(trimmed.indexOf("?"), trimmed.indexOf("？"));
  if (qMarkIdx > 0 && qMarkIdx < trimmed.length - 1) {
    var q = trimmed.substring(0, qMarkIdx + 1).trim();
    var a = trimmed.substring(qMarkIdx + 1).trim();
    writeLog("[AutoFix] 以問號切分: " + q.substring(0, 30));
    return q + " / A：" + a;
  }

  // 4. 無法自動修復，加上預設前綴
  writeLog("[AutoFix] 無法自動判斷，加預設格式");
  return "相關問題 / A：" + trimmed;
}

function handleAutoQA(u, cid) {
  const history = getHistoryFromCacheOrSheet(cid);
  if (history.length < 2) return "❌ 對話不足，無法自動整理";

  try {
    // 將最近對話整理成一行 QA（問題, 答案）
    const apiKey =
      PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    const convo = history
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const prompt = `請把以下對話濃縮成一行「問題 / A：答案」格式。
                              只回傳一行，用「 / A：」分隔，不要解釋。

                              對話：
                              ${convo}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.3,
      },
    };
    // v24.2.3: 簡單整理用 Fast 模型
    const res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_FAST}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    let qaLine = "";
    let costInfo = "";
    if (res.getResponseCode() === 200) {
      try {
        const j = JSON.parse(res.getContentText());

        // v27.9.17: 記錄 Token 費用
        if (j.usageMetadata) {
          const usage = j.usageMetadata;
          const costUSD =
            (usage.promptTokenCount / 1000000) * PRICE_FAST_INPUT +
            (usage.candidatesTokenCount / 1000000) * PRICE_FAST_OUTPUT;
          const costTWD = costUSD * EXCHANGE_RATE;
          lastTokenUsage = {
            input: usage.promptTokenCount,
            output: usage.candidatesTokenCount,
            total: usage.totalTokenCount,
            costUSD: costUSD,
            costTWD: costTWD,
          };
          writeLog(
            `[AutoQA Tokens] In: ${usage.promptTokenCount}, Out: ${
              usage.candidatesTokenCount
            }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`,
          );
          costInfo = `\n\n---\n本次整理預估花費：NT$${costTWD.toFixed(4)} (In:${
            usage.promptTokenCount
          }/Out:${usage.candidatesTokenCount})`;
        }

        const cands = j && j.candidates ? j.candidates : [];
        if (Array.isArray(cands) && cands.length > 0) {
          const p = cands[0].content && cands[0].content.parts;
          if (Array.isArray(p) && p.length > 0 && p[0].text) {
            qaLine = p[0].text.trim().replace(/[\r\n]+/g, " ");
          }
        }
      } catch (parseErr) {
        writeLog(`[AutoQA Parse Error] ${parseErr.message}`);
      }
    }

    if (!qaLine || qaLine.length < 10) {
      // 降級：簡單從最後兩句生成
      const lastUser = history
        .slice()
        .reverse()
        .find((m) => m.role === "user");
      const lastBot = history
        .slice()
        .reverse()
        .find((m) => m.role === "assistant");
      const q = lastUser && lastUser.content ? lastUser.content : "問題";
      const a = lastBot && lastBot.content ? lastBot.content : "待補";
      qaLine = `${q}, ${a}`;
    }

    const lock = LockService.getScriptLock();
    let hasLock = false;
    try {
      lock.waitLock(10000);
      hasLock = true;
      const sheet = ss.getSheetByName(SHEET_NAMES.QA);
      sheet.appendRow([qaLine]);
      SpreadsheetApp.flush();
    } catch (e) {
      writeLog(`[AutoQA Write Error] ${e.message}`);
    } finally {
      if (hasLock) {
        try {
          lock.releaseLock();
        } catch (e) {}
      }
    }

    syncGeminiKnowledgeBase();
    return `✅ 已自動整理並存入 QA：\n${qaLine.substring(0, 50)}...${costInfo}`;
  } catch (e) {
    writeLog(`[AutoQA Error] ${e.message}`);
    return "❌ 整理失敗";
  }
}

// ==========================================
// 6. 資料寫入與工具函式 (全展開)
// ==========================================

function sanitizeForSheet(text) {
  if (!text) return "";
  let s = text.toString();
  s = s.replace(/[\r\n]+/g, " ");
  s = s.replace(/,/g, "，");
  s = s.replace(/:/g, "：");
  return s.trim();
}

function writeQA(l, s, p, a, n) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = ss.getSheetByName(SHEET_NAMES.QA);
    if (!sheet) return false;
    const cleanP = sanitizeForSheet(p);
    const cleanA = sanitizeForSheet(a);
    const cleanN = sanitizeForSheet(n);
    sheet.appendRow([
      [new Date().toLocaleDateString(), l, s, cleanP, cleanA, cleanN].join(
        ", ",
      ),
    ]);
    SpreadsheetApp.flush();
    return true;
  } catch (e) {
    writeLog("[WriteQA Error] " + e);
    return false;
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
    flushLogs(); // 確保 Log 寫入
  }
}

function writeRule(k, d, u, desc) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet) return false;
    const cleanK = sanitizeForSheet(k);
    const cleanD = sanitizeForSheet(d);
    const cleanDesc = sanitizeForSheet(desc);
    sheet.appendRow([[cleanK, cleanD, u, cleanDesc].join(", ")]);
    SpreadsheetApp.flush();
    return true;
  } catch (e) {
    writeLog("[WriteRule Error] " + e);
    return false;
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function refreshLogFilterConfig_() {
  try {
    const now = Date.now();
    if (now - LOG_FILTER_STATE.loadedAt < 300000) {
      return;
    }
    const raw = PropertiesService.getScriptProperties().getProperty(
      "LOG_COMPACT_ROUTING",
    );
    if (raw === null || raw === "") {
      LOG_FILTER_STATE.compactRouting = true;
    } else {
      LOG_FILTER_STATE.compactRouting = String(raw).toLowerCase() !== "false";
    }
    LOG_FILTER_STATE.loadedAt = now;
  } catch (e) {
    // 讀設定失敗時維持預設精簡模式，避免回寫造成額外噪音
    LOG_FILTER_STATE.compactRouting = true;
  }
}

function shouldSkipNoisyRoutingLog_(type, content) {
  if (type === "Error" || type === "UserRecord") {
    return false;
  }
  if (!LOG_FILTER_STATE.compactRouting || !content) {
    return false;
  }

  // 保留最終關鍵可追溯節點
  const keepPatterns = [
    /\[HandleMsg\]/,
    /\[AI Stats\]/,
    /\[AI Raw Response\]/,
    /\[Final Reply\]/,
    /\[Reply\]/,
    /\[Flow Decision\]/,
    /\[DirectDeep\] 命中 CLASS_RULES 直通車關鍵字/,
    /\[DirectDeep v29\.5\.131\] 型號 .*有 PDF/,
    /\[DirectDeep v29\.5\.131\] 所有型號均無 PDF/,
    /\[KB Select\] 🎯 命中型號/,
    /\[KB Select\] Tier0:/,
    /\[KB Select\] 🚫 所有型號均無專屬 PDF/,
    /\[KB Select\] ⚠️ 所有型號均無專屬 PDF/,
  ];
  if (keepPatterns.some((re) => re.test(content))) {
    return false;
  }

  // 壓縮路由細節噪音（同資訊在最終關鍵節點已可追溯）
  const noisyPatterns = [
    /\[DirectDeep\] 從所有關鍵字提取型號/,
    /\[DirectDeep v29\.5\.154\] 過濾內部代號/,
    /\[DirectDeep v29\.5\.153\] 早期子字串去重/,
    /\[DirectDeep\] ✅ 注入型號到 Cache/,
    /\[KB Select\] 強制只用當前訊息匹配型號/,
    /\[KB Select\] 從對話歷史提取型號/,
    /\[KB Select\] 從 Cache 讀取直通車注入型號/,
    /\[KB Select\] forceCurrentOnly=true，跳過歷史\/Cache 型號注入/,
    /\[KB Select\] 當前訊息有型號，沿用已知型號/,
    /\[KB Select\] 當前訊息無型號但 forceCurrentOnly=false，保留歷史型號/,
    /\[KB Select\] 🔍 偵測到比較意圖，保留多型號/,
    /\[KB Select\] 🔒 已鎖定直通車型號/,
    /\[KB Select\] ⚡ Single Model Lock Detected/,
    /\[KB Select\] 📊 Sorted Tier 1:/,
    /\[KB Select\] 🔍 Comparison detected\. Allowing up to 2 PDFs/,
    /\[KB Select\] ✂️ Enforcing Strict Limit:/,
    /\[KB Select\] ⚡ Found Primary Model/,
  ];

  return noisyPatterns.some((re) => re.test(content));
}

function writeLog(a, b, c) {
  // 參數相容：
  // - 舊用法：writeLog("文字")
  // - 新用法：writeLog(userId, type, content)
  var userId = null;
  var type = "General";
  var content = "";

  if (typeof b !== "undefined" && typeof c !== "undefined") {
    userId = a;
    type = b || "General";
    content = c || "";
  } else {
    content = a || "";
  }

  refreshLogFilterConfig_();
  if (shouldSkipNoisyRoutingLog_(type, content)) {
    return;
  }

  var timestamp = Utilities.formatDate(
    new Date(),
    "Asia/Taipei",
    "HH:mm:ss.SSS",
  );
  var msgForLog = `[${type}] ${content}`;

  // 🧪 TEST MODE: 預設只在頁面顯示，不寫 Sheet；但 UserRecord/Error 允許寫入
  if (typeof IS_TEST_MODE !== "undefined" && IS_TEST_MODE) {
    if (typeof TEST_LOGS !== "undefined") {
      TEST_LOGS.push(`[${timestamp}] ${msgForLog}`);
    }
    console.log(msgForLog);

    if (type !== "UserRecord" && type !== "Error") {
      return; // 攔截一般 Log，保持 Sheet 乾淨
    }

    // 標記測試模式寫入
    content = `[測試模式] ${content}`;
    msgForLog = `[${type}] ${content}`;
  }

  // v27.8.5 Performance: 改為寫入緩衝區，不直接寫 Sheet
  // 解決 writeLog 阻塞導致回應變慢的問題
  PENDING_LOGS.push([new Date(), msgForLog.replace(/[\r\n]+/g, " ")]);
  console.log(msgForLog);

  // 安全機制：緩衝區過大時強制寫入 (避免 timeout 丟失太多)
  if (PENDING_LOGS.length >= 50) {
    flushLogs();
  }
}

function flushLogs() {
  if (PENDING_LOGS.length === 0) return;

  // 🧪 TEST MODE: 不寫入 Sheet
  if (typeof IS_TEST_MODE !== "undefined" && IS_TEST_MODE) {
    PENDING_LOGS = [];
    return;
  }

  try {
    if (ss) {
      const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
      if (logSheet) {
        // 批量寫入 (Batch Write) - 效能關鍵點
        logSheet
          .getRange(logSheet.getLastRow() + 1, 1, PENDING_LOGS.length, 2)
          .setValues(PENDING_LOGS);
        SpreadsheetApp.flush();

        // 自動清理：保留最新 500 筆
        const lastRow = logSheet.getLastRow();
        if (lastRow > 600) {
          const deleteCount = lastRow - 500;
          logSheet.deleteRows(1, deleteCount);
        }
      }
    }
  } catch (e) {
    console.error("Flush Logs Error: " + e.message);
  } finally {
    PENDING_LOGS = []; // 清空緩衝區
  }
}

/**
 * v24.3.0 新增：從對話歷史自動提取上下文
 * 用途：支援跨越時間邊界的延續提問（如店員隔天回來繼續問）
 *
 * 提取內容：型號、品牌、功能特徵、使用場景
 * 範圍：回溯最近 10 條訊息（避免過度搜尋舊訊息）
 */
function extractContextFromHistory(userId, contextId) {
  try {
    const history = getHistoryFromCacheOrSheet(contextId);
    if (!history || history.length === 0) {
      return null;
    }

    // v27.9.78: 只從「最後一條 assistant 訊息」提取型號
    // 原因：用戶選擇特定型號後，最後的 assistant 回覆會包含該型號的詳細資訊
    // 這樣可以確保只搜尋用戶實際選擇的型號，避免歷史中其他型號干擾
    const lastAssistantMsg = history
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");

    const recentMsgs = lastAssistantMsg ? lastAssistantMsg.content || "" : "";

    // 提取型號
    const MODEL_REGEX =
      /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{1,2}[A-Z]{0,2}\d{0,4}[A-Z]{0,2}|[CF]\d{2}[A-Z]\d{3}|WA\d+[A-Z\d]*|WD\d+[A-Z\d]*|VR\d+[A-Z\d]*)\b/g;
    const models = [];
    let match;
    while ((match = MODEL_REGEX.exec(recentMsgs)) !== null) {
      if (!models.includes(match[0])) {
        models.push(match[0]);
      }
    }

    // 提取品牌（簡單方法：檢查是否提到 Samsung/三星）
    const hasSamsung = /samsung|三星|SAMSUNG/i.test(recentMsgs);
    const brand = hasSamsung ? "Samsung" : null;

    // 提取功能特徵（簡單方法：檢查常見術語）
    const features = [];
    const featureKeywords = {
      "4K": /4K|UHD|3840x2160/i,
      OLED: /OLED/i,
      MiniLED: /MiniLED|mini led/i,
      IPS: /IPS/i,
      VA: /VA/i,
      曲面: /curved|曲|1000R|1800R/i,
      "USB-C": /USB-C|type-c/i,
      Thunderbolt: /thunderbolt/i,
    };

    for (const [name, pattern] of Object.entries(featureKeywords)) {
      if (pattern.test(recentMsgs)) {
        features.push(name);
      }
    }

    // 提取場景（簡單方法：檢查常見場景詞）
    const scenario = [];
    const scenarioKeywords = {
      電競: /gaming|電競|遊戲|FPS|RTX/i,
      創意工作: /creative|design|修圖|色域|DCI-P3/i,
      商務: /business|office|商務|辦公/i,
      居家: /home|living|家用|living room/i,
    };

    for (const [name, pattern] of Object.entries(scenarioKeywords)) {
      if (pattern.test(recentMsgs)) {
        scenario.push(name);
      }
    }

    return {
      models: models.length > 0 ? models : null,
      brand: brand,
      features: features.length > 0 ? features : null,
      scenario: scenario.length > 0 ? scenario : null,
    };
  } catch (e) {
    writeLog(`[extractContextFromHistory] 錯誤: ${e.message}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// v29.4.32: History Sanitization - Clean system tags and Flex objects
// ════════════════════════════════════════════════════════════════
function sanitizeHistoryContent(content) {
  // 1. If not a string (e.g., Flex object), extract altText or fallback
  if (typeof content !== "string") {
    if (content && content.altText) {
      content = `[選單] ${content.altText}`;
    } else if (content && content.type === "flex") {
      content = "[選單] 型號選擇";
    } else if (content && typeof content === "object") {
      content = "[系統訊息]";
    } else {
      content = String(content || "");
    }
  }

  // 2. Remove System Hint tags (injected for Direct Search)
  content = content.replace(/\[System Hint:[^\]]*\]/gi, "");

  // 3. Remove Auto-Search tags (internal signals)
  content = content.replace(/\[AUTO_SEARCH_PDF(?::[^\]]+)?\]/gi, "");
  content = content.replace(/\[AUTO_SEARCH_WEB\]/gi, "");
  content = content.replace(/\[NEED_DOC\]/gi, "");
  content = content.replace(/\[型號:[^\]]+\]/gi, "");
  content = content.replace(/\[KB_EXPIRED\]/gi, "");

  // 4. Clean up [object Object] artifacts
  content = content.replace(/\[object Object\]/g, "");

  // 5. Trim excessive whitespace
  content = content.replace(/\n{3,}/g, "\n\n").trim();

  return content;
}

function sanitizeHistoryArray(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((msg) => ({
      ...msg,
      content: sanitizeHistoryContent(msg.content),
    }))
    .filter((msg) => msg.content && msg.content.length > 0);
}

function getHistoryFromCacheOrSheet(cid) {
  const c = CacheService.getScriptCache();
  const k = `${CACHE_KEYS.HISTORY_PREFIX}${cid}`;
  const v = c.get(k);
  if (v) {
    try {
      // v29.4.32: Sanitize history on read
      return sanitizeHistoryArray(JSON.parse(v));
    } catch (e) {}
  }
  try {
    // 2025-12-05: 恢復 Sheet 讀取 (Cache Miss 時的備案)
    let s = ss.getSheetByName(SHEET_NAMES.LAST_CONVERSATION);
    if (!s) {
      // 若 Sheet 不存在，視為無歷史，不需建立 (等到寫入時再建)
      return [];
    }
    const f = s
      .getRange("A:A")
      .createTextFinder(cid)
      .matchEntireCell(true)
      .findNext();
    if (f) {
      // v29.4.32: Sanitize history on read
      return sanitizeHistoryArray(
        JSON.parse(s.getRange(f.getRow(), 2).getValue()),
      );
    }
  } catch (e) {}
  return [];
}

function updateHistorySheetAndCache(cid, prev, uMsg, aMsg) {
  try {
    // v29.4.32: Sanitize content before storage
    uMsg = { ...uMsg, content: sanitizeHistoryContent(uMsg.content) };
    aMsg = { ...aMsg, content: sanitizeHistoryContent(aMsg.content) };

    let base = Array.isArray(prev) ? prev.slice() : [];
    if (base.length % 2 !== 0) {
      base.shift();
    }

    // 合併新訊息
    let newHist = [...base, uMsg, aMsg];

    // v24.0.0: 智慧摘要機制 (Rolling Summary)
    // 只在超長對話 (>12對=24則) 才觸發摘要，避免過度壓縮導致失憶
    const SUMMARY_THRESHOLD = CONFIG.SUMMARY_THRESHOLD * 2; // 24
    const MAX_MSG_COUNT = CONFIG.HISTORY_PAIR_LIMIT * 2; // 20 (Fast Mode 上限)

    if (newHist.length > SUMMARY_THRESHOLD) {
      writeLog(
        `[History] 超長對話 (${newHist.length} > ${SUMMARY_THRESHOLD})，啟動摘要...`,
      );

      const splitIndex = Math.floor(newHist.length / 2);
      const safeSplitIndex = splitIndex % 2 === 0 ? splitIndex : splitIndex - 1;

      const oldMsgs = newHist.slice(0, safeSplitIndex);
      const recentMsgs = newHist.slice(safeSplitIndex);

      const summary = callGeminiToSummarize(oldMsgs);

      if (summary) {
        const summaryMsg = {
          role: "user",
          content: `【系統自動摘要】\n之前的對話重點：${summary}\n(請基於此上下文繼續服務)`,
        };
        const ackMsg = {
          role: "assistant",
          content: "好的，我已了解之前的對話脈絡。",
        };

        newHist = [summaryMsg, ackMsg, ...recentMsgs];
        writeLog(`[History] 摘要完成，新長度: ${newHist.length}`);
      } else {
        newHist = newHist.slice(-MAX_MSG_COUNT);
        writeLog(`[History] 摘要失敗，執行簡單切分`);
      }
    }

    const json = JSON.stringify(newHist);
    CacheService.getScriptCache().put(
      `${CACHE_KEYS.HISTORY_PREFIX}${cid}`,
      json,
      CONFIG.CACHE_TTL_SEC,
    );

    // 2025-12-05: 恢復 Sheet 寫入 (長期記憶備份)
    // 自動檢查並建立 Sheet，防止因刪除導致失效
    try {
      let s = ss.getSheetByName(SHEET_NAMES.LAST_CONVERSATION);
      if (!s) {
        s = ss.insertSheet(SHEET_NAMES.LAST_CONVERSATION);
        s.appendRow(["ContextID", "HistoryJSON", "LastUpdated"]); // 補標題
        writeLog(
          `[AutoCreate] 已自動重建 ${SHEET_NAMES.LAST_CONVERSATION} 工作表`,
        );
      }

      const f = s
        .getRange("A:A")
        .createTextFinder(cid)
        .matchEntireCell(true)
        .findNext();
      if (f) {
        s.getRange(f.getRow(), 2).setValue(json);
        s.getRange(f.getRow(), 3).setValue(new Date());
      } else {
        s.appendRow([cid, json, new Date()]);
      }
    } catch (sheetErr) {
      writeLog(`[History Sheet Error] ${sheetErr.message}`);
    }
  } catch (e) {
    writeLog(`[UpdateHistory Error] ${e.message}`);
  }
}

/**
 * 呼叫 Gemini 摘要對話紀錄
 */
function callGeminiToSummarize(messages) {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) return null;

  const convoText = messages
    .map((m) => `${m.role === "user" ? "用戶" : "客服"}: ${m.content}`)
    .join("\n");

  // 2025-12-05 v23.6.5: 強化摘要 Prompt，強制保留關鍵實體
  const prompt = `請將以下客服對話摘要成 300 字以內的重點。
                              【強制保留關鍵實體 (Key Entities)】
                              1. 產品型號 (如 G90XF, S32DG802) - 這是最重要的資訊，絕對不能遺漏！
                              2. 故障代碼或具體問題 (如 3D 無法開啟, 螢幕閃爍)
                              3. 用戶偏好或特殊需求
                              4. 已嘗試過的解決方案

                              請以第三人稱客觀描述，例如：「用戶詢問 G90XF 的 3D 功能...」。

                              ${convoText}`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 500,
      temperature: 0.3,
    },
  };

  try {
    // v27.9.37: 支援 OpenRouter 切換
    if (LLM_PROVIDER === "OpenRouter") {
      try {
        // 建構 OpenRouter 訊息
        const messages = [{ role: "user", parts: [{ text: prompt }] }];
        // 使用 callOpenRouter (不帶 System Prompt，因為這裡 prompt 包含了所有指示)
        const responseText = callOpenRouter(messages, 0.4);
        return responseText.trim().replace(/[\r\n]+/g, " ");
      } catch (orErr) {
        writeLog(
          `[Modify OpenRouter Fail] ${orErr.message}, Fallback to Gemini`,
        );
      }
    }

    // v24.2.3: 簡單摘要用 Fast 模型
    const res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_FAST}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    if (res.getResponseCode() !== 200) return null;

    const json = JSON.parse(res.getContentText());
    if (json.candidates && json.candidates[0].content) {
      return json.candidates[0].content.parts[0].text.trim();
    }
    return null;
  } catch (e) {
    writeLog(`[Summarize Error] ${e.message}`);
    return null;
  }
}

function clearHistorySheetAndCache(cid) {
  try {
    // v24.1.10 重大修復：真正清除對話記憶（包含 Sheet + Cache）
    // 之前只清除 Cache，導致系統降級讀取 Sheet 中的舊對話

    // 1. 清除 Sheet 中的歷史記錄
    const s = ss.getSheetByName(SHEET_NAMES.LAST_CONVERSATION);
    if (s) {
      const f = s
        .getRange("A:A")
        .createTextFinder(cid)
        .matchEntireCell(true)
        .findNext();
      if (f) {
        s.getRange(f.getRow(), 2).clearContent();
        // writeLog(`[ClearHistory] 已從 Sheet 清除 ${cid} 的歷史記錄`);
      }
    }

    // 2. 清除 Cache 中的歷史記錄
    const cache = CacheService.getScriptCache();
    cache.remove(`${CACHE_KEYS.HISTORY_PREFIX}${cid}`);

    // 3. 清除 PDF 模式狀態
    cache.remove(CACHE_KEYS.PDF_MODE_PREFIX + cid);

    // v27.2.6+: 一併清除 PDF 反問暫存與直通車注入的型號，避免重啟後還吃到舊 pending
    cache.remove(CACHE_KEYS.PENDING_PDF_SELECTION + cid);
    cache.remove(`${cid}:hit_alias_key`);
    cache.remove(`${cid}:direct_search_models`);
    // v29.4.45: Clear Web Search Limit & Flags
    cache.remove(`${cid}:web_search_count`);
    cache.remove(`${cid}:pdf_consulted`);

    writeLog(
      `[ClearHistory] ✅ 完全清除了 ${cid} 的對話記憶 (Sheet + Cache + PDF Mode)`,
    );
  } catch (e) {
    writeLog(`[ClearHistory Error] ${e.message}`);
  }
}

// ========== 7. LINE Webhook 入口 ==========
// 注意：doGet 已移至區塊 9 (TEST UI) 並合併健康檢查功能

function doPost(e) {
  writeLog("[Webhook] Request Received");
  try {
    // 自動檢查並恢復排程（部署後自癒）
    ensureSyncTriggerExists();

    const postData = e && e.postData ? e.postData : {};
    const contents = postData.contents || "{}";
    const json = JSON.parse(contents);

    // 🆕 v29.5.209: 自訂的爬蟲與維護者 Webhook 入口
    if (json.action === "append_class_rule") {
      const authKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") || "";
      if (!json.secret || json.secret !== authKey) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Sheet CLASS_RULES not found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // 追加寫入末列 (v29.5.214: 回歸原汁原味 A 欄單欄位大字串設計)
      const newRuleText = json.content;
      sheet.appendRow([newRuleText]);
      
      // 自動觸發快取與別稱字典重建
      const syncResult = syncGeminiKnowledgeBase(false);
      writeLog(`[Webhook Appended] 成功自官網更新新機型規格: ${newRuleText.substring(0, 100)}... 狀態: ${syncResult}`);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, sync: syncResult }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (json.action === "upload_manual_pdf") {
      const authKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") || "";
      if (!json.secret || json.secret !== authKey) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
      if (!folderId) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "DRIVE_FOLDER_ID Script Property is not set" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      try {
        const folder = DriveApp.getFolderById(folderId);
        const pdfBytes = Utilities.base64Decode(json.pdfBase64);
        const blob = Utilities.newBlob(pdfBytes, "application/pdf", json.fileName);
        const file = folder.createFile(blob);
        writeLog(`[Webhook PDF] 成功上傳手冊 PDF: ${json.fileName} (ID: ${file.getId()})`);
        return ContentService.createTextOutput(JSON.stringify({ success: true, fileId: file.getId() }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        writeLog(`[Webhook PDF Error] 上傳失敗: ${err.message}`);
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    const events = json.events || [];

    events.forEach(function (event) {
      if (event.type === "message") {
        const eventId = event.webhookEventId;
        if (isDuplicateEvent(eventId)) return;

        const isGroup =
          event.source.type === "group" || event.source.type === "room";
        var contextId = isGroup ? event.source.groupId : event.source.userId;
        var userId = event.source.userId;
        var replyToken = event.replyToken;

        if (isGroup) {
          if (event.message.type === "text") {
            const botUserId = getBotUserId();
            const mention = event.message.mention || {};
            const mentions = mention.mentionees || [];
            if (
              !mentions.some(function (m) {
                return m.userId === botUserId;
              })
            )
              return;
            var cleanedText = event.message.text;
            mentions.forEach(function (m) {
              if (m.userId === botUserId) {
                cleanedText = cleanedText
                  .replace(
                    cleanedText.substring(m.index, m.index + m.length),
                    "",
                  )
                  .trim();
              }
            });
            if (!cleanedText) {
              replyMessage(replyToken, "有事嗎？");
              return;
            }
            // v27.4.0: 修改 event.message.text 為清理後的文字，再傳遞整個 event
            event.message.text = cleanedText;
            handleMessage(event);
          } else if (event.message.type === "image") {
            if (userId === CONFIG.VIP_IMAGE_USER) {
              handleImageMessage(
                event.message.id,
                userId,
                replyToken,
                contextId,
              );
            }
          }
        } else {
          if (event.message.type === "text") {
            handleMessage(event);
          } else if (event.message.type === "image") {
            handleImageMessage(event.message.id, userId, replyToken, contextId);
          }
        }
      }
    });
    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    flushLogs(); // 確保 Log 寫入 Sheet
  }
}

// ========== 8. 輔助工具 (Utils) ==========

function getHistoryModels(userId) {
  // 簡單實作：從 Cache 的 HISTORY_JSON 中讀取最近的 User Message，並用正則提取型號
  // 這是為了在 Deep Mode 但用戶未提及型號時 (例如「請切換模式幫我查」) 進行救援
  try {
    const cache = CacheService.getScriptCache();
    const historyJson = cache.get(CACHE_KEYS.HISTORY_PREFIX + userId);
    if (!historyJson) return [];

    const history = JSON.parse(historyJson);
    const models = [];
    // 反向遍歷 (最新的先找)
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === "user") {
        const text = msg.content;
        // 使用與 getRelevantKBFiles 相同的正則 (複製自上方)
        const match = text.match(
          /\b(G\d{2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|[CF]\d{2}[A-Z]\d{3})\b/g,
        );
        if (match) {
          match.forEach((m) => {
            if (!models.includes(m)) models.push(m);
          });
        }
        const lsMatch = text.match(/LS(\d{2}[A-Z]{2}\d{3}[A-Z]{2})/g);
        if (lsMatch) {
          lsMatch.forEach((ls) => {
            const cleanModel = ls.replace(/^LS/, "S").replace(/XZW$/, "");
            if (!models.includes(cleanModel)) models.push(cleanModel);
          });
        }
      }
      if (models.length > 0) break; // 找到最近的一組就停，避免混淆這題跟上題的型號
    }
    return models;
  } catch (e) {
    writeLog(`[getHistoryModels Error] ${e.message}`);
    return [];
  }
}

function replyMessage(tk, txt, options = {}) {
  // 🧪 TEST MODE: 不呼叫 LINE API (清除測試介面時請移除此判斷)
  if (IS_TEST_MODE || tk === "TEST_REPLY_TOKEN") {
    // v29.5.130: TestUI 依賴 testMessage() 從 Log 收集回覆；這裡補寫 [Reply] 讓前端能顯示
    try {
      let preview = "";
      if (Array.isArray(txt)) {
        preview = txt
          .map((t) => {
            if (typeof t === "string") return t;
            if (t && typeof t === "object")
              return t.altText || "[Flex Message]";
            return String(t || "");
          })
          .join("\n\n");
      } else if (txt && typeof txt === "object" && txt.type) {
        preview = txt.altText || "[Flex Message]";
      } else {
        preview = txt === null || txt === undefined ? "" : txt.toString();
      }

      if (preview) {
        writeLog(`[Reply] ${preview}`);
      }
    } catch (e) {
      // ignore
    }
    writeLog("[TEST MODE] 跳過 LINE API 呼叫");
    return;
  }

  try {
    const lineToken =
      PropertiesService.getScriptProperties().getProperty("LINE_TOKEN");
    // writeLog(`[Reply Debug] LINE_TOKEN 前10字: ${lineToken ? lineToken.substring(0, 10) : "NULL"}`);

    // v29.3.21: 升級支援多訊息泡泡 (Array)
    let messages = [];
    if (Array.isArray(txt)) {
      // 限制最多 5 個訊息 (LINE 回覆限制)
      messages = txt.slice(0, 5).map((t) => {
        if (typeof t === "object" && t.type) {
          return t; // 已經是 Flex 或其他格式
        }
        return {
          type: "text",
          text: t.toString().substring(0, 4000),
        };
      });
    } else {
      if (typeof txt === "object" && txt.type) {
        messages = [txt];
      } else {
        messages = [{ type: "text", text: txt.toString().substring(0, 4000) }];
      }
    }

    // v29.3.36: 優先使用顯式傳遞的 options.quickReply，其次才是全域變數 (相容性)
    let qrItems = null;

    if (options && options.quickReply && options.quickReply.items) {
      qrItems = options.quickReply.items;
      writeLog(`[Reply] 使用顯式 Quick Reply: ${qrItems.length} 個選項`);
    } else if (quickReplyOptions && quickReplyOptions.length > 0) {
      qrItems = quickReplyOptions.map((opt) => ({
        type: "action",
        action: {
          type: "message",
          label: opt.label.substring(0, 20),
          text: opt.text || opt.label,
        },
      }));
      writeLog(`[Reply] 使用全域 Quick Reply: ${qrItems.length} 個選項`);
      quickReplyOptions = []; // Clear global
    }

    if (qrItems) {
      const lastMsg = messages[messages.length - 1];
      lastMsg.quickReply = { items: qrItems };
    }

    const response = UrlFetchApp.fetch(
      "https://api.line.me/v2/bot/message/reply",
      {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + lineToken,
        },
        payload: JSON.stringify({
          replyToken: tk,
          messages: messages,
        }),
        muteHttpExceptions: true,
      },
    );

    const code = response.getResponseCode();
    // v29.5.109: 完整記錄 LINE 回覆內容
    const logFull =
      typeof txt === "string"
        ? txt.replace(/\n/g, " ")
        : txt.altText || "[Flex Message]";
    if (code === 200) {
      writeLog(`[Reply] ✅ LINE 回覆成功: ${logFull}`);
    } else {
      const errorBody = response.getContentText();
      writeLog(`[Reply] ❌ LINE API 錯誤 ${code}: ${errorBody}`);
    }
  } catch (e) {
    writeLog("[Reply Error] " + e);
  }
}

function showLoadingAnimation(uid, sec) {
  try {
    const res = UrlFetchApp.fetch(
      "https://api.line.me/v2/bot/chat/loading/start",
      {
        method: "post",
        headers: {
          Authorization:
            "Bearer " +
            PropertiesService.getScriptProperties().getProperty("LINE_TOKEN"),
          "Content-Type": "application/json",
        },
        payload: JSON.stringify({ chatId: uid, loadingSeconds: sec }),
        muteHttpExceptions: true,
      },
    );
    const code = res.getResponseCode();
    if (code !== 202) {
      writeLog(
        `[Animation Warning] LINE API 回傳 ${code}: ${res.getContentText()}`,
      );
    }
  } catch (e) {
    writeLog(`[Animation Error] ${e.message}`);
  }
}

function getBotUserId() {
  let id = PropertiesService.getScriptProperties().getProperty("BOT_USER_ID");
  if (!id) {
    try {
      const res = UrlFetchApp.fetch("https://api.line.me/v2/bot/info", {
        headers: {
          Authorization:
            "Bearer " +
            PropertiesService.getScriptProperties().getProperty("LINE_TOKEN"),
        },
      });
      if (res.getResponseCode() === 200) {
        id = JSON.parse(res.getContentText()).userId;
        PropertiesService.getScriptProperties().setProperty("BOT_USER_ID", id);
      }
    } catch (e) {}
  }
  return id;
}

function isDuplicateEvent(id) {
  const c = CacheService.getScriptCache();
  if (c.get(id)) return true;
  c.put(id, "1", 60);
  return false;
}

function hasRecentAnimation(id) {
  return CacheService.getScriptCache().get(`anim_${id}`) != null;
}

function markAnimationShown(id) {
  // v29.3.25: 縮短快取時間從 20s -> 5s，確保動畫更靈敏地觸發
  CacheService.getScriptCache().put(`anim_${id}`, "1", 5);
}

function runInitializeAndSync() {
  Object.values(SHEET_NAMES).forEach((name) => {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
    }
  });
  syncGeminiKnowledgeBase();
}

// 讀取最近 LOG（供 CLASP 呼叫）
function getRecentLogs(count = 50) {
  const sheet = ss.getSheetByName(SHEET_NAMES.LOG);
  if (!sheet) return "LOG sheet not found";
  const lastRow = sheet.getLastRow();
  const startRow = Math.max(1, lastRow - count + 1);
  const data = sheet
    .getRange(startRow, 1, lastRow - startRow + 1, 2)
    .getValues();
  return data.map((row) => `${row[0]} | ${row[1]}`).join("\n");
}

/**
 * 雲端 PDF 查證工具：
 * 直接從 Drive 讀取指定 PDF，驗證「頁面 91-93 是否有 SmartThings 相關句子」。
 * 可用 clasp run verifySmartThingsClaimFromCloudPdf 執行。
 */
function verifySmartThingsClaimFromCloudPdf() {
  const targetPdfName = "S32FM702,S32FM703,S32FM803.pdf";
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("缺少 GEMINI_API_KEY");
  }

  const folderId =
    CONFIG.DRIVE_FOLDER_ID ||
    PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  if (!folderId) {
    throw new Error("缺少 DRIVE_FOLDER_ID");
  }

  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByName(targetPdfName);
  if (!files.hasNext()) {
    throw new Error(`Drive 找不到檔案: ${targetPdfName}`);
  }
  const file = files.next();
  const blob = file.getBlob();
  const pdfUri = uploadFileToGemini(
    apiKey,
    blob,
    file.getSize(),
    "application/pdf",
  );
  if (!pdfUri) {
    throw new Error("上傳 PDF 到 Gemini 失敗");
  }

  const prompt = [
    "你是文件查核器，只能依據附加PDF回答，不可推測。",
    "請驗證以下敘述是否為真：",
    "「頁面 91-93：使用 SmartThings，提到 SmartThings 功能允許產品連接和控制在相同空間內偵測到的各種裝置。」",
    "",
    "請輸出 JSON，格式固定：",
    '{',
    '  "found": true/false,',
    '  "evidence": [',
    '    {"page": number, "quote": "原文片段(最多60字)"}',
    "  ],",
    '  "summary": "一句話結論"',
    "}",
    "",
    "要求：",
    "1) 必須指出頁碼。",
    "2) quote 必須是 PDF 原文片段，不可改寫。",
    "3) 若找不到，found=false 且 evidence=[]。",
  ].join("\n");

  const url = `${CONFIG.API_ENDPOINT}/${GEMINI_MODEL_FAST}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            fileData: {
              mimeType: "application/pdf",
              fileUri: pdfUri,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  };

  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  const body = resp.getContentText();
  let text = "";
  try {
    const json = JSON.parse(body);
    text =
      (((json || {}).candidates || [])[0] || {}).content?.parts?.[0]?.text ||
      "";
  } catch (e) {
    text = "";
  }

  return {
    targetPdfName: targetPdfName,
    driveFileId: file.getId(),
    driveFileName: file.getName(),
    driveLastUpdated: Utilities.formatDate(
      file.getLastUpdated(),
      "Asia/Taipei",
      "yyyy-MM-dd HH:mm:ss",
    ),
    geminiFileUri: pdfUri,
    apiStatus: code,
    modelJsonText: String(text || body || "").substring(0, 3000),
  };
}

// 測試 /紀錄 功能（供 CLASP 呼叫）
function testDraftFunction(inputText) {
  try {
    const testInput = inputText || "M50A,M50B,M50C有內建陀螺儀";
    writeLog(`[Test] 測試輸入: ${testInput}`);

    // Step 1: 呼叫 callGeminiToDraft
    const draft = callGeminiToDraft(testInput, "initial", null);
    writeLog(`[Test] AI 產出 Draft: ${JSON.stringify(draft)}`);

    // Step 2: 產生預覽訊息
    const preview = generatePreviewMsg(draft);
    writeLog(`[Test] 預覽訊息: ${preview.substring(0, 200)}...`);

    // Step 3: 模擬驗證 (不實際寫入)
    let validationResult = "";
    if (draft.type === "qa") {
      if (
        !draft.q ||
        !draft.a ||
        draft.q === "undefined" ||
        draft.a === "undefined"
      ) {
        validationResult = "❌ QA 草稿不完整，缺少問題(q)或答案(a)欄位";
      } else {
        validationResult = `✅ QA 草稿有效\nQ: ${draft.q}\nA: ${draft.a}`;
      }
    } else if (draft.type === "rule") {
      if (
        !draft.key ||
        !draft.def ||
        draft.key === "undefined" ||
        draft.def === "undefined"
      ) {
        validationResult = "❌ Rule 草稿不完整，缺少關鍵字(key)或定義(def)欄位";
      } else {
        validationResult = `✅ Rule 草稿有效\nKey: ${draft.key}\nDef: ${
          draft.def
        }\nDesc: ${draft.desc || "(無)"}`;
      }
    } else if (draft.type === "error") {
      validationResult = `❌ AI 回傳錯誤: ${draft.message || "內容不足"}`;
    } else {
      validationResult = `❌ 未知類型: ${draft.type}`;
    }

    writeLog(`[Test] 驗證結果: ${validationResult}`);

    return {
      input: testInput,
      draft: draft,
      preview: preview,
      validation: validationResult,
    };
  } catch (e) {
    writeLog(`[Test Error] ${e.message}`);
    return { error: e.message };
  }
}

// ════════════════════════════════════════════════════════════════
// 9. TEST UI - 測試介面 (Web App)
// ════════════════════════════════════════════════════════════════
// ⚠️ 清除測試介面時請刪除此整個區塊 + 頂部的 TEST MODE GLOBALS + TestUI.html

// ==========================================
// 9. TEST UI (測試介面專用 - V27.3.7)
// ==========================================

// 1. 網頁入口（合併版：健康檢查 + TestUI）
// - LINE Verify: 不帶參數，返回 200 OK
// - TestUI: 訪問 ?test=1，返回測試介面
function doGet(e) {
  // 確保觸發器存在
  ensureSyncTriggerExists();

  // 若有 test 參數，顯示 TestUI
  if (e && e.parameter && e.parameter.test === "1") {
    return HtmlService.createTemplateFromFile("TestUI")
      .evaluate()
      .setTitle("LINE Bot 測試模擬器 v2.3")
      .addMetaTag(
        "viewport",
        "width=device-width, initial-scale=1, user-scalable=no",
      );
  }

  // 預設：返回健康檢查（給 LINE Verify 用）
  return ContentService.createTextOutput(
    "OK - Current Version: " + GAS_VERSION + " [" + BUILD_TIMESTAMP + "]",
  ).setMimeType(ContentService.MimeType.TEXT);
}

/**
 * 測試入口 (V27.7.2 - 型號選擇反問修復版)
 * 修正重點：捕捉型號選擇反問，確保前端能顯示選項
 */
function testMessage(msg, userId) {
  IS_TEST_MODE = true;
  TEST_LOGS = [];

  if (msg === undefined || msg === null) msg = "";
  if (typeof msg === "object") {
    try {
      msg = JSON.stringify(msg);
    } catch (e) {
      msg = "";
    }
  }
  msg = String(msg).trim();

  userId = userId || "TEST_DEV_001";

  var fakeEvent = {
    replyToken: "TEST_REPLY_TOKEN",
    source: { type: "user", userId: userId },
    message: { type: "text", text: msg, id: "TEST_" + new Date().getTime() },
    type: "message",
    timestamp: new Date().getTime(),
  };

  try {
    if (typeof handleMessage === "function") {
      handleMessage(fakeEvent);
    } else {
      throw new Error("找不到 handleMessage 主函式");
    }
  } catch (e) {
    var errStr = e.toString();
    if (errStr.indexOf("ContentService") === -1) {
      TEST_LOGS.push(`[Fatal] 系統崩潰: ${errStr}`);
    }
  }

  // 收集回覆 (優先級：[Reply] > [AI Reply] > PDF反問 > [API Short Response])
  var botResponses = [];
  var seenContent = new Set();
  var hasOfficialReply = false;
  var hasFlexSelectionFlow = TEST_LOGS.some(
    (l) =>
      l.indexOf("已發送 Flex Selection") > -1 ||
      l.indexOf("型號泡泡選擇模式") > -1,
  );

  // 1️⃣ 優先找 [Reply] 和 [AI Reply]
  for (var i = 0; i < TEST_LOGS.length; i++) {
    var log = TEST_LOGS[i];
    if (log.indexOf("[Reply]") > -1 || log.indexOf("[AI Reply]") > -1) {
      if (hasFlexSelectionFlow && log.indexOf("[AI Reply]") > -1) {
        continue;
      }
      var content = parseLogContent(
        log,
        log.indexOf("[Reply]") > -1 ? "[Reply]" : "[AI Reply]",
      );
      if (content && !seenContent.has(content)) {
        botResponses.push(content);
        seenContent.add(content);
        hasOfficialReply = true;
      }
    }
    // v29.5.98: Capture Flex Replies
    if (log.indexOf("[Flex Reply]") > -1) {
      // Extract Alt Text
      var match = log.match(/Alt: (.*?), JSON:/);
      if (match && match[1]) {
        var alt = match[1];
        // Append a hint that it was a Flex Message
        var content = `[Flex Message] ${alt} (查看日誌以見詳情)`;
        if (!seenContent.has(content)) {
          botResponses.push(content);
          seenContent.add(content);
          hasOfficialReply = true;
        }
      }
    }
  }

  // 1.5️⃣ 檢查是否有 PDF 選擇日誌（表示 handlePdfSelectionReply 已執行）
  if (!hasOfficialReply) {
    var hasPdfSelectLog = TEST_LOGS.some(
      (l) =>
        l.indexOf("[PDF Select] 用戶選擇") > -1 ||
        l.indexOf("[PDF Select] 用戶輸入完整型號") > -1,
    );
    if (hasPdfSelectLog) {
      // 表示已經觸發 PDF 查詢，但結果未被正確記錄
      // 這是 TEST MODE 的局限，需要從 LOG 中重新提取
      // 嘗試從日誌中找 [AI Reply] 或其他結果
      var hasResults = false;
      for (var i = 0; i < TEST_LOGS.length; i++) {
        var log = TEST_LOGS[i];
        if (log.indexOf("[AI Reply]") > -1) {
          var content = parseLogContent(log, "[AI Reply]");
          if (content && !seenContent.has(content)) {
            botResponses.push(content);
            seenContent.add(content);
            hasOfficialReply = true;
            hasResults = true;
          }
        }
      }
      // 如果 PDF 選擇後還是沒有回答，表示 API 調用失敗或超時
      if (!hasResults && hasPdfSelectLog) {
        botResponses.push("⏳ PDF 查詢中，請稍候...");
        hasOfficialReply = true;
      }
    }
  }

  // 2️⃣ 如果沒有官方回覆，檢查是否有型號選擇反問 (這是特殊情況)
  if (!hasOfficialReply) {
    if (hasFlexSelectionFlow) {
      var cache = CacheService.getScriptCache();
      var suggestedModelsRaw = cache.get(`${userId}:suggested_models`);
      if (suggestedModelsRaw) {
        try {
          var mArr = JSON.parse(suggestedModelsRaw) || [];
          if (Array.isArray(mArr) && mArr.length > 0) {
            var preview = mArr.slice(0, 5).join("、");
            var more = mArr.length > 5 ? "…" : "";
            botResponses.push(
              `🔍 已送出型號選擇泡泡，請先選完整型號（例如：${preview}${more}）。`,
            );
          } else {
            botResponses.push("🔍 已送出型號選擇泡泡，請先選完整型號。");
          }
        } catch (e) {
          botResponses.push("🔍 已送出型號選擇泡泡，請先選完整型號。");
        }
      } else {
        botResponses.push("🔍 已送出型號選擇泡泡，請先選完整型號。");
      }
      hasOfficialReply = true;
    }
  }

  // 2.5️⃣ 若仍無官方回覆，再檢查舊版型號選擇反問訊號
  if (!hasOfficialReply) {
    var hasPdfQuestion = TEST_LOGS.some(
      (l) => l.indexOf("已發送型號選擇反問") > -1,
    );
    if (hasPdfQuestion) {
      // 從 Cache 中還原型號選擇訊息（handleMessage 已存入 PENDING_PDF_SELECTION）
      var cache = CacheService.getScriptCache();
      var pendingPdfData = cache.get(CACHE_KEYS.PENDING_PDF_SELECTION + userId);

      if (pendingPdfData) {
        try {
          var pending = JSON.parse(pendingPdfData);
          if (pending.options && pending.options.length > 0) {
            // 重新生成選項訊息（與 LINE 一致）
            var selectionMsg = buildPdfSelectionMessage(
              pending.aliasKey,
              pending.options,
            );
            botResponses.push(selectionMsg);
            hasOfficialReply = true;
          }
        } catch (e) {
          // 如果解析失敗，用備用提示
          botResponses.push("🔍 系統偵測到需要選擇型號，請見快速回覆選項");
          hasOfficialReply = true;
        }
      } else {
        // Cache 已過期或不存在，用備用提示
        botResponses.push("🔍 系統偵測到需要選擇型號，請見快速回覆選項");
        hasOfficialReply = true;
      }
    }
  }

  // 3️⃣ 如果還是沒有，才用 [API Short Response]
  if (!hasOfficialReply) {
    for (var i = 0; i < TEST_LOGS.length; i++) {
      var log = TEST_LOGS[i];
      if (log.indexOf("[API Short Response]") > -1) {
        // 日誌格式: [API Short Response] Out: X tokens, Content: "..."
        // 需要提取 Content: 之後的內容
        var contentStart = log.indexOf('Content: "');
        if (contentStart > -1) {
          var contentStr = log.substring(contentStart + 10); // skip 'Content: "'
          var contentEnd = contentStr.lastIndexOf('"');
          if (contentEnd > -1) {
            var content = contentStr.substring(0, contentEnd);
            if (content && !seenContent.has(content)) {
              botResponses.push(content);
              seenContent.add(content);
            }
          }
        }
      }
    }
  }

  // 4️⃣ 最後檢查錯誤
  for (var i = 0; i < TEST_LOGS.length; i++) {
    var log = TEST_LOGS[i];
    if (log.indexOf("[Fatal]") > -1) {
      var fatalMsg = "❌ " + log;
      if (!seenContent.has(fatalMsg)) {
        botResponses.push(fatalMsg);
        seenContent.add(fatalMsg);
      }
    }
  }

  IS_TEST_MODE = false;

  return {
    success: true,
    replies: botResponses,
    logs: TEST_LOGS,
  };
}

// 輔助: 清洗 Log 內容
function parseLogContent(logLine, keyword) {
  var content = logLine.split(keyword).pop().trim();
  if (content.startsWith('"') && content.endsWith('"'))
    content = content.slice(1, -1);
  return content.replace(/\\n/g, "\n");
}

// 清除快取
function clearTestSession(userId) {
  var cache = CacheService.getScriptCache();
  userId = userId || "TEST_DEV_001";
  cache.remove(`${userId}:context`);
  cache.remove(`${userId}:pdf_mode`);
  cache.remove(`${userId}:pdf_consulted`);
  cache.remove(`pdf_consulted_${userId}`);
  cache.remove(`dissatisfied_count_${userId}`);
  cache.remove(`${userId}:direct_search_models`);
  cache.remove(`${userId}:hit_alias_key`);
  cache.remove(`${userId}:elaboration_state`);
  cache.remove(`${userId}:last_meaningful_query`);
  cache.remove(`${userId}:pending_topic`);
  cache.remove(`${userId}:model_select_mode`);
  cache.remove(`${userId}:qa_offer_payload`);
  cache.remove(`${userId}:suggested_models`);
  cache.remove(`model_selection_${userId}`);
  cache.remove(`${userId}:pending_pdf_query`);
  return { success: true, msg: "✅ 髒資料已清除" };
}

// --- 雲端歷史紀錄功能 ---

function getCloudHistory() {
  try {
    var sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TEST_HISTORY");
    if (!sheet) return []; // 如果沒有分頁，回傳空陣列 (前端會用預設值)

    // 讀取 A 欄所有資料
    var lastRow = sheet.getLastRow();
    if (lastRow < 1) return [];

    var data = sheet.getRange(1, 1, lastRow, 1).getValues();
    // 轉成一維陣列並過濾空值
    return data.map((r) => r[0]).filter((t) => t);
  } catch (e) {
    return [];
  }
}

function saveCloudHistory(historyArray) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("TEST_HISTORY");
    if (!sheet) {
      sheet = ss.insertSheet("TEST_HISTORY");
    }

    // 清空舊資料
    sheet.clear();

    if (historyArray && historyArray.length > 0) {
      // 轉成二維陣列寫入
      var rows = historyArray.map((t) => [t]);
      sheet.getRange(1, 1, rows.length, 1).setValues(rows);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
} // ════════════════════════════════════════════════════════════════

function getBotVersion() {
  return {
    version: "v27.9.64",
    description: `Back: ${LLM_PROVIDER} | Smart Editor Mode: ON | Dynamic Rules`,
  };
}

/**
 * [Smart Editor Mode] 檢查是否為科技新聞或三星產品相關 (v27.9.67 放寬版)
 * 包含一般科技關鍵字 (AI, Apple, Chip, etc.) + 三星系列
 */
function isValidTechContent(msg) {
  const upper = msg.toUpperCase();
  const cache = CacheService.getScriptCache();

  // 1. 基礎科技關鍵字 (Fallback & General Tech)
  // 用戶要求：放寬至科技新聞 (AI, PC, Mobile, Chip, Tech Giants)
  const basicKeywords = [
    // Samsung Core
    "SAMSUNG",
    "GALAXY",
    "ODYSSEY",
    "SMART",
    "MONITOR",
    "WASHER",
    "TV",
    "冰箱",
    "洗衣機",
    "吸塵器",
    "螢幕",
    "M5",
    "M7",
    "M8",
    "G5",
    "G7",
    "G8",
    "S9",
    // Tech Giants & General
    "APPLE",
    "IPHONE",
    "IPAD",
    "MAC",
    "GOOGLE",
    "PIXEL",
    "MICROSOFT",
    "WINDOWS",
    "SURFACE",
    "TESLA",
    "NVIDIA",
    "AMD",
    "INTEL",
    "QUALCOMM",
    "TSMC",
    "ASUS",
    "ACER",
    "MSI",
    "ROG",
    "SONY",
    "LG",
    "PANASONIC",
    "AI",
    "CHIP",
    "PANEL",
    "DISPLAY",
    "OLED",
    "MINI LED",
    "PROCESSOR",
    "GPU",
    "CPU",
    "RAM",
    "科技",
    "新聞",
    "發表",
    "上市",
    "規格",
    "評測",
    "半導體",
    "晶片",
    "手機",
    "筆電",
    "電腦",
    "人工智慧",
  ];

  try {
    const ruleSheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    // 快篩：若命中基礎科技關鍵字 -> True
    if (basicKeywords.some((k) => upper.includes(k))) return true;

    // 否則，檢查是否包含 CLASS_RULES 中的「系列」名稱 (通常在第1欄)
    // 這是為了確保比較冷門的三星系列也能過關 (原本邏輯)
    let productKeywords = cache.get("CORE_PRODUCT_KEYWORDS");
    if (!productKeywords) {
      if (ruleSheet) {
        const data = ruleSheet.getRange("A2:A200").getValues();
        const keys = data
          .map((r) => {
            const txt = r[0].toString();
            if (!txt) return "";
            if (txt.includes("_")) return txt.split("_")[1];
            return txt;
          })
          .filter((k) => k && k.length > 1);
        productKeywords = JSON.stringify(keys);
        cache.put("CORE_PRODUCT_KEYWORDS", productKeywords, 21600);
      } else {
        productKeywords = "[]";
      }
    }

    const keywords = JSON.parse(productKeywords);
    return keywords.some((key) => upper.includes(key.toUpperCase()));
  } catch (e) {
    writeLog("[isValidTechContent] Error: " + e.message);
    return basicKeywords.some((key) => upper.includes(key));
  }
}

/**
 * 判斷是否像「整篇網頁貼文」：長段落 + 多行 + 常見文章結構訊號
 */
function isLikelyPastedLongArticle(msg) {
  const text = String(msg || "");
  if (!text) return false;
  const len = text.length;
  const lineCount = text.split(/\n/).length;
  const hasUrl = /(https?:\/\/|www\.)/i.test(text);
  const hasArticleMarkers =
    /(原文|來源|作者|發布|更新|閱讀|全文|訂閱|廣告|延伸閱讀|點此|更多內容|©|版權)/i.test(
      text,
    );
  const hasPuncDensity = (text.match(/[。！？；，,:]/g) || []).length >= 12;

  if (len >= 220 && (lineCount >= 5 || hasPuncDensity)) return true;
  if (len >= 160 && hasUrl && (lineCount >= 4 || hasArticleMarkers)) return true;
  if (len >= 260 && hasArticleMarkers) return true;
  return false;
}

function hasTechSignals(msg) {
  const text = String(msg || "");
  return /(科技|TECH|AI|GPU|CPU|NPU|晶片|半導體|手機|筆電|PC|電腦|螢幕|顯示器|面板|OLED|MINI\s*LED|NVIDIA|AMD|INTEL|APPLE|GOOGLE|MICROSOFT|SAMSUNG|GALAXY|ODYSSEY)/i.test(
    text,
  );
}

function isProjectRelevantLongContent(msg) {
  const text = String(msg || "");
  const hasSamsungBrand = /(SAMSUNG|三星)/i.test(text);
  const hasModelCode = /\b(?:LS)?S\d{2}[A-Z0-9]{4,}\b/i.test(text);
  const hasProjectSeries =
    /(ODYSSEY|SMART\s*MONITOR|VIEWFINITY|SMARTTHINGS|GALAXY\s*WATCH)/i.test(
      text,
    );
  const hasSamsungCategory =
    hasSamsungBrand &&
    /(螢幕|顯示器|洗衣機|冰箱|吸塵器|MONITOR|DISPLAY|WASHER|DRYER|VACUUM|APPLIANCE)/i.test(
      text,
    );
  const hasMatterSamsungContext =
    /MATTER/i.test(text) && /(SMARTTHINGS|SAMSUNG|三星)/i.test(text);

  return (
    hasModelCode ||
    hasProjectSeries ||
    hasSamsungCategory ||
    hasMatterSamsungContext
  );
}

function isQACandidateLongContent(msg) {
  const text = String(msg || "");
  const hasQuestionLike =
    /(如何|怎麼|是否|有沒有|支援|內建|差異|比較|設定|開啟|關閉|故障|排除|為什麼|可以嗎|\?|？)/i.test(
      text,
    );
  const hasActionable =
    /(步驟|教學|設定|規格|更新率|解析度|HDR|KVM|PIP|PBP|SmartThings|Matter|集線器|中樞|保固|維修|連接埠|接口|線材)/i.test(
      text,
    );
  return hasQuestionLike || hasActionable;
}

function isAffirmativeForQaEdit(msg) {
  const t = String(msg || "").trim();
  return /^(要|好|好的|好啊|可以|進入|進入QA|進入QA編輯模式|加入QA|存成QA)$/i.test(
    t,
  );
}

function isNegativeForQaEdit(msg) {
  const t = String(msg || "").trim();
  return /^(不要|先不要|不用|暫時不用|略過|跳過)$/i.test(t);
}

function buildQaEditInstructionText() {
  return (
    "【QA編輯模式操作方式】\n" +
    "1. 回覆「要」：直接進入 QA 編輯模式\n\n" +
    "2. 也可手動輸入：/記錄 <內容>（或 /紀錄 <內容>）\n\n" +
    "3. 進入後可直接回覆文字持續修稿\n\n" +
    "4. 確認存檔：/記錄\n\n" +
    "5. 取消離開：/取消"
  );
}

function ensureArticleCleanOutputFormat(aiText, originalText) {
  const text = String(aiText || "").trim();
  const hasSummary = text.includes("【重點摘要】");
  const hasCleanedOriginal = text.includes("【去廣告原文】");
  if (hasSummary && hasCleanedOriginal) return text;

  const cleaned = buildHeuristicCleanArticleText(originalText);
  const points = buildHeuristicSummaryPoints(cleaned);
  const summaryBlock = points
    .slice(0, 4)
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n\n");

  return `【重點摘要】\n${summaryBlock}\n\n【去廣告原文】\n${cleaned}`;
}

function buildHeuristicCleanArticleText(originalText) {
  const text = String(originalText || "");
  const adPattern =
    /(廣告|訂閱|立即訂閱|點此|延伸閱讀|更多內容|贊助|sponsored|advertisement|優惠|折扣)/i;

  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !adPattern.test(s));

  const cleaned = (lines.length > 0 ? lines.join("\n") : text.trim()).trim();
  if (!cleaned) return "（原文內容不足，無法整理）";
  if (cleaned.length > 3600) return `${cleaned.substring(0, 3600)}...`;
  return cleaned;
}

function buildHeuristicSummaryPoints(cleanedText) {
  const text = String(cleanedText || "");
  const sentenceCandidates = text
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12)
    .slice(0, 8);

  const picked = [];
  for (let i = 0; i < sentenceCandidates.length && picked.length < 4; i++) {
    const item = sentenceCandidates[i];
    if (!picked.includes(item)) {
      picked.push(item);
    }
  }

  if (picked.length === 0) {
    return ["這篇內容已完成去廣告整理，可依下方原文快速閱讀重點。"];
  }
  return picked;
}

/**
 * 讀取 Prompt 設定 (優先查 Cache，無則查 Sheet)
 * v27.9.64: 補上遺失的 helper function
 */
function getPromptsFromCacheOrSheet() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("KB_PROMPTS_JSON");
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  // Cache Miss, read Sheet
  const sheet = ss.getSheetByName(SHEET_NAMES.PROMPT);
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  // 假設格式: [Type], [Key], [Content]
  // 我們需要將 Key (例如 "總編模式") 對應到 Content
  const prompts = {};
  data.forEach((row) => {
    if (row.length >= 3) {
      // row[1] is Key (e.g., 總編模式), row[2] is Content
      const key = row[1].toString().trim();
      const content = row[2].toString().trim();
      if (key && content) {
        prompts[key] = content;
      }
    }
  });

  // 寫入 Cache (1小時)
  cache.put("KB_PROMPTS_JSON", JSON.stringify(prompts), 3600);
  return prompts;
}

// ════════════════════════════════════════════════════════════════
// UI Helper Functions (v29.4.13)
// ════════════════════════════════════════════════════════════════

/**
 * v29.5.61: Determine Search Intent for Dynamic Bubble Text
 * @param {string} msg - User's message
 * @param {string[]} models - List of models for manual availability check
 */
function determineSearchIntent(msg, models = []) {
  if (!msg)
    return {
      headerText: "🔍 請選擇型號",
      footerText: "點選型號後AI將協助查詢",
    };

  const m = msg.toLowerCase();

  // 1. Manual / PDF Intent
  if (
    m.match(/設定|說明書|手冊|故障|error|安裝|reset|重置|亮燈|閃爍|無法|不能/)
  ) {
    // v29.5.61: Check if ALL models in the list have manuals
    let allHaveManuals = false;
    if (models.length > 0) {
      try {
        const pdfIndexJson =
          PropertiesService.getScriptProperties().getProperty(
            "PDF_MODEL_INDEX",
          );
        const pdfModelIndex = pdfIndexJson ? JSON.parse(pdfIndexJson) : [];
        allHaveManuals = models.every((primary) => {
          return pdfModelIndex.some((m) => {
            if (m.startsWith("S") && m.length >= 7)
              return m.includes(primary) || primary.includes(m);
            return m === primary;
          });
        });
      } catch (e) {}
    }

    if (allHaveManuals) {
      return {
        headerText: "🔍 請選擇型號以查閱產品手冊",
        footerText: "載入PDF約需 30 秒，請耐心等候",
      };
    } else {
      // 若包含無手冊型號，標題降級
      return {
        headerText: "🔍 請選擇型號以查閱說明或規格",
        footerText: "點選型號後AI將為您深入分析",
      };
    }
  }

  // 2. Price / Web Intent
  if (m.match(/多少錢|價格|價錢|售價|哪裡買|costco|pchome|momo|通路/)) {
    return {
      headerText: "🔍 請選擇型號以查詢價格/通路",
      footerText: "將為您搜尋網路公開資訊",
    };
  }

  // 3. Spec / QA Intent
  if (m.match(/規格|尺寸|面板|hz|更新率|接孔|hdmi|dp|壁掛|重量|寬度|高度/)) {
    return {
      headerText: "🔍 請選擇型號以查詢規格數據",
      footerText: "將從規格庫快速查詢",
    };
  }

  // Default
  return {
    headerText: "🔍 請選擇型號以查詢詳細資訊",
    footerText: "點選型號後AI將協助查詢",
  };
}

/**
 * 建立型號選擇的 Flex Message Carousel
 * v29.5.14: 全新設計 - 基於 LINE 最佳實踐
 * - 使用 Hero 區塊作為視覺焦點
 * - 現代化配色與間距
 * - 清晰的按鈕層次結構
 * v29.5.50: Support dynamic intentConfig
 */
function createModelSelectionFlexV3(models, intentConfig = null) {
  // 1. Strict Deduplication (Case Insensitive)
  const uniqueModels = [];
  const seen = new Set();

  models.forEach((m) => {
    const key = m.trim().toUpperCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      uniqueModels.push(m.trim());
    }
  });

  // v29.5.23: 降冪排列（Z-A）
  uniqueModels.sort((a, b) => b.localeCompare(a));

  const displayModels = uniqueModels.slice(0, 10);
  const remainingCount = uniqueModels.length - displayModels.length;

  // v29.5.118: 建立型號按鈕 - 回傳 #型號:MODEL 格式，讓 handleMessage 能攔截
  const buttons = displayModels.map((model, index) => {
    const label = `${model}`.substring(0, 20);
    return {
      type: "button",
      action: {
        type: "message",
        label: label,
        text: `#型號:${model}`, // v29.5.118: 加前綴，避免觸發 DirectDeep
      },
      style: "primary",
      color: "#4A90D9",
      margin: "md",
      height: "sm",
    };
  });

  // 若有更多型號
  if (remainingCount > 0) {
    buttons.push({
      type: "button",
      action: {
        type: "message",
        label: `還有 ${remainingCount} 款...`,
        text: "列出所有型號",
      },
      style: "secondary",
      margin: "sm",
      height: "sm",
    });
  }

  const bubble = {
    type: "bubble",
    // v29.5.19: 不指定 size，使用預設寬度 (約 300px)
    // Header 區塊 - 簡潔標題
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: intentConfig ? intentConfig.headerText : "🔍 請選擇型號",
          color: "#333333",
          size: "md",
          weight: "bold",
          align: "center",
        },
        {
          type: "text",
          text: `找到 ${displayModels.length} 款`,
          color: "#888888",
          size: "xs",
          align: "center",
          margin: "xs",
        },
      ],
      paddingAll: "15px",
      backgroundColor: "#F5F5F5",
    },
    // Body 區塊 - 按鈕列表
    body: {
      type: "box",
      layout: "vertical",
      contents: buttons,
      spacing: "md", // v29.5.16: 增加按鈕間距
      paddingAll: "12px",
    },
    // Footer 區塊 - 簡化
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: intentConfig
            ? intentConfig.footerText
            : "點選型號後會載入手冊（約30秒）",
          size: "xxs",
          color: "#888888",
          align: "center",
        },
        {
          type: "text",
          text: "也可以不選，直接輸入其他問題",
          size: "xxs",
          color: "#AAAAAA",
          align: "center",
          margin: "xs",
        },
      ],
      paddingAll: "8px",
      backgroundColor: "#FAFAFA",
    },
  };

  // v29.5.141 fix: Wrap in Flex Message object
  const altText =
    intentConfig && intentConfig.altText ? intentConfig.altText : "請選擇型號";

  return {
    type: "flex",
    altText: altText,
    contents: {
      type: "carousel",
      contents: [bubble],
    },
  };
}

/**
 * 發送 Flex Message
 */
function replyFlexMessage(replyToken, flexContainer, altText) {
  // 🧪 TEST MODE START (v29.5.98 Fixed)
  if (
    (typeof IS_TEST_MODE !== "undefined" && IS_TEST_MODE) ||
    replyToken === "TEST_REPLY_TOKEN"
  ) {
    writeLog(
      `[Flex Reply] Alt: ${altText}, JSON: ${JSON.stringify(flexContainer)}`,
    );
    return 200;
  }
  // 🧪 TEST MODE END

  const url = "https://api.line.me/v2/bot/message/reply";
  // v29.5.12: Correct key is LINE_TOKEN
  const accessToken =
    PropertiesService.getScriptProperties().getProperty("LINE_TOKEN");

  const payload = {
    replyToken: replyToken,
    messages: [
      {
        type: "flex",
        altText: altText || "請查看選單",
        contents: flexContainer,
      },
    ],
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const resCode = response.getResponseCode();
    const resBody = response.getContentText();

    if (resCode !== 200) {
      writeLog(`[Reply Flex Error] ${resCode}: ${resBody}`);
    }
    // v29.5.0: Simplify Reply Log (Silent Success)
    // else { writeLog(`[Reply Flex Success]`); }

    return resCode;
  } catch (e) {
    writeLog(`[Reply Flex Exception] ${e.message}`);
    return 500;
  }
}

/**
 * v29.4.56: 全形轉半形函式
 * 將 Ｇ５ 轉為 G5，Ｓ３ 轉為 S3，１２３ 轉為 123
 */
function toHalfWidth(str) {
  if (!str) return "";
  return str
    .replace(/[\uff01-\uff5e]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    })
    .replace(/\u3000/g, " ");
}

/**
 * [Cost Guard] 檢查是否為高成本 PDF 操作 (v29.5.96)
 * @param {string} userMsg
 */
function checkPdfCost(userMsg) {
  if (!userMsg) return { isHighCost: false, reason: "Empty message" };

  // 1. Check for PDF Keywords
  const m = userMsg.toLowerCase();
  const pdfKeywords = [
    "手冊",
    "設定",
    "說明書",
    "故障",
    "error",
    "安裝",
    "reset",
    "重置",
    "亮燈",
    "閃爍",
    "無法",
    "不能",
  ];
  const isPdfIntent = pdfKeywords.some((k) => m.includes(k));

  // 2. Check strict model format (S27... G5...)
  // Simple regex for Samsung model-like strings
  const isModelLike = /[a-z0-9]{5,}/.test(m);

  if (isPdfIntent) {
    return {
      isHighCost: true,
      reason: "Detected PDF Keywords (e.g. 手冊/設定)",
    };
  }

  if (isModelLike && m.length < 20) {
    return { isHighCost: true, reason: "Potential Model Number (Loads PDF)" };
  }

  return { isHighCost: false, reason: "General Conversation" };
}




