# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e.test.ts >> Frontend HTML served at root
- Location: e2e.test.ts:44:1

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "index-hMf8P10i.js"
Received string:    "<!DOCTYPE html><html lang=\"zh-CN\"><head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>VeighNa Web — 量化交易看板</title>
    <link rel=\"icon\" type=\"image/svg+xml\" href=\"/favicon.svg\">
    <script type=\"module\" crossorigin=\"\" src=\"/assets/index-5td9sHcu.js\"></script>
    <link rel=\"stylesheet\" crossorigin=\"\" href=\"/assets/index-Aknb3dUg.css\">
  </head>
  <body class=\"bg-[#1e1e1e] text-[#cccccc]\">
    <div id=\"root\"><div class=\"h-screen w-screen bg-[#0A0E17] text-white overflow-hidden flex flex-col\"><div class=\"h-10 bg-[#111827] border-b border-white/10 flex items-center px-4 relative z-50\"><div class=\"flex items-center gap-2 mr-6\"><span class=\"text-lg\">📊</span><span class=\"font-bold text-white\">VeighNa Web</span></div><div class=\"flex items-center gap-1\"><div class=\"relative\"><button class=\"px-3 py-1.5 text-sm rounded hover:bg-white/10 \">系统</button></div><div class=\"relative\"><button class=\"px-3 py-1.5 text-sm rounded hover:bg-white/10 \">功能</button></div><div class=\"relative\"><button class=\"px-3 py-1.5 text-sm rounded hover:bg-white/10 \">帮助</button></div></div><div class=\"flex-1\"></div><div class=\"flex items-center gap-4\"><button class=\"flex items-center gap-1 px-2 py-1 rounded text-sm hover:bg-white/10 min-h-[44px] min-w-[44px] justify-center\" title=\"Switch to English\"><span>🌐</span><span class=\"text-xs text-gray-400 hidden sm:inline\">EN</span></button><span class=\"text-sm text-gray-400 tabular-nums\">14:41:53</span><div class=\"flex items-center gap-2\"><div class=\"w-2 h-2 rounded-full bg-red-500\"></div><span class=\"text-sm text-gray-400\">未连接</span></div></div></div><main class=\"flex-1 min-h-0\"><div class=\"h-full w-full\"><div class=\"h-full flex flex-col p-4 gap-4 overflow-auto\"><div class=\"absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none\"><div class=\"flex flex-col items-center gap-3\"><div class=\"w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin\"></div><span class=\"text-sm text-gray-400\">加载市场数据...</span></div></div><div class=\"grid grid-cols-4 gap-4\"><div class=\"col-span-2 grid grid-cols-2 gap-4\"><div class=\"bg-[#111827]/80 rounded-lg border border-white/10 p-4 hover:border-white/20 transition-colors\"><div class=\"flex items-center justify-between mb-2\"><span class=\"text-sm text-gray-400\">上证指数</span><span class=\"text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400\">加载中</span></div><div class=\"animate-pulse\"><div class=\"h-8 bg-white/5 rounded w-3/4 mb-2\"></div><div class=\"h-4 bg-white/5 rounded w-1/2\"></div></div></div><div class=\"bg-[#111827]/80 rounded-lg border border-white/10 p-4 hover:border-white/20 transition-colors\"><div class=\"flex items-center justify-between mb-2\"><span class=\"text-sm text-gray-400\">深证成指</span><span class=\"text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400\">加载中</span></div><div class=\"animate-pulse\"><div class=\"h-8 bg-white/5 rounded w-3/4 mb-2\"></div><div class=\"h-4 bg-white/5 rounded w-1/2\"></div></div></div><div class=\"bg-[#111827]/80 rounded-lg border border-white/10 p-4 hover:border-white/20 transition-colors\"><div class=\"flex items-center justify-between mb-2\"><span class=\"text-sm text-gray-400\">创业板指</span><span class=\"text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400\">加载中</span></div><div class=\"animate-pulse\"><div class=\"h-8 bg-white/5 rounded w-3/4 mb-2\"></div><div class=\"h-4 bg-white/5 rounded w-1/2\"></div></div></div><div class=\"bg-[#111827]/80 rounded-lg border border-white/10 p-4 hover:border-white/20 transition-colors\"><div class=\"flex items-center justify-between mb-2\"><span class=\"text-sm text-gray-400\">上证50</span><span class=\"text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400\">加载中</span></div><div class=\"animate-pulse\"><div class=\"h-8 bg-white/5 rounded w-3/4 mb-2\"></div><div class=\"h-4 bg-white/5 rounded w-1/2\"></div></div></div><div class=\"bg-[#111827]/80 rounded-lg border border-white/10 p-4 hover:border-white/20 transition-colors\"><div class=\"flex items-center justify-between mb-2\"><span class=\"text-sm text-gray-400\">沪深300</span><span class=\"text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400\">加载中</span></div><div class=\"animate-pulse\"><div class=\"h-8 bg-white/5 rounded w-3/4 mb-2\"></div><div class=\"h-4 bg-white/5 rounded w-1/2\"></div></div></div><div class=\"bg-[#111827]/80 rounded-lg border border-white/10 p-4 hover:border-white/20 transition-colors\"><div class=\"flex items-center justify-between mb-2\"><span class=\"text-sm text-gray-400\">中证500</span><span class=\"text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400\">加载中</span></div><div class=\"animate-pulse\"><div class=\"h-8 bg-white/5 rounded w-3/4 mb-2\"></div><div class=\"h-4 bg-white/5 rounded w-1/2\"></div></div></div></div><div class=\"col-span-2 flex flex-col gap-4\"><div class=\"bg-[#111827]/80 rounded-lg border border-white/10 p-4\"><h3 class=\"text-sm text-gray-400 mb-3\">涨跌家数</h3><div class=\"animate-pulse space-y-2\"><div class=\"h-8 bg-white/5 rounded\"></div><div class=\"h-4 bg-white/5 rounded w-3/4\"></div></div></div><div class=\"rounded-lg border p-4 bg-yellow-500/10 border-yellow-500/30\"><h3 class=\"text-sm text-gray-400 mb-2\">市场情绪</h3><div class=\"flex items-center gap-3\"><span class=\"text-3xl\">🟡</span><div><div class=\"text-xl font-bold text-[#F59E0B]\">震荡</div><div class=\"text-xs text-gray-500\">市场方向不明，建议观望</div></div></div></div></div></div><div class=\"flex gap-4 flex-1 min-h-0\"><div class=\"w-96 bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col\"><h3 class=\"font-bold mb-4\">行业板块</h3><div class=\"animate-pulse space-y-3\"><div class=\"h-6 bg-white/5 rounded\"></div><div class=\"h-6 bg-white/5 rounded\"></div><div class=\"h-6 bg-white/5 rounded\"></div><div class=\"h-6 bg-white/5 rounded\"></div><div class=\"h-6 bg-white/5 rounded\"></div></div></div><div class=\"flex-1 bg-[#111827]/80 rounded-lg border border-white/10 p-4 flex flex-col\"><div class=\"flex items-center justify-between mb-4\"><h3 class=\"font-bold\">今日强势股</h3></div></div></div></div></div></main></div></div>····
