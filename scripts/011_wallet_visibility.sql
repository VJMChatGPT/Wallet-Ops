alter table if exists tracked_wallets
  add column if not exists visible_in_workbook boolean not null default true;
