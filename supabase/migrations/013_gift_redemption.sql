-- Staff mark a gift card redeemed when the patient uses it in store (from the booking details or after scanning the
-- card's QR code), and can undo a mistake. This records when and by whom. Run this once in the Supabase SQL editor,
-- after 012_prescription_gift_claims.sql. The status values ('Redeemed') already exist from 011 and 012.
alter table public.bookings add column if not exists gift_redeemed_at timestamptz;
alter table public.bookings add column if not exists gift_redeemed_by uuid references auth.users(id) on delete set null;
alter table public.gift_claims add column if not exists redeemed_at timestamptz;
alter table public.gift_claims add column if not exists redeemed_by uuid references auth.users(id) on delete set null;
-- Any card already marked Redeemed before this file gets a redemption time, so the checks below hold.
update public.bookings set gift_redeemed_at = now() where gift_status = 'Redeemed' and gift_redeemed_at is null;
update public.gift_claims set redeemed_at = now() where status = 'Redeemed' and redeemed_at is null;
-- A redeemed card always has its redemption time, and only a redeemed card has one.
alter table public.bookings add constraint bookings_gift_redeemed_check check ((gift_status = 'Redeemed') = (gift_redeemed_at is not null));
alter table public.gift_claims add constraint gift_claims_redeemed_check check ((status = 'Redeemed') = (redeemed_at is not null));
