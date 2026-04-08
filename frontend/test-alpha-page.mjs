import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  console.log('Navigating to /alpha...');
  await page.goto('http://192.168.2.105:5173/alpha', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);
  
  const title = await page.title();
  console.log('Page title:', title);
  
  const bodyText = await page.locator('body').innerText().catch(() => 'N/A');
  console.log('Body text (first 800 chars):\n', bodyText.substring(0, 800));
  
  const canvas = await page.locator('canvas').count();
  console.log('\nCanvas elements:', canvas);
  
  console.log('\n=== Console Errors ===');
  if (errors.length === 0) console.log('No errors!');
  errors.forEach(e => console.log('ERROR:', e));
  
  await page.screenshot({ path: '/tmp/alpha-page-test.png', fullPage: true });
  console.log('\nScreenshot: /tmp/alpha-page-test.png');
  
  await browser.close();
})();
