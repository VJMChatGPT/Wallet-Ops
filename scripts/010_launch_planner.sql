alter table if exists tracked_wallets
  add column if not exists eligible_for_rotation boolean not null default true,
  add column if not exists last_used_at timestamptz null,
  add column if not exists times_used integer not null default 0,
  add column if not exists last_launch_id uuid null,
  add column if not exists last_launch_name text null,
  add column if not exists active boolean not null default true,
  add column if not exists notes text null;

create table if not exists launch_plans (
  id uuid primary key default gen_random_uuid(),
  name text null,
  previous_sheet_id uuid null references sheets(id) on delete set null,
  previous_sheet_name text null,
  token_mint text null,
  token_symbol text null,
  selection_mode text not null check (
    selection_mode in ('manual', 'automatic_rotation', 'least_recently_used', 'weighted_random')
  ),
  desired_wallet_count integer not null check (desired_wallet_count > 0),
  exclude_previous_launch boolean not null default false,
  prefer_lower_historical_usage boolean not null default true,
  randomness_factor numeric not null default 0,
  target_average_sol numeric null,
  min_sol numeric null,
  max_sol numeric null,
  variance_config jsonb null,
  reserve_floor numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists launch_plan_wallets (
  id uuid primary key default gen_random_uuid(),
  launch_plan_id uuid not null references launch_plans(id) on delete cascade,
  wallet_id uuid not null references tracked_wallets(id) on delete cascade,
  role text not null check (
    role in ('selected', 'non_selected', 'previous_launch', 'source', 'destination')
  ),
  current_sol numeric null,
  target_sol numeric null,
  deficit_sol numeric null,
  surplus_sol numeric null,
  was_used_in_previous_launch boolean not null default false,
  selected_for_next_launch boolean not null default false,
  selection_reason text null,
  historical_times_used integer not null default 0,
  historical_last_used_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (launch_plan_id, wallet_id)
);

create table if not exists launch_plan_transfers (
  id uuid primary key default gen_random_uuid(),
  launch_plan_id uuid not null references launch_plans(id) on delete cascade,
  source_wallet_id uuid not null references tracked_wallets(id) on delete cascade,
  destination_wallet_id uuid not null references tracked_wallets(id) on delete cascade,
  amount_sol numeric not null,
  source_before numeric null,
  source_after numeric null,
  destination_before numeric null,
  destination_after numeric null,
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists launch_plans_created_at_idx
  on launch_plans (created_at desc);

create index if not exists launch_plan_wallets_launch_plan_id_idx
  on launch_plan_wallets (launch_plan_id);

create index if not exists launch_plan_wallets_wallet_id_idx
  on launch_plan_wallets (wallet_id);

create index if not exists launch_plan_transfers_launch_plan_id_idx
  on launch_plan_transfers (launch_plan_id);

alter table launch_plans enable row level security;
alter table launch_plan_wallets enable row level security;
alter table launch_plan_transfers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plans'
      and policyname = 'launch_plans_public_select'
  ) then
    create policy launch_plans_public_select on launch_plans
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plans'
      and policyname = 'launch_plans_public_insert'
  ) then
    create policy launch_plans_public_insert on launch_plans
      for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plans'
      and policyname = 'launch_plans_public_update'
  ) then
    create policy launch_plans_public_update on launch_plans
      for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plans'
      and policyname = 'launch_plans_public_delete'
  ) then
    create policy launch_plans_public_delete on launch_plans
      for delete using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plan_wallets'
      and policyname = 'launch_plan_wallets_public_select'
  ) then
    create policy launch_plan_wallets_public_select on launch_plan_wallets
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plan_wallets'
      and policyname = 'launch_plan_wallets_public_insert'
  ) then
    create policy launch_plan_wallets_public_insert on launch_plan_wallets
      for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plan_wallets'
      and policyname = 'launch_plan_wallets_public_update'
  ) then
    create policy launch_plan_wallets_public_update on launch_plan_wallets
      for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plan_wallets'
      and policyname = 'launch_plan_wallets_public_delete'
  ) then
    create policy launch_plan_wallets_public_delete on launch_plan_wallets
      for delete using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plan_transfers'
      and policyname = 'launch_plan_transfers_public_select'
  ) then
    create policy launch_plan_transfers_public_select on launch_plan_transfers
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plan_transfers'
      and policyname = 'launch_plan_transfers_public_insert'
  ) then
    create policy launch_plan_transfers_public_insert on launch_plan_transfers
      for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plan_transfers'
      and policyname = 'launch_plan_transfers_public_update'
  ) then
    create policy launch_plan_transfers_public_update on launch_plan_transfers
      for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'launch_plan_transfers'
      and policyname = 'launch_plan_transfers_public_delete'
  ) then
    create policy launch_plan_transfers_public_delete on launch_plan_transfers
      for delete using (true);
  end if;
end $$;
