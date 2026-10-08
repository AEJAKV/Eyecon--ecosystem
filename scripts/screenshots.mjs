// Full-page screenshots of the public pages, for before/after comparisons.
// Usage: node scripts/screenshots.mjs <folder>     e.g. node scripts/screenshots.mjs before
// Saves into screenshots/<folder>/. The dev server must be running; set BASE_URL if it is not on port 3000.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const folder = process.argv[2];
if (!folder) { console.error('Give a folder name, for example: node scripts/screenshots.mjs before'); process.exit(1); }

const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const pages = [['home', '/'], ['book-alex-morgan', '/book/alex-morgan']];
// The wide size is an extra check of the home page only.
const sizes = [['desktop', 1440, 900], ['mobile', 390, 844], ['wide', 1920, 1080]];
const out = path.resolve('screenshots', path.basename(folder));
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
try {
  for (const [size, width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: size === 'mobile', hasTouch: size === 'mobile' });
    for (const [name, route] of size === 'wide' ? pages.slice(0, 1) : pages) {
      const page = await context.newPage();
      const response = await page.goto(base + route, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`${route} returned ${response?.status()}`);
      await page.waitForSelector('.hero');
      await page.evaluate(() => document.fonts.ready);
      // Scroll through the page so lazy images load, then let the entrance animations finish.
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } window.scrollTo(0, 0); });
      // Hide what floats over the page (mobile booking bar, Next.js dev badge) so nothing covers the content in a full-page capture.
      await page.addStyleTag({ content: '.mobile-book, nextjs-portal { display: none !important; }' });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2200);
      const file = path.join(out, `${name}-${size}-${width}x${height}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log('Saved ' + path.relative(process.cwd(), file));
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}
