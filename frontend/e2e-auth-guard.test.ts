/**
 * Auth Guard E2E Verification Tests
 * Tests: 1. Unauthenticated → /login redirect
 *        2. Login flow → token stored
 *        3. Token invalid → redirect
 *        4. Dashboard access after login
 */
import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:5180';
const API_BASE = 'http://192.168.2.105:8501';

test.describe('Auth Guard E2E', () => {

  test('1. Unauthenticated access /dashboard → redirect to /login', async ({ page }) => {
    // Clear any existing auth
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('auth_token'));

    // Navigate to protected page
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle' });
    
    // Wait for redirect to complete (URL contains /login)
    try {
      await page.waitForURL('**/login**', { timeout: 5000 });
      console.log('✅ Redirected to /login:', page.url());
    } catch {
      // If no redirect, check current URL
      console.log('Current URL:', page.url());
      console.log('Page content length:', (await page.textContent('body'))?.length);
    }

    const url = page.url();
    const redirected = url.includes('/login');
    console.log('Test 1 Result - Redirected:', redirected, '| URL:', url);
    expect(redirected).toBe(true);
  });

  test('2. Login page loads correctly', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const content = await page.textContent('body');
    console.log('Login page content length:', content?.length);
    
    // Check for login form elements
    const usernameInput = await page.locator('input[type="text"], input#username').count();
    const passwordInput = await page.locator('input[type="password"], input#password').count();
    const submitBtn = await page.locator('button[type="submit"]').count();
    
    console.log('Username inputs:', usernameInput);
    console.log('Password inputs:', passwordInput);
    console.log('Submit buttons:', submitBtn);
    
    expect(usernameInput + passwordInput).toBeGreaterThan(0);
  });

  test('3. Login → token stored in localStorage', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Fill login form
    const usernameInput = page.locator('input#username, input[type="text"]').first();
    const passwordInput = page.locator('input#password, input[type="password"]').first();
    
    await usernameInput.fill('admin');
    await passwordInput.fill('admin123');
    await page.locator('button[type="submit"]').click();
    
    // Wait for login to complete
    await page.waitForTimeout(4000);
    
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    console.log('Token stored:', token ? `${token.substring(0, 30)}...` : 'NULL');
    console.log('Current URL after login:', page.url());
    
    expect(token).toBeTruthy();
  });

  test('4. Authenticated /dashboard → no redirect', async ({ page }) => {
    // Login first
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.locator('input#username, input[type="text"]').first().fill('admin');
    await page.locator('input#password, input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
    
    // Now access dashboard
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const url = page.url();
    const onDashboard = url.includes('/dashboard');
    console.log('Test 4 - On dashboard:', onDashboard, '| URL:', url);
    expect(onDashboard).toBe(true);
  });

  test('5. Protected API → 200 with valid token', async ({ page }) => {
    // Login first
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.locator('input#username, input[type="text"]').first().fill('admin');
    await page.locator('input#password, input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
    
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    
    const res = await page.evaluate(async ({ tok, url }) => {
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${tok}` } });
      return { status: r.status };
    }, { tok: token, url: `${API_BASE}/api/position/positions` });
    
    console.log('Protected API status with token:', res.status);
    expect(res.status).toBe(200);
  });

  test('6. Protected API → 401 without token', async ({ page }) => {
    const res = await page.evaluate(async ({ url }) => {
      const r = await fetch(url);
      return { status: r.status };
    }, { url: `${API_BASE}/api/position/positions` });
    
    console.log('Protected API status without token:', res.status);
    expect(res.status).toBe(401);
  });

  test('7. Expired/invalid token → API 401', async ({ page }) => {
    // Set fake token
    await page.goto(FRONTEND_URL);
    await page.evaluate(() => localStorage.setItem('auth_token', 'invalid_fake_token_12345'));
    
    const res = await page.evaluate(async ({ url }) => {
      const r = await fetch(url, { headers: { 'Authorization': 'Bearer invalid_fake_token_12345' } });
      return { status: r.status };
    }, { url: `${API_BASE}/api/position/positions` });
    
    console.log('Invalid token API status:', res.status);
    expect(res.status).toBe(401);
  });

  test('8. Positions page accessible after login', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.locator('input#username, input[type="text"]').first().fill('admin');
    await page.locator('input#password, input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
    
    await page.goto(`${FRONTEND_URL}/positions`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const url = page.url();
    const onPositions = url.includes('/positions');
    const content = await page.textContent('body');
    console.log('Positions page URL:', url, '| Content length:', content?.length);
    expect(onPositions).toBe(true);
  });
});
