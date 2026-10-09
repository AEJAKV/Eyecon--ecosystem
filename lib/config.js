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
  { id: 'styling', short: 'Styling', name: 'Frame styling consultation', description: 'Explore frames with a personal styling consultation.', icon: 'glasses', meta: 'About [XX] min · Anyone choosing new frames', points: ['Face-shape and lifestyle fit', 'Pieces from Cartier to LINDBERG', 'No obligation to buy'] }
];
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
// that show as-is on the page until the clinic supplies the real details.
export const doctors = [
  { slug: 'doctor-1', title: 'Dr.', first: '[First]', last: '[Last]', line: '[One short sentence about their focus.]', intro: '[First sentence introducing the doctor.] [Second sentence about how they work with patients.]', focus: '[Areas of focus]', languages: '[Languages spoken]', wears: '[The frames they wear]', photo: '/images/doctor1.webp' },
  { slug: 'doctor-2', title: 'Dr.', first: '[First]', last: '[Last]', line: '[One short sentence about their focus.]', intro: '[First sentence introducing the doctor.] [Second sentence about how they work with patients.]', focus: '[Areas of focus]', languages: '[Languages spoken]', wears: '[The frames they wear]', photo: '/images/doctor2.webp' }
];
export const statuses = ['Booked', 'Attended', 'No-show', 'Cancelled'];
export const sources = ['Affiliate', 'Direct', 'Phone', 'Walk-in'];
export const instructions = ['Bring your current glasses and contact lenses.', 'Bring photo ID and your insurance card.', 'Please arrive 10 minutes early.'];
export const defaultTemplates = [
  { id: 'confirmation', subject: 'Your Eyecon appointment', body: 'Hello {name}, your appointment is booked for {date}. {address}\n\n{instructions}\n\n{gift}' },
  { id: 'day-before', subject: 'Your appointment is tomorrow', body: 'Hello {name}, a reminder of your Eyecon appointment: {date}. {address} {gift}' },
  { id: 'same-day', subject: 'Your appointment is today', body: 'Hello {name}, we look forward to seeing you at Eyecon today: {date}. {gift}' },
  { id: 'no-show', subject: 'Would you like to rebook?', body: 'Hello {name}, please contact Eyecon if you would like to arrange another appointment. {phone}' }
];
export function doctorName(slug) { const d = doctors.find(d => d.slug === slug); return d ? `${d.title} ${d.first} ${d.last}` : ''; }
export function serviceName(id) { return services.find(s => s.id === id)?.name || 'Eye appointment'; }
export function formatDate(iso, options = {}) { return new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, dateStyle: 'medium', timeStyle: 'short', ...options }).format(new Date(iso)); }
export function money(value) { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value || 0)); }
