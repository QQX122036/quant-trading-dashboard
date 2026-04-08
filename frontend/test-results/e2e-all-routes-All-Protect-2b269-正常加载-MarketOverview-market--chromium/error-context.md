# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-all-routes.test.ts >> All Protected Routes — 登录后正常加载 >> MarketOverview (/market)
- Location: e2e-all-routes.test.ts:130:5

# Error details

```
Error: Login failed: no token
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e7]: 📊
    - heading "VeighNa Web" [level=1] [ref=e8]
    - paragraph [ref=e9]: 量化交易系统 · 智能投资平台
  - generic [ref=e10]:
    - heading "用户登录" [level=2] [ref=e11]
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: 用户名
        - generic [ref=e15]:
          - generic [ref=e16]: 👤
          - textbox "用户名" [ref=e17]:
            - /placeholder: 请输入用户名
            - text: admin
      - generic [ref=e18]:
        - generic [ref=e19]: 密码
        - generic [ref=e20]:
          - generic [ref=e21]: 🔒
          - textbox "密码" [ref=e22]:
            - /placeholder: 请输入密码
            - text: admin123
          - button "显示密码" [ref=e23]: 👁️
      - generic [ref=e25] [cursor=pointer]:
        - checkbox "记住登录状态" [ref=e26]
        - generic [ref=e27]: 记住登录状态
      - button "登录中..." [disabled] [ref=e28]: 登录中...
    - paragraph [ref=e31]: "测试账号: admin / admin123"
  - paragraph [ref=e32]: © 2026 VeighNa Quant · 安全交易 · 智慧投资
```

# Test source

