-- New gift card claims ("Already have a prescription") flagged in the admin and front desk workspaces: each user's
-- gifts_seen_at moves to now when they press Mark seen on Gift cards. Claims made after it are new to them.
-- Run this once in the Supabase SQL editor, after 019_remove_doctor.sql.

alter table public.workspace_seen add column if not exists gifts_seen_at timestamptz not null default now();
create index if not exists gift_claims_issued_at_idx on public.gift_claims(issued_at desc);
