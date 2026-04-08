import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const allLogs = [];
  page.on('console', msg => allLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => allLogs.push(`[pageerror] ${err.message}`));
  
  // Set token first
  await page.goto('http://192.168.2.105:5173/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc3NTY2ODQwMiwiaWF0IjoxNzc1NTgyMDAyLCJqdGkiOiJmMmNlM2IzZi1hM2ExLTRmYzYtYTA5Ni1lNTgxMTU5ZTljODAifQ.gsyGs0ajzzylhKfR4Q1');
  });
  
  console.log('Testing /alpha-signals route...');
  await page.goto('http://192.168.2.105:5173/alpha-signals', { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    const rootChild = await page.locator('#root > *').count();
    const url = page.url();
    console.log(`[${i+1}s] URL=${url} #root children: ${rootChild}`);
    if (rootChild > 0) break;
  }
  
  console.log('\nFinal URL:', page.url());
  const bodyText = await page.locator('body').innerText().catch(() => '');
  console.log('Body text (first 500):', bodyText.substring(0, 500));
  
  console.log('\n=== All Console Logs ===');
  allLogs.forEach(l => console.log(l));
  
  await page.screenshot({ path: '/tmp/alpha-signals-test.png', fullPage: true });
  console.log('\nScreenshot: /tmp/alpha-signals-test.png');
  
  await browser.close();
})();
