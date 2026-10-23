# Eyecon Optometry — Module 1

A complete Next.js project for the affiliate referral and appointment-booking experience. Open it in VS Code and deploy it to Vercel. The default is an interactive **demo**: no accounts, API keys or database are needed to explore it.

## What is included

- Premium public landing page and personalised affiliate landing pages, with “Shop Frames” in the header on tablets and desktops, the appointments section and a “Shop all frames →” link under the collections carousel. They go to `shopUrl` in `lib/config.js` (or `NEXT_PUBLIC_SHOP_URL`), which is `/shop` by default.
- On phones (640px and narrower) the site header is a menu button on the left, the Eyecon logo with its mark centred, and search and a shopping bag (to Shop Frames) on the right. Search (`lib/search.js`, on every screen size) drops a panel from the top and finds the houses, sample frames, services and pages as you type, suggesting popular places before you type; services open booking with that service chosen and every result keeps an affiliate's referral. the menu opens a drawer from the left with Book appointment, Shop Frames, the clinic phone (tap to call) and the address (opens Google Maps). Tablets and desktops keep Search, Shop Frames, the phone and Book appointment in the header (Search and the phone become icons below 860px); Search opens the same panel there, centred with two columns of results.
- Shop Frames page at `/shop`, a boutique page for the houses Eyecon carries and featured frames. It opens with a photo header (`public/images/shop/hero-desktop.webp`, and `hero-mobile.webp` on phones): white words in the left third over a dark panel with the photograph on the right two-thirds, under the white overlay site header; on phones the words sit above the 4:5 photograph. If the photograph is missing the plain centred heading shows instead. Then comes a “Featured this week” row: a scroll-snap row of frame cards (4 with the next peeking on desktop, 1½ on phones), arrows and arrow keys, a “New” tag, a heart that saves the frame in this browser, and “Reserve to try”, which books a styling visit with the brand chosen. Photographs go in `public/images/shop/frames/[slug].webp`; until then each card shows “Photograph to follow”, and demo mode labels the row “Sample selection”. Below it come the houses, in `collections` order: each `banner` brand is a full-width photograph (`public/images/shop/banners/[slug]-desktop.webp`; phones use the brand photograph `public/images/brands/[slug].webp`) with its tagline and “Shop the collection”, and consecutive `tile` brands form rows of three (`public/images/brands/[slug].webp`, the carousel photograph) with “Discover”; both fall back to the carousel photograph. On phones banners put their words below a 4:5 photograph and tile rows swipe with a “1 / 3” counter. Short tile rows are filled by, and the page always ends with, “Book a styling visit” and “Visit the boutique” (Get directions opens Google Maps once the clinic address is set). Each brand has its own page at `/shop/[slug]` (built ahead for every brand; it reads `?affiliate=` in the browser so the pages stay static) with “← All frames”, the banner, the blurb, a grid of that brand’s frames (4 columns, 2 on tablets and phones; “New pieces arriving soon” while it has none) and “Want to try [Brand] in person?”. the brands (`collections`, with a tagline, blurb and banner or tile layout each) and six sample frames (`frames`, to replace with frames Eyecon stocks; a price shows only once filled in) are in `lib/config.js`. Opened with `?affiliate=SLUG`, every booking link on the page carries the same affiliate (`withAffiliate` in `lib/affiliate.js`), and an affiliate landing page passes its referral on to the shop links.
- Non-Invasive Skin Tightening as a service, with its technologies (`skinTechnologies` in `lib/config.js`, bracketed placeholders until the clinic supplies them) shown as a swipeable, keyboard-friendly row of cards in the home page panel and booking step 1. Choosing a technology is optional and is saved with the booking.
- “In their words” on the home page and the booking page’s left column show Eyecon’s real Google reviews (in `lib/config.js`, word for word, featured ones first). Long featured reviews show an excerpt with “Read full review”; review cards clamp to four lines and open on click. Until the clinic sets its real Google rating and review count, demo mode shows a sample rating labelled “Sample rating”; live mode shows none.
- Four-step booking: service, optometrist and time, patient details and confirmation. Every appointment belongs to one optometrist. Patients either choose an optometrist first (their photo, name and focus, then that optometrist's days and times) or a time first (each time shows which optometrists are free; when more than one is, the patient picks). Two optometrists can see patients at the same time; one optometrist cannot be double-booked.
- “Complete your file” after booking: residency status, one valid government ID and optional tagged documents (diploma, certificate, high school diploma, English language test result, other). PDF, JPG or PNG, up to 10 MB each and 8 files, checked by file signature on the server. Patients can skip and finish later from the single-use, expiring link in their confirmation email (`{documents_link}`). Each file goes straight from the patient's browser to a private storage bucket through a one-time signed upload link (so the website host's request limit does not apply), and the server checks every stored file's size, type and first bytes before recording it; unfinished uploads are removed by the hourly reminders job. Staff open files through links that expire after 5 minutes; affiliates never see them. In demo mode only file names and sizes are kept, in the browser.
- “Find my booking” at `/my-booking` for patients without an account: booking reference (8 characters, e.g. 7K2M9QXB) plus the booking email. Shows the booking card, add-to-calendar buttons, the gift card number, a “Complete your file” link while the ID is missing, and a line to call the clinic for changes. Turnstile, a honeypot and 10 attempts per IP per hour; not found and wrong email give the same answer. Linked from the footer and the confirmation email (`{reference}`, `{lookup_link}`).
- EMR placeholder (`lib/emr.js`): an adapter with `getAppointment(reference)` and `syncBooking(booking)` that returns null until the clinic confirms its EMR vendor. The lookup already lets EMR data override status, doctor and time.
- Referral identity throughout booking; the $50 gift appears only with an active affiliate referral.
- Google, Apple `.ics` and Outlook calendar options. The event, the confirmation card and the confirmation email (template field `{doctor}`) name the optometrist.
- Affiliate dashboard (completed referrals this month and all time, upcoming bookings as a count that “counts once completed”, commission earned and paid), referrals, referral link/QR, earnings, profile editing and photo upload. A referral counts, and earns commission, only once its appointment is completed (Attended).
- Staff booking list/calendar showing each booking's optometrist, patient details, attendance status, manual bookings (free times grouped by optometrist), availability per optometrist, affiliate performance dashboard (per-affiliate bookings, completed, upcoming, billed and commission, sortable; a page per affiliate with every appointment amount, inline commission calculator, date and status filters, staff CSV, and “Preview as affiliate”; “Top affiliates this month” on the overview), leads, procedure pricing, calculated commission, payout recording and message templates.
- Supabase database schema, authentication and server-side role checks for live mode.
- Turnstile booking verification, optional Resend email, Twilio SMS with opt-in, and an authenticated reminder endpoint.
- Responsive layouts, keyboard controls, native form labels, focus handling, reduced-motion support and optimised local WebP images.

