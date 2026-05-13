alter table if exists public.sheet_wallets
  add column if not exists planned_for_launch boolean not null default false,
  add column if not exists used_in_launch boolean not null default false,
  add column if not exists used_notes text null;

alter table if exists public.portfolio_snapshot_wallets
  add column if not exists planned_for_launch boolean not null default false,
  add column if not exists used_in_launch boolean not null default false,
  add column if not exists used_notes text null;

alter table if exists public.portfolio_snapshots
  add column if not exists total_sol_planned numeric null,
  add column if not exists total_sol_used numeric null,
  add column if not exists total_sol_used_not_planned numeric null,
  add column if not exists total_selected_token_planned numeric null,
  add column if not exists total_selected_token_used numeric null,
  add column if not exists total_selected_token_used_not_planned numeric null,
  add column if not exists total_selected_token_supply_percent_planned numeric null,
  add column if not exists total_selected_token_supply_percent_used numeric null,
  add column if not exists total_selected_token_supply_percent_used_not_planned numeric null;
