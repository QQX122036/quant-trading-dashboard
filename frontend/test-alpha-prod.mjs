import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  
  // Set token
  await page.goto('http://192.168.2.105:8501/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc3NTY2ODQwMiwiaWF0IjoxNzc1NTgyMDAyLCJqdGkiOiJmMmNlM2IzZi1hM2ExLTRmYzYtYTA5Ni1lNTgxMTU5ZTljODAifQ.gsyGs0ajzzylhKfR4Q1');
  });
  
  console.log('Testing /alpha-signals via backend (port 8501)...');
  await page.goto('http://192.168.2.105:8501/alpha-signals', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  
  console.log('URL:', page.url());
  const bodyText = await page.locator('body').innerText().catch(() => '');
  console.log('Body text (first 800):\n', bodyText.substring(0, 800));
  
  const canvas = await page.locator('canvas').count();
  console.log('\nCanvas elements:', canvas);
  
  console.log('\n=== Console Errors ===');
  if (errors.length === 0) console.log('No errors!');
  errors.forEach(e => console.log(e));
  
  await page.screenshot({ path: '/tmp/alpha-prod.png', fullPage: true });
  console.log('\nScreenshot: /tmp/alpha-prod.png');
  
  await browser.close();
})();
