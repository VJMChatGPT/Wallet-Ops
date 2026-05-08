alter table public.tracked_wallets
  add column if not exists funding_source_label text,
  add column if not exists first_funder_address text,
  add column if not exists funded_at timestamptz,
  add column if not exists funding_detection_method text,
  add column if not exists funding_detected_at timestamptz;

update public.tracked_wallets
set funding_source_label = funding_cex
where funding_source_label is null
  and funding_cex is not null;

update public.tracked_wallets
set funded_at = (planned_date::date)::timestamptz
where funded_at is null
  and planned_date ~ '^\d{4}-\d{2}-\d{2}$';

create table if not exists public.funding_source_addresses (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  address text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists funding_source_addresses_address_idx
  on public.funding_source_addresses(address);

alter table public.funding_source_addresses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'funding_source_addresses'
      and policyname = 'Allow public read access to funding_source_addresses'
  ) then
    create policy "Allow public read access to funding_source_addresses"
      on public.funding_source_addresses for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'funding_source_addresses'
      and policyname = 'Allow public insert access to funding_source_addresses'
  ) then
    create policy "Allow public insert access to funding_source_addresses"
      on public.funding_source_addresses for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'funding_source_addresses'
      and policyname = 'Allow public update access to funding_source_addresses'
  ) then
    create policy "Allow public update access to funding_source_addresses"
      on public.funding_source_addresses for update
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'funding_source_addresses'
      and policyname = 'Allow public delete access to funding_source_addresses'
  ) then
    create policy "Allow public delete access to funding_source_addresses"
      on public.funding_source_addresses for delete
      using (true);
  end if;
end $$;

alter table public.portfolio_snapshot_wallets
  add column if not exists row_order integer,
  add column if not exists funding_source_label text,
  add column if not exists first_funder_address text,
  add column if not exists funded_at timestamptz;

update public.portfolio_snapshot_wallets
set funding_source_label = funding_cex
where funding_source_label is null
  and funding_cex is not null;

update public.portfolio_snapshot_wallets
set funded_at = (planned_date::date)::timestamptz
where funded_at is null
  and planned_date ~ '^\d{4}-\d{2}-\d{2}$';

create index if not exists portfolio_snapshot_wallets_row_order_idx
  on public.portfolio_snapshot_wallets(snapshot_id, row_order);
