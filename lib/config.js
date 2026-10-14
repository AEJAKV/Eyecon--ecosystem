export const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
export const clinic = {
  name: 'Eyecon Optometry',
  phone: process.env.NEXT_PUBLIC_CLINIC_PHONE || '',
  email: process.env.NEXT_PUBLIC_CLINIC_EMAIL || '',
  address: process.env.NEXT_PUBLIC_CLINIC_ADDRESS || '',
  hours: process.env.NEXT_PUBLIC_CLINIC_HOURS || '',
  timezone: process.env.NEXT_PUBLIC_CLINIC_TIMEZONE || 'America/Toronto',
  reviews: process.env.NEXT_PUBLIC_REVIEWS_URL || '',
  // Verified Google rating and review count, copied from the clinic's Google Business Profile. Leave blank until confirmed.
  rating: Number(process.env.NEXT_PUBLIC_GOOGLE_RATING) || null,
  reviewCount: Number(process.env.NEXT_PUBLIC_GOOGLE_REVIEW_COUNT) || null,
  // Comma-separated list of insurers the clinic confirms it works with.
  insurers: (process.env.NEXT_PUBLIC_INSURERS || '').split(',').map(s => s.trim()).filter(Boolean),
  site: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
};
// meta and points fill the detail panel beside the appointment chart. [XX] and [X] are placeholders until the clinic confirms them.
// short is the label on the phone layout's chips. Each service's photograph lives at public/images/services/[id].webp.
export const services = [
  { id: 'eye-exam', short: 'Eye exam', name: 'Comprehensive eye exam', description: 'A thorough look at your vision and eye health.', icon: 'eye', meta: 'About [XX] min · Adults', points: ['Vision and prescription check', 'Full eye-health assessment', 'Time to talk through frames'] },
  { id: 'contacts', short: 'Contact lenses', name: 'Contact lens fitting', description: 'Find the right contact lenses and a comfortable fit.', icon: 'circle', meta: 'About [XX] min · New or current wearers', points: ['Lens measurements', 'Trial lenses to take home', 'Follow-up to confirm the fit'] },
  { id: 'dry-eye', short: 'Dry eye', name: 'Dry eye consultation', description: 'Discuss dryness, irritation and your care options.', icon: 'drop', meta: 'About [XX] min · Dry, tired or irritated eyes', points: ['Tear-film assessment', 'Lifestyle and screen-time review', 'A personal treatment plan'] },
  { id: 'children', short: 'Children', name: 'Children’s eye exam', description: 'Thoughtful eye care for growing eyes.', icon: 'people', meta: 'About [XX] min · Ages [X] and up', points: ['Gentle, game-like testing', 'Checks for focus and eye tracking', 'Clear advice for parents'] },
  { id: 'testing', short: 'Testing', name: 'Specialty testing', description: 'Additional testing recommended for your eye care.', icon: 'scan', meta: 'About [XX] min · On referral or recommendation', points: ['Advanced eye imaging', 'Results explained in plain terms', 'Shared with your optometrist'] },
  { id: 'skin-tightening', short: 'Skin tightening', name: 'Non-Invasive Skin Tightening', description: '[One sentence describing the treatment.]', icon: 'skin', meta: 'About [XX] min · [Who it is for]', points: ['[First point]', '[Second point]', '[Third point]'] },
  { id: 'styling', short: 'Styling', name: 'Frame styling consultation', description: 'Explore frames with a personal styling consultation.', icon: 'glasses', meta: 'About [XX] min · Anyone choosing new frames', points: ['Face-shape and lifestyle fit', 'Pieces from Cartier to LINDBERG', 'No obligation to buy'] }
];
// The technologies offered for Non-Invasive Skin Tightening. Choosing one when booking is optional; the slug is saved
// on the booking as its service_option. All placeholders until the clinic supplies the details.
export const skinTechnologies = [
  { slug: 'technology-1', name: '[Technology one]', summary: '[One sentence on how it works.]', session: '[XX] min · [X] sessions', image: '/images/services/skin-tightening.webp' },
  { slug: 'technology-2', name: '[Technology two]', summary: '[One sentence on how it works.]', session: '[XX] min · [X] sessions', image: '/images/services/skin-tightening.webp' },
  { slug: 'technology-3', name: '[Technology three]', summary: '[One sentence on how it works.]', session: '[XX] min · [X] sessions', image: '/images/services/skin-tightening.webp' }
];
// The services whose booking can carry an option, and the options each offers.
export const serviceOptions = { 'skin-tightening': skinTechnologies };
export function serviceOptionName(service, slug) { return serviceOptions[service]?.find(o => o.slug === slug)?.name || ''; }
// Where "Shop frames" goes. For now the collections carousel on the home page; point it at the online store later.
export const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL || '/#collections';
// The collections carousel. Each brand's photograph lives at public/images/brands/[slug].webp.
export const collections = [
  { slug: 'cartier', name: 'Cartier', line: 'Parisian jewellery heritage, translated into gold and precious-metal frames.' },
  { slug: 'tom-ford', name: 'Tom Ford', line: 'Bold, cinematic shapes with sharp tailoring and confident lines.' },
  { slug: 'gucci', name: 'Gucci', line: 'Italian eclecticism: playful details, rich colour, statement acetate.' },
  { slug: 'lindberg', name: 'LINDBERG', line: 'Danish minimalism. Featherweight titanium with no screws, no excess.' },
  { slug: 'maybach', name: 'Maybach', line: 'German craftsmanship with fine woods, horn and precious metals.' },
  { slug: 'dita', name: 'DITA', line: 'Los Angeles precision with architectural metalwork and refined finishes.' },
  { slug: 'chrome-hearts', name: 'Chrome Hearts', line: 'Hand-finished sterling silver with an unmistakable rock edge.' },
  { slug: 'maui-jim', name: 'Maui Jim', line: 'Polarised lenses built for bright light and true colour.' }
];
export const brands = collections.map(c => c.name);
// The optometrists shown on the home page. The layout handles one to six. Bracketed values are placeholders
// that show as-is on the page until the clinic supplies the real details. The photographs are placeholders too, and
// alt says so; when a real portrait replaces one, remove its alt and the doctor's name is used instead.
export const doctors = [
  { slug: 'doctor-1', title: 'Dr.', first: '[First]', last: '[Last]', line: '[One short sentence about their focus.]', intro: '[First sentence introducing the doctor.] [Second sentence about how they work with patients.]', focus: '[Areas of focus]', languages: '[Languages spoken]', wears: '[The frames they wear]', photo: '/images/doctors/doctor-1.webp', alt: 'Placeholder portrait' },
  { slug: 'doctor-2', title: 'Dr.', first: '[First]', last: '[Last]', line: '[One short sentence about their focus.]', intro: '[First sentence introducing the doctor.] [Second sentence about how they work with patients.]', focus: '[Areas of focus]', languages: '[Languages spoken]', wears: '[The frames they wear]', photo: '/images/doctors/doctor-2.webp', alt: 'Placeholder portrait' }
];
// Real content for “In their words” and “Your visit, prepared” on the home page. Empty until the clinic supplies it.
// Reviews: only real reviews, copied exactly as the patient wrote them (typos included), with their first name and
// last initial, or their username as shown. Eyecon's Google reviews, supplied by the clinic.
export const reviews = [
  { name: "Charise S.", service: "Frame repair", source: 'Google', stars: 5, text: "This review is for Sebastian W. He is the most helpful, knowledgeable and personable sales person I've encountered in sometime. I broke my only pair of glasses (my eyesight is terrible). He helped me to find my frames even though they are discontinued and replaced my lenses when my glasses arrived in the mail. Thank you Sebastian!" },
  { name: "Nirvana", service: "Adjustment", source: 'Google', stars: 5, text: "I came in to get my Off-White sunglasses adjusted since they were a bit loose, and the staff was amazing! The gentleman who helped me was so polite and professional — he fixed them perfectly and didn't even charge me for it. I really appreciated his kindness and great service. Highly recommend this store for their customer care and attention to detail!" },
  { name: "Thinh T.", service: "Repair", source: 'Google', stars: 5, text: "I went into eyecon and got my glasses repaired no one time, and no hassle I was helped by a nice gentlemen that sat in the front and he was very courteous. 5 stars will come back to get my next set of glasses from here!" },
  { name: "Lilian E.", service: "Eye exam", source: 'Google', stars: 5, text: "Amazing experience at Eyecon. Got a routine eye exam and prescription glasses, everyone was very knowledgeable and welcoming. I especially appreciate Hoda, who went above and beyond in her customer service and who helped me pick out which glasses were right for me. I definitely recommend Eyecon." },
  { name: "Matthew A.", service: "Frames", source: 'Google', stars: 5, text: "I've bought two pairs of glasses and a pair of sunglasses from this location and I couldn't be happier!" },
  { name: "Intermilan07", service: "Eye exam", source: 'Google', stars: 5, text: "Thorough eye exam and overall great service. Lots of high-end products. Highly recommend" },
  { name: "Liubov P.", service: "In store", source: 'Google', stars: 5, text: "I've been to this store several times and they're always happy to help me... I'll be back and recommend this place." },
  { name: "Lynna J.", service: "Frame styling", source: 'Google', stars: 5, text: "There are a lot of unique, and very funky frames to choose from here. The sales team did a great job of finding the me some cool, edgy frames that work with my face." },
  { name: "Kevin T.", service: "Children's exam", source: 'Google', stars: 5, text: "Excellent selection and helpful staff, had a great experience getting my new glasses here. Dr. Lobo was great with my toddler who was nervous about his eye exam but was happy and laughing by the end of it." },
  { name: "Ram V.", service: "Eye exam", source: 'Google', stars: 5, text: "Booked an appointment for my eye exam and was pleased with with the service as there was no wait time. The Optometrist was highly skilled and the sales person behind the counter was very friendly and helpful. Good variety of glasses to choose from and the prices were very reasonable. Extremely happy and satisfied." }
];
// The featured quote opens on these reviews, in this order; the rest follow in the order above.
export const featuredReviews = ['Kevin T.', 'Lilian E.', 'Ram V.'];
// Short themes these reviews actually mention.
export const mentions = ['Thorough eye exams', 'High-end selection', 'Friendly, knowledgeable staff', 'Great with kids', 'No wait time', 'Free adjustments'];
export const goodToKnow = []; // rows such as { label: 'Parking', text: 'Free parking behind the clinic.' }

