import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const networkReqs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  page.on('request', req => {
    if (req.url().includes('/api/')) networkReqs.push(req.method() + ' ' + req.url());
  });
  
  // First go to login
  console.log('1. Going to login page...');
  await page.goto('http://192.168.2.105:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  
  console.log('URL after login page load:', page.url());
  
  // Try to login via API
  console.log('\n2. Attempting login via API...');
  const loginResp = await page.request.post('http://192.168.2.105:8501/api/auth/login', {
    data: { username: 'admin', password: 'admin123' }
  });
  console.log('Login status:', loginResp.status());
  const loginBody = await loginResp.json().catch(() => ({}));
  console.log('Login response:', JSON.stringify(loginBody).substring(0, 200));
  
  if (loginBody.access_token) {
    const token = loginBody.access_token;
    console.log('\nGot token, storing in localStorage...');
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t);
    }, token);
    
    // Now navigate to alpha
    console.log('\n3. Navigating to /alpha...');
    await page.goto('http://192.168.2.105:5173/alpha', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(5000);
    
    console.log('URL after alpha load:', page.url());
    const bodyText = await page.locator('body').innerText().catch(() => 'N/A');
    console.log('Body text (first 1000 chars):\n', bodyText.substring(0, 1000));
    
    const canvas = await page.locator('canvas').count();
    console.log('\nCanvas elements:', canvas);
    
    const h2 = await page.locator('h2').allInnerTexts().catch(() => []);
    console.log('H2 elements:', h2);
  } else {
    console.log('No access_token in login response!');
  }
  
  console.log('\n=== Network Requests to /api/* ===');
  networkReqs.slice(0, 20).forEach(r => console.log(r));
  
  console.log('\n=== Console Errors ===');
  if (errors.length === 0) console.log('No errors!');
  errors.forEach(e => console.log('ERROR:', e));
  
  await page.screenshot({ path: '/tmp/alpha-page-loggedin.png', fullPage: true });
  console.log('\nScreenshot: /tmp/alpha-page-loggedin.png');
  
  await browser.close();
})();
