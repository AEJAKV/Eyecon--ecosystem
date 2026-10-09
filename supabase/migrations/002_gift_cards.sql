-- Referral gift cards. Run this once in the Supabase SQL editor, after schema.sql and 001_preferred_doctor.sql.

-- An optional three-letter code per affiliate, used in their gift card numbers (EYC-CODE-SERIAL).
-- When it is empty the website derives one from the affiliate's name.
alter table public.affiliates add column if not exists gift_code text check (gift_code is null or gift_code ~ '^[A-Z]{3}$');

-- The gift card issued to a referral booking: a six-character serial, when it was issued, when it expires
-- (180 days after issue) and its status. All four stay empty for bookings that did not come from a referral.
alter table public.bookings add column if not exists gift_serial text check (gift_serial is null or gift_serial ~ '^[2-9A-HJ-NP-Z]{6}$');
alter table public.bookings add column if not exists gift_issued_at timestamptz;
alter table public.bookings add column if not exists gift_expires_at timestamptz;
alter table public.bookings add column if not exists gift_status text check (gift_status is null or gift_status in ('Issued','Redeemed','Expired','Void'));

-- No two bookings can ever hold the same serial.
create unique index if not exists booking_gift_serial_unique on public.bookings(gift_serial) where gift_serial is not null;
