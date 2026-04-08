import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  // Set auth token first
  await page.goto('http://192.168.2.105:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc3NTY2ODQwMiwiaWF0IjoxNzc1NTgyMDAyLCJqdGkiOiJmMmNlM2IzZi1hM2ExLTRmYzYtYTA5Ni1lNTgxMTU5ZTljODAifQ.gsyGs0ajzzylhKfR4Q1');
  });
  
  console.log('Navigating to /alpha...');
  await page.goto('http://192.168.2.105:5173/alpha', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);
  
  // Get full DOM
  const html = await page.content();
  console.log('Page HTML length:', html.length);
  
  // Count elements
  const divs = await page.locator('div').count();
  const buttons = await page.locator('button').count();
  const sections = await page.locator('section').count();
  console.log(`divs=${divs}, buttons=${buttons}, sections=${sections}`);
  
  // Check root element
  const rootContent = await page.locator('#root').innerHTML().catch(() => 'N/A');
  console.log('\n#root innerHTML (first 500 chars):', rootContent.substring(0, 500));
  
  // Check if page redirects
  console.log('\nURL:', page.url());
  
  // Wait and reload
  await page.waitForTimeout(3000);
  const bodyAfter = await page.locator('body').innerHTML().catch(() => 'N/A');
  console.log('\nBody HTML after wait (first 500):', bodyAfter.substring(0, 500));
  
  console.log('\n=== Console Errors ===');
  if (errors.length === 0) console.log('No errors!');
  errors.forEach(e => console.log('ERROR:', e));
  
  await page.screenshot({ path: '/tmp/alpha-page3.png', fullPage: true });
  console.log('\nScreenshot: /tmp/alpha-page3.png');
  
  await browser.close();
})();
