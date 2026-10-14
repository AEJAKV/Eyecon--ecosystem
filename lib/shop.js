import { collections, money } from './config.js';
import { withAffiliate } from './affiliate.js';

// The Shop Frames page's rules, kept apart from the components so they can be tested.

export function frameBrand(frame) { return collections.find(c => c.slug === frame.brand) || null; }

// A frame's price as shown: nothing while it is blank; a plain number is shown in dollars, anything else as written.
export function framePrice(price) {
  const text = String(price ?? '').trim();
  if (!text) return '';
  return /^\d+(\.\d+)?$/.test(text) ? money(text) : text;
}

// A styling visit, with a brand already chosen when one is given, keeping the affiliate's referral.
export function stylingHref(affiliate, brandName = '') {
  return withAffiliate('/booking?service=styling' + (brandName ? '&brand=' + encodeURIComponent(brandName) : ''), affiliate);
}
// "Reserve to try": a styling visit with the frame's brand already chosen.
export function reserveHref(frame, affiliate) { return stylingHref(affiliate, frameBrand(frame)?.name); }
// A brand's own page. Not a booking link, but it keeps the referral so the booking links there can carry it on.
export function brandHref(slug, affiliate) { return withAffiliate('/shop/' + slug, affiliate); }
// Get directions: a Google Maps search for the address, or nothing while there is no address.
export function directionsUrl(address) {
  const text = String(address ?? '').trim();
  return text ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(text) : '';
}

// The brands below the featured row, in list order. Each 'banner' brand is its own full-width band; consecutive
// 'tile' brands fill rows of three. A row left short is filled with the closing tiles (Book a styling visit, then
// Visit the boutique), and the page always ends with both closing tiles: in the last row when it already holds them,
// otherwise in a row of their own after it. New brands fall into the same pattern from their layout alone.
export const CLOSING_TILES = ['styling', 'visit'];
export function brandGroups(list = collections) {
  const groups = [];
  for (const brand of list) {
    const last = groups.at(-1);
    if (brand.layout === 'tile' && last?.type === 'tiles' && last.items.length < 3) last.items.push(brand);
    else groups.push({ type: brand.layout === 'tile' ? 'tiles' : 'banner', items: [brand] });
  }
  for (const group of groups) {
    if (group.type === 'tiles') group.items.push(...CLOSING_TILES.slice(0, 3 - group.items.length).map(closing => ({ closing })));
  }
  const end = groups.at(-1), shown = end?.type === 'tiles' ? end.items.map(i => i.closing) : [];
  const missing = CLOSING_TILES.filter(id => !shown.includes(id));
  if (missing.length) groups.push({ type: 'tiles', items: missing.map(closing => ({ closing })) });
  return groups;
}

// Saved (hearted) frames live in this browser only. Reading and writing never throw: a private window, blocked storage
// or a damaged value simply means nothing is saved.
export const SAVED_FRAMES_KEY = 'eyecon-saved-frames';
export function readSavedFrames(storage) {
  try {
    const list = JSON.parse(storage?.getItem(SAVED_FRAMES_KEY) || '[]');
    return Array.isArray(list) ? list.filter(s => typeof s === 'string') : [];
  } catch { return []; }
}
export function writeSavedFrames(storage, list) {
  try { storage.setItem(SAVED_FRAMES_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
export function toggleSaved(list, slug) { return list.includes(slug) ? list.filter(s => s !== slug) : [...list, slug]; }
