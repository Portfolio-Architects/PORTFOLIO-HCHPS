const { chromium } = require('@playwright/test');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome' // Use system Chrome to avoid missing browser binary error
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Register console and error listeners
  page.on('console', msg => {
    console.log(`[BROWSER LOG] [${msg.type()}] ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.error('🚨 [BROWSER RUNTIME ERROR]', err);
  });
  
  console.log('Navigating to http://localhost:3001/ ...');
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  
  console.log('Waiting for Lock Screen...');
  await page.waitForTimeout(3000);
  
  // Log in
  const usernameInput = await page.$('input[placeholder="Enter your ID"]');
  const passwordInput = await page.$('input[type="password"]');
  
  if (usernameInput && passwordInput) {
    console.log('Login Screen detected. Entering credentials...');
    await usernameInput.fill('ocs5298');
    await passwordInput.fill('34237116!a');
    
    console.log('Submitting login...');
    const loginButton = await page.$('button:has-text("로그인")');
    if (loginButton) {
      await loginButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(4000);
  }

  // Go to Mindmap tab if not selected
  console.log('Navigating to Mindmap tab...');
  const mindmapTab = await page.$('button:has-text("마인드맵")');
  if (mindmapTab) {
    await mindmapTab.click();
    await page.waitForTimeout(5000);
  }

  console.log('Taking mindmap tab screenshot...');
  await page.screenshot({ path: 'scratch/screenshot_mindmap.png' });

  // Try to click "노드 추가" button
  console.log('Looking for "노드 추가" button...');
  const addNodeBtn = await page.$('button:has-text("노드 추가")');
  if (addNodeBtn) {
    console.log('Clicking "노드 추가" button...');
    await addNodeBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'scratch/screenshot_add_modal.png' });
    
    // Look for modal input
    const modalInput = await page.$('input[placeholder="노드 이름을 입력하세요..."]');
    if (modalInput) {
      console.log('Modal input found. Entering node name "테스트노드생성123"...');
      await modalInput.fill('테스트노드생성123');
      await page.screenshot({ path: 'scratch/screenshot_modal_filled.png' });
      
      console.log('Pressing Enter to submit...');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      await page.screenshot({ path: 'scratch/screenshot_after_add.png' });
      console.log('Node creation submit completed.');
    } else {
      console.error('Modal input NOT found!');
    }
  } else {
    console.error('"노드 추가" button NOT found!');
  }

  console.log('Closing browser...');
  await browser.close();
})().catch(err => {
  console.error('Script failed:', err);
});
