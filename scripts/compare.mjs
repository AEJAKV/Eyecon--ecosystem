// Side-by-side before/after images from two screenshot folders.
// Usage: node scripts/compare.mjs [before] [after] [output]   Saves into screenshots/compare/ unless an output folder is named.
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const [before = 'before', after = 'after', output = 'compare'] = process.argv.slice(2);
const root = path.resolve('screenshots'), out = path.join(root, path.basename(output));
await mkdir(out, { recursive: true });
const names = (await readdir(path.join(root, after))).filter(f => f.endsWith('.png'));
const afterOnly = new Set(names), shared = (await readdir(path.join(root, before))).filter(f => afterOnly.has(f));
const data = async file => 'data:image/png;base64,' + (await readFile(file)).toString('base64');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const name of shared) {
    const width = Number(name.match(/-(\d+)x\d+\.png$/)?.[1]) || 1440;
    await page.setViewportSize({ width: width * 2 + 72, height: 800 });
    await page.setContent(`<style>
      body { margin: 0; padding: 24px; background: #14181d; color: #f6f5f2; font: 500 15px/1 system-ui, sans-serif; display: flex; gap: 24px; align-items: flex-start; }
      figure { margin: 0; } figcaption { letter-spacing: .14em; text-transform: uppercase; margin-bottom: 14px; } img { display: block; width: ${width}px; }
    </style>
    <figure><figcaption>Before</figcaption><img src="${await data(path.join(root, before, name))}"></figure>
    <figure><figcaption>After</figcaption><img src="${await data(path.join(root, after, name))}"></figure>`, { waitUntil: 'load' });
    const file = path.join(out, name);
    await page.screenshot({ path: file, fullPage: true });
    console.log('Saved ' + path.relative(process.cwd(), file));
  }
} finally {
  await browser.close();
}
