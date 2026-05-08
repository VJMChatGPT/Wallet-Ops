alter table public.tracked_wallets
  add column if not exists funding_source_address text,
  add column if not exists funding_label_source text;

update public.tracked_wallets
set funding_source_address = coalesce(funding_source_address, first_funder_address)
where first_funder_address is not null;

alter table public.portfolio_snapshot_wallets
  add column if not exists funding_source_address text,
  add column if not exists funding_label_source text;

update public.portfolio_snapshot_wallets
set funding_source_address = coalesce(funding_source_address, first_funder_address)
where first_funder_address is not null;

alter table public.funding_source_addresses
  add column if not exists source text;

create index if not exists tracked_wallets_funding_source_address_idx
  on public.tracked_wallets(funding_source_address);

create index if not exists portfolio_snapshot_wallets_funding_source_address_idx
  on public.portfolio_snapshot_wallets(funding_source_address);
