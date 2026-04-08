# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e.test.ts >> Auth Flow E2E >> Dashboard page loads after login
- Location: e2e.test.ts:79:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 100
Received:   56
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - link "跳转到主要内容" [ref=e3] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e4]:
    - navigation "主导航" [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]: 📊
        - generic [ref=e8]: VeighNa Web
      - generic [ref=e9]:
        - button "系统菜单" [ref=e11]: 系统
        - button "功能菜单" [ref=e13]: 功能
        - button "帮助菜单" [ref=e15]: 帮助
      - generic [ref=e16]:
        - generic "当前时间 07:44:11" [ref=e17]: 07:44:11
        - button "切换到英文" [ref=e18]:
          - generic [ref=e19]: 🌐
          - generic [ref=e20]: EN
        - 'status "WebSocket状态: 未连接" [ref=e21]':
          - generic [ref=e23]: 未连接
    - main [ref=e24]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const FRONTEND_URL = 'http://localhost:5180';
  4   | const API_BASE = 'http://192.168.2.105:8501';
  5   | 
  6   | test.describe('Auth Flow E2E', () => {
  7   |   
  8   |   test('Access protected page → redirect to login', async ({ page }) => {
  9   |     await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
  10  |     await page.waitForTimeout(3000);
  11  |     const url = page.url();
  12  |     console.log('Current URL after accessing /dashboard:', url);
  13  |     // If auth guard works, should redirect to /login
  14  |     const redirected = url.includes('/login');
  15  |     console.log('Redirected to login:', redirected);
  16  |     // Even if not redirected, check if page loaded properly
  17  |     const content = await page.textContent('body');
  18  |     console.log('Page content length:', content?.length);
  19  |     expect(redirected).toBe(true);
  20  |   });
  21  | 
  22  |   test('Login page loads', async ({ page }) => {
  23  |     await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  24  |     await page.waitForTimeout(2000);
  25  |     const url = page.url();
  26  |     console.log('Login page URL:', url);
  27  |     const content = await page.textContent('body');
  28  |     console.log('Login page content length:', content?.length);
  29  |     expect(content?.length).toBeGreaterThan(50);
  30  |   });
  31  | 
  32  |   test('Login → token stored in localStorage', async ({ page }) => {
  33  |     await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  34  |     await page.waitForTimeout(2000);
  35  |     
  36  |     const inputs = await page.locator('input').all();
  37  |     console.log('Found inputs:', inputs.length);
  38  |     
  39  |     if (inputs.length >= 2) {
  40  |       await inputs[0].fill('admin');
  41  |       await inputs[1].fill('admin123');
  42  |     } else {
  43  |       // Try alternative selectors
  44  |       await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {});
  45  |       await page.locator('input[name="password"], input[type="password"]').first().fill('admin123').catch(() => {});
  46  |     }
  47  |     
  48  |     await page.locator('button[type="submit"]').click();
  49  |     await page.waitForTimeout(3000);
  50  |     
  51  |     const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  52  |     console.log('Token after login:', token ? token.substring(0, 30) + '...' : 'NULL');
  53  |     expect(token).toBeTruthy();
  54  |   });
  55  | 
  56  |   test('Protected API → 200 with valid token', async ({ page }) => {
  57  |     await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  58  |     await page.waitForTimeout(2000);
  59  |     
  60  |     const inputs = await page.locator('input').all();
  61  |     if (inputs.length >= 2) {
  62  |       await inputs[0].fill('admin');
  63  |       await inputs[1].fill('admin123');
  64  |     }
  65  |     await page.locator('button[type="submit"]').click();
  66  |     await page.waitForTimeout(3000);
  67  |     
  68  |     const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  69  |     
  70  |     const res = await page.evaluate(async ({ tok, url }) => {
  71  |       const r = await fetch(url, { headers: { 'Authorization': `Bearer ${tok}` } });
  72  |       return { status: r.status, data: await r.json() };
  73  |     }, { tok: token, url: `${API_BASE}/api/position/positions` });
  74  |     
  75  |     console.log('API Response:', res.status, JSON.stringify(res.data).substring(0, 100));
  76  |     expect(res.status).toBe(200);
  77  |   });
  78  | 
  79  |   test('Dashboard page loads after login', async ({ page }) => {
  80  |     await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  81  |     await page.waitForTimeout(2000);
  82  |     
  83  |     const inputs = await page.locator('input').all();
  84  |     if (inputs.length >= 2) {
  85  |       await inputs[0].fill('admin');
  86  |       await inputs[1].fill('admin123');
  87  |     }
  88  |     await page.locator('button[type="submit"]').click();
  89  |     await page.waitForTimeout(3000);
  90  |     
  91  |     await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
  92  |     await page.waitForTimeout(3000);
  93  |     
  94  |     const content = await page.textContent('body');
  95  |     console.log('Dashboard content length:', content?.length, '| URL:', page.url());
> 96  |     expect(content?.length).toBeGreaterThan(100);
      |                             ^ Error: expect(received).toBeGreaterThan(expected)
  97  |   });
  98  | 
  99  |   test('Positions page loads after login', async ({ page }) => {
  100 |     await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  101 |     await page.waitForTimeout(2000);
  102 |     
  103 |     const inputs = await page.locator('input').all();
  104 |     if (inputs.length >= 2) {
  105 |       await inputs[0].fill('admin');
  106 |       await inputs[1].fill('admin123');
  107 |     }
  108 |     await page.locator('button[type="submit"]').click();
  109 |     await page.waitForTimeout(3000);
  110 |     
  111 |     await page.goto(`${FRONTEND_URL}/positions`, { waitUntil: 'networkidle', timeout: 15000 });
  112 |     await page.waitForTimeout(3000);
  113 |     
  114 |     const content = await page.textContent('body');
  115 |     console.log('Positions content length:', content?.length, '| URL:', page.url());
  116 |     expect(content?.length).toBeGreaterThan(100);
  117 |   });
  118 | });
  119 | 
```