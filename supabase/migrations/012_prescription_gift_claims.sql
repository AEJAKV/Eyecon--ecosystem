-- Gift cards claimed without booking, by a visitor who came through an affiliate's link and already has a prescription.
-- They give their name and email (and optionally a health card number or insurance) and the card is emailed to them to
-- use in store. Run this once in the Supabase SQL editor, after 011_released_gift_cards.sql.
-- Only the server (service role) can read or write this table, like the others. Affiliates never see these rows.

-- 1. Claims. The serial uses the same six-character alphabet as every other gift card and the 180 days start at the
-- claim. The health card number and the insurance policy number are stored encrypted by the server (encryptPolicy in
-- lib/server.js), like a booking's policy number. One claim per email address per affiliate.
create table public.gift_claims (
 id uuid primary key default gen_random_uuid(),
 affiliate_id uuid not null references public.affiliates(id),
 serial text not null check (serial ~ '^[2-9A-HJ-NP-Z]{6}$'),
 name text not null check (char_length(name) between 2 and 120),
 email text not null check (char_length(email) <= 254),
 health_card text,
 insurance text check (insurance is null or char_length(insurance) <= 120),
 policy text,
 issued_at timestamptz not null default now(),
 expires_at timestamptz not null,
 status text not null default 'Issued' check (status in ('Issued','Redeemed','Expired','Void')),
 check (expires_at > issued_at)
);
create unique index gift_claims_serial_unique on public.gift_claims(serial);
create unique index gift_claims_email_unique on public.gift_claims(affiliate_id, lower(email));
create index gift_claims_affiliate_index on public.gift_claims(affiliate_id);
alter table public.gift_claims enable row level security;
revoke all on public.gift_claims from anon, authenticated;

-- 2. A serial stays unique across bookings, released cards and claims. The two guards from 011 also look at claims
-- now, and claims get their own guard. All take the same lock per serial so two writers cannot race.
create or replace function public.gift_card_serial_guard() returns trigger language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext('gift-serial:' || new.serial));
 if exists (select 1 from bookings where gift_serial = new.serial and id is distinct from new.booking_id)
  or exists (select 1 from gift_claims where serial = new.serial) then
  raise exception 'gift serial in use' using errcode = '23505';
 end if;
 return new;
end;$$;

create or replace function public.booking_gift_serial_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if new.gift_serial is null then return new; end if;
 perform pg_advisory_xact_lock(hashtext('gift-serial:' || new.gift_serial));
 if exists (select 1 from gift_cards where serial = new.gift_serial and booking_id is distinct from new.id)
  or exists (select 1 from gift_claims where serial = new.gift_serial) then
  raise exception 'gift serial in use' using errcode = '23505';
 end if;
 return new;
end;$$;

create function public.gift_claim_serial_guard() returns trigger language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext('gift-serial:' || new.serial));
 if exists (select 1 from bookings where gift_serial = new.serial) or exists (select 1 from gift_cards where serial = new.serial) then
  raise exception 'gift serial in use' using errcode = '23505';
 end if;
 return new;
end;$$;
create trigger gift_claims_serial_guard before insert or update of serial on public.gift_claims
 for each row execute function public.gift_claim_serial_guard();

-- 3. Records the attempt (the same per-IP table and limit as releases: 10 an hour), checks the affiliate is active,
-- refuses a second claim for the same email and affiliate, and stores the claim. The website draws the serial; a
-- serial clash (23505) rolls this call back, attempt included, and the website draws another.
create function public.claim_prescription_gift(p_affiliate uuid, p_serial text, p_days integer, p_name text, p_email text,
 p_health_card text, p_insurance text, p_policy text, p_request_hash text)
returns setof public.gift_claims language plpgsql security definer set search_path=public as $$
declare issued timestamptz := now();
begin
 perform pg_advisory_xact_lock(hashtext('gift-release:' || p_request_hash));
 delete from gift_release_attempts where request_hash = p_request_hash and created_at < now() - interval '1 day';
 if (select count(*) from gift_release_attempts where request_hash = p_request_hash and created_at > now() - interval '1 hour') >= 10 then raise exception 'rate limit'; end if;
 insert into gift_release_attempts(request_hash) values (p_request_hash);
 if not exists (select 1 from affiliates where id = p_affiliate and active = true) then raise exception 'inactive affiliate'; end if;
 if exists (select 1 from gift_claims where affiliate_id = p_affiliate and lower(email) = lower(p_email)) then raise exception 'already claimed'; end if;
 return query insert into gift_claims(affiliate_id, serial, name, email, health_card, insurance, policy, issued_at, expires_at)
  values (p_affiliate, p_serial, p_name, lower(p_email), p_health_card, nullif(p_insurance, ''), p_policy, issued, issued + p_days * interval '1 day') returning *;
end;$$;
revoke all on function public.claim_prescription_gift(uuid,text,integer,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_prescription_gift(uuid,text,integer,text,text,text,text,text,text) to service_role;
