import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const allLogs = [];
  page.on('console', msg => allLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => allLogs.push(`[pageerror] ${err.message}`));
  
  // Set token in localStorage before navigating
  await page.goto('http://192.168.2.105:5173/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc3NTY2ODQwMiwiaWF0IjoxNzc1NTgyMDAyLCJqdGkiOiJmMmNlM2IzZi1hM2ExLTRmYzYtYTA5Ni1lNTgxMTU5ZTljODAifQ.gsyGs0ajzzylhKfR4Q1');
  });
  
  console.log('Navigating to /alpha...');
  await page.goto('http://192.168.2.105:5173/alpha', { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  // Wait for solid to potentially render
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const rootChild = await page.locator('#root > *').count();
    console.log(`[${i+1}s] #root children: ${rootChild}`);
    if (rootChild > 0) break;
  }
  
  console.log('\nURL:', page.url());
  
  // Check root content
  const rootHtml = await page.locator('#root').innerHTML();
  console.log('#root HTML length:', rootHtml.length);
  console.log('#root first 300 chars:', rootHtml.substring(0, 300));
  
  // Check for any text
  const h2s = await page.locator('h2').allInnerTexts().catch(() => []);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  console.log('\nH2 texts:', h2s);
  console.log('Body text:', bodyText.substring(0, 200));
  
  // All logs
  console.log('\n=== All Console/Page Logs ===');
  allLogs.forEach(l => console.log(l));
  
  await page.screenshot({ path: '/tmp/alpha-full-test.png', fullPage: true });
  console.log('\nScreenshot: /tmp/alpha-full-test.png');
  
  await browser.close();
})();
