import 'server-only';
import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { formatDate } from './config.js';

// The gift card as a PNG made on the server: the same card the website's "Download card" draws (QR code, number,
// validity), for the gift card email (shown in the email and attached) and its hosted image (/api/gift/image).
const INK = '#14181d', GOLD = '#b49a67', GOLD_TEXT = '#7a6230', CREAM = '#f6f1e4', MUTED = '#5b6067';
const font = file => readFile(join(process.cwd(), 'assets', 'fonts', file));
export const GIFT_IMAGE = { width: 720, height: 1000 };

export async function giftCardImage({ number, url, expiresAt }) {
  const [bodoni, jost, jostMedium, qr] = await Promise.all([font('bodoni-moda-latin-400-normal.woff'), font('jost-latin-400-normal.woff'), font('jost-latin-500-normal.woff'),
    QRCode.toDataURL(url, { width: 480, margin: 1, errorCorrectionLevel: 'M', color: { dark: INK, light: '#ffffff' } })]);
  const until = expiresAt ? 'Valid until ' + formatDate(expiresAt, { dateStyle: 'long', timeStyle: undefined }) : '';
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: CREAM, padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', border: `2px solid ${GOLD}`, paddingTop: 56, fontFamily: 'Jost' }}>
        <div style={{ display: 'flex', color: GOLD_TEXT, fontSize: 22, fontWeight: 500, letterSpacing: 4 }}>EYECON OPTOMETRY</div>
        <div style={{ display: 'flex', color: INK, fontFamily: 'Bodoni Moda', fontSize: 64, marginTop: 18 }}>$50 gift card</div>
        <div style={{ display: 'flex', background: '#ffffff', padding: 10, marginTop: 30 }}><img src={qr} width={480} height={480} alt="" /></div>
        <div style={{ display: 'flex', color: GOLD_TEXT, fontSize: 40, fontWeight: 500, letterSpacing: 6, marginTop: 34 }}>{number}</div>
        {until && <div style={{ display: 'flex', color: MUTED, fontSize: 26, marginTop: 18 }}>{until}</div>}
        <div style={{ display: 'flex', color: MUTED, fontSize: 26, marginTop: 8 }}>Show this code at the clinic</div>
      </div>
    </div>,
    { ...GIFT_IMAGE, fonts: [{ name: 'Bodoni Moda', data: bodoni, weight: 400 }, { name: 'Jost', data: jost, weight: 400 }, { name: 'Jost', data: jostMedium, weight: 500 }] }
  );
}
// The PNG bytes, for an email attachment. null if the image cannot be made: the email then goes without it.
export async function giftCardPng(card) {
  try { return Buffer.from(await (await giftCardImage(card)).arrayBuffer()); }
  catch (e) { console.error('Gift card image not made:', e?.message); return null; }
}
