-- Calculated affiliate commission. Staff enter what the patient was billed and any discount; the database works out
-- the rest:  net = max(gross − discount − operation cost, 0),  commission = round(net × rate ÷ 100, 2), and only
-- for bookings that came from an affiliate. The affiliate's commission_rate is now the real rate (a percentage).
-- Run this once in the Supabase SQL editor, after 006_booking_lookup.sql.
-- None of these amounts are ever sent to affiliates; they see only their commission.

-- 1. Retail price and operation cost per procedure (service id from lib/config.js). Seeded at 0 until staff fill in
-- Staff admin > Pricing.
create table public.procedure_costs (
 service text primary key check (service in ('eye-exam','contacts','dry-eye','children','testing','styling')),
 retail_price numeric(12,2) not null default 0 check (retail_price >= 0),
 operation_cost numeric(12,2) not null default 0 check (operation_cost >= 0),
 updated_at timestamptz not null default now()
);
insert into public.procedure_costs (service, retail_price, operation_cost) values
 ('eye-exam',0,0),('contacts',0,0),('dry-eye',0,0),('children',0,0),('testing',0,0),('styling',0,0)
on conflict (service) do nothing;
alter table public.procedure_costs enable row level security;
revoke all on public.procedure_costs from anon, authenticated;

-- 2. The amounts behind each commission. operation_cost and commission_rate are snapshots taken the first time the
-- appointment is completed, so later price or rate changes do not alter an existing calculation.
alter table public.bookings add column if not exists gross_amount numeric(12,2) check (gross_amount is null or gross_amount >= 0);
alter table public.bookings add column if not exists discount_amount numeric(12,2) check (discount_amount is null or discount_amount >= 0);
alter table public.bookings add column if not exists operation_cost numeric(12,2) check (operation_cost is null or operation_cost >= 0);
alter table public.bookings add column if not exists net_amount numeric(12,2) check (net_amount is null or net_amount >= 0);
alter table public.bookings add column if not exists commission_rate numeric(5,2) check (commission_rate is null or commission_rate between 0 and 100);

-- 3. Complete an appointment: mark it Attended and calculate its commission. Paid bookings are locked.
create function public.complete_appointment(p_id uuid, p_gross numeric, p_discount numeric, p_actor uuid)
returns setof public.bookings language plpgsql security definer set search_path=public as $$
declare b bookings; v_gross numeric(12,2); v_discount numeric(12,2); v_cost numeric(12,2); v_rate numeric(5,2); v_net numeric(12,2);
begin
 select * into b from bookings where id = p_id for update;
 if not found then raise exception 'booking not found'; end if;
 if b.payout = 'Paid' then raise exception 'paid bookings are locked'; end if;
 v_gross := round(p_gross, 2); v_discount := round(coalesce(p_discount, 0), 2);
 if v_gross is null or v_gross < 0 or v_gross > 1000000 then raise exception 'invalid gross amount'; end if;
 if v_discount < 0 or v_discount > v_gross then raise exception 'invalid discount'; end if;
 v_cost := coalesce(b.operation_cost, (select operation_cost from procedure_costs where service = b.service), 0);
 if b.affiliate_id is not null then
  v_rate := coalesce(b.commission_rate, (select round(commission_rate, 2) from affiliates where id = b.affiliate_id), 0);
 end if;
 v_net := greatest(v_gross - v_discount - v_cost, 0);
 return query update bookings set status = 'Attended', gross_amount = v_gross, discount_amount = v_discount, operation_cost = v_cost,
  net_amount = v_net, commission_rate = v_rate, commission = case when b.affiliate_id is null then 0 else round(v_net * v_rate / 100, 2) end
 where id = p_id returning *;
 insert into audit_logs(actor_id, action, record_id) values (p_actor, 'complete_appointment', p_id::text);
end;$$;
revoke all on function public.complete_appointment(uuid,numeric,numeric,uuid) from public, anon, authenticated;
grant execute on function public.complete_appointment(uuid,numeric,numeric,uuid) to service_role;
