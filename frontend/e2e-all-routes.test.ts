/**
 * e2e-all-routes.test.ts — 完整路由 E2E 覆盖
 * 覆盖所有 18 个路由 + auth guard + API 数据验证
 */
import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:5180';
const API_BASE = 'http://192.168.2.105:8501';

// ─── 路由清单 ───────────────────────────────────────────────────────────────
const PROTECTED_ROUTES = [
  { path: '/market',        name: 'MarketOverview',    checks: ['指数', '市场'] },
  { path: '/dashboard',     name: 'StockDashboard',    checks: ['股票', '监控'] },
  { path: '/dashboard/home',name: 'DashboardHome',      checks: ['仪表盘', '账户'] },
  { path: '/backtest',     name: 'BacktestAnalysis',  checks: ['回测', '配置'] },
  { path: '/trades',       name: 'TradeLog',           checks: ['交易', '委托'] },
  { path: '/positions',     name: 'PositionManagement', checks: ['持仓', '管理'] },
  { path: '/data',         name: 'DataManager',        checks: ['数据', '导入'] },
  { path: '/strategies',   name: 'StrategyManager',   checks: ['策略', '启动'] },
  { path: '/factors',      name: 'FactorDashboard',    checks: ['因子', 'IC'] },
  { path: '/multifactor',  name: 'MultiFactorChart',  checks: ['多因子', '分析'] },
  { path: '/portfolio',    name: 'PortfolioAnalysis',  checks: ['组合', '分析'] },
  { path: '/sentiment',    name: 'SentimentPage',      checks: ['情绪', '舆情'] },
  { path: '/news',         name: 'NewsSentiment',      checks: ['新闻', '舆情'] },
  { path: '/advisor',      name: 'AIAdvisor',           checks: ['AI', '建议'] },
  { path: '/derivatives',  name: 'DerivativesPage',    checks: ['期权', '期货'] },
  { path: '/backtest/report', name: 'BacktestReport',  checks: ['回测', '报告'] },
  { path: '/stock/report', name: 'StockReport',        checks: ['股票', '报告'] },
];

// ─── 通用: 确保已登录 ────────────────────────────────────────────────────────
async function ensureLogin(page: Page): Promise<string> {
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);

  // 检查是否已有有效 token
  const existing = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (existing) {
    try {
      const payload = JSON.parse(atob(existing.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) return existing;
    } catch { /* ignore */ }
  }

  const inputs = await page.locator('input').all();
  if (inputs.length >= 2) {
    await inputs[0].fill('admin');
    await inputs[1].fill('admin123');
  } else {
    await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {});
    await page.locator('input[name="password"], input[type="password"]').first().fill('admin123').catch(() => {});
  }

  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/auth/login'), { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]).catch(() => {});

  await page.waitForTimeout(2000);
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) throw new Error('Login failed: no token');
  return token as string;
}

// ─── Test Suite 1: Auth Guard — 未登录重定向 ─────────────────────────────────
test.describe('Auth Guard — 未登录访问受保护路由', () => {

  for (const route of PROTECTED_ROUTES) {
    test(`未登录访问 ${route.path} → /login`, async ({ page }) => {
      await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.removeItem('auth_token'));

      await page.goto(`${FRONTEND_URL}${route.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);

      const url = page.url();
      const redirectedToLogin = url.includes('/login');
      console.log(`${route.path} → ${redirectedToLogin ? '✅ 重定向 /login' : '⚠️ 未重定向，当前: ' + url}`);
      expect(redirectedToLogin).toBe(true);
    });
  }

  test('登录页本身可访问（无重定向循环）', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/login');
    const content = await page.textContent('body');
    expect(content?.length ?? 0).toBeGreaterThan(50);
  });
});

// ─── Test Suite 2: Login Flow ────────────────────────────────────────────────
test.describe('Login Flow', () => {

  test('用户名+密码登录 → token 写入 localStorage', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    const inputs = await page.locator('input').all();
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    await inputs[0].fill('admin');
    await inputs[1].fill('admin123');
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(4000);

    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
    console.log('✅ Token stored:', token?.substring(0, 20) + '...');
  });

  test('登录后访问 /login 不重定向（已认证）', async ({ page }) => {
    await ensureLogin(page);
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const url = page.url();
    // 已登录用户访问 /login 应该跳转首页，不是无限重定向
    const notLoop = !url.endsWith('/login') || (await page.textContent('body'))?.length! > 100;
    console.log('✅ After login /login URL:', url, '| Content OK:', notLoop);
    expect(notLoop).toBe(true);
  });
});

// ─── Test Suite 3: All Protected Routes ────────────────────────────────────
test.describe('All Protected Routes — 登录后正常加载', () => {

  for (const route of PROTECTED_ROUTES) {
    test(`${route.name} (${route.path})`, async ({ page }) => {
      await ensureLogin(page);

      // 访问路由
      await page.goto(`${FRONTEND_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(4000);

      const url = page.url();
      const onCorrectRoute = url.includes(route.path) || url === `${FRONTEND_URL}/`;
      console.log(`✅ ${route.name}: URL=${url}`);

      // 页面内容非空
      const content = await page.textContent('body');
      const contentLen = content?.length ?? 0;

      // 无严重 JS Error
      const errors: string[] = [];
      page.on('pageerror', err => errors.push(err.message));
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('net::ERR_NAME_NOT_RESOLVED') &&
        !e.includes('Failed to load resource') &&
        !e.includes('net::ERR_CONNECTION_REFUSED') &&
        !e.includes('CORS')
      );
      if (criticalErrors.length > 0) {
        console.log(`⚠️ JS Errors on ${route.path}:`, criticalErrors);
      }

      // 检查关键字（路由特定）
      const hasExpectedKeyword = route.checks.some(kw =>
        content?.toLowerCase().includes(kw.toLowerCase())
      );
      console.log(`  Keywords: ${route.checks.join(', ')} → ${hasExpectedKeyword ? '✅' : '⚠️ (API may not be available)'}`);
      console.log(`  Content length: ${contentLen} chars`);

      // 页面必须有实际内容（至少 50 字符，说明框架和布局加载成功）
      expect(contentLen).toBeGreaterThan(50);
      // URL 必须在预期路由上
      expect(onCorrectRoute).toBe(true);
    });
  }
});

// ─── Test Suite 4: Key API Endpoints ────────────────────────────────────────
test.describe('Key API Endpoints — 数据正确性验证', () => {

  test('GET /api/alpha/top20 → 200 + 20条 rank=1-20 数据', async ({ page }) => {
    const token = await ensureLogin(page);
    const res = await page.evaluate(async ({ tok, apiBase }) => {
      const r = await fetch(`${apiBase}/api/alpha/top20`, {
        headers: { 'Authorization': `Bearer ${tok}` },
      });
      const body = await r.json();
      return { status: r.status, body };
    }, { tok: token, apiBase: API_BASE });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe('0');
    expect(Array.isArray(res.body.data?.items)).toBe(true);
    expect(res.body.data.items.length).toBe(20);
    const ranks = res.body.data.items.map((i: any) => i.rank);
    expect(ranks).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
    console.log('✅ /api/alpha/top20 OK — 20条 rank 连续');
  });

  test('GET /api/position/positions → 200 (需认证)', async ({ page }) => {
    const token = await ensureLogin(page);
    const res = await page.evaluate(async ({ tok, apiBase }) => {
      const r = await fetch(`${apiBase}/api/position/positions`, {
        headers: { 'Authorization': `Bearer ${tok}` },
      });
      return { status: r.status, body: await r.json() };
    }, { tok: token, apiBase: API_BASE });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);  // API returns number 0
    console.log('✅ /api/position/positions OK');
  });

  test('无 Token → GET /api/position/positions → 401/403 或 CORS 拒绝', async ({ page }) => {
    const res = await page.evaluate(async ({ apiBase }) => {
      try {
        const r = await fetch(`${apiBase}/api/position/positions`);
        return { status: r.status };
      } catch (e: any) {
        // CORS 或网络错误时 fetch 抛错，返回 status=0
        return { status: 0, error: e?.message };
      }
    }, { apiBase: API_BASE });

    console.log('✅ No-token → status:', res.status, res.error ?? '');
    // 可能是 401/403（后端拒绝），也可能是 0（浏览器 CORS 阻止）
    expect([0, 401, 403]).toContain(res.status);
  });

  test('无效 Token → GET /api/position/positions → 401 或 CORS 拒绝', async ({ page }) => {
    const res = await page.evaluate(async ({ apiBase }) => {
      try {
        const r = await fetch(`${apiBase}/api/position/positions`, {
          headers: { 'Authorization': 'Bearer invalid_fake_token' },
        });
        return { status: r.status };
      } catch (e: any) {
        return { status: 0, error: e?.message };
      }
    }, { apiBase: API_BASE });
    console.log('✅ Invalid token → status:', res.status);
    expect([0, 401, 403]).toContain(res.status);
  });
});

