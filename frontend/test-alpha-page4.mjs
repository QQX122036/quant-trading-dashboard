import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const allMsgs = [];
  page.on('console', msg => allMsgs.push({type: msg.type(), text: msg.text()}));
  page.on('pageerror', err => allMsgs.push({type: 'pageerror', text: err.message + '\n' + err.stack}));
  page.on('requestfailed', req => allMsgs.push({type: 'reqfail', text: req.url() + ' - ' + req.failure()?.errorText}));
  
  await page.goto('http://192.168.2.105:5173/alpha', { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  // Wait for solid to hydrate
  await page.waitForFunction(() => document.getElementById('root')?.children?.length > 0, {timeout: 10000}).catch(() => {});
  await page.waitForTimeout(5000);
  
  console.log('URL:', page.url());
  console.log('#root children:', await page.locator('#root').evaluate(el => el.children.length));
  
  // Try getting JS error from window
  const solidError = await page.evaluate(() => {
    return window.__solid_error || window.SOLID_ERROR || null;
  });
  if (solidError) console.log('Solid error:', solidError);
  
  console.log('\n=== All Console Messages ===');
  allMsgs.forEach(m => console.log(`[${m.type}]`, m.text));
  
  await page.screenshot({ path: '/tmp/alpha-page4.png', fullPage: true });
  
  await browser.close();
})();
