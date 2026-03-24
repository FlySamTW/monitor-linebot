const puppeteer = require("puppeteer");
const TEST_URL = "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";
async function main(){
  const browser = await puppeteer.launch({headless:"new", args:["--no-sandbox","--disable-setuid-sandbox"]});
  const page = await browser.newPage();
  const userId = "TEST_M7_MUTE_001";
  try{
    await page.goto(TEST_URL,{waitUntil:"networkidle0", timeout:90000});
    await new Promise(r=>setTimeout(r,4000));
    let frame=null;
    for(const f of page.frames()){ const el=await f.$("#msg-input").catch(()=>null); if(el){ frame=f; break; } }
    if(!frame) throw new Error("TestUI frame not found");
    const send=(msg)=>frame.evaluate((m,uid)=>new Promise((resolve,reject)=>{google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).testMessage(m,uid);}), msg, userId);
    const clear=()=>frame.evaluate((uid)=>new Promise((resolve,reject)=>{google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).clearTestSession(uid);}), userId);
    await clear();
    const qs=["/重啟","沒有遙控器怎麼關聲音","M7沒有遙控器 把聲音關掉"];
    for(let i=0;i<qs.length;i++){
      const res=await send(qs[i]);
      console.log(`TURN ${i+1} USER: ${qs[i]}`);
      (res.replies||[]).forEach((r,j)=>console.log(`BOT#${j+1}: ${r}`));
      console.log('LOGS:');
      (res.logs||[]).filter(x=>/AI Raw Response|Auto Search|Smart Router|來源|Reply|Signal Check|Flow Decision/.test(String(x))).forEach(x=>console.log(String(x)));
      console.log('---');
    }
  } finally { await browser.close(); }
}
main().catch(e=>{ console.error(e); process.exit(1); });
