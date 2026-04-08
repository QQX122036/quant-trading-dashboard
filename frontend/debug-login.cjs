const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const failed = [];
  const not200 = [];
  
  page.on('requestfailed', req => {
    failed.push(req.method() + ' ' + req.url() + ' -> ' + (req.failure()?.errorText || 'unknown'));
  });
  
  page.on('response', res => {
    if (res.status() === 401 || res.status() >= 400) {
      not200.push(res.status() + ': ' + res.request().method() + ' ' + res.url());
    }
  });
  
  await page.goto('http://192.168.2.105:5173/login', { waitUntil: 'networkidle' });
  await page.fill('input#username, input[type="text"]', 'admin');
  await page.fill('input#password, input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('URL after login:', page.url());
  console.log('Token:', await page.evaluate(() => localStorage.getItem('auth_token') ? 'EXISTS' : 'NULL'));
  
  console.log('\n--- Failed requests ---');
  for (const f of failed) console.log(f);
  
  console.log('\n--- Non-200 responses ---');
  for (const n of not200) console.log(n);
  
  await browser.close();
  process.exit(0);
})();
