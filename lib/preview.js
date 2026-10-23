import { safePhoto } from './validation.js';

// What a shared /book/[slug] link shows in WhatsApp, Facebook, iMessage and the like. Only public fields are used:
// the name and photo. This file has no server imports so the rules can be tested on their own.
export const PREVIEW_SIZE = { width: 1200, height: 630 };
export const PREVIEW_FALLBACK_PHOTO = '/images/affiliate.webp';
export const PREVIEW_GIFT_LINE = '$50 gift card on your first visit';

// The affiliate a preview may be built for: found and active, otherwise null (an unknown or switched-off link gets the
// plain Eyecon preview). The photo falls back to the shared placeholder when there is none.
export function previewAffiliate(affiliate) {
  if (!affiliate || affiliate.active === false || !String(affiliate.name || '').trim()) return null;
  return { name: String(affiliate.name).trim(), slug: affiliate.slug, photo: affiliate.photo ? safePhoto(affiliate.photo) : PREVIEW_FALLBACK_PHOTO };
}

export function previewTitle(affiliate) {
  return affiliate ? `${affiliate.name} invites you to Eyecon Optometry` : 'Eyecon Optometry';
}
export function previewDescription(affiliate) {
  return affiliate
    ? `${affiliate.name} has introduced you to Eyecon. Book online and receive a $50 gift card on your first visit.`
    : 'Arrange a personal eye care appointment with Eyecon Optometry.';
}

// The metadata for the page. The image itself comes from app/book/[slug]/opengraph-image.js.
export function previewMetadata(affiliate, site) {
  const title = previewTitle(affiliate), description = previewDescription(affiliate);
  let metadataBase = null;
  try { metadataBase = new URL(site); } catch { /* an unusable site URL leaves relative URLs to the default */ }
  return {
    ...(metadataBase ? { metadataBase } : {}),
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'Eyecon Optometry', locale: 'en_CA' },
    twitter: { card: 'summary_large_image', title, description }
  };
}