## Scope and launch status

This implements **Module 1**, the referral/booking platform. It does not implement the later e-commerce, lens builder, virtual try-on, AI concierge, patient portal or MyVisionExpress modules.

The grayscale photography is concept imagery from the design mockup. Doctor panels are explicitly marked as preview content; use approved real portraits, credentials, biographies and photography before launch. Clinic contact details, hours, verified reviews, insurance wording, appointment durations and gift eligibility need confirmation. No invented ratings or testimonials are included. Commission is calculated, never typed: the affiliate’s commission rate × net, where net = amount billed to the patient (gross − discount) − the procedure’s operation cost, never below $0. Example: $400 billed, $200 operation cost → $200 net → 10% → $20. Retail prices and operation costs start at $0 and must be entered in Staff admin > Pricing. Payout recording is a ledger update, not a bank transfer.

Demo data is stored in the current browser and is neither secure nor shared between users. Use fictional details only. Live mode uses Supabase and must be configured and verified with your own services before collecting real patient information. This delivery does not certify privacy compliance, WCAG conformance, production security or a PageSpeed score. No live service credentials were available during development.

## Planned: Optometrist profiles and schedules (staff-managed)

Not built yet. Goal: staff add and edit doctors and their working hours in the staff workspace. The website's “The people behind your exam” section and the booking form's “Choose your doctor” date and time step both read from this, so they are always correct.

Today the two placeholder doctors are written in `lib/config.js` (changing them needs a developer), and staff add bookable times one slot at a time in Staff admin › Bookings › Add available time.

### Backend needed (extends the existing Supabase + Next.js API; no new service)

**Database: new migration `supabase/migrations/010_doctors_and_schedules.sql`**
- `doctors` table: slug, title, first name, last name, short line, intro, focus, languages, frames they wear, photo, services they perform, show on website (yes/no), display order.
- `doctor_weekly_hours` table: doctor, weekday, start time, end time (several rows per day allowed, so a lunch break is just a gap).
- One appointment length per doctor (15/30/45/60/90 min).
- `doctor_time_off` table: doctor, from, to, reason (vacation, half day, blocked hour).
- `doctor_extra_hours` table: doctor, date, start, end (one-off extra days).
- Moves today's two placeholder doctors from `lib/config.js` into the table.
- Existing bookings and the double-booking protection stay exactly as they are.

**Photo storage**
- A Supabase storage bucket for doctor photos (public, images only, size-limited).

**Automatic time slots**
- A database function turns weekly hours, minus time off, plus extra hours, into bookable slots, always 90 days ahead.
- Runs whenever staff save a schedule, and once a day through the existing hourly scheduler that already calls `/api/reminders` (no new scheduler needed).
- Never removes a slot that already has a booking.

**Server API (`app/api/workspace`, staff only)**
- Add, edit, hide and reorder a doctor; upload a photo.
- Save weekly hours and slot length; add or remove time off and extra hours.
- Warn staff when new time off overlaps confirmed appointments, listing the patients to rebook.
- A doctor with upcoming appointments can be hidden but not deleted.

**Public read**
- The home page and booking form load the shown doctors (name, photo, bio, services) from the database instead of the code. No patient data is involved.

**Demo mode**
- Sample doctors and schedules in `lib/demo.js`, so the preview keeps working with no keys.

### Setup steps once it is built
1. Run `010_doctors_and_schedules.sql` once in the Supabase SQL editor.
2. Confirm the doctor-photos storage bucket exists (the migration creates it).
3. No new environment variables or accounts are needed.

### Open questions
- One appointment length per doctor, or different lengths per service?
- Do all doctors perform every service (for example skin tightening)?
- Does the front desk manage schedules, or does each doctor sign in to manage their own?
- Will schedules later come from the EMR / MyVisionExpress?

### Build order
1. Doctor profiles in the staff workspace, feeding the website.
2. Weekly hours and time off generating the booking slots.
3. A week calendar view per doctor (open, booked and blocked times; click to block a time).

## Pages / sitemap

| Address | Page |
| --- | --- |
| `/` | Direct visitor landing page |
| `/book/alex-morgan` | Example affiliate landing page in demo mode |
| `/book/[slug]` | Active affiliate's personalised landing page |
| `/booking?affiliate=alex-morgan` | Booking flow with affiliate referral |
| `/booking` | Direct booking flow |
| `/booking?service=eye-exam&doctor=doctor-1` | Booking flow opened on “Choose a doctor” with that optometrist selected (the “Book with” button on the home page’s optometrist cards) |
| `/shop` | Shop Frames: the houses Eyecon carries and featured frames |
| `/shop?affiliate=alex-morgan` | Shop Frames with an affiliate referral carried onto its booking links |
| `/shop/[slug]` | A brand’s page, e.g. `/shop/cartier`: its banner, blurb, its frames and “Book a styling visit”. Built at build time for every brand in `collections`; other slugs are not found |
| `/documents#t=…` | “Complete your file” from the confirmation email’s single-use link |
| `/my-booking` | Find my booking: reference and email lookup |
| `/login` | Demo exploration or live sign-in/password reset |
| `/affiliate` | Affiliate overview |
| `/affiliate/referrals` | Patient name, appointment date, status and “Your commission” (blank until completed); CSV export of the same fields |
| `/affiliate/link` | Personal link and downloadable QR code |
| `/affiliate/earnings` | Commission per completed appointment and its payout status |
| `/affiliate/profile` | Display name, introduction and portrait |
| `/admin` | Staff bookings, availability, calendar and “Top affiliates this month” |
| `/admin/affiliates` | Affiliate performance table (cards on phones), sortable by completed and commission; add, activate/deactivate and photograph affiliates |
| `/admin/affiliates/[slug]` | One affiliate: stats, appointments with gross, discount, operation cost, net and commission, inline calculator, filters, CSV, and “Preview as affiliate” (read-only) |
| `/admin/leads` | Search/filter/export bookings |
| `/admin/payouts` | Calculate commission for attended referrals and record payments |
| `/admin/pricing` | Retail price and operation cost for each procedure |
| `/admin/messages` | Edit templates and inspect live delivery activity |
| `/privacy` | Draft privacy notice requiring clinic review |

