-- Gift cards released when a visitor opens an affiliate's link, not when they book. The 180 days start at release.
-- The website keeps the visitor's card and claim token in their browser; booking with that token claims the card.
-- Run this once in the Supabase SQL editor, after 010_doctors_and_schedules.sql (it builds on 002_gift_cards.sql).
-- Only the server (service role) can read or write these tables, like the others.

-- 1. A booking's gift card may now come from a claimed released card, so its status can also be 'Claimed'.
alter table public.bookings drop constraint if exists bookings_gift_status_check;
alter table public.bookings add constraint bookings_gift_status_check check (gift_status is null or gift_status in ('Issued','Claimed','Redeemed','Expired','Void'));

-- 2. Released cards. The serial uses the same six-character alphabet as bookings.gift_serial. The claim token is
-- 32 random bytes handed to the visitor once; only its SHA-256 hash (hashToken in lib/server.js) is stored.
create table public.gift_cards (
 id uuid primary key default gen_random_uuid(),
 affiliate_id uuid not null references public.affiliates(id),
 serial text not null check (serial ~ '^[2-9A-HJ-NP-Z]{6}$'),
 released_at timestamptz not null default now(),
 expires_at timestamptz not null,
 status text not null default 'Released' check (status in ('Released','Claimed','Redeemed','Expired','Void')),
 booking_id uuid references public.bookings(id),
 token_hash text not null,
 check (expires_at > released_at),
 check ((status = 'Released') = (booking_id is null) or status in ('Redeemed','Expired','Void'))
);
create unique index gift_cards_serial_unique on public.gift_cards(serial);
create unique index gift_cards_token_unique on public.gift_cards(token_hash);
create unique index gift_cards_booking_unique on public.gift_cards(booking_id) where booking_id is not null;
create index gift_cards_affiliate_index on public.gift_cards(affiliate_id);
alter table public.gift_cards enable row level security;
revoke all on public.gift_cards from anon, authenticated;

-- 3. A serial is unique across released cards and bookings. A booking may hold the serial of the card that was
-- claimed for it (the same card), and no other. Each trigger takes the same lock so two writers cannot race.
create function public.gift_card_serial_guard() returns trigger language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext('gift-serial:' || new.serial));
 if exists (select 1 from bookings where gift_serial = new.serial and id is distinct from new.booking_id) then
  raise exception 'gift serial in use' using errcode = '23505';
 end if;
 return new;
end;$$;
create trigger gift_cards_serial_guard before insert or update of serial, booking_id on public.gift_cards
 for each row execute function public.gift_card_serial_guard();

create function public.booking_gift_serial_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if new.gift_serial is null then return new; end if;
 perform pg_advisory_xact_lock(hashtext('gift-serial:' || new.gift_serial));
 if exists (select 1 from gift_cards where serial = new.gift_serial and booking_id is distinct from new.id) then
  raise exception 'gift serial in use' using errcode = '23505';
 end if;
 return new;
end;$$;
create trigger bookings_gift_serial_guard before insert or update of gift_serial on public.bookings
 for each row execute function public.booking_gift_serial_guard();

-- 4. Releases per hashed IP (the same hash the booking form uses), at most 10 an hour.
create table public.gift_release_attempts (
 id bigint generated always as identity primary key,
 request_hash text not null,
 created_at timestamptz not null default now()
);
create index gift_release_attempts_hash_index on public.gift_release_attempts(request_hash, created_at);
alter table public.gift_release_attempts enable row level security;
revoke all on public.gift_release_attempts from anon, authenticated;

-- Records the attempt, refuses the 11th within an hour, checks the affiliate is active and stores the card.
-- The website draws the serial and token; a serial clash (23505) rolls this call back, attempt included, and the
-- website simply draws another. expires_at is released_at plus p_days (GIFT_CARD_DAYS, 180).
create function public.release_gift_card(p_affiliate uuid, p_serial text, p_token_hash text, p_days integer, p_request_hash text)
returns setof public.gift_cards language plpgsql security definer set search_path=public as $$
declare released timestamptz := now();
begin
 perform pg_advisory_xact_lock(hashtext('gift-release:' || p_request_hash));
 delete from gift_release_attempts where request_hash = p_request_hash and created_at < now() - interval '1 day';
 if (select count(*) from gift_release_attempts where request_hash = p_request_hash and created_at > now() - interval '1 hour') >= 10 then raise exception 'rate limit'; end if;
 insert into gift_release_attempts(request_hash) values (p_request_hash);
 if not exists (select 1 from affiliates where id = p_affiliate and active = true) then raise exception 'inactive affiliate'; end if;
 return query insert into gift_cards(affiliate_id, serial, released_at, expires_at, token_hash)
  values (p_affiliate, p_serial, released, released + p_days * interval '1 day', p_token_hash) returning *;
end;$$;
revoke all on function public.release_gift_card(uuid,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.release_gift_card(uuid,text,text,integer,text) to service_role;
