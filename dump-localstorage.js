const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3001');
  await page.waitForTimeout(2000);
  const data = await page.evaluate(() => JSON.stringify(localStorage));
  require('fs').writeFileSync('localstorage_dump.json', data);
  await browser.close();
  console.log('Dumped successfully.');
})();
