// One-off: converts the Shop Frames banner, hero and brand photographs to WebP.
// Crops each source to its exact ratio, then resizes without upscaling.
// Usage: node scripts/convert-shop-images.mjs [srcRoot]  (originals live in the git-ignored design-assets/)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const src = process.argv[2] || 'design-assets/originals';
const banners = path.join(src, 'shop frames banners');
const brands = path.join(src, 'brands');

const jobs = [
  { in: path.join(banners, 'shop-frames-hero-desktop.png'), out: 'public/images/shop/hero-desktop.webp', w: 2400, rw: 16, rh: 9 },
  { in: path.join(banners, 'shop-frames-hero-mobile.png'), out: 'public/images/shop/hero-mobile.webp', w: 1080, rw: 4, rh: 5 },
  ...['cartier', 'chrome-hearts', 'tom-ford', 'maybach', 'dior', 'tiffany-and-co'].map((slug) => ({
    in: path.join(banners, `${slug}-desktop-banner.png`), out: `public/images/shop/banners/${slug}-desktop.webp`, w: 2400, rw: 16, rh: 9,
  })),
  ...['bottega-veneta', 'celine', 'versace', 'prada', 'tiffany-and-co', 'dior', 'oakley', 'ray-ban'].map((slug) => ({
    in: path.join(brands, `${slug}.png`), out: `public/images/brands/${slug}.webp`, w: 1122, h: 1402, rw: 4, rh: 5,
  })),
];

// Per-file crop position overrides, filled in after checking the output.
// The 16:9 sources only lose a few rows, so keep their top edge: the hero's
// right-hand head already touches it in the source.
const positions = Object.fromEntries(
  ['hero-desktop', 'cartier-desktop', 'chrome-hearts-desktop', 'tom-ford-desktop', 'maybach-desktop', 'dior-desktop', 'tiffany-and-co-desktop']
    .map((name) => [`${name}.webp`, 'top']),
);

for (const job of jobs) {
  const { width, height } = await sharp(job.in).metadata();
  // Largest box of the target ratio that fits the source, on a whole-unit grid.
  const unit = Math.min(Math.floor(width / job.rw), Math.floor(height / job.rh));
  let cropW = unit * job.rw;
  let cropH = unit * job.rh;
  // The brand portraits have a fixed size that matches their source.
  if (job.h && job.w <= width && job.h <= height) { cropW = job.w; cropH = job.h; }
  const outW = Math.min(job.w, cropW);
  const outH = job.h && outW === job.w ? job.h : Math.round((outW * cropH) / cropW);
  const position = positions[path.basename(job.out)] || 'attention';
  const cropped = await sharp(job.in).resize(cropW, cropH, { fit: 'cover', position }).toBuffer();
  mkdirSync(path.dirname(job.out), { recursive: true });
  const info = await sharp(cropped).resize(outW, outH, { withoutEnlargement: true }).webp({ quality: 82 }).toFile(job.out);
  console.log(`${job.out} ${info.width}x${info.height} ${Math.round(info.size / 1024)}KB (${position})`);
}
