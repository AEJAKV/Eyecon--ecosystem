'use client';
// "Download card" on My link & QR: the affiliate's whole share card (EYECON, the QR code, "Scan to book with my personal
// introduction" and their name), light or dark as chosen, as a print-quality PNG with rounded corners. It is drawn at
// 4x the on-screen card (280 px wide), so 1120 px wide. Drawn in the browser; nothing is sent anywhere.
export const CARD_SCALE = 4;
const STYLES = {
  light: { bg: '#ffffff', ink: '#14181d', name: '#7a6230', edge: '#dcdbd6' },
  dark: { bg: '#14181d', ink: '#f6f5f2', name: '#d8c49a', edge: null }
};
// The card's layout in on-screen pixels, matching .share-card in app/workspace.css.
export function cardLayout() {
  const pad = 25.6, gap = 16, brand = 30, qrBox = 210, textBlock = 40.8, nameBlock = 25.2;
  const qrTop = pad + brand + gap, textTop = qrTop + qrBox + gap, nameTop = textTop + textBlock + gap;
  return { width: 280, height: Math.round(nameTop + nameBlock + pad), pad, qrTop, qrBox, textTop, nameTop };
}
function spaced(g, text, cx, y, spacing) {
  const widths = [...text].map(ch => g.measureText(ch).width), total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = cx - total / 2; g.textAlign = 'left';
  [...text].forEach((ch, i) => { g.fillText(ch, x, y); x += widths[i] + spacing; });
  g.textAlign = 'center';
}
export async function downloadShareCard({ url, name, slug, dark = false }) {
  const S = CARD_SCALE, L = cardLayout(), st = STYLES[dark ? 'dark' : 'light'];
  try { await document.fonts?.ready; } catch {}
  const QR = (await import('qrcode')).default, img = new Image();
  img.src = await QR.toDataURL(url, { width: 190 * S, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#202221', light: '#ffffff' } });
  await img.decode();
  const c = document.createElement('canvas'); c.width = L.width * S; c.height = L.height * S;
  const g = c.getContext('2d'); g.scale(S, S);
  const serif = "'Bodoni Moda Variable', Didot, 'Bodoni 72', Georgia, serif", sans = "'Jost Variable', Futura, 'Avenir Next', system-ui, sans-serif";
  const round = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  round(0.5, 0.5, L.width - 1, L.height - 1, 20); g.fillStyle = st.bg; g.fill();
  if (st.edge) { g.strokeStyle = st.edge; g.lineWidth = 1; g.stroke(); }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = st.ink;
  g.font = `400 20px ${serif}`; spaced(g, 'EYECON', L.width / 2, L.pad + 22, 6);
  const qx = (L.width - L.qrBox) / 2; round(qx, L.qrTop, L.qrBox, L.qrBox, 12); g.fillStyle = '#ffffff'; g.fill();
  g.drawImage(img, qx + 10, L.qrTop + 10, 190, 190);
  g.fillStyle = st.ink; g.font = `400 13.6px ${sans}`;
  g.fillText('Scan to book with my', L.width / 2, L.textTop + 15); g.fillText('personal introduction', L.width / 2, L.textTop + 35.4);
  g.fillStyle = st.name; g.font = `italic 400 16.8px ${serif}`; g.fillText(name || '', L.width / 2, L.nameTop + 18.5);
  const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `eyecon-${slug}-card-${dark ? 'dark' : 'light'}.png`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
