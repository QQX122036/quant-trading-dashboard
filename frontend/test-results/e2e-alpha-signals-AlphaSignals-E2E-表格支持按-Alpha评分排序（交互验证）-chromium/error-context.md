# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-alpha-signals.test.ts >> AlphaSignals E2E >> 表格支持按 Alpha评分排序（交互验证）
- Location: e2e-alpha-signals.test.ts:258:3

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
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | const FRONTEND_URL = 'http://localhost:5180';
  4   | const API_BASE = 'http://192.168.2.105:8501';
  5   | 
  6   | /**
  7   |  * E2E 测试: AlphaSignals 页面
  8   |  * 覆盖: /api/alpha/top20 API、CSV 导出功能
  9   |  */
  10  | test.describe('AlphaSignals E2E', () => {
  11  | 
  12  |   // ── 前置: 确保登录状态 ────────────────────────────────
  13  |   async function ensureLogin(page: Page): Promise<string> {
  14  |     // 直接去登录页
  15  |     await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  16  |     await page.waitForTimeout(1000);
  17  | 
  18  |     // 检查是否已有有效 token
  19  |     const existing = await page.evaluate(() => localStorage.getItem('auth_token'));
  20  |     if (existing) {
  21  |       try {
  22  |         const payload = JSON.parse(atob(existing.split('.')[1]));
  23  |         if (payload.exp * 1000 > Date.now()) return existing;
  24  |       } catch { /* ignore */ }
  25  |     }
  26  | 
  27  |     // 执行登录
  28  |     const inputs = await page.locator('input').all();
  29  |     if (inputs.length >= 2) {
  30  |       await inputs[0].fill('admin');
  31  |       await inputs[1].fill('admin123');
  32  |     } else {
  33  |       await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {});
  34  |       await page.locator('input[name="password"], input[type="password"]').first().fill('admin123').catch(() => {});
  35  |     }
  36  | 
  37  |     // 点击登录后等待网络请求完成
  38  |     await Promise.all([
  39  |       page.waitForResponse(r => r.url().includes('/api/auth/login'), { timeout: 15000 }),
  40  |       page.locator('button[type="submit"]').click(),
  41  |     ]).catch(() => {});  // ignore if response timeout
  42  | 
  43  |     // 等待登录完成
  44  |     await page.waitForTimeout(2000);
  45  | 
  46  |     const token = await page.evaluate(() => localStorage.getItem('auth_token'));
> 47  |     if (!token) throw new Error('Login failed: no token');
      |                       ^ Error: Login failed: no token
  48  |     return token as string;
  49  |   }
  50  | 
  51  |   // ── Test 1: /api/alpha/top20 API 直接验证 ────────────────
  52  |   test('API /api/alpha/top20 返回 200 且数据格式正确', async ({ page }) => {
  53  |     const token = await ensureLogin(page);
  54  |     const res = await page.evaluate(async ({ tok, apiBase }) => {
  55  |       const r = await fetch(`${apiBase}/api/alpha/top20`, {
  56  |         headers: { 'Authorization': `Bearer ${tok}` },
  57  |       });
  58  |       const body = await r.json();
  59  |       return { status: r.status, body };
  60  |     }, { tok: token, apiBase: API_BASE });
  61  | 
  62  |     console.log('API Status:', res.status);
  63  |     console.log('Response code:', res.body.code);
  64  |     console.log('Items count:', res.body.data?.items?.length);
  65  | 
  66  |     expect(res.status).toBe(200);
  67  |     expect(res.body.code).toBe('0');
  68  |     expect(res.body.data).toBeDefined();
  69  |     expect(Array.isArray(res.body.data.items)).toBe(true);
  70  |     expect(res.body.data.items.length).toBeGreaterThan(0);
  71  |     expect(res.body.data.items.length).toBeLessThanOrEqual(20);
  72  | 
  73  |     // 验证关键字段
  74  |     const item = res.body.data.items[0];
  75  |     expect(item).toHaveProperty('ts_code');
  76  |     expect(item).toHaveProperty('name');
  77  |     expect(item).toHaveProperty('alpha20');
  78  |     expect(item).toHaveProperty('rank');
  79  |     expect(item).toHaveProperty('trade_date');
  80  | 
  81  |     // rank 应为 1-20 连续整数
  82  |     const ranks = res.body.data.items.map((i: any) => i.rank);
  83  |     expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  84  |   });
  85  | 
  86  |   // ── Test 2: API 返回字段与前端类型兼容 ─────────────────
  87  |   test('API 返回字段与前端 AlphaStock 类型兼容', async ({ page }) => {
  88  |     const token = await ensureLogin(page);
  89  |     const res = await page.evaluate(async ({ tok, apiBase }) => {
  90  |       const r = await fetch(`${apiBase}/api/alpha/top20`, {
  91  |         headers: { 'Authorization': `Bearer ${tok}` },
  92  |       });
  93  |       return r.json();
  94  |     }, { tok: token, apiBase: API_BASE });
  95  | 
  96  |     const items: any[] = res.data?.items ?? [];
  97  |     expect(items.length).toBeGreaterThan(0);
  98  | 
  99  |     const apiFields = Object.keys(items[0] ?? {});
  100 |     console.log('API fields:', apiFields);
  101 | 
  102 |     // API 有: ts_code, name, trade_date, alpha20, rank, open, close, change_pct, volume, avg_vol_20
  103 |     // 前端核心字段: ts_code, name, alpha20, rank
  104 |     const hasCore = ['ts_code', 'name', 'alpha20', 'rank'].every(f => apiFields.includes(f));
  105 |     expect(hasCore).toBe(true);
  106 |   });
  107 | 
  108 |   // ── Test 3: 页面加载（路由验证）────────────────────────
  109 |   test('AlphaSignals 页面可访问（验证路由）', async ({ page }) => {
  110 |     await ensureLogin(page);
  111 |     const errors: string[] = [];
  112 |     page.on('pageerror', err => errors.push(err.message));
  113 | 
  114 |     await page.goto(`${FRONTEND_URL}/alpha-signals`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  115 |     await page.waitForTimeout(6000);
  116 | 
  117 |     const url = page.url();
  118 |     console.log('Page URL:', url);
  119 |     // URL 应该保持在 alpha-signals（不重定向到 /login）
  120 |     expect(url).toContain('/alpha-signals');
  121 | 
  122 |     // 页面有内容（body 不为空）
  123 |     const bodyText = await page.textContent('body');
  124 |     console.log('Body text length:', bodyText?.length);
  125 | 
  126 |     // 过滤出真正的错误（忽略 405 CORS preflight 和 favicon）
  127 |     const realErrors = errors.filter(e =>
  128 |       !e.includes('favicon') &&
  129 |       !e.includes('net::ERR_') &&
  130 |       !e.includes('405') &&
  131 |       !e.includes('Failed to load resource')
  132 |     );
  133 |     expect(realErrors.length).toBe(0);
  134 |   });
  135 | 
  136 |   // ── Test 4: 导出 CSV 按钮存在 ──────────────────────────
  137 |   test('导出 CSV 按钮存在（页面元素验证）', async ({ page }) => {
  138 |     await ensureLogin(page);
  139 |     await page.goto(`${FRONTEND_URL}/alpha-signals`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  140 |     await page.waitForTimeout(7000);
  141 | 
  142 |     // 找导出按钮（多种匹配方式）
  143 |     const exportBtn = page.locator('button').filter({ hasText: /导出|CSV|Download/i }).first();
  144 |     const btnCount = await exportBtn.count();
  145 |     console.log('Export CSV button count:', btnCount);
  146 | 
  147 |     if (btnCount > 0) {
```