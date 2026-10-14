import { featuredReviews } from './config.js';

// The reviews with the featured ones first, in the order named in lib/config.js; the rest keep their order.
export function featuredFirst(list, names = featuredReviews) {
  const rank = r => { const i = names.indexOf(r.name); return i < 0 ? names.length : i; };
  return list.map((r, i) => [r, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([r]) => r);
}

// The featured quote shortens a long review: about max characters, ending on a whole word, then "…".
// Shorter reviews are returned unchanged. The full text is always one click away.
export const EXCERPT_LENGTH = 160;
export function excerpt(text, max = EXCERPT_LENGTH) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1), space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-—]+$/, '') + '…';
}
