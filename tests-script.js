const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('response', r => { if(r.status() >= 400) console.log('HTTP ERROR:', r.url(), r.status()) });
  await page.goto('https://portfolio-hchps.pages.dev/');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
