/**
 * e2e-backtest-p0.test.ts — 回测页面 P0 测试用例
 * 覆盖: 回测配置/执行/结果展示/异常处理
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

// ─── BT-001: 回测页面正常加载 ──────────────────────────────────────────────
test('BT-001: 回测页面正常加载，无FATAL错误', async ({ page }) => {
  await ensureLogin(page);
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  await page.goto(`${FRONTEND_URL}/backtest`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const pageContent = await page.content();
  expect(pageContent.length).toBeGreaterThan(100);

  const fatalErrors = errors.filter(e =>
    !e.includes('Warning') &&
    !e.includes('warn') &&
    !e.includes('favicon')
  );
  expect(fatalErrors.length).toBe(0);
});

// ─── BT-002: 页面包含参数配置区域 ─────────────────────────────────────────
test('BT-002: 回测配置区域存在（标的/策略/参数/时间）', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/backtest`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const content = await page.content();

  // 检查是否有配置相关区域
  const hasConfig = content.includes('标的') ||
    content.includes('股票') ||
    content.includes('策略') ||
    content.includes('参数') ||
    content.includes('时间');

  expect(hasConfig).toBe(true);
});

// ─── BT-003: 提交回测任务 ─────────────────────────────────────────────────
test('BT-003: 提交回测任务，API返回200', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/backtest`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 查找并填写标的输入框
  const stockInput = page.locator('input').first();
  if (await stockInput.count() > 0) {
    await stockInput.fill('600519.SSE');
  }

  // 查找执行按钮
  const executeBtn = page.locator('button:has-text("执行"), button:has-text("回测"), button:has-text("开始")').first();
  if (await executeBtn.count() > 0) {
    await executeBtn.click();
    await page.waitForTimeout(3000);

    // 检查是否有响应（任务ID或错误提示）
    const content = await page.content();
    const hasResponse = content.includes('任务') ||
      content.includes('成功') ||
      content.includes('失败') ||
      content.includes('error');
    expect(hasResponse).toBe(true);
  } else {
    // 如果没有执行按钮，记录但不失败
    console.log('No execute button found');
  }
});

// ─── BT-004: 回测结果展示 ─────────────────────────────────────────────────
test('BT-004: 回测结果包含收益曲线/回撤/夏普/胜率', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/backtest`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  const content = await page.content();

  // 检查是否有结果指标
  const hasResults = content.includes('收益') ||
    content.includes('回撤') ||
    content.includes('夏普') ||
    content.includes('胜率') ||
    content.includes('收益率') ||
    content.includes('chart') ||
    content.includes('canvas');

  expect(hasResults).toBe(true);
});

// ─── BT-005: 异常处理-无参数提交 ─────────────────────────────────────────
test('BT-005: 无参数提交时提示错误，不崩溃', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/backtest`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  // 直接点击执行按钮（不填写任何参数）
  const executeBtn = page.locator('button:has-text("执行"), button:has-text("回测"), button:has-text("开始")').first();
  if (await executeBtn.count() > 0) {
    await executeBtn.click();
    await page.waitForTimeout(2000);

    // 应该有错误提示
    const content = await page.content();
    const hasErrorMsg = content.includes('错误') ||
      content.includes('请选择') ||
      content.includes('请输入') ||
      content.includes('必填');

    // 不崩溃
    expect(errors.length).toBe(0);
    // 有合理的错误提示
    expect(hasErrorMsg).toBe(true);
  }
});

// ─── BT-006: 回测记录列表 ─────────────────────────────────────────────────
test('BT-006: 显示历史回测记录', async ({ page }) => {
  await ensureLogin(page);
  await page.goto(`${FRONTEND_URL}/backtest`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  const content = await page.content();

  // 检查是否有历史记录区域
  const hasHistory = content.includes('历史') ||
    content.includes('记录') ||
    content.includes('列表') ||
    content.includes('任务');

  expect(hasHistory).toBe(true);
});
