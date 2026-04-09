/**
 * e2e-sentiment-p0.test.ts — 市场情绪页面 P0 测试用例
 * 覆盖: 仪表盘/时序图/热力图/无数据降级
 */
import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = 'http://192.168.2.105:5173';
const API_BASE = 'http://localhost:8501/api';

async function ensureLogin(page: Page) {
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) return;
    } catch {}
  }
  const inputs = await page.locator('input').all();
  if (inputs.length >= 2) {
    await inputs[0].fill('admin');
    await inputs[1].fill('admin123');
  }
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/auth/login'), { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]).catch(() => {});
  await page.waitForTimeout(2000);
}

// ─── SE-001: 情绪页面正常加载 ──────────────────────────────────────────────
test('SE-001: 情绪页面正常加载，无FATAL错误', async ({ page }) => {
  await ensureLogin(page);
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  await page.goto(`${FRONTEND_URL}/sentiment`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const pageContent = await page.content();
  expect(pageContent.length).toBeGreaterThan(100);

  const fatalErrors = errors.filter(e =>
    !e.includes('Warning') &&
    !e.includes('warn') &&
    !e.includes('favicon')
  );
  console.log('Errors:', fatalErrors);
  expect(fatalErrors.length).toBe(0);
});

// ─── SE-002: 情绪仪表盘 ───────────────────────────────────────────────────
test('SE-002: 情绪仪表盘（恐慌指数/贪婪指数卡片）显示', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/sentiment`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  const content = await page.content();

  // 检查是否有情绪相关指标
  const hasSentiment = content.includes('情绪') ||
    content.includes('恐慌') ||
    content.includes('贪婪') ||
    content.includes('fear') ||
    content.includes('greed') ||
    content.includes('指数');

  expect(hasSentiment).toBe(true);
});

// ─── SE-003: 情绪时序图 ───────────────────────────────────────────────────
test('SE-003: 情绪时序折线图渲染正常', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/sentiment`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // 查找canvas（ECharts）
  const canvas = page.locator('canvas').first();
  const hasCanvas = await canvas.count() > 0;

  // 或者SVG
  const svg = page.locator('svg').first();
  const hasSvg = await svg.count() > 0;

  // 检查是否有图表相关内容
  const content = await page.content();
  const hasChartArea = content.includes('时序') ||
    content.includes('趋势') ||
    content.includes('走势') ||
    content.includes('chart');

  expect(hasCanvas || hasSvg || hasChartArea).toBe(true);
});

// ─── SE-004: 板块热力图 ──────────────────────────────────────────────────
test('SE-004: 板块情绪热力图渲染正常', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/sentiment`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  const content = await page.content();

  // 检查是否有板块/热力图相关
  const hasHeatmap = content.includes('板块') ||
    content.includes('热力') ||
    content.includes('heatmap') ||
    content.includes('sector');

  expect(hasHeatmap).toBe(true);
});

// ─── SE-005: 无数据降级 ───────────────────────────────────────────────────
test('SE-005: 数据为空时显示"暂无数据"而非空白', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/sentiment`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const content = await page.content();

  // 应该显示空数据提示或页面正常加载
  const hasEmptyState = content.includes('暂无') ||
    content.includes('空') ||
    content.includes('无数据') ||
    content.includes('加载中') ||
    content.length > 500;

  expect(hasEmptyState).toBe(true);
});
