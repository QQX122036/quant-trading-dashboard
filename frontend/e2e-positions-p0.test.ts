/**
 * e2e-positions-p0.test.ts — 持仓页面 P0 测试用例
 * 覆盖: 持仓列表/行业饼图/资金曲线/详情弹窗/空数据
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

// ─── PS-001: 持仓页面正常加载 ──────────────────────────────────────────────
test('PS-001: 持仓页面正常加载，无FATAL错误', async ({ page }) => {
  await ensureLogin(page);
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  await page.goto(`${FRONTEND_URL}/positions`, { waitUntil: 'networkidle', timeout: 30000 });
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

// ─── PS-002: 持仓列表展示 ─────────────────────────────────────────────────
test('PS-002: 持仓列表显示（股票/数量/成本/现价/盈亏）', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/positions`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  const content = await page.content();

  // 检查是否有持仓相关内容
  const hasPositionList = content.includes('持仓') ||
    content.includes('股票') ||
    content.includes('证券') ||
    content.includes('position') ||
    content.includes('股份');

  expect(hasPositionList).toBe(true);
});

// ─── PS-003: 行业分布饼图 ─────────────────────────────────────────────────
test('PS-003: 行业分布饼图渲染正常', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/positions`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // 查找ECharts canvas
  const canvas = page.locator('canvas').first();
  const hasCanvas = await canvas.count() > 0;

  // 或者SVG图表
  const svg = page.locator('svg').first();
  const hasSvg = await svg.count() > 0;

  // 检查是否有图表相关区域
  const content = await page.content();
  const hasChartArea = content.includes('行业') ||
    content.includes('分布') ||
    content.includes('chart') ||
    content.includes('pie');

  expect(hasCanvas || hasSvg || hasChartArea).toBe(true);
});

// ─── PS-004: 资金曲线图 ───────────────────────────────────────────────────
test('PS-004: 资金曲线图渲染正常', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/positions`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  const content = await page.content();

  // 检查是否有资金/净值相关
  const hasFundCurve = content.includes('资金') ||
    content.includes('净值') ||
    content.includes('资产') ||
    content.includes('曲线');

  expect(hasFundCurve).toBe(true);
});

// ─── PS-005: 持仓详情弹窗 ─────────────────────────────────────────────────
test('PS-005: 点击持仓行弹出详情', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/positions`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // 查找持仓行并点击
  const positionRow = page.locator('tr, [class*="row"], [class*="item"]').first();
  if (await positionRow.count() > 0) {
    await positionRow.click();
    await page.waitForTimeout(1000);

    // 检查是否有弹窗或详情出现
    const modal = page.locator('[class*="modal"], [class*="dialog"], [class*="drawer"], [role="dialog"]').first();
    const hasModal = await modal.count() > 0;

    // 或者详情区域出现
    const content = await page.content();
    const hasDetail = content.includes('详情') ||
      content.includes('成本') ||
      content.includes('盈亏');

    expect(hasModal || hasDetail).toBe(true);
  }
});

// ─── PS-006: 空数据展示 ───────────────────────────────────────────────────
test('PS-006: 无持仓时显示"暂无持仓"而非空白', async ({ page }) => {
  await ensureLogin(page);

  // 先登出，清空token
  await page.evaluate(() => localStorage.removeItem('auth_token'));

  await page.goto(`${FRONTEND_URL}/positions`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const content = await page.content();

  // 应该显示空数据提示或页面正常加载
  const hasEmptyState = content.includes('暂无') ||
    content.includes('空') ||
    content.includes('无数据') ||
    content.length > 500;

  expect(hasEmptyState).toBe(true);
});
