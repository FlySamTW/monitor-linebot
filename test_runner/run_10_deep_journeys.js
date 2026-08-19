const fs = require('fs');

const BASE_URL = 'https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec';
const SECRET = 'sam2026';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function queryBot(q, uid) {
  const url = `${BASE_URL}?testRun=1&secret=${SECRET}&uid=${encodeURIComponent(uid)}&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json;
  } catch (err) {
    return { error: err.message };
  }
}

async function readSheetRecords(limit = 50) {
  const url = `${BASE_URL}?readlog=1&secret=${SECRET}&limit=${limit}`;
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function readSheetLog(limit = 50) {
  const url = `${BASE_URL}?readlogSheet=LOG&secret=${SECRET}&limit=${limit}`;
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

const JOURNEYS = [
  {
    id: 'J01',
    title: 'Smart Monitor M8 遙控器配對與按鍵無反應 (PDF 深度操作)',
    userId: 'TEST_USER_J01_' + Date.now(),
    turns: [
      'M8 智慧螢幕遙控器沒反應怎麼辦',
      '我換了新電池還是完全連不上',
      '要怎麼重新配對藍牙遙控器？要同時按哪兩個鍵？',
      '配對成功了，那如果我想用手機當遙控器要下載什麼 App？'
    ]
  },
  {
    id: 'J02',
    title: 'Odyssey OLED G6 (G60SD) 烙印防護與防反光 (深度排錯)',
    userId: 'TEST_USER_J02_' + Date.now(),
    turns: [
      'G60SD 會不會容易烙印？',
      '它有什麼防烙印功能？會自動執行嗎？',
      '螢幕暗下來或突然跳出清理是正常的嗎？多久一次？',
      '我想調整面板保養的設定要去哪裡開？'
    ]
  },
  {
    id: 'J03',
    title: 'ViewFinity S9 5K (S27C900) Mac 連接與色彩校色 (深度操作)',
    userId: 'TEST_USER_J03_' + Date.now(),
    turns: [
      'ViewFinity S9 5K 接 Mac 畫面出不來',
      '我是用 Thunderbolt 4 線接在後面的 Type-C 孔',
      '要插哪一個孔才對？後面的孔有分充電瓦數嗎？',
      '可以用手機幫這台螢幕校色嗎？Smart Calibration 怎麼用？'
    ]
  },
  {
    id: 'J04',
    title: 'Odyssey Ark 55吋 (G97NC) 旋轉直立座艙與多重視窗 (PDF 手冊操作)',
    userId: 'TEST_USER_J04_' + Date.now(),
    turns: [
      '55吋 Ark 旋轉成直立模式 (座艙模式) 畫面沒有自動轉向',
      '要手動去哪裡設定旋轉？',
      'Ark Dial 旋鈕遙控器要怎麼配對跟充電？',
      '直立座艙模式下最多可以分割幾個視窗？'
    ]
  },
  {
    id: 'J05',
    title: 'Smart Monitor M7 忘記 PIN 碼與重置原廠 (PDF 手冊)',
    userId: 'TEST_USER_J05_' + Date.now(),
    turns: [
      'M7 智慧螢幕忘記 PIN 碼怎麼辦',
      '我按遙控器重置 PIN 碼的組合鍵是什麼？',
      '如果我想整台恢復原廠預設值要去哪裡選？',
      '重設後裡面的 App 需要重新登入嗎？'
    ]
  },
  {
    id: 'J06',
    title: 'Odyssey G9 OLED (G95SC) 240Hz 開不上去 (深度排錯)',
    userId: 'TEST_USER_J06_' + Date.now(),
    turns: [
      '49吋 G95SC 接電腦只有 60Hz 跑不到 240Hz',
      '我的顯卡是 RTX 4080，是用 HDMI 線接的',
      '是要插 Micro HDMI 還是 HDMI 2.1？要在 OSD 裡面開 Game Mode 嗎？',
      '開了 240Hz 之後 HDR 要怎麼開？Windows 裡面會變灰色的嗎？'
    ]
  },
  {
    id: 'J07',
    title: 'Odyssey Neo G8 (G85NB) 4K 240Hz 區域控光 (深度操作)',
    userId: 'TEST_USER_J07_' + Date.now(),
    turns: [
      'Neo G8 畫面看起來有點偏亮、黑底有光暈',
      '要怎麼開啟局部調光 (Local Dimming)？',
      '選 Auto、Standard 還是 High 比較好？',
      '玩 PS5 的時候 Local Dimming 可以跟 VRR 同時開嗎？'
    ]
  },
  {
    id: 'J08',
    title: 'Smart Monitor M5 藍牙耳機連線與聲音延遲 (PDF 操作)',
    userId: 'TEST_USER_J08_' + Date.now(),
    turns: [
      'M5 螢幕可以連藍牙耳機聽聲音嗎？',
      '要從哪裡進去配對藍牙耳機？',
      '連上之後看影片聲音跟嘴型不同步怎麼調整？',
      '可以同時連兩支藍牙耳機一起聽嗎？'
    ]
  },
  {
    id: 'J09',
    title: 'ViewFinity S8 (S27B800) Type-C 90W 與 USB Hub (深度排錯)',
    userId: 'TEST_USER_J09_' + Date.now(),
    turns: [
      'S27B800 螢幕後面的 USB 孔插隨身碟電腦讀不到',
      '我是用 HDMI 接電腦的',
      '如果要用螢幕上的 USB 孔，需要另外接 USB Upstream 線或 Type-C 嗎？',
      '如果換成 Type-C 線一線連接筆電，可以同時 4K 畫面 + 充電 90W + 上網孔 (LAN) 嗎？'
    ]
  },
  {
    id: 'J10',
    title: 'Odyssey G5 (G55C) 165Hz 畫面撕裂與 FreeSync (深度操作)',
    userId: 'TEST_USER_J10_' + Date.now(),
    turns: [
      'G55C 玩遊戲畫面會撕裂卡頓怎麼辦',
      '要在螢幕按鈕選單裡把 FreeSync Premium 打開嗎？',
      '打開 FreeSync 之後反應時間 (Response Time) 為什麼變成反灰不能調？',
      '那電腦顯卡是 NVIDIA 的話，可以在驅動裡開啟 G-Sync 相容嗎？'
    ]
  }
];

async function runAllJourneys() {
  console.log('====================================================');
  console.log('  開始執行 10 組「追問到第四層」+「PDF 深度手冊」實測  ');
  console.log('====================================================\n');

  const summary = [];

  for (let jIndex = 0; jIndex < JOURNEYS.length; jIndex++) {
    const journey = JOURNEYS[jIndex];
    console.log(`\n▶ [Journey ${jIndex + 1}/10] ${journey.title}`);
    console.log(`  User ID: ${journey.userId}`);
    const turnResults = [];

    for (let tIndex = 0; tIndex < journey.turns.length; tIndex++) {
      const q = journey.turns[tIndex];
      const level = tIndex + 1;
      console.log(`  [第 ${level} 層提問] ${q}`);

      const res = await queryBot(q, journey.userId);
      const reply = res.reply || res.error || '(無回覆)';
      const logs = res.logs || [];
      const stats = logs.find(l => l.includes('Stats')) || '無 Stats 日誌';
      const envelope = logs.find(l => l.includes('Envelope')) || '無 Envelope 日誌';

      console.log(`  [AI 回覆摘要] ${reply.replace(/\n+/g, ' ').substring(0, 100)}...`);
      console.log(`  [狀態] ${stats} | ${envelope}`);

      turnResults.push({
        level: level,
        question: q,
        reply: reply,
        stats: stats,
        envelope: envelope
      });

      await sleep(1500);
    }

    summary.push({
      journey: journey.title,
      turns: turnResults
    });
  }

  console.log('\n====================================================');
  console.log('  實測完成！正在驗證 Google Sheet 的 LOG 與所有紀錄頁  ');
  console.log('====================================================\n');

  await sleep(3000);

  const sheetRecords = await readSheetRecords(10);
  console.log('【Google Sheet「所有紀錄」頁最新 5 筆】:');
  if (sheetRecords && sheetRecords.records) {
    sheetRecords.records.slice(-5).forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.role || 'User/Bot'}] (${r.flag || 'Normal'}) ${r.text.substring(0, 80)}`);
    });
  } else {
    console.log('  無法讀取所有紀錄頁:', sheetRecords);
  }

  const sheetLogs = await readSheetLog(10);
  console.log('\n【Google Sheet「LOG」頁最新 5 筆】:');
  if (sheetLogs && sheetLogs.records) {
    sheetLogs.records.slice(-5).forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.timestamp}] ${r.message.substring(0, 80)}`);
    });
  } else {
    console.log('  無法讀取 LOG 頁:', sheetLogs);
  }

  fs.writeFileSync('journeys_result.json', JSON.stringify(summary, null, 2), 'utf8');
  console.log('\n全部 10 組（共 40 輪）實測結果已儲存至 journeys_result.json');
}

runAllJourneys();