</body></html>"
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: 📊
      - generic [ref=e7]: VeighNa Web
    - generic [ref=e8]:
      - button "系统" [ref=e10]
      - button "功能" [ref=e12]
      - button "帮助" [ref=e14]
    - generic [ref=e15]:
      - button "🌐 EN" [ref=e16]:
        - generic [ref=e17]: 🌐
        - generic [ref=e18]: EN
      - generic [ref=e19]: 14:41:53
      - generic [ref=e22]: 未连接
  - main [ref=e23]:
    - generic [ref=e25]:
      - generic:
        - generic:
          - generic: 加载市场数据...
      - generic [ref=e26]:
        - generic [ref=e27]:
          - generic [ref=e29]:
            - generic [ref=e30]: 上证指数
            - generic [ref=e31]: 加载中
          - generic [ref=e36]:
            - generic [ref=e37]: 深证成指
            - generic [ref=e38]: 加载中
          - generic [ref=e43]:
            - generic [ref=e44]: 创业板指
            - generic [ref=e45]: 加载中
          - generic [ref=e50]:
            - generic [ref=e51]: 上证50
            - generic [ref=e52]: 加载中
          - generic [ref=e57]:
            - generic [ref=e58]: 沪深300
            - generic [ref=e59]: 加载中
          - generic [ref=e64]:
            - generic [ref=e65]: 中证500
            - generic [ref=e66]: 加载中
        - generic [ref=e70]:
          - heading "涨跌家数" [level=3] [ref=e72]
          - generic [ref=e76]:
            - heading "市场情绪" [level=3] [ref=e77]
            - generic [ref=e78]:
              - generic [ref=e79]: 🟡
              - generic [ref=e80]:
                - generic [ref=e81]: 震荡
                - generic [ref=e82]: 市场方向不明，建议观望
      - generic [ref=e83]:
        - heading "行业板块" [level=3] [ref=e85]
        - heading "今日强势股" [level=3] [ref=e94]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | const BASE_URL = 'http://localhost:8501';
  3  | 
  4  | // === API Tests ===
  5  | 
  6  | test('JWT login flow', async ({ page }) => {
  7  |   // Note: backend expects query params, not JSON body
  8  |   const response = await page.request.post(`${BASE_URL}/api/auth/login?username=admin&password=admin123`);
  9  |   expect(response.status()).toBe(200);
  10 |   const body = await response.json();
  11 |   expect(body.access_token).toBeDefined();
  12 |   const tokenParts = body.access_token.split('.');
  13 |   expect(tokenParts.length).toBe(3);
  14 |   expect(body.user_id).toBeDefined();
  15 | });
  16 | 
  17 | test('API health check', async ({ page }) => {
  18 |   const response = await page.request.get(`${BASE_URL}/api/health`);
  19 |   expect(response.status()).toBe(200);
  20 |   const body = await response.json();
  21 |   expect(body.status).toBeDefined();
  22 | });
  23 | 
  24 | test('API daily-bar returns market data', async ({ page }) => {
  25 |   const response = await page.request.get(`${BASE_URL}/api/data/daily-bar?ts_code=600519.SH&start=2026-01-01&end=2026-04-05`);
  26 |   expect(response.status()).toBe(200);
  27 |   const body = await response.json();
  28 |   // Response format: {code:0, data:[...]} not {bars:[...]}
  29 |   expect(body.data).toBeDefined();
  30 |   expect(Array.isArray(body.data)).toBe(true);
  31 |   expect(body.data.length).toBeGreaterThan(0);
  32 |   expect(body.data[0]).toHaveProperty('ts_code');
  33 |   expect(body.data[0]).toHaveProperty('trade_date');
  34 |   expect(body.data[0]).toHaveProperty('close');
  35 | });
  36 | 
  37 | test('API positions endpoint (correct path: /api/position/positions)', async ({ page }) => {
  38 |   const response = await page.request.get(`${BASE_URL}/api/position/positions`);
  39 |   expect(response.status()).toBe(200);
  40 |   const body = await response.json();
  41 |   expect(body.positions).toBeDefined();
  42 | });
  43 | 
  44 | test('Frontend HTML served at root', async ({ page }) => {
  45 |   const response = await page.goto(`${BASE_URL}/`);
  46 |   expect(response?.status()).toBe(200);
  47 |   const content = await page.content();
  48 |   expect(content).toContain('VeighNa Web');
> 49 |   expect(content).toContain('index-hMf8P10i.js');
     |                   ^ Error: expect(received).toContain(expected) // indexOf
  50 | });
  51 | 
  52 | test('Frontend /kline route serves HTML', async ({ page }) => {
  53 |   const response = await page.goto(`${BASE_URL}/kline`);
  54 |   expect(response?.status()).toBe(200);
  55 | });
  56 | 
  57 | test('Frontend /backtest route serves HTML', async ({ page }) => {
  58 |   const response = await page.goto(`${BASE_URL}/backtest`);
  59 |   expect(response?.status()).toBe(200);
  60 | });
  61 | 
```