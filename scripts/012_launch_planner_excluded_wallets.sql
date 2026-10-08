alter table if exists public.launch_plans
  add column if not exists excluded_wallet_ids jsonb not null default '[]'::jsonb;

update public.launch_plans
set excluded_wallet_ids = '[]'::jsonb
where excluded_wallet_ids is null;
