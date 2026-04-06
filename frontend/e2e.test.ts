import { test, expect } from '@playwright/test';
const BASE_URL = 'http://localhost:8501';

// === API Tests ===

test('JWT login flow', async ({ page }) => {
  // Note: backend expects query params, not JSON body
  const response = await page.request.post(`${BASE_URL}/api/auth/login?username=admin&password=admin123`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.access_token).toBeDefined();
  const tokenParts = body.access_token.split('.');
  expect(tokenParts.length).toBe(3);
  expect(body.user_id).toBeDefined();
});

test('API health check', async ({ page }) => {
  const response = await page.request.get(`${BASE_URL}/api/health`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBeDefined();
});

test('API daily-bar returns market data', async ({ page }) => {
  const response = await page.request.get(`${BASE_URL}/api/data/daily-bar?ts_code=600519.SH&start=2026-01-01&end=2026-04-05`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  // Response format: {code:0, data:[...]} not {bars:[...]}
  expect(body.data).toBeDefined();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data.length).toBeGreaterThan(0);
  expect(body.data[0]).toHaveProperty('ts_code');
  expect(body.data[0]).toHaveProperty('trade_date');
  expect(body.data[0]).toHaveProperty('close');
});

test('API positions endpoint (correct path: /api/position/positions)', async ({ page }) => {
  const response = await page.request.get(`${BASE_URL}/api/position/positions`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.positions).toBeDefined();
});

test('Frontend HTML served at root', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/`);
  expect(response?.status()).toBe(200);
  const content = await page.content();
  expect(content).toContain('VeighNa Web');
  expect(content).toContain('index-hMf8P10i.js');
});

test('Frontend /kline route serves HTML', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/kline`);
  expect(response?.status()).toBe(200);
});

test('Frontend /backtest route serves HTML', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/backtest`);
  expect(response?.status()).toBe(200);
});
