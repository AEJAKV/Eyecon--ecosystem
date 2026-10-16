import { collections, frames, services } from './config.js';
import { withAffiliate } from './affiliate.js';

// Site search for the phone header. It searches what the site already has: the houses (brands), the sample frames,
// the services and a few pages. Every word typed must appear somewhere in an entry (accents and case are ignored).
// Houses and frames open the brand's page under /shop; services open the booking page with that service chosen.
// bookingHref and affiliate keep an affiliate's referral on every result.
const fold = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const join = (href, key, value) => href + (href.split('#')[0].includes('?') ? '&' : '?') + key + '=' + encodeURIComponent(value);

export function searchEntries({ bookingHref = '/booking', shopHref = '/shop', affiliate } = {}) {
  const brandName = slug => collections.find(c => c.slug === slug)?.name || '';
  return [
    ...collections.map(c => ({ group: 'Houses', title: c.name, sub: c.tagline, href: withAffiliate('/shop/' + c.slug, affiliate), words: [c.name, c.line, c.tagline, 'frames glasses eyewear brand'] })),
    ...frames.map(f => ({ group: 'Frames', title: brandName(f.brand) + ' ' + f.model, sub: f.material, href: withAffiliate('/shop/' + f.brand, affiliate), words: [brandName(f.brand), f.model, f.material, 'frame glasses eyewear'] })),
    ...services.map(s => ({ group: 'Services', title: s.name, sub: s.description, href: join(bookingHref, 'service', s.id), words: [s.name, s.short, s.description, 'book appointment'] })),
    { group: 'Pages', title: 'Shop all frames', sub: 'The houses we carry and featured frames', href: shopHref, words: ['shop frames glasses eyewear boutique collections brands'] },
    { group: 'Pages', title: 'Book an appointment', sub: 'Choose a service, a doctor and a time', href: bookingHref, words: ['book booking appointment schedule exam doctor optometrist'] },
    { group: 'Pages', title: 'Find my booking', sub: 'See your appointment details', href: '/my-booking', words: ['find my booking lookup appointment reference change'] },
  ];
}

export function searchSite(query, options) {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return searchEntries(options)
    .map(entry => {
      const title = fold(entry.title), text = fold([entry.title, entry.sub, ...entry.words].join(' '));
      if (!terms.every(t => text.includes(t))) return null;
      // Matches at the start of the title rank first, then anywhere in the title, then elsewhere.
      const score = terms.reduce((n, t) => n + (title.startsWith(t) ? 3 : title.includes(t) ? 2 : 1), 0);
      return { ...entry, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ words, score, ...result }) => result);
}
