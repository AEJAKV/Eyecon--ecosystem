'use client';
import { formatDate } from '@/lib/config';
// "Download card": the gift card as a PNG image (QR code, card number under it, validity) that the patient can keep in
// their photos and show at the clinic. Drawn in the browser; nothing is sent anywhere.
export async function downloadGiftCard({ number, url, expiresAt }) {
  const QR = (await import('qrcode')).default;
  const img = new Image();
  img.src = await QR.toDataURL(url, { width: 480, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14181d', light: '#ffffff' } });
  await img.decode();
  const c = document.createElement('canvas'); c.width = 720; c.height = 1000;
  const g = c.getContext('2d'), serif = "'Bodoni Moda Variable', Didot, serif", sans = "'Jost Variable', system-ui, sans-serif";
  g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, 720, 1000);
  g.strokeStyle = '#b49a67'; g.lineWidth = 2; g.strokeRect(24, 24, 672, 952);
  g.textAlign = 'center';
  g.fillStyle = '#7a6230'; g.font = `500 22px ${sans}`; g.fillText('EYECON OPTOMETRY', 360, 100);
  g.fillStyle = '#14181d'; g.font = `64px ${serif}`; g.fillText('$50 gift card', 360, 185);
  g.fillStyle = '#ffffff'; g.fillRect(110, 230, 500, 500); g.drawImage(img, 120, 240, 480, 480);
  g.fillStyle = '#7a6230'; g.font = '600 40px ui-monospace, Menlo, Consolas, monospace'; g.fillText(number, 360, 800);
  g.fillStyle = '#5b6067'; g.font = `26px ${sans}`;
  if (expiresAt) g.fillText('Valid until ' + formatDate(expiresAt, { dateStyle: 'long', timeStyle: undefined }), 360, 860);
  g.fillText('Show this code at the clinic', 360, 905);
  const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'eyecon-gift-card-' + number + '.png';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
