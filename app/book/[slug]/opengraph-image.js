import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadPreviewAffiliate, previewPhotoUri } from '@/lib/preview-data';
import { PREVIEW_SIZE, PREVIEW_GIFT_LINE } from '@/lib/preview';

export const alt = 'An introduction to Eyecon Optometry';
export const size = PREVIEW_SIZE;
export const contentType = 'image/png';

// The site's own colours (globals.css) and fonts (Bodoni Moda for the wordmark and name, Jost for the rest).
const INK = '#14181d', GOLD = '#b49a67', GOLD_LIGHT = '#e3d4b1', PAPER = '#f6f5f2';
const font = file => readFile(join(process.cwd(), 'assets', 'fonts', file));
const PHOTO_WIDTH = 500;

function Wordmark({ scale = 1 }) {
  const word = 44 * scale, mark = word * 0.77;
  return <div style={{ display: 'flex', alignItems: 'center', color: PAPER, fontFamily: 'Bodoni Moda', fontSize: word, letterSpacing: word * 0.32, lineHeight: 1 }}>
    <span>EYECON</span>
    <div style={{ display: 'flex', width: mark * 1.5, height: mark, marginLeft: word * 0.38, border: `${Math.max(2, Math.round(scale * 2.5))}px solid ${GOLD}` }} />
  </div>;
}

export default async function Image({ params }) {
  const { slug } = await params;
  const [affiliate, bodoni, jost, jostMedium] = await Promise.all([loadPreviewAffiliate(slug), font('bodoni-moda-latin-400-normal.woff'), font('jost-latin-400-normal.woff'), font('jost-latin-500-normal.woff')]);
  const photo = affiliate ? await previewPhotoUri(affiliate.photo, PHOTO_WIDTH, size.height) : null;
  const fonts = [{ name: 'Bodoni Moda', data: bodoni, weight: 400, style: 'normal' }, { name: 'Jost', data: jost, weight: 400, style: 'normal' }, { name: 'Jost', data: jostMedium, weight: 500, style: 'normal' }];
  const root = { display: 'flex', width: '100%', height: '100%', background: INK, color: PAPER, fontFamily: 'Jost' };

  // An unknown or switched-off link, or one whose photo cannot be read at all, gets the plain Eyecon card.
  if (!affiliate || !photo) {
    return new ImageResponse(<div style={{ ...root, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Wordmark scale={1.6} />
      <div style={{ display: 'flex', marginTop: 28, color: GOLD_LIGHT, fontSize: 24, letterSpacing: 11, textTransform: 'uppercase' }}>Optometry</div>
    </div>, { ...size, fonts });
  }

  const long = affiliate.name.length > 22;
  return new ImageResponse(<div style={root}>
    <img src={photo} width={PHOTO_WIDTH} height={size.height} style={{ width: PHOTO_WIDTH, height: size.height, objectFit: 'cover' }} />
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '64px 64px 64px 72px' }}>
      <Wordmark />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', color: GOLD_LIGHT, fontSize: 22, letterSpacing: 6, textTransform: 'uppercase', marginBottom: 22 }}>Introduced by</div>
        <div style={{ display: 'flex', fontFamily: 'Bodoni Moda', fontSize: long ? 52 : 68, lineHeight: 1.1 }}>{affiliate.name}</div>
        <div style={{ display: 'flex', width: 72, height: 2, background: GOLD, margin: '34px 0' }} />
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 500, lineHeight: 1.3, color: GOLD_LIGHT }}>{PREVIEW_GIFT_LINE}</div>
      </div>
    </div>
  </div>, { ...size, fonts });
}
