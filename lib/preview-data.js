import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { DEMO } from './config.js';
import { seedDemo } from './demo.js';
import { adminClient, publicAffiliate } from './server.js';
import { previewAffiliate, PREVIEW_FALLBACK_PHOTO } from './preview.js';

// The active affiliate for a slug, with public fields only, or null when the slug is unknown, inactive or the lookup
// fails (the link still works; it just gets the plain Eyecon preview). Demo mode reads the seeded affiliates.
export async function loadPreviewAffiliate(slug) {
  try {
    if (DEMO) return previewAffiliate(seedDemo().affiliates.find(a => a.slug === slug && a.active));
    const { data } = await adminClient().from('affiliates').select('*').eq('slug', slug).eq('active', true).maybeSingle();
    return previewAffiliate(data && publicAffiliate(data));
  } catch (error) {
    console.error('Link preview: affiliate lookup failed:', error?.message);
    return null;
  }
}

async function photoBytes(photo) {
  if (photo.startsWith('/images/')) return readFile(join(process.cwd(), 'public', photo));
  const response = await fetch(photo, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error('photo ' + response.status);
  return Buffer.from(await response.arrayBuffer());
}

// The photo as a PNG data URI cropped to the given size. The image renderer cannot read WebP, and affiliates' photos
// may be WebP, so every photo is converted. A photo that cannot be read falls back to the shared placeholder.
export async function previewPhotoUri(photo, width, height) {
  for (const source of [photo, PREVIEW_FALLBACK_PHOTO]) {
    try {
      const png = await sharp(await photoBytes(source)).rotate().resize(width, height, { fit: 'cover', position: 'attention' }).png().toBuffer();
      return 'data:image/png;base64,' + png.toString('base64');
    } catch (error) {
      console.error('Link preview: photo unavailable:', error?.message);
    }
  }
  return null;
}