// SAMPLE CONTENT FOR THE DESIGN PREVIEW ONLY. None of it is real: the rating, review count and insurers are invented.
// siteContent() below uses it only in demo mode, and only where the matching real value above (or in the clinic
// settings) is still empty. It is never shown in live mode, and the page labels it as sample wherever it appears.
export const sample = {
  rating: 4.9,
  reviewCount: 127,
  insurers: ['Sun Life', 'Manulife', 'Canada Life', 'Blue Cross', 'Green Shield', 'Desjardins'],
  goodToKnow: [
    { label: 'Payment', text: '[Payment options and financing]' },
    { label: 'Parking', text: '[Parking and directions]' },
    { label: 'Accessibility', text: '[Accessibility details]' }
  ]
};
// What the home page shows for each of these: the real value when there is one; otherwise the sample in demo mode,
// and nothing in live mode. Each entry says whether it is sample content, so the page can label it.
export function siteContent(demo = DEMO, real = { rating: clinic.rating, reviewCount: clinic.reviewCount, reviews, mentions, insurers: clinic.insurers, goodToKnow }) {
  const list = key => (real[key]?.length ? { items: real[key], sample: false } : demo && sample[key]?.length ? { items: sample[key], sample: true } : { items: [], sample: false });
  // The review count only ever accompanies the rating it belongs to: a sample count is never put beside a real rating.
  const rating = real.rating ? { value: real.rating, count: real.reviewCount || null, sample: false } : demo ? { value: sample.rating, count: sample.reviewCount, sample: true } : { value: null, count: null, sample: false };
  return { rating, reviews: list('reviews'), mentions: list('mentions'), insurers: list('insurers'), goodToKnow: list('goodToKnow') };
}
// "Complete your file" after booking. The residency options are placeholders until the clinic confirms the list;
// the chosen label is stored on the booking as written here.
export const residencyStatuses = ['[Residency status 1]', '[Residency status 2]', '[Residency status 3]', '[Other]'];
// Document kinds. A file needs exactly one government ID; the other kinds tag optional additional documents.
export const documentKinds = [
  { id: 'government-id', label: 'Valid government ID' },
  { id: 'diploma', label: 'Diploma' },
  { id: 'certificate', label: 'Certificate' },
  { id: 'high-school-diploma', label: 'High school diploma' },
  { id: 'english-test', label: 'English language test result' },
  { id: 'other', label: 'Other' }
];
export const DOCUMENT_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MAX_FILES = 8;
// The upload link sent with a booking works once, until this many hours after the appointment starts.
export const DOCUMENT_LINK_HOURS_AFTER_VISIT = 24;
export function fileSize(bytes) { return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'; }
export function documentKindLabel(id) { return documentKinds.find(k => k.id === id)?.label || 'Document'; }
export function documentLinkExpiry(start) { return new Date(new Date(start).getTime() + DOCUMENT_LINK_HOURS_AFTER_VISIT * 3600000).toISOString(); }
export function documentsLink(token, site = clinic.site) { return token ? site + '/documents#t=' + token : ''; }
// How long a referral gift card stays valid, counted from the moment the booking is made.
export const GIFT_CARD_DAYS = 180;
export const statuses = ['Booked', 'Attended', 'No-show', 'Cancelled'];
export const sources = ['Affiliate', 'Direct', 'Phone', 'Walk-in'];
export const instructions = ['Bring your current glasses and contact lenses.', 'Bring photo ID and your insurance card.', 'Please arrive 10 minutes early.'];
export const defaultTemplates = [
  { id: 'confirmation', subject: 'Your Eyecon appointment', body: 'Hello {name}, your appointment with {doctor} is booked for {date}. {address}\n\n{instructions}\n\nComplete your file before your visit: {documents_link}\n\n{gift}\n\nYour booking reference is {reference}. Find your booking any time: {lookup_link}' },
  { id: 'day-before', subject: 'Your appointment is tomorrow', body: 'Hello {name}, a reminder of your Eyecon appointment: {date}. {address} {gift}' },
  { id: 'same-day', subject: 'Your appointment is today', body: 'Hello {name}, we look forward to seeing you at Eyecon today: {date}. {gift}' },
  { id: 'no-show', subject: 'Would you like to rebook?', body: 'Hello {name}, please contact Eyecon if you would like to arrange another appointment. {phone}' }
];
export function findDoctor(slug) { return doctors.find(d => d.slug === slug) || null; }
export function doctorName(slug) { const d = findDoctor(slug); return d ? `${d.title} ${d.first} ${d.last}` : ''; }
export function serviceName(id) { return services.find(s => s.id === id)?.name || 'Eye appointment'; }
export function formatDate(iso, options = {}) { return new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, dateStyle: 'medium', timeStyle: 'short', ...options }).format(new Date(iso)); }
export function money(value) { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value || 0)); }
