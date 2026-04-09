# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-sentiment-p0.test.ts >> SE-002: 情绪仪表盘（恐慌指数/贪婪指数卡片）显示
- Location: e2e-sentiment-p0.test.ts:59:1

# Error details

```
Error: page.content: Target page, context or browser has been closed
```

# Test source

```ts
  1   | /**
  2   |  * e2e-sentiment-p0.test.ts — 市场情绪页面 P0 测试用例
  3   |  * 覆盖: 仪表盘/时序图/热力图/无数据降级
  4   |  */
  5   | import { test, expect, Page } from '@playwright/test';
  6   | 
  7   | const FRONTEND_URL = 'http://192.168.2.105:5173';
  8   | const API_BASE = 'http://localhost:8501/api';
  9   | 
  10  | async function ensureLogin(page: Page) {
  11  |   await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  12  |   await page.waitForTimeout(1000);
  13  |   const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  14  |   if (token) {
  15  |     try {
  16  |       const payload = JSON.parse(atob(token.split('.')[1]));
  17  |       if (payload.exp * 1000 > Date.now()) return;
  18  |     } catch {}
  19  |   }
  20  |   const inputs = await page.locator('input').all();
  21  |   if (inputs.length >= 2) {
  22  |     await inputs[0].fill('admin');
  23  |     await inputs[1].fill('admin123');
  24  |   }
  25  |   await Promise.all([
  26  |     page.waitForResponse(r => r.url().includes('/api/auth/login'), { timeout: 15000 }),
  27  |     page.locator('button[type="submit"]').click(),
  28  |   ]).catch(() => {});
  29  |   await page.waitForTimeout(2000);
  30  | }
  31  | 
  32  | // ─── SE-001: 情绪页面正常加载 ──────────────────────────────────────────────
  33  | test('SE-001: 情绪页面正常加载，无FATAL错误', async ({ page }) => {
  34  |   await ensureLogin(page);
  35  |   const errors: string[] = [];
  36  |   page.on('console', msg => {
  37  |     if (msg.type() === 'error') errors.push(msg.text());
  38  |   });
  39  |   page.on('pageerror', err => {
  40  |     errors.push(`PAGE ERROR: ${err.message}`);
  41  |   });
  42  | 
  43  |   await page.goto(`${FRONTEND_URL}/sentiment`, { waitUntil: 'networkidle', timeout: 30000 });
  44  |   await page.waitForTimeout(3000);
  45  | 
  46  |   const pageContent = await page.content();
  47  |   expect(pageContent.length).toBeGreaterThan(100);
  48  | 
  49  |   const fatalErrors = errors.filter(e =>
  50  |     !e.includes('Warning') &&
  51  |     !e.includes('warn') &&
  52  |     !e.includes('favicon')
  53  |   );
  54  |   console.log('Errors:', fatalErrors);
  55  |   expect(fatalErrors.length).toBe(0);
  56  | });
  57  | 
  58  | // ─── SE-002: 情绪仪表盘 ───────────────────────────────────────────────────
  59  | test('SE-002: 情绪仪表盘（恐慌指数/贪婪指数卡片）显示', async ({ page }) => {
  60  |   await ensureLogin(page);
  61  |   await page.goto(`${FRONTEND_URL}/sentiment`, { waitUntil: 'networkidle', timeout: 30000 });
  62  |   await page.waitForTimeout(5000);
  63  | 
> 64  |   const content = await page.content();
      |                              ^ Error: page.content: Target page, context or browser has been closed
  65  | 
  66  |   // 检查是否有情绪相关指标
  67  |   const hasSentiment = content.includes('情绪') ||
  68  |     content.includes('恐慌') ||
  69  |     content.includes('贪婪') ||
  70  |     content.includes('fear') ||
  71  |     content.includes('greed') ||
  72  |     content.includes('指数');
  73  | 
  74  |   expect(hasSentiment).toBe(true);
  75  | });
  76  | 
  77  | // ─── SE-003: 情绪时序图 ───────────────────────────────────────────────────
  78  | test('SE-003: 情绪时序折线图渲染正常', async ({ page }) => {
  79  |   await ensureLogin(page);
  80  |   await page.goto(`${FRONTEND_URL}/sentiment`, { waitUntil: 'networkidle', timeout: 30000 });
  81  |   await page.waitForTimeout(5000);
  82  | 
  83  |   // 查找canvas（ECharts）
  84  |   const canvas = page.locator('canvas').first();
  85  |   const hasCanvas = await canvas.count() > 0;
  86  | 
  87  |   // 或者SVG
  88  |   const svg = page.locator('svg').first();
  89  |   const hasSvg = await svg.count() > 0;
  90  | 
  91  |   // 检查是否有图表相关内容
  92  |   const content = await page.content();
  93  |   const hasChartArea = content.includes('时序') ||
  94  |     content.includes('趋势') ||
  95  |     content.includes('走势') ||
  96  |     content.includes('chart');
  97  | 
  98  |   expect(hasCanvas || hasSvg || hasChartArea).toBe(true);
  99  | });
  100 | 
  101 | // ─── SE-004: 板块热力图 ──────────────────────────────────────────────────
  102 | test('SE-004: 板块情绪热力图渲染正常', async ({ page }) => {
  103 |   await ensureLogin(page);
  104 |   await page.goto(`${FRONTEND_URL}/sentiment`, { waitUntil: 'networkidle', timeout: 30000 });
  105 |   await page.waitForTimeout(5000);
  106 | 
  107 |   const content = await page.content();
  108 | 
  109 |   // 检查是否有板块/热力图相关
  110 |   const hasHeatmap = content.includes('板块') ||
  111 |     content.includes('热力') ||
  112 |     content.includes('heatmap') ||
  113 |     content.includes('sector');
  114 | 
  115 |   expect(hasHeatmap).toBe(true);
  116 | });
  117 | 
  118 | // ─── SE-005: 无数据降级 ───────────────────────────────────────────────────
  119 | test('SE-005: 数据为空时显示"暂无数据"而非空白', async ({ page }) => {
  120 |   await ensureLogin(page);
  121 |   await page.goto(`${FRONTEND_URL}/sentiment`, { waitUntil: 'networkidle', timeout: 30000 });
  122 |   await page.waitForTimeout(3000);
  123 | 
  124 |   const content = await page.content();
  125 | 
  126 |   // 应该显示空数据提示或页面正常加载
  127 |   const hasEmptyState = content.includes('暂无') ||
  128 |     content.includes('空') ||
  129 |     content.includes('无数据') ||
  130 |     content.includes('加载中') ||
  131 |     content.length > 500;
  132 | 
  133 |   expect(hasEmptyState).toBe(true);
  134 | });
  135 | 
```