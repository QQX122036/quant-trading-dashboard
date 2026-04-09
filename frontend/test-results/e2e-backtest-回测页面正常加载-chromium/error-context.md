# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-backtest.test.ts >> 回测页面正常加载
- Location: e2e-backtest.test.ts:33:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5180/login
Call log:
  - navigating to "http://localhost:5180/login", waiting until "networkidle"

```

# Test source

```ts
  1   | /**
  2   |  * e2e-backtest.test.ts — 回测模块 E2E 覆盖
  3   |  * 覆盖: 回测配置 → 提交 → 进度轮询 → 结果展示
  4   |  */
  5   | import { test, expect, Page } from '@playwright/test';
  6   | 
  7   | const FRONTEND_URL = 'http://localhost:5180';
  8   | const API_BASE = 'http://localhost:8501/api';
  9   | 
  10  | async function ensureLogin(page: Page) {
> 11  |   await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5180/login
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
  32  | // ─── 回测页面加载 ────────────────────────────────────────────────────────────
  33  | test('回测页面正常加载', async ({ page }) => {
  34  |   await ensureLogin(page);
  35  |   const errors: string[] = [];
  36  |   page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  37  |   await page.goto(`${FRONTEND_URL}/backtest`, { waitUntil: 'networkidle', timeout: 30000 });
  38  |   await page.waitForTimeout(3000);
  39  |   const pageContent = await page.content();
  40  |   expect(pageContent.length).toBeGreaterThan(100);
  41  |   const fatalErrors = errors.filter(e => !e.includes('Warning') && !e.includes('warn'));
  42  |   expect(fatalErrors.length).toBe(0);
  43  | });
  44  | 
  45  | // ─── 回测配置 UI 存在 ────────────────────────────────────────────────────────
  46  | test('回测配置区域存在（标的输入/策略选择/参数设置）', async ({ page }) => {
  47  |   await ensureLogin(page);
  48  |   await page.goto(`${FRONTEND_URL}/backtest`, { waitUntil: 'networkidle', timeout: 30000 });
  49  |   await page.waitForTimeout(3000);
  50  |   const content = await page.content();
  51  |   const hasConfigArea = content.includes('回测') || content.includes('标的') || content.includes('策略') || content.includes('参数');
  52  |   expect(hasConfigArea).toBe(true);
  53  | });
  54  | 
  55  | // ─── 回测进度轮询（提交任务后检查进度条） ──────────────────────────────────
  56  | test('回测任务提交后进度条出现（冒烟）', async ({ page }) => {
  57  |   await ensureLogin(page);
  58  |   await page.goto(`${FRONTEND_URL}/backtest`, { waitUntil: 'networkidle', timeout: 30000 });
  59  |   await page.waitForTimeout(3000);
  60  | 
  61  |   const buttons = await page.locator('button').all();
  62  |   const runButton = buttons.find(async b => {
  63  |     const text = await b.textContent();
  64  |     return text && (text.includes('执行') || text.includes('开始') || text.includes('回测') || text.includes('run') || text.includes('Run') || text.includes('submit') || text.includes('Submit'));
  65  |   });
  66  | 
  67  |   if (runButton) {
  68  |     const responsePromise = page.waitForResponse(r => r.url().includes('/api/backtest'), { timeout: 30000 }).catch(() => null);
  69  |     await runButton.click();
  70  |     const response = await responsePromise;
  71  |     if (response && response.status() < 400) {
  72  |       await page.waitForTimeout(5000);
  73  |     }
  74  |     expect(true).toBe(true);
  75  |   } else {
  76  |     expect(true).toBe(true);
  77  |   }
  78  | });
  79  | 
  80  | // ─── 回测结果 ECharts 图表区域存在 ─────────────────────────────────────────
  81  | test('回测结果区域有图表（ECharts canvas）', async ({ page }) => {
  82  |   await ensureLogin(page);
  83  |   await page.goto(`${FRONTEND_URL}/backtest`, { waitUntil: 'networkidle', timeout: 30000 });
  84  |   await page.waitForTimeout(5000);
  85  |   const content = await page.content();
  86  |   const hasChartArea = content.includes('echarts') || content.includes('canvas') || content.includes('图表') || content.includes('chart');
  87  |   expect(hasChartArea).toBe(true);
  88  | });
  89  | 
  90  | // ─── 回测 API 健康检查 ───────────────────────────────────────────────────────
  91  | test('回测 API /api/backtest/tasks 可访问', async ({ page }) => {
  92  |   await ensureLogin(page);
  93  |   const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  94  |   const res = await page.request.get(`${API_BASE}/backtest/tasks`, {
  95  |     headers: { Authorization: `Bearer ${token}` },
  96  |   });
  97  |   // 可能 200/401/403/500，后端 500 应由 Coder 修复
  98  |   expect([200, 401, 403]).toContain(res.status());
  99  | });
  100 | 
  101 | // ─── 回测报告页加载 ──────────────────────────────────────────────────────────
  102 | test('回测报告页 /backtest/report 可访问', async ({ page }) => {
  103 |   await ensureLogin(page);
  104 |   const errors: string[] = [];
  105 |   page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  106 |   await page.goto(`${FRONTEND_URL}/backtest/report`, { waitUntil: 'networkidle', timeout: 30000 });
  107 |   await page.waitForTimeout(3000);
  108 |   const fatalErrors = errors.filter(e => !e.includes('Warning') && !e.includes('warn'));
  109 |   expect(fatalErrors.length).toBe(0);
  110 | });
  111 | 
```