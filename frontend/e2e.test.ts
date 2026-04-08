import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:5180';
const API_BASE = 'http://192.168.2.105:8501';

test.describe('Auth Flow E2E', () => {
  
  test('Access protected page → redirect to login', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    const url = page.url();
    console.log('Current URL after accessing /dashboard:', url);
    // If auth guard works, should redirect to /login
    const redirected = url.includes('/login');
    console.log('Redirected to login:', redirected);
    // Even if not redirected, check if page loaded properly
    const content = await page.textContent('body');
    console.log('Page content length:', content?.length);
    expect(redirected).toBe(true);
  });

  test('Login page loads', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const url = page.url();
    console.log('Login page URL:', url);
    const content = await page.textContent('body');
    console.log('Login page content length:', content?.length);
    expect(content?.length).toBeGreaterThan(50);
  });

  test('Login → token stored in localStorage', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const inputs = await page.locator('input').all();
    console.log('Found inputs:', inputs.length);
    
    if (inputs.length >= 2) {
      await inputs[0].fill('admin');
      await inputs[1].fill('admin123');
    } else {
      // Try alternative selectors
      await page.locator('input[name="username"], input[type="text"]').first().fill('admin').catch(() => {});
      await page.locator('input[name="password"], input[type="password"]').first().fill('admin123').catch(() => {});
    }
    
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    console.log('Token after login:', token ? token.substring(0, 30) + '...' : 'NULL');
    expect(token).toBeTruthy();
  });

  test('Protected API → 200 with valid token', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const inputs = await page.locator('input').all();
    if (inputs.length >= 2) {
      await inputs[0].fill('admin');
      await inputs[1].fill('admin123');
    }
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    
    const res = await page.evaluate(async ({ tok, url }) => {
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${tok}` } });
      return { status: r.status, data: await r.json() };
    }, { tok: token, url: `${API_BASE}/api/position/positions` });
    
    console.log('API Response:', res.status, JSON.stringify(res.data).substring(0, 100));
    expect(res.status).toBe(200);
  });

  test('Dashboard page loads after login', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const inputs = await page.locator('input').all();
    if (inputs.length >= 2) {
      await inputs[0].fill('admin');
      await inputs[1].fill('admin123');
    }
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    const content = await page.textContent('body');
    console.log('Dashboard content length:', content?.length, '| URL:', page.url());
    expect(content?.length).toBeGreaterThan(100);
  });

  test('Positions page loads after login', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const inputs = await page.locator('input').all();
    if (inputs.length >= 2) {
      await inputs[0].fill('admin');
      await inputs[1].fill('admin123');
    }
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    
    await page.goto(`${FRONTEND_URL}/positions`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    const content = await page.textContent('body');
    console.log('Positions content length:', content?.length, '| URL:', page.url());
    expect(content?.length).toBeGreaterThan(100);
  });
});
