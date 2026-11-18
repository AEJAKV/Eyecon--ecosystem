// Site-wide search and social metadata. No server imports, so the rules can be tested on their own.
export const SITE_NAME = 'Eyecon Optometry';
export const SHARE_IMAGE = { url: '/images/hero-desktop.webp', width: 1672, height: 941, alt: 'Eyecon Optometry, an optometrist and luxury eyewear boutique in Edmonton' };

// The site URL as a URL object, or null when it cannot be parsed (a bad URL must never crash the build).
export function siteBase(site) {
  try { return new URL(site); } catch { return null; }
}

// The root metadata every page inherits. Next.js merges metadata shallowly: a page that sets its own openGraph or
// twitter replaces these whole, so such a page must repeat the fields it still wants (see pageSocial).
export function rootSeo(site) {
  const metadataBase = siteBase(site);
  return {
    ...(metadataBase ? { metadataBase } : {}),
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_CA', images: [SHARE_IMAGE] },
    twitter: { card: 'summary_large_image', images: [SHARE_IMAGE.url] }
  };
}

// A page's own canonical: the path only, never a query string such as ?affiliate= or ?category=.
export function canonicalFor(path) {
  const clean = String(path || '/').split(/[?#]/)[0];
  return { canonical: clean.startsWith('/') ? clean : '/' + clean };
}

// Open Graph and Twitter for a page that has its own title, description or picture. Next.js replaces the root
// openGraph and twitter whole, so this repeats what every page keeps (site name, locale, card type) and falls back
// to the default share image when the page has none of its own. `og` adds Open Graph-only fields (article times).
export function pageSocial({ title, description, type = 'website', image, og = {} }) {
  const images = image?.url ? [image] : [SHARE_IMAGE];
  return {
    openGraph: { type, siteName: SITE_NAME, locale: 'en_CA', title, description, images, ...og },
    twitter: { card: 'summary_large_image', title, description, images: images.map(i => i.url) }
  };
}

// Stage 2: titles and descriptions. Titles 50-60 characters with the keyword first and the brand last; descriptions
// 140-160 characters with a benefit and a call to action.
export const TITLE_RANGE = [50, 60];
export const DESCRIPTION_RANGE = [140, 160];

export const HOME_SEO = {
  title: 'Optometrist & Luxury Eyewear in Edmonton | Eyecon Optometry',
  description: 'Book an eye exam with Eyecon Optometry in Edmonton. Comprehensive eye care, contact lenses, dry eye care and luxury frames from Cartier to LINDBERG.'
};
export const SHOP_SEO = {
  title: 'Designer Frames in Edmonton: Cartier to LINDBERG | Eyecon',
  description: 'Browse the luxury eyewear houses Eyecon Optometry carries in Edmonton, from Cartier to LINDBERG. Reserve any frame online and try it on at your appointment.'
};
export const BLOG_SEO = {
  title: 'Eye Health & Eyewear Blog | Eyecon Optometry Edmonton',
  description: 'Eye health, frames and news from Eyecon Optometry in Edmonton. Practical advice on eye exams, dry eye, contact lenses and choosing frames. Book your visit.'
};
export const PRIVACY_SEO = { description: 'How Eyecon Optometry uses your information when you book an appointment, claim a gift card or comment on our blog.' };
export const GIFT_TERMS_SEO = { description: 'The terms of the Eyecon Optometry referral gift card: who can receive one, how long it lasts and how to redeem it.' };

const inRange = (s, [min, max]) => s.length >= min && s.length <= max;

// "{Brand} Eyeglasses & Frames in Edmonton | Eyecon Optometry" when that fits 50-60 characters, otherwise the shorter
// "{Brand} Eyeglasses in Edmonton | Eyecon Optometry" (long names like Chrome Hearts or Tiffany & Co.).
export function brandTitle(name) {
  const options = [`${name} Eyeglasses & Frames in Edmonton | Eyecon Optometry`, `${name} Eyeglasses in Edmonton | Eyecon Optometry`];
  return options.find(t => inRange(t, TITLE_RANGE)) || options[1];
}

export const BRAND_CTA = 'Reserve to try at Eyecon in Edmonton.';
// Calls to action from shortest to longest. The first one that brings the description into 140-160 is used.
const BRAND_CTAS = [
  BRAND_CTA,
  'Reserve online and try it on at your Eyecon visit in Edmonton.',
  'Reserve a frame online and try it on at your Eyecon appointment in Edmonton.',
  'Reserve a frame online and try it on at your Eyecon Optometry appointment in Edmonton.'
];
function fitSentences(sentences, room) {
  let body = '';
  for (const s of sentences) { const next = body ? body + ' ' + s : s; if (next.length > room) break; body = next; }
  return body;
}
// The brand's own blurb (whole sentences only) plus a call to action, never over 160 characters. Only a blurb whose
// first sentence is too long for every call to action is cut at a word.
export function brandDescription(blurb) {
  const max = DESCRIPTION_RANGE[1];
  const sentences = String(blurb || '').match(/[^.!?]+[.!?]+(?:\s|$)/g)?.map(s => s.trim()) || [String(blurb || '').trim()];
  const made = BRAND_CTAS.map(cta => {
    const body = fitSentences(sentences, max - cta.length - 1);
    return { text: body ? body + ' ' + cta : '', whole: !!body };
  }).filter(m => m.whole);
  const best = made.find(m => inRange(m.text, DESCRIPTION_RANGE)) || made.reduce((a, b) => (!a || b.text.length > a.text.length ? b : a), null);
  if (best) return best.text;
  const cut = (sentences[0] || '').slice(0, max - BRAND_CTA.length - 2);
  const body = cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length).replace(/[,;:\s]+$/, '') + '…';
  return body + ' ' + BRAND_CTA;
}

// Stage 4: image alt text. Descriptive, under 125 characters, no keyword stuffing; a purely decorative image has alt="".
export const ALT_MAX = 125;
// Alt text from stored data, safe to render: never undefined, trimmed, and cut at a word if an older record is longer.
export function altText(value) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= ALT_MAX) return s;
  const cut = s.slice(0, ALT_MAX - 1), at = cut.lastIndexOf(' ');
  return (at > 0 ? cut.slice(0, at) : cut).replace(/[,;:\s]+$/, '') + '…';
}

