import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Login first
  await page.goto('http://192.168.2.105:5173/', { waitUntil: 'networkidle', timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc3NTY2ODQwMiwiaWF0IjoxNzc1NTgyMDAyLCJqdGkiOiJmMmNlM2IzZi1hM2ExLTRmYzYtYTA5Ni1lNTgxMTU5ZTljODAifQ.gsyGs0ajzzylhKfR4Q1');
  });
  
  const routes = [
    '/market',
    '/dashboard', 
    '/alpha-signals',
    '/positions',
    '/trades',
    '/backtest',
    '/factors',
    '/portfolio',
    '/sentiment',
    '/news',
    '/advisor',
    '/derivatives',
  ];
  
  console.log('=== Frontend Page Render Test ===\n');
  
  for (const route of routes) {
    await page.goto(`http://192.168.2.105:5173${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);
    
    const rootChildren = await page.locator('#root > *').count();
    const url = page.url();
    const hasError = await page.locator('text=组件加载失败').count() > 0;
    const hasContent = rootChildren > 0 && !url.includes('login');
    
    console.log(`${route.padEnd(20)} | #root:${rootChildren} | Error:${hasError ? '❌' : '✅'} | Content:${hasContent ? '✅' : '❌'}`);
  }
  
  await browser.close();
})();
