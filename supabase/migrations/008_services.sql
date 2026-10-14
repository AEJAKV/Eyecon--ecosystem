-- Adds the Non-Invasive Skin Tightening service (id 'skin-tightening') and an optional per-booking service option,
-- used for the skin tightening technology the patient chose (a slug from skinTechnologies in lib/config.js).
-- Run this once in the Supabase SQL editor, after 007_commission.sql.

-- 1. Bookings may be for skin tightening. The original check came from schema.sql (named bookings_service_check).
alter table public.bookings drop constraint if exists bookings_service_check;
alter table public.bookings add constraint bookings_service_check
 check (service in ('eye-exam','contacts','dry-eye','children','testing','skin-tightening','styling'));

-- 2. The optional choice within the service. Empty when the patient made none.
alter table public.bookings add column if not exists service_option text
 check (service_option is null or service_option ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- 3. Pricing (migration 007) has the same list of services, and a row per service starting at 0.
alter table public.procedure_costs drop constraint if exists procedure_costs_service_check;
alter table public.procedure_costs add constraint procedure_costs_service_check
 check (service in ('eye-exam','contacts','dry-eye','children','testing','skin-tightening','styling'));
insert into public.procedure_costs (service, retail_price, operation_cost) values ('skin-tightening', 0, 0)
on conflict (service) do nothing;