// Stage 6: sitemap.xml and robots.txt.
// The public, indexable pages. /booking and /my-booking are noindex, so they are not listed.
export const SITEMAP_PAGES = ['/', '/shop', '/blog', '/privacy', '/gift-card-terms'];
// What robots.txt keeps crawlers out of (the working areas, booking, personal pages and the API).
export const ROBOTS_DISALLOW = ['/admin', '/desk', '/affiliate', '/booking', '/my-booking', '/book/', '/gift/', '/documents', '/login', '/api/'];

// The sitemap entries: the fixed pages and every brand page (dated lastModified, the time of the build), then each
// published blog post (dated when it was published). A bad site URL gives an empty sitemap instead of an error.
export function sitemapFor(site, { collections = [], posts = [], lastModified } = {}) {
  const base = siteBase(site);
  if (!base) return [];
  const at = path => new URL(path, base).toString();
  const pages = [...SITEMAP_PAGES, ...collections.map(c => '/shop/' + c.slug)].map(p => ({ url: at(p), ...(lastModified ? { lastModified } : {}) }));
  return [...pages, ...posts.map(p => ({ url: at('/blog/' + p.slug), lastModified: p.publishedAt }))];
}

// robots.txt: the demo site is closed to crawlers; the live site is open except for ROBOTS_DISALLOW. Both name the sitemap.
export function robotsFor(site, demo) {
  const base = siteBase(site);
  return {
    rules: { userAgent: '*', ...(demo ? { disallow: '/' } : { allow: '/', disallow: ROBOTS_DISALLOW }) },
    ...(base ? { sitemap: new URL('/sitemap.xml', base).toString(), host: base.origin } : {})
  };
}