```ts
  1   | /**
  2   |  * e2e-all-routes.test.ts — 完整路由 E2E 覆盖
  3   |  * 覆盖所有 18 个路由 + auth guard + API 数据验证
  4   |  */
  5   | import { test, expect, Page } from '@playwright/test';
  6   | 
  7   | const FRONTEND_URL = 'http://localhost:5180';
  8   | const API_BASE = 'http://192.168.2.105:8501';
  9   | 
  10  | // ─── 路由清单 ───────────────────────────────────────────────────────────────
  11  | const PROTECTED_ROUTES = [
  12  |   { path: '/market',        name: 'MarketOverview',    checks: ['指数', '市场'] },
  13  |   { path: '/dashboard',     name: 'StockDashboard',    checks: ['股票', '监控'] },
  14  |   { path: '/dashboard/home',name: 'DashboardHome',      checks: ['仪表盘', '账户'] },
  15  |   { path: '/backtest',     name: 'BacktestAnalysis',  checks: ['回测', '配置'] },
  16  |   { path: '/trades',       name: 'TradeLog',           checks: ['交易', '委托'] },
  17  |   { path: '/positions',     name: 'PositionManagement', checks: ['持仓', '管理'] },
  18  |   { path: '/data',         name: 'DataManager',        checks: ['数据', '导入'] },
  19  |   { path: '/strategies',   name: 'StrategyManager',   checks: ['策略', '启动'] },
  20  |   { path: '/factors',      name: 'FactorDashboard',    checks: ['因子', 'IC'] },
  21  |   { path: '/multifactor',  name: 'MultiFactorChart',  checks: ['多因子', '分析'] },
  22  |   { path: '/portfolio',    name: 'PortfolioAnalysis',  checks: ['组合', '分析'] },
  23  |   { path: '/sentiment',    name: 'SentimentPage',      checks: ['情绪', '舆情'] },
  24  |   { path: '/news',         name: 'NewsSentiment',      checks: ['新闻', '舆情'] },
  25  |   { path: '/advisor',      name: 'AIAdvisor',           checks: ['AI', '建议'] },
  26  |   { path: '/derivatives',  name: 'DerivativesPage',    checks: ['期权', '期货'] },
  27  |   { path: '/backtest/report', name: 'BacktestReport',  checks: ['回测', '报告'] },
  28  |   { path: '/stock/report', name: 'StockReport',        checks: ['股票', '报告'] },
  29  | ];
  30  | 
  31  | // ─── 通用: 确保已登录 ────────────────────────────────────────────────────────
  32  | async function ensureLogin(page: Page): Promise<string> {
  33  |   await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  34  |   await page.waitForTimeout(1000);
  35  | 
  36  |   // 检查是否已有有效 token
  37  |   const existing = await page.evaluate(() => localStorage.getItem('auth_token'));
  38  |   if (existing) {
  39  |     try {
  40  |       const payload = JSON.parse(atob(existing.split('.')[1]));
  41  |       if (payload.exp * 1000 > Date.now()) return existing;
  42  |     } catch { /* ignore */ }
  43  |   }
  44  | 
  45  |   const inputs = await page.locator('input').all();
  46  |   if (inputs.length >= 2) {
  47  |     await inputs[0].fill('admin');
  48  |     await inputs[1].fill('admin123');
  49  |   } else {
  50  |     await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {});
  51  |     await page.locator('input[name="password"], input[type="password"]').first().fill('admin123').catch(() => {});
  52  |   }
  53  | 
  54  |   await Promise.all([
  55  |     page.waitForResponse(r => r.url().includes('/api/auth/login'), { timeout: 15000 }),
  56  |     page.locator('button[type="submit"]').click(),
  57  |   ]).catch(() => {});
  58  | 
  59  |   await page.waitForTimeout(2000);
  60  |   const token = await page.evaluate(() => localStorage.getItem('auth_token'));
> 61  |   if (!token) throw new Error('Login failed: no token');
      |                     ^ Error: Login failed: no token
  62  |   return token as string;
  63  | }
  64  | 
  65  | // ─── Test Suite 1: Auth Guard — 未登录重定向 ─────────────────────────────────
  66  | test.describe('Auth Guard — 未登录访问受保护路由', () => {
  67  | 
  68  |   for (const route of PROTECTED_ROUTES) {
  69  |     test(`未登录访问 ${route.path} → /login`, async ({ page }) => {
  70  |       await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  71  |       await page.evaluate(() => localStorage.removeItem('auth_token'));
  72  | 
  73  |       await page.goto(`${FRONTEND_URL}${route.path}`, { waitUntil: 'domcontentloaded' });
  74  |       await page.waitForTimeout(3000);
  75  | 
  76  |       const url = page.url();
  77  |       const redirectedToLogin = url.includes('/login');
  78  |       console.log(`${route.path} → ${redirectedToLogin ? '✅ 重定向 /login' : '⚠️ 未重定向，当前: ' + url}`);
  79  |       expect(redirectedToLogin).toBe(true);
  80  |     });
  81  |   }
  82  | 
  83  |   test('登录页本身可访问（无重定向循环）', async ({ page }) => {
  84  |     await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  85  |     await page.waitForTimeout(2000);
  86  |     const url = page.url();
  87  |     expect(url).toContain('/login');
  88  |     const content = await page.textContent('body');
  89  |     expect(content?.length ?? 0).toBeGreaterThan(50);
  90  |   });
  91  | });
  92  | 
  93  | // ─── Test Suite 2: Login Flow ────────────────────────────────────────────────
  94  | test.describe('Login Flow', () => {
  95  | 
  96  |   test('用户名+密码登录 → token 写入 localStorage', async ({ page }) => {
  97  |     await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  98  |     await page.waitForTimeout(1000);
  99  | 
  100 |     const inputs = await page.locator('input').all();
  101 |     expect(inputs.length).toBeGreaterThanOrEqual(2);
  102 | 
  103 |     await inputs[0].fill('admin');
  104 |     await inputs[1].fill('admin123');
  105 |     await page.locator('button[type="submit"]').click();
  106 | 
  107 |     await page.waitForTimeout(4000);
  108 | 
  109 |     const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  110 |     expect(token).toBeTruthy();
  111 |     console.log('✅ Token stored:', token?.substring(0, 20) + '...');
  112 |   });
  113 | 
  114 |   test('登录后访问 /login 不重定向（已认证）', async ({ page }) => {
  115 |     await ensureLogin(page);
  116 |     await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  117 |     await page.waitForTimeout(2000);
  118 |     const url = page.url();
  119 |     // 已登录用户访问 /login 应该跳转首页，不是无限重定向
  120 |     const notLoop = !url.endsWith('/login') || (await page.textContent('body'))?.length! > 100;
  121 |     console.log('✅ After login /login URL:', url, '| Content OK:', notLoop);
  122 |     expect(notLoop).toBe(true);
  123 |   });
  124 | });
  125 | 
  126 | // ─── Test Suite 3: All Protected Routes ────────────────────────────────────
  127 | test.describe('All Protected Routes — 登录后正常加载', () => {
  128 | 
  129 |   for (const route of PROTECTED_ROUTES) {
  130 |     test(`${route.name} (${route.path})`, async ({ page }) => {
  131 |       await ensureLogin(page);
  132 | 
  133 |       // 访问路由
  134 |       await page.goto(`${FRONTEND_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  135 |       await page.waitForTimeout(4000);
  136 | 
  137 |       const url = page.url();
  138 |       const onCorrectRoute = url.includes(route.path) || url === `${FRONTEND_URL}/`;
  139 |       console.log(`✅ ${route.name}: URL=${url}`);
  140 | 
  141 |       // 页面内容非空
  142 |       const content = await page.textContent('body');
  143 |       const contentLen = content?.length ?? 0;
  144 | 
  145 |       // 无严重 JS Error
  146 |       const errors: string[] = [];
  147 |       page.on('pageerror', err => errors.push(err.message));
  148 |       const criticalErrors = errors.filter(e =>
  149 |         !e.includes('favicon') &&
  150 |         !e.includes('net::ERR_NAME_NOT_RESOLVED') &&
  151 |         !e.includes('Failed to load resource') &&
  152 |         !e.includes('net::ERR_CONNECTION_REFUSED') &&
  153 |         !e.includes('CORS')
  154 |       );
  155 |       if (criticalErrors.length > 0) {
  156 |         console.log(`⚠️ JS Errors on ${route.path}:`, criticalErrors);
  157 |       }
  158 | 
  159 |       // 检查关键字（路由特定）
  160 |       const hasExpectedKeyword = route.checks.some(kw =>
  161 |         content?.toLowerCase().includes(kw.toLowerCase())
```