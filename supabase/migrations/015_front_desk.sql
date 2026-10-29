-- Adds the front desk role: clinic staff who use /desk for Bookings, Gift cards and Leads only, and never see
-- commissions, payouts, pricing or procedure amounts. Staff admin invite them from Staff admin > Team and can turn
-- their access off and on again. Run this once in the Supabase SQL editor, after 014_health_card_documents.sql.
-- Existing staff and affiliate accounts are unchanged.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('staff','front-desk','affiliate'));
alter table public.profiles drop constraint if exists profiles_check;
alter table public.profiles add constraint profiles_check check ((role='affiliate' and affiliate_id is not null) or role in ('staff','front-desk'));
-- The Team page lists each member by name and email. active=false refuses their next request.
alter table public.profiles add column if not exists name text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
create index if not exists profiles_role_idx on public.profiles(role);
