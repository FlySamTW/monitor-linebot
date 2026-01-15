
// ════════════════════════════════════════════════════════════════
// UI Helper Functions (v29.4.13)
// ════════════════════════════════════════════════════════════════

/**
 * 建立型號選擇的 Flex Message Carousel
 * v29.4.10: 針對多型號提供美觀的選擇介面
 * v29.4.13: Ensure function exists and optimize layout
 */
function createModelSelectionFlex(models) {
  // 限制顯示數量，避免 Payload 過大 (Max 10 per bubble, split if needed)
  // 這裡簡單實作：若超過 10 個，只顯示前 10 個，並提示還有更多
  // 實際應用可做成 Carousel 分頁 (但暫時先用單一長列表)
  
  const displayModels = models.slice(0, 10);
  const remainingCount = models.length - displayModels.length;

  const buttons = displayModels.map((model, index) => {
    return {
      type: "button",
      action: {
        type: "message",
        label: `${index + 1}. ${model}`,
        text: `${model} 怎麼設定` // 點擊後直接發送查詢指令
      },
      style: "secondary",
      margin: "sm",
      height: "sm" // 緊湊高度
    };
  });

  if (remainingCount > 0) {
    buttons.push({
      type: "button",
      action: {
        type: "message",
        label: `...還有 ${remainingCount} 款 (點此列出)`,
        text: "列出所有型號"
      },
      style: "link",
      margin: "sm",
      height: "sm"
    });
  }

  // 底部提示按鈕
  buttons.push({
      type: "button",
      action: {
        type: "message",
        label: "💡 或直接繼續提問",
        text: "直接問問題"
      },
      style: "link",
      margin: "md",
      height: "sm",
      color: "#999999"
  });

  const bubble = {
    type: "bubble",
    size: "kilo", // 略寬一點
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🔍 型號確認",
          color: "#1DB446",
          size: "sm",
          weight: "bold"
        },
        {
          type: "text",
          text: `找到 ${models.length} 款相關型號`, // 動態標題
          weight: "bold",
          size: "xl",
          margin: "md",
          wrap: true
        },
        {
          type: "text",
          text: "請點擊下方按鈕選擇：",
          size: "xs",
          color: "#aaaaaa",
          margin: "sm"
        },
        {
          type: "text",
          text: "⚠️ 載入詳細手冊約需 30 秒",
          size: "xs",
          color: "#FF5500", // 橘色警示
          margin: "sm",
          weight: "bold"
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: buttons
    }
  };

  return {
    type: "carousel",
    contents: [bubble] // 即使只有一個 Bubble，用 Carousel 容器包裝較為彈性
  };
}

/**
 * 發送 Flex Message
 */
function replyFlexMessage(replyToken, flexContainer, altText) {
  const url = "https://api.line.me/v2/bot/message/reply";
  const accessToken =
    PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");

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
    } else {
    //   writeLog(`[Reply Flex Success]`); // 減少 Log 噪音
    }
    
    return resCode;
  } catch (e) {
    writeLog(`[Reply Flex Exception] ${e.message}`);
    return 500;
  }
}
