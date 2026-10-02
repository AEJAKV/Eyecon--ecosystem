export const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
export const clinic = {
  name: 'Eyecon Optometry',
  phone: process.env.NEXT_PUBLIC_CLINIC_PHONE || '',
  email: process.env.NEXT_PUBLIC_CLINIC_EMAIL || '',
  address: process.env.NEXT_PUBLIC_CLINIC_ADDRESS || '',
  hours: process.env.NEXT_PUBLIC_CLINIC_HOURS || '',
  timezone: process.env.NEXT_PUBLIC_CLINIC_TIMEZONE || 'America/Toronto',
  reviews: process.env.NEXT_PUBLIC_REVIEWS_URL || '',
  site: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
};
export const services = [
  { id: 'eye-exam', name: 'Comprehensive eye exam', description: 'A thorough look at your vision and eye health.', icon: 'eye' },
  { id: 'contacts', name: 'Contact lens fitting', description: 'Find the right contact lenses and a comfortable fit.', icon: 'circle' },
  { id: 'dry-eye', name: 'Dry eye consultation', description: 'Discuss dryness, irritation and your care options.', icon: 'drop' },
  { id: 'children', name: 'Children’s eye exam', description: 'Thoughtful eye care for growing eyes.', icon: 'people' },
  { id: 'testing', name: 'Specialty testing', description: 'Additional testing recommended for your eye care.', icon: 'scan' },
  { id: 'styling', name: 'Frame styling consultation', description: 'Explore frames with a personal styling consultation.', icon: 'glasses' }
];
export const brands = ['Cartier', 'Tom Ford', 'Gucci', 'LINDBERG', 'Maybach', 'DITA', 'Chrome Hearts', 'Maui Jim'];
export const statuses = ['Booked', 'Attended', 'No-show', 'Cancelled'];
export const sources = ['Affiliate', 'Direct', 'Phone', 'Walk-in'];
export const instructions = ['Bring your current glasses and contact lenses.', 'Bring photo ID and your insurance card.', 'Please arrive 10 minutes early.'];
export const defaultTemplates = [
  { id: 'confirmation', subject: 'Your Eyecon appointment', body: 'Hello {name}, your appointment is booked for {date}. {address}\n\n{instructions}\n\n{gift}' },
  { id: 'day-before', subject: 'Your appointment is tomorrow', body: 'Hello {name}, a reminder of your Eyecon appointment: {date}. {address} {gift}' },
  { id: 'same-day', subject: 'Your appointment is today', body: 'Hello {name}, we look forward to seeing you at Eyecon today: {date}. {gift}' },
  { id: 'no-show', subject: 'Would you like to rebook?', body: 'Hello {name}, please contact Eyecon if you would like to arrange another appointment. {phone}' }
];
export function serviceName(id) { return services.find(s => s.id === id)?.name || 'Eye appointment'; }
export function formatDate(iso, options = {}) { return new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, dateStyle: 'medium', timeStyle: 'short', ...options }).format(new Date(iso)); }
export function money(value) { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value || 0)); }
