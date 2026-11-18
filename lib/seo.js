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
