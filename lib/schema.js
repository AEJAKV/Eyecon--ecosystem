import { clinic, services } from './config.js';
import { siteBase, SHARE_IMAGE, SITE_NAME } from './seo.js';

// Structured data (JSON-LD) for search engines. Rules:
//  - Only values that are really on the site or in lib/config.js. Nothing is invented.
//  - A value containing a [bracketed placeholder] is never output. scrub() removes it, and a node that would be left
//    without a required field is dropped whole.
//  - Left out until the clinic confirms them: priceRange, sameAs (social and Google Business Profile links),
//    aggregateRating and FAQPage. Add each one here only when the real value is confirmed.
// No server or React imports, so the rules can be tested on their own.

const PLACEHOLDER = /\[[^\]]*\]/;

// Drops empty values and anything with a [bracketed placeholder] in it, at any depth.
export function scrub(value) {
  if (typeof value === 'string') { const s = value.trim(); return !s || PLACEHOLDER.test(s) ? undefined : s; }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) { const list = value.map(scrub).filter(v => v !== undefined); return list.length ? list : undefined; }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) { const s = scrub(v); if (s !== undefined) out[k] = s; }
    return Object.keys(out).some(k => k !== '@type' && k !== '@context') ? out : undefined;
  }
  return undefined;
}

const CONTEXT = 'https://schema.org';
const node = data => { const s = scrub(data); return s ? { '@context': CONTEXT, ...s } : null; };
const origin = site => siteBase(site)?.origin || null;
const at = (site, path) => { const base = siteBase(site); return base ? new URL(path, base).toString() : null; };
// The clinic's stable identifier, e.g. https://www.eyeconcanada.ca/#clinic
export const clinicId = site => (origin(site) ? origin(site) + '/#clinic' : null);

// "Unit 448-5015-111 ST Edmonton, Alberta T6H-4M6": only an Edmonton, Alberta address in this shape is understood;
// anything else is left out instead of guessed.
export function parseAddress(text) {
  const m = /^(.+?)[,\s]+Edmonton[,\s]+(?:Alberta|AB)[,\s]+([A-Za-z]\d[A-Za-z])[\s-]?(\d[A-Za-z]\d)$/i.exec(String(text || '').trim());
  if (!m) return null;
  return { '@type': 'PostalAddress', streetAddress: m[1].trim(), addressLocality: 'Edmonton', addressRegion: 'AB', postalCode: (m[2] + ' ' + m[3]).toUpperCase(), addressCountry: 'CA' };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayIndex = word => DAYS.findIndex(d => d.toLowerCase().startsWith(String(word).toLowerCase().slice(0, 3)));
function clock(text) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(String(text).trim());
  if (!m) return null;
  let h = Number(m[1]) % 12; if (m[3].toLowerCase() === 'pm') h += 12;
  return String(h).padStart(2, '0') + ':' + (m[2] || '00');
}
// "Mon–Fri 10am–9pm · Sat 10am–7pm · Sun 11am–6pm" → one OpeningHoursSpecification per part. A part that cannot be
// read (a note, "Closed", an odd format) is skipped.
export function parseHours(text) {
  const specs = [];
  for (const part of String(text || '').split('·')) {
    const m = /^\s*([A-Za-z]+)(?:\s*[–-]\s*([A-Za-z]+))?\s+(\S+)\s*[–-]\s*(\S+)\s*$/.exec(part);
    if (!m) continue;
    const from = dayIndex(m[1]), to = m[2] ? dayIndex(m[2]) : from, opens = clock(m[3]), closes = clock(m[4]);
    if (from < 0 || to < from || !opens || !closes) continue;
    specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS.slice(from, to + 1), opens, closes });
  }
  return specs;
}

function telephone(c) {
  const t = String(c.phoneHref || '').replace(/^tel:/, '');
  return /^\+\d{10,15}$/.test(t) ? t : null;
}

// The clinic, with its service catalog, and the website. Output once, on every page. Every other node that needs the
// clinic (the website, a post's publisher or author) points to it by @id instead of repeating it. The catalog lists
// the services in lib/config.js by name and description, with no prices.
export function siteSchema(site = clinic.site, c = clinic, list = services) {
  if (!siteBase(site)) return [];
  const o = origin(site), id = clinicId(site);
  return [
    // A clinic with no real name is not published at all.
    scrub(c.name) === undefined ? null : node({
      '@type': 'Optician', '@id': id, name: c.name, url: o + '/',
      medicalSpecialty: 'https://schema.org/Optometric',
      telephone: telephone(c), email: c.email, address: parseAddress(c.address), openingHoursSpecification: parseHours(c.hours),
      image: at(site, SHARE_IMAGE.url), logo: at(site, '/icon.svg'),
      hasOfferCatalog: {
        '@type': 'OfferCatalog', name: 'Eye care and eyewear services',
        itemListElement: list.map(s => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.description, provider: { '@id': id } } }))
      }
    }),
    node({ '@type': 'WebSite', '@id': o + '/#website', name: SITE_NAME, url: o + '/', publisher: { '@id': id } })
  ].filter(Boolean);
}

// A trail of { name, path }. Left out if any step has no usable name.
export function breadcrumbSchema(steps, site = clinic.site) {
  if (!siteBase(site) || !steps.length || steps.some(s => scrub(s.name) === undefined)) return [];
  const n = node({ '@type': 'BreadcrumbList', itemListElement: steps.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, item: at(site, s.path) })) });
  return n ? [n] : [];
}
export const shopSchema = site => breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }], site);

// A brand page: the trail and the brand itself, from the collections list in lib/config.js.
export function brandSchema(brand, site = clinic.site) {
  if (!brand || !siteBase(site)) return [];
  const url = at(site, '/shop/' + brand.slug);
  const b = node({ '@type': 'Brand', '@id': url + '#brand', name: brand.name, description: brand.blurb, slogan: brand.tagline, url });
  return [...breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: brand.name, path: '/shop/' + brand.slug }], site), ...(b ? [b] : [])];
}

// A published blog post (the shape publicPost() returns). Needs a real title and publish date; the author is the
// post's byline; the image is the post's own cover. dateModified is left out: posts do not record one.
export function postSchema(post, site = clinic.site) {
  if (!post || !siteBase(site) || scrub(post.title) === undefined || !post.publishedAt) return [];
  const url = at(site, '/blog/' + post.slug);
  const byline = String(post.byline || '').trim();
  const cover = post.cover?.url && /^https?:\/\//.test(post.cover.url) ? post.cover.url : null;
  const article = node({
    '@type': 'BlogPosting', headline: post.title, description: post.excerpt, datePublished: post.publishedAt, url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url }, image: cover, articleSection: post.category,
    author: byline === SITE_NAME ? { '@id': clinicId(site) } : { '@type': 'Person', name: byline },
    publisher: { '@id': clinicId(site) }
  });
  return [
    ...(article ? [article] : []),
    ...breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: post.title, path: '/blog/' + post.slug }], site)
  ];
}
