'use client';
import { useEffect, useState } from 'react';
// A QR code drawn in the browser: an affiliate's referral link, or a gift card's own page (which staff scan).
export default function QR({ url, size = 150, alt = 'QR code linking to this affiliate’s booking page', className = 'qr' }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let active = true;
    import('qrcode').then(m => (m.default || m).toDataURL(url, { width: size * 2, margin: 2, color: { dark: '#202221', light: '#ffffff' }, errorCorrectionLevel: 'M' })).then(s => { if (active) setImage(s); });
    return () => { active = false; };
  }, [url, size]);
  return image ? <img className={className} src={image} width={size} height={size} alt={alt} /> : <div className={className} style={{ width: size, height: size }} aria-label="Generating QR code" />;
}
