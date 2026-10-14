'use client';
import { useEffect, useRef, useState } from 'react';
import Image, { getImageProps } from 'next/image';

// Photographs known to be missing, so a fallback shows at once instead of retrying the request.
const missingPhotos = new Set();

/* A photograph that fills its frame, or the fallback passed as children while the file is missing. */
export default function Photo({ src, alt, sizes, children }) {
  const [missing, setMissing] = useState(missingPhotos.has(src)), ref = useRef(null);
  const fail = () => { missingPhotos.add(src); setMissing(true); };
  // An image that failed before the page became interactive never fires onError, so check once on mount.
  useEffect(() => { const img = ref.current; if (img?.complete && !img.naturalWidth) fail(); }, []);
  return missing ? children : <Image ref={ref} src={src} alt={alt} fill sizes={sizes} onError={fail} />;
}

/* Art direction with a fallback: phones (up to 640px) load the mobile photograph, larger screens the desktop one,
   and only the matching file is downloaded. If the chosen file is missing, the children show instead (for example a
   Photo of another image). Both sources fill their frame. */
export function ArtPhoto({ desktop, mobile, alt, children }) {
  const [missing, setMissing] = useState(missingPhotos.has(desktop) && missingPhotos.has(mobile)), ref = useRef(null);
  const fail = () => { missingPhotos.add(desktop); missingPhotos.add(mobile); setMissing(true); };
  useEffect(() => { const img = ref.current; if (img?.complete && !img.naturalWidth) fail(); }, []);
  if (missing) return children;
  const { props: { srcSet: wide } } = getImageProps({ alt, src: desktop, fill: true, sizes: '100vw' });
  const { props: { srcSet: narrow, ...rest } } = getImageProps({ alt, src: mobile, fill: true, sizes: '100vw' });
  return (
    <picture>
      <source media="(max-width: 640px)" srcSet={narrow} />
      <source srcSet={wide} />
      <img ref={ref} {...rest} onError={fail} />
    </picture>
  );
}
