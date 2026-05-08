alter table public.tracked_wallets
  add column if not exists sort_order integer,
  add column if not exists trade_status text,
  add column if not exists funding_source_label text,
  add column if not exists funding_source_address text,
  add column if not exists funding_label_source text,
  add column if not exists first_funder_address text,
  add column if not exists platform text,
  add column if not exists funded_at timestamptz,
  add column if not exists funding_detection_method text,
  add column if not exists funding_detected_at timestamptz;

alter table public.portfolio_snapshot_wallets
  add column if not exists row_order integer,
  add column if not exists trade_status text,
  add column if not exists funding_source_label text,
  add column if not exists funding_source_address text,
  add column if not exists funding_label_source text,
  add column if not exists first_funder_address text,
  add column if not exists platform text,
  add column if not exists funded_at timestamptz;

create table if not exists public.sheets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('master', 'launch')),
  token_mint text,
  token_symbol text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sheets_single_master_idx
  on public.sheets(type)
  where type = 'master';

create index if not exists sheets_sort_order_idx
  on public.sheets(sort_order, created_at);

create table if not exists public.sheet_wallets (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.sheets(id) on delete cascade,
  wallet_id uuid not null references public.tracked_wallets(id) on delete cascade,
  row_order integer not null default 0,
  label text,
  trade_status text,
  funding_source_label text,
  funding_source_address text,
  funding_label_source text,
  first_funder_address text,
  platform text,
  funded_at timestamptz,
  funding_detection_method text,
  funding_detected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sheet_id, wallet_id)
);

create index if not exists sheet_wallets_sheet_order_idx
  on public.sheet_wallets(sheet_id, row_order, created_at);

create index if not exists sheet_wallets_wallet_idx
  on public.sheet_wallets(wallet_id);

alter table public.portfolio_snapshots
  add column if not exists sheet_id uuid references public.sheets(id) on delete cascade,
  add column if not exists sheet_name text;

alter table public.portfolio_snapshot_wallets
  add column if not exists trade_status text;

create index if not exists portfolio_snapshots_sheet_created_at_idx
  on public.portfolio_snapshots(sheet_id, created_at desc);

alter table public.sheets enable row level security;
alter table public.sheet_wallets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sheets'
      and policyname = 'Allow public read access to sheets'
  ) then
    create policy "Allow public read access to sheets"
      on public.sheets for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sheets'
      and policyname = 'Allow public insert access to sheets'
  ) then
    create policy "Allow public insert access to sheets"
      on public.sheets for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sheets'
      and policyname = 'Allow public update access to sheets'
  ) then
    create policy "Allow public update access to sheets"
      on public.sheets for update
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sheets'
      and policyname = 'Allow public delete access to sheets'
  ) then
    create policy "Allow public delete access to sheets"
      on public.sheets for delete
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sheet_wallets'
      and policyname = 'Allow public read access to sheet_wallets'
  ) then
    create policy "Allow public read access to sheet_wallets"
      on public.sheet_wallets for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sheet_wallets'
      and policyname = 'Allow public insert access to sheet_wallets'
  ) then
    create policy "Allow public insert access to sheet_wallets"
      on public.sheet_wallets for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sheet_wallets'
      and policyname = 'Allow public update access to sheet_wallets'
  ) then
    create policy "Allow public update access to sheet_wallets"
      on public.sheet_wallets for update
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sheet_wallets'
      and policyname = 'Allow public delete access to sheet_wallets'
  ) then
    create policy "Allow public delete access to sheet_wallets"
      on public.sheet_wallets for delete
      using (true);
  end if;
end $$;

insert into public.sheets (name, type, sort_order)
select 'All Wallets', 'master', 0
where not exists (
  select 1 from public.sheets where type = 'master'
);

with master_sheet as (
  select id
  from public.sheets
  where type = 'master'
  limit 1
),
ranked_wallets as (
  select
    tw.*,
    row_number() over (
      order by
        coalesce(tw.sort_order, 2147483647),
        tw.created_at,
        tw.address
    ) - 1 as fallback_row_order
  from public.tracked_wallets tw
)
insert into public.sheet_wallets (
  sheet_id,
  wallet_id,
  row_order,
  label,
  trade_status,
  funding_source_label,
  funding_source_address,
  funding_label_source,
  first_funder_address,
  platform,
  funded_at,
  funding_detection_method,
  funding_detected_at
)
select
  master_sheet.id,
  ranked_wallets.id,
  coalesce(ranked_wallets.sort_order, ranked_wallets.fallback_row_order),
  ranked_wallets.label,
  ranked_wallets.trade_status,
  ranked_wallets.funding_source_label,
  ranked_wallets.funding_source_address,
  ranked_wallets.funding_label_source,
  ranked_wallets.first_funder_address,
  ranked_wallets.platform,
  ranked_wallets.funded_at,
  ranked_wallets.funding_detection_method,
  ranked_wallets.funding_detected_at
from ranked_wallets
cross join master_sheet
where not exists (
  select 1
  from public.sheet_wallets sw
  where sw.sheet_id = master_sheet.id
    and sw.wallet_id = ranked_wallets.id
);

with master_sheet as (
  select id, name
  from public.sheets
  where type = 'master'
  limit 1
)
update public.portfolio_snapshots ps
set
  sheet_id = coalesce(ps.sheet_id, master_sheet.id),
  sheet_name = coalesce(ps.sheet_name, master_sheet.name)
from master_sheet
where ps.sheet_id is null
   or ps.sheet_name is null;