An unknown or inactive affiliate page presents a direct-booking alternative. Affiliate workspaces show only each referral’s patient name, appointment date, status, the affiliate’s own commission and its payout (`lib/affiliate.js`). Contact details, service type, insurance, documents, residency status and every procedure amount (gross, discount, operation cost, net) and per-booking rate are never sent to affiliates; the live API selects only the allowed columns and the demo applies the same filter.

## 1. Create/open the project in VS Code

1. Install the current Node.js **LTS** release from [nodejs.org](https://nodejs.org/en/download). The project requires Node 20.9 or later; use a currently supported LTS release.
2. Install [Visual Studio Code](https://code.visualstudio.com/download) and [Git](https://git-scm.com/downloads).
3. Download and extract `Eyecon_Module_1_Nextjs.zip`. You will see a folder named `eyecon-module-1` containing `package.json`.
4. In VS Code choose **File → Open Folder**, then open that folder. Do not open the folder above it.
5. In the VS Code file list, duplicate `.env.example` and name the copy `.env.local`. Keep `NEXT_PUBLIC_DEMO_MODE=true` for now. No other values are needed for the local demo.

If you prefer to create files manually: make an empty folder named `eyecon-module-1`, open it in VS Code, create each path from `SOURCE_CODE.md`, and paste the complete file contents from its matching code block. Paths and capitalisation must match exactly. The guide includes a complete Base64 asset restoration command for the four WebP images. `package-lock.json` is supplied; do not create `node_modules` or `.next` yourself. The ZIP is the easiest option.

## 2. Terminal commands

Choose **Terminal → New Terminal** in VS Code. It should open inside the project folder. Run one command at a time:

```bash
node --version
npm --version
npm install
npm run dev
```

- `node --version` and `npm --version` confirm the required tools are installed.
- `npm install` downloads the dependencies listed in `package.json`. It creates `node_modules`.
- `npm run dev` starts the local development server and updates the preview when you save a file.

Leave that terminal running. Press **Ctrl+C** when you want to stop it.

Other useful commands, run after stopping the development server:

```bash
npm test
npm run build
npm run start
```

`npm test` checks booking validation, per-optometrist booking and overlap protection, affiliate data filtering, payout guards, CSV handling and calendars. `npm run build` prepares and checks the production build. `npm run start` runs that production build locally. To reproduce the pinned installation later, use `npm ci` in place of `npm install`.

## 3. Preview and explore locally

1. Open [http://localhost:3000](http://localhost:3000) in your browser, or use the URL printed in the terminal if port 3000 is occupied.
2. Visit [the example affiliate page](http://localhost:3000/book/alex-morgan), choose a service and finish a booking with **fictional** patient details.
3. Open `/login`, click **Explore affiliate demo**, then explore Referrals, My link & QR, Earnings and Profile.
4. Open `/login` again and click **Explore staff demo**. Set a retail price and operation cost in Pricing. Change a booking to Attended, open **Calculate** in Payouts, enter the amount billed and any discount, save, and record a payment. These actions change only sample data in your browser.
5. Use **Reset demo data** at `/login` to restore the examples and refresh the demo availability dates.
6. To inspect mobile layout, narrow your browser window or use your browser's device toolbar. Check the public page, each booking step and both dashboards.

The demo is intentionally not an authentication system. Each browser has its own records. No emails/SMS are sent, and real staff credentials are not used.

## 4. Put the project on GitHub

The simplest route is [GitHub Desktop](https://desktop.github.com/): choose **File → Add local repository**, select the project folder, create a repository if prompted, then **Publish repository**. Choose a private repository if that suits your project.

For the terminal route, create a new empty repository on [GitHub](https://github.com/new), named `eyecon-module-1`. Do not initialise that remote repository with a README, licence or `.gitignore`; those files already exist locally. Copy its HTTPS URL. In the VS Code terminal run:

```bash
git init
git add .
git commit -m "Build Eyecon Module 1"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/eyecon-module-1.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username. `git init` starts version history; `git add` selects the files; `git commit` saves a version; `git branch` names the branch; `git remote` connects the repository; `git push` uploads it. Complete GitHub's sign-in prompt. Do not use your account password as a Git HTTPS password.

Check the uploaded file list: `.env.local`, `.next` and `node_modules` must not appear. The included `.gitignore` excludes them. `.env.example` contains no secrets and is safe to commit. To upload later edits:

```bash
git add .
git commit -m "Update Eyecon pages"
git push
```

## 5. Connect GitHub to Vercel and publish

1. Sign in to [Vercel](https://vercel.com) with GitHub.
2. Choose **Add New → Project** and import `eyecon-module-1`. Grant access to that repository when requested.
3. Confirm the framework is **Next.js**. The root directory should contain `package.json`; if your repository wraps the project in another folder, select `eyecon-module-1` as the Root Directory. Keep the normal Next.js build settings; do not use a static export.
4. For the first **design preview**, add `NEXT_PUBLIC_DEMO_MODE=true`. This publishes a demo, not a real appointment system. Add the confirmed public clinic values if available.
5. Click **Deploy**. When the build finishes, open the generated deployment URL.
6. Set `NEXT_PUBLIC_SITE_URL` to that exact HTTPS deployment URL in Project Settings → Environment Variables, then redeploy. This makes shared referral links and QR codes point to the published site.
7. Later, add your domain in Project Settings → Domains and follow the DNS instructions Vercel displays. Update `NEXT_PUBLIC_SITE_URL` and the authentication/Turnstile allowed domains when you change domains.
8. Push future edits to GitHub to trigger another deployment. Environment-variable changes require a new deployment; public variables are compiled into the frontend.

Leave preview deployments in demo mode. Only turn the **Production** environment to live mode after the configuration below and staging checks. This project has server API routes, so it cannot be deployed as a plain static website.

## Live mode configuration

These are deployment steps, not required for exploring the demo.

### A. Create the Supabase backend

1. Create a new Supabase project. Choose a region and service agreements appropriate for the clinic's privacy/data-residency decisions.
2. Open **SQL Editor**. Paste the complete `supabase/schema.sql` and run it **once on an empty project**. It creates tables, access rules, booking/payout functions and the affiliate-photo bucket. Running it again will produce "already exists" errors; use reviewed migrations for later changes.
   Then run each file in `supabase/migrations/` once, in number order. `004_doctor_availability.sql` makes slots and bookings per optometrist; it assigns any existing slots to `doctor-1`, so staff should review them afterwards. `005_documents.sql` adds “Complete your file”: the residency status, the document records, hashed upload tokens and the **private** `booking-documents` storage bucket. Do not add storage policies to that bucket. `006_booking_lookup.sql` gives every booking a unique reference (existing bookings included) and adds the rate-limited lookup. `008_services.sql` adds the skin tightening service and the optional `service_option` column. `007_commission.sql` adds procedure pricing and calculates commission in the database (`complete_appointment`); after running it, set each affiliate’s real commission rate. `009_direct_uploads.sql` lets “Complete your file” upload straight to storage (required on Vercel).
3. In **Authentication**, create the initial staff user with a confirmed email and a strong password. Copy that user's UUID.
4. In SQL Editor run the following, replacing the UUID with the actual user ID:

```sql
insert into public.profiles(id, role)
values ('THE-ACTUAL-AUTH-USER-UUID', 'staff');
```

5. Set Authentication's Site URL to your live URL. Allow the exact login redirect URLs `https://YOUR-DOMAIN/login?set-password=1` and `https://YOUR-DOMAIN/login?mode=reset`. Add the corresponding localhost URLs only for your development environment.
6. Configure Supabase's auth email delivery/SMTP so invitations and password resets reach real users. Public account signup is not required; staff invite affiliates from the dashboard.
7. Copy the project's URL, anon key and service-role key into the matching `.env.local`/Vercel variables. The browser uses the anon key; the server uses the service-role key. **Never expose the service-role key in a NEXT_PUBLIC variable.**

### B. Public booking verification and insurance storage

Create a Cloudflare Turnstile widget for your domain(s); set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. The server checks the verification result, hostname and `booking` action. If verification is not configured, public live bookings are rejected.

Generate a private insurance encryption key in a local terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set its full output as `INSURANCE_ENCRYPTION_KEY` in your private environment. Keep a secure backup. Changing or losing it makes existing policy numbers unreadable. Policy numbers are encrypted using AES-256-GCM; other booking fields remain ordinary database records, protected by database/server access rules. Without the key, bookings with a supplied policy number are rejected; the optional field can be left blank.

### C. Confirmations and reminders

- For email, configure a verified sending domain in Resend and set `RESEND_API_KEY` and `RESEND_FROM`. Confirmation emails attach an `.ics` calendar file.
- For SMS, configure a Twilio sending number and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. The application sends only when the patient has opted into SMS. Confirm the actual consent wording and provider setup for your clinic.
- Generate `CRON_SECRET` using the same random-key command. Configure an **hourly authenticated HTTPS scheduler** to call `GET https://YOUR-DOMAIN/api/reminders` with header `Authorization: Bearer YOUR-CRON-SECRET`. Keep the secret in the scheduler's protected header/secret field, not a URL or a public repository. The scheduler itself is not provisioned by this project.
- Reminder windows are 22–26 hours before and within 2 hours of the appointment. A unique job per booking/message type prevents normal duplicate dispatch. Provider acceptance is recorded as `sent`; it is not proof of delivery. Failed, unfinished or unconfigured jobs require staff review and are not retried automatically. No-show templates are triggered by changing status to No-show.

### D. Activate and verify

1. Set every confirmed clinic value, the live URL and service keys. Change **only the configured live environment** to `NEXT_PUBLIC_DEMO_MODE=false`, restart locally or redeploy.
2. Sign in with the real staff account. Add appointment slots for each optometrist using **Add available time**. The input explicitly uses the staff browser's local timezone; patient displays use `NEXT_PUBLIC_CLINIC_TIMEZONE`. Confirm both before adding slots.
3. Add an affiliate and complete the email invitation. Verify their photo, link, QR, active/inactive state and restricted workspace.
4. Book a test appointment from that affiliate link. Verify database persistence, referral attribution, email/SMS, calendar timezone, staff status updates and the calculated commission.
5. Try simultaneous bookings with the same optometrist for an overlapping interval and confirm only one succeeds; then book two different optometrists at the same time and confirm both succeed. Test both roles with separate accounts and verify anonymous requests cannot access patient data.
6. Check notification failures, audit records, provider bills, backup/recovery and data retention with the team's deployment owner. Approve real copy, portrait rights, gift terms, privacy wording and clinical scheduling before accepting patients.

Each optometrist has their own calendar of explicit staff-created slots. Durations are assigned to slots, not automatically determined by service. It does not sync MyVisionExpress, offer self-service rescheduling/cancellation, manage multiple locations or implement a rules-based commission engine. The staff API currently loads at most 2,000 bookings and 100 recent delivery jobs; add server pagination for larger use. Document files never pass through the website: `/api/documents` hands out signed upload links and checks the stored files afterwards, so Vercel's 4.5 MB request limit does not apply (each file is still limited to 10 MB by the bucket). Uploaded documents are not deleted automatically; set and apply a retention period. Staff have a shared staff role, not per-action permissions or MFA enforcement. Account deletion, data retention, consent withdrawal and retry workflows require the clinic's operational processes or later implementation. For a partial affiliate invitation failure, review the auth user and inactive/missing affiliate/profile in Supabase before retrying; the server does not delete auth accounts automatically.

## Editing the design

| Change | File |
| --- | --- |
| Colours, spacing, mobile breakpoints, typography | `app/globals.css` |
| Public landing page copy/sections | `components/landing.js` |
| Services, brands, sample frames, pre-visit instructions | `lib/config.js` |
| Shop Frames page | `components/shop.js` (rules in `lib/shop.js`) |
| Booking steps and questions | `components/booking-flow.js` |
| Affiliate and staff screens | `components/workspace.js` |
| Reusable header, footer, buttons and fields | `components/ui.js` |
| Database schema and booking/payout rules | `supabase/schema.sql` |
| Demo records | `lib/demo.js` |
| Local concept images | `public/images/` |

Replace images using the same filenames, or update the references. Keep appropriate permissions and descriptive alt text. Clinic contact values belong in the environment, not hardcoded fictional text. Update the draft privacy page in `app/privacy/page.js` with the clinic's approved notice. The current typography uses local system fonts and a serif display stack; there is no external font dependency or animation library.

## 6. Common errors and fixes

| Problem | Fix |
| --- | --- |
| `npm` / `node` is not recognised | Install Node LTS, close/reopen VS Code and run the version commands again. |
| `ENOENT` / missing `package.json` | Open a terminal inside `eyecon-module-1`, the folder that actually contains `package.json`. |
| Unsupported Node version | Install a current supported LTS release and select it in Vercel's Node settings too. |
| Port 3000 is busy | Open the port printed by Next.js, or stop the other local server. You can run `npm run dev -- --port 3001`. |
| Browser changes look stale | Save the file, reload, check terminal errors. Restart after `.env.local` changes. Public environment changes require a rebuild on Vercel. |
| Old demo dates / sample changes | Use Reset demo data at `/login`; demo data persists in browser storage. |
| Supabase "already exists" error | The supplied SQL is an initial schema, not a repeatable migration. Use a fresh project or review migrations before modifying existing data. |
| Live sign-in succeeds but workspace denied | Verify the user's UUID and role in `public.profiles`. Affiliate accounts must have a matching active affiliate row. |
| No live appointment times | Sign in as staff and add future slots. Only available non-overlapping slots within 90 days are returned. |
| "That time is no longer available" | Select another time; check the database/service logs if every valid slot fails. |
| Turnstile verification rejected | Confirm matching key pair, allowed hostname, exact deployment domain and site URL, then redeploy. |
| Insurance storage not configured | Supply the exact 64-character hex key, or leave the optional policy number blank while configuring it. |
| Email/SMS does not arrive | Check the delivery log and provider dashboards, sender verification, credentials, phone format and SMS consent. Demo never sends messages. |
| Git requests your identity | Run `git config --global user.name "Your Name"` and `git config --global user.email "YOUR-GITHUB-EMAIL"`, then repeat the commit. |
| Git says `remote origin already exists` | Inspect `git remote -v`; if wrong, use `git remote set-url origin YOUR-ACTUAL-REPOSITORY-URL`. |
| GitHub authentication/push rejected | Sign in using GitHub Desktop or Git Credential Manager. Verify you own/have write access to the repository. |
| Vercel cannot find the project | Set Root Directory to the folder containing `package.json` and select the Next.js preset. |
| Vercel build fails | Read the first actual error in Build Logs; check Node version, exact filename case, committed files and env variables. Run `npm run build` locally. |
| Secrets accidentally committed | Revoke/rotate them at the provider immediately, remove them from Git history with a reviewed process, and update deployment variables. |

## References

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [GitHub: add local code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
- [Vercel Git deployment](https://vercel.com/docs/git)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Cloudflare Turnstile server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Resend email API](https://resend.com/docs/api-reference/emails/send-email)
- [Twilio SMS API](https://www.twilio.com/docs/messaging/api/message-resource)

## Validation

Run `npm test` and `npm run build` after changing the project. The production build and eight core tests passed. Browser checks covered the demo booking, calendar download, referral filtering, attendance, commission, manual booking, affiliate creation and mobile layout with no page errors. An automated axe scan of 17 desktop/mobile screens and states reported no findings for the selected WCAG 2 A/AA, 2.1 A/AA and 2.2 AA rule tags after fixes. This automated scan is not a full accessibility audit. Live Supabase, email/SMS delivery, Turnstile, reminders and Vercel deployment must still be verified with your accounts. No live patient data was used.
