import { DEMO, clinic, GIFT_CARD_DAYS } from '@/lib/config';
import { adminClient, giftStatus } from '@/lib/server';
import { giftCardImage } from '@/lib/gift-image';
import { giftCardPath, parseGiftNumber } from '@/lib/gift';
// The gift card image shown inside the gift card email: GET /api/gift/image?number=EYC-AMO-7K2M9Q. Only a real card's
// full number gets an image (the same check as the card page), and it shows no patient details. The demo draws any
// well-formed number, valid for GIFT_CARD_DAYS from today, so the design can be previewed.
export async function GET(request) {
  const number = String(new URL(request.url).searchParams.get('number') || '').toUpperCase().slice(0, 40);
  if (!parseGiftNumber(number)) return new Response('Not found', { status: 404 });
  let expiresAt = new Date(Date.now() + GIFT_CARD_DAYS * 86400000).toISOString();
  if (!DEMO) {
    const card = await giftStatus(adminClient(), number).catch(() => null);
    if (!card) return new Response('Not found', { status: 404 });
    expiresAt = card.expiresAt;
  }
  const image = await giftCardImage({ number, url: clinic.site + giftCardPath(number), expiresAt });
  return new Response(image.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } });
}
