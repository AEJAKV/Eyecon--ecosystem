'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/provider';
import { resolveGift } from '@/lib/gift-browser';
const inflight = new Map();
// The visitor's gift card for an affiliate's link. The first visit asks the server for a card (the 180 days start
// then) and keeps it, with its claim token, in this browser; later visits read the same card back. status is
// 'loading', 'ready' (card has serial, releasedAt, expiresAt, token) or 'fallback': storage is unavailable or the
// request failed for any reason, so the card is issued when the visitor books, as before (see resolveGift).
export function useGift(affiliate) {
  const { releaseGift, ready } = useApp();
  const slug = affiliate?.slug;
  const [gift, setGift] = useState({ status: 'loading', card: null });
  useEffect(() => {
    if (!slug || !ready) return;
    let live = true;
    // One request per affiliate at a time, so React's development double-run does not release two cards.
    const release = s => { if (!inflight.has(s)) inflight.set(s, releaseGift(s).finally(() => inflight.delete(s))); return inflight.get(s); };
    resolveGift(slug, { release }).then(result => { if (live) setGift(result); });
    return () => { live = false; };
  }, [slug, ready]);
  return gift;
}
