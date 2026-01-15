
const puppeteer = require('puppeteer');

const TEST_URL = "https://script.google.com/macros/s/AKfycbzEmG6nTAyut14fSy1_SN-MR2I_W4BqVPdJ39SIdVW7WcTDQuyDE0kCrj5pjE07IUGJxg/exec?test=1";

async function runTests() {
    console.log("Starting Puppeteer Verification (Iframe Aware)...");
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    try {
        console.log(`Navigating to ${TEST_URL}`);
        await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 60000 });
        
        console.log("Page loaded. Searching for input frame...");

        // Wait a bit for iframes to spawn
        await new Promise(r => setTimeout(r, 5000));

        let frame = page.mainFrame();
        const inputSelector = '#msg-input';
        
        // Find the right frame
        let inputFound = false;
        for (const f of page.frames()) {
            try {
                const el = await f.$(inputSelector);
                if (el) {
                    frame = f;
                    inputFound = true;
                    console.log(`Found input in frame: ${f.url()}`);
                    break;
                }
            } catch (e) {}
        }

        if (!inputFound) {
            console.log("Dumping frames...");
            page.frames().forEach(f => console.log(f.url()));
            throw new Error(`Input ${inputSelector} not found in any frame.`);
        }

        // --- Helper Function: Send Message ---
        async function sendMsg(text) {
            console.log(`Sending: ${text}`);
            await frame.type('#msg-input', text);
            await frame.click('#send-btn');
        }

        // --- Helper Function: Get Last Bot Message ---
        async function getLastBotMessage() {
            await new Promise(r => setTimeout(r, 5000)); 
            
            const bubbles = await frame.$$eval('.msg-row.bot .msg-bubble', els => els.map(e => e.innerText));
            const lastText = bubbles.length > 0 ? bubbles[bubbles.length - 1] : "NO_REPLY";
            
            const quickReplies = await frame.$$eval('.quick-reply-btn', els => els.map(e => e.innerText));
            
            return { text: lastText, quickReplies };
        }

        // --- Helper: Wait for Specific Response ---
        async function waitForResponseContain(substr, timeoutMs = 30000) {
             const startTime = Date.now();
             while(Date.now() - startTime < timeoutMs) {
                 const res = await getLastBotMessage();
                 if (res.text && res.text.includes(substr)) return res;
                 await new Promise(r => setTimeout(r, 2000));
             }
             return await getLastBotMessage();
        }

        // --- TEST 1: Reset ---
        await sendMsg('/重啟');
        const resetRes = await waitForResponseContain("重啟完成");
        console.log("Reset Response:", resetRes.text);
        
        // Check for version
        const versionMatch = resetRes.text.match(/v\d+\.\d+\.\d+/);
        console.log("Detected Version:", versionMatch ? versionMatch[0] : "Unknown");

        // --- TEST 2: Fuzzy Matching (S43...) ---
        console.log("\n--- TEST 2: Fuzzy Matching (S43... should auto-select) ---");
        await sendMsg('S43FM703UCX如何開啟零售模式');
        console.log("Waiting for PDF search...");
        const fuzzyRes = await waitForResponseContain("零售模式", 60000); 
        console.log("Fuzzy Match Response Text:", fuzzyRes.text);
        console.log("Fuzzy Match Menu Buttons:", JSON.stringify(fuzzyRes.quickReplies));

        if (fuzzyRes.quickReplies.length > 0) {
            console.error("FAIL: Menu appeared for Fuzzy Match");
        } else {
            console.log("PASS: No menu appeared (Auto-selected)");
        }

        // --- TEST 3: Confusion Menu (G8...) ---
        console.log("\n--- TEST 3: Confusion Menu (G8... should show menu) ---");
        await sendMsg('請問G8有kvm嗎');
        
        // Wait longer for this complex case
        await new Promise(r => setTimeout(r, 20000));
        const confRes = await getLastBotMessage();
        
        console.log("Confusion Response Text:", confRes.text);
        console.log("Confusion Menu Buttons:", JSON.stringify(confRes.quickReplies));

        if (confRes.quickReplies.length > 0) {
            console.log("PASS: Menu appeared for Confusion Trigger");
        } else {
            console.error("FAIL: No menu appeared for Confusion Trigger. Text: " + confRes.text);
        }

    } catch (e) {
        console.error("TEST ERROR:", e);
    } finally {
        await browser.close();
    }
}

runTests();

