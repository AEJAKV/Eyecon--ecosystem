import { services } from './config.js';

// Internal links that lead search engines and visitors from content to the pages that book or sell. No server or React
// imports, so the rules can be tested on their own. Only public pages are linked: never /admin, /desk or /affiliate.
export const EXAM_LINK_TEXT = 'Book an eye exam in Edmonton';

// A booking address (/booking or /booking?affiliate=alex) with a service preselected. The affiliate is kept.
export function bookingForService(bookingHref, serviceId) {
  const [path, query = ''] = String(bookingHref || '/booking').split('?');
  const rest = new URLSearchParams(query);
  rest.delete('service');
  const tail = rest.toString();
  return path + '?service=' + encodeURIComponent(serviceId) + (tail ? '&' + tail : '');
}
// The shop address that carries the same affiliate as a booking address.
export function shopForBooking(bookingHref) {
  const affiliate = new URLSearchParams(String(bookingHref || '').split('?')[1] || '').get('affiliate');
  return '/shop' + (affiliate ? '?affiliate=' + encodeURIComponent(affiliate) : '');
}

// The one related link at the end of a post, by its category: a service to book, or the shop. A category with no
// entry (Clinic news, or any other) gets no related link, only the eye exam one.
export const RELATED_BY_CATEGORY = {
  'Eye health': { service: 'dry-eye', text: 'Book a dry eye consultation' },
  'Contact lenses': { service: 'contacts', text: 'Book a contact lens fitting' },
  'Frames & style': { shop: true, text: 'Browse designer frames in Edmonton' },
  'Skin tightening': { service: 'skin-tightening', text: 'Book non-invasive skin tightening' }
};

// [related link, eye exam link] for the end of a post. Every link has descriptive text and a public destination.
export function postNextLinks(category, bookingHref) {
  const related = RELATED_BY_CATEGORY[category];
  const links = [];
  if (related) links.push({ text: related.text, href: related.shop ? shopForBooking(bookingHref) : bookingForService(bookingHref, related.service) });
  links.push({ text: EXAM_LINK_TEXT, href: bookingForService(bookingHref, 'eye-exam') });
  return links;
}
export const knownServiceIds = () => services.map(s => s.id);
