import { Header,Footer } from '@/components/ui';
import { clinic,DEMO,GIFT_CARD_DAYS } from '@/lib/config';
export const metadata={title:'Privacy notice'};
// The privacy notice the booking form, the "Complete your file" form and the footer link to. It describes what this
// platform actually does: update it whenever the data collected, who can see it, or a service provider changes.
const PRIVACY_UPDATED='November 9, 2026';
export default function Page(){return <><Header/><main className="container prose" id="main-content">
<p className="eyebrow">YOUR INFORMATION</p>
<h1>Privacy notice</h1>
<p className="muted">Last updated {PRIVACY_UPDATED}</p>
<p>{clinic.name} (“we”) respects your privacy. This notice explains what information this website collects when you book an appointment, claim a gift card or comment on our blog, how we use it, who can see it, and the choices you have. We handle health information under Alberta’s <em>Health Information Act</em> and other personal information under Alberta’s <em>Personal Information Protection Act</em>.</p>

<h2>What we collect when you book</h2>
<ul>
<li>Your name, email address and phone number.</li>
<li>The service you choose, your optometrist, your appointment time and whether this is your first visit.</li>
<li>If you choose to give them: your insurance provider and policy number, and frame brands you like.</li>
<li>Whether you agree to text message reminders.</li>
<li>If you booked through someone’s personal link, which affiliate referred you.</li>
</ul>

<h2>Completing your file</h2>
<p>After you book, we ask you to upload a valid government ID and, if you wish, your Alberta Health Care card (PDF, JPG or PNG). We use these to confirm who you are and, where it applies, to bill Alberta Health Care or your insurer. This step is optional online: you can bring the documents to your visit instead. Uploaded files are kept in private storage that only authorised clinic staff can open.</p>

<h2>How we use your information</h2>
<ul>
<li>To book, confirm, change and manage your appointment, and to prepare for your visit.</li>
<li>To send your confirmation and reminder emails, and text reminders only if you agreed to them.</li>
<li>To bill Alberta Health Care or your insurer where it applies.</li>
<li>To issue and check gift cards, which are valid for {GIFT_CARD_DAYS} days from the day they are issued.</li>
<li>To credit the affiliate who referred you.</li>
</ul>
<p>We do not sell your information, and we do not use it for advertising.</p>

<h2>Personal referrals</h2>
<p>If you book through an affiliate’s link, that affiliate can see your name, your appointment date and whether the visit was completed. They never see your contact details, the service you chose, your insurance, your documents or any prices.</p>

<h2>Who can see your information</h2>
<p>Only authorised clinic staff, each with their own sign-in, can see your full booking. Front desk staff see what they need to check you in. We use these service providers to run the website, and they handle your information only to provide their service to us:</p>
<ul>
<li><strong>Supabase:</strong> stores bookings and uploaded documents, in Canada.</li>
<li><strong>Vercel:</strong> hosts this website. Your requests may be processed outside Canada, including in the United States.</li>
<li><strong>Resend:</strong> sends our emails, from the United States.</li>
<li><strong>Google:</strong> hosts the clinic inbox that receives a new-booking alert with your name, contact details and appointment (never your insurance or documents).</li>
<li><strong>Cloudflare Turnstile:</strong> checks that forms are sent by a person, not a bot.</li>
<li><strong>Twilio:</strong> sends text reminders, only if you agreed to them.</li>
</ul>
<p>Information handled outside Canada may be subject to the laws of that country.</p>

<h2>How we protect it</h2>
<p>The website uses encrypted connections. Insurance policy numbers are encrypted before they are stored. The link to upload your documents works once and only for your booking. Staff and affiliates each see only what their role allows.</p>

<h2>How long we keep it</h2>
<p>We keep your appointment records and documents for as long as the laws and professional standards for optometry in Alberta require, then destroy them securely. Uploads you start but do not finish are deleted automatically.</p>

<h2>Cookies and your browser</h2>
<p>We do not use advertising or tracking cookies. The website stores a few small items in your browser to work, for example a gift card you are holding before you book. Cloudflare Turnstile may set its own cookie to check for bots.</p>

<h2>Your choices</h2>
<ul>
<li>You can ask to see or correct the information we hold about you.</li>
<li>You can stop text reminders at any time by contacting the clinic.</li>
<li>You can look up your booking with your reference and email on the My booking page.</li>
</ul>
<p>If you are not satisfied with our answer to a privacy concern, you can contact the Office of the Information and Privacy Commissioner of Alberta.</p>

<h2>Contact us</h2>
<p>Questions or requests about your information go to our privacy contact at {clinic.name}{clinic.address?<>, {clinic.address}</>:null}{clinic.phone?<>, <a href={clinic.phoneHref}>{clinic.phone}</a></>:null}{clinic.email?<>, or <a href={'mailto:'+clinic.email}>{clinic.email}</a></>:null}.</p>
{DEMO&&<><h2>Design preview</h2><p>This version uses sample records and browser storage. Use fictional information only. Clear site data or reset the demo on the sign-in page to remove demo bookings.</p></>}
</main><Footer/></>;}
