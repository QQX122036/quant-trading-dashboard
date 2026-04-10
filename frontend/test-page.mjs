import { chromium } from 'playwright';

const browser = await chromium.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
const errors = [];
const logs = [];

page.on('console', msg => {
  if (msg.type() === 'error') {
    errors.push(msg.text());
  }
});

page.on('pageerror', err => {
  errors.push(`PAGE ERROR: ${err.message}`);
});

try {
  await page.goto('http://192.168.2.105:8501/', { 
    waitUntil: 'networkidle',
    timeout: 15000 
  });
  
  await page.waitForTimeout(3000);
  
  console.log('=== CONSOLE ERRORS ===');
  if (errors.length === 0) {
    console.log('No errors!');
  } else {
    errors.forEach(e => console.log(e));
  }
  
  console.log('\n=== PAGE TITLE ===');
  console.log(await page.title());
  
  console.log('\n=== BODY TEXT (first 500 chars) ===');
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log(bodyText.substring(0, 500));
  
} catch (e) {
  console.log('Navigation error:', e.message);
}

await browser.close();
