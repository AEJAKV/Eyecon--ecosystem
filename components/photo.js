'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

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