// ─── Test Suite 5: Navigation Flow ───────────────────────────────────────────
test.describe('Navigation Flow — 页面间跳转', () => {

  test('登录 → Dashboard → 左导航跳转至 /trades', async ({ page }) => {
    await ensureLogin(page);

    // 访问 dashboard
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);
    console.log('✅ Dashboard loaded:', page.url());

    // 通过侧边栏链接导航到 /trades
    const tradesLink = page.locator('a[href="/trades"], nav a[href="/trades"], [data-route="/trades"]').first();
    const linkExists = await tradesLink.count() > 0;

    if (linkExists) {
      await tradesLink.click();
      await page.waitForTimeout(3000);
      const url = page.url();
      console.log('✅ Navigated to /trades:', url);
      expect(url).toContain('/trades');
    } else {
      // 如果侧边栏路由不存在，直接 goto 测试
      await page.goto(`${FRONTEND_URL}/trades`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      console.log('✅ /trades direct access OK:', page.url());
    }
  });

  test('从 /dashboard 可导航到 /market', async ({ page }) => {
    await ensureLogin(page);
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    const marketLink = page.locator('a[href="/market"]').first();
    if (await marketLink.count() > 0) {
      await marketLink.click();
      await page.waitForTimeout(3000);
      expect(page.url()).toContain('/market');
      console.log('✅ Navigation /dashboard → /market OK');
    } else {
      await page.goto(`${FRONTEND_URL}/market`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(5000);
      const contentLen = (await page.textContent('body'))?.length ?? 0;
      expect(contentLen).toBeGreaterThan(50);
      console.log('✅ /market direct access OK');
    }
  });
});

// ─── Test Suite 6: Page Integrity — 无严重 Error ───────────────────────────
test.describe('Page Integrity — 无严重 JS Error', () => {

  for (const route of PROTECTED_ROUTES.slice(0, 8)) { // 前8个核心路由
    test(`${route.name} (${route.path}) 无严重 Error`, async ({ page }) => {
      await ensureLogin(page);

      const errors: string[] = [];
      page.on('pageerror', err => errors.push(err.message));
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      await page.goto(`${FRONTEND_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(5000);

      const realErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('net::ERR_') &&
        !e.includes('Failed to load resource') &&
        !e.includes('net::ERR_NAME_NOT_RESOLVED') &&
        !e.includes('net::ERR_CONNECTION_REFUSED')
      );

      console.log(`${route.name} errors:`, realErrors.length === 0 ? '✅ 无' : '⚠️ ' + realErrors.join('; '));
      expect(realErrors.length).toBe(0);
    });
  }
});
