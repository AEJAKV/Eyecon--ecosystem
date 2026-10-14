'use client';
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

// Cloudflare Turnstile. action names the form ('booking' or 'lookup'); the server checks it matches.
export default function Captcha({ action, onToken }) {
  const el = useRef(null), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!loaded || !el.current || !window.turnstile) return;
    const id = window.turnstile.render(el.current, { sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, action, callback: onToken, 'expired-callback': () => onToken('') });
    return () => window.turnstile?.remove(id);
  }, [loaded]);
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setLoaded(true)} /><div ref={el} /></>;
}
