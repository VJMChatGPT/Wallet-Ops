-- Manual spreadsheet-style fields for tracked wallets

ALTER TABLE public.tracked_wallets
  ADD COLUMN IF NOT EXISTS trade_status TEXT,
  ADD COLUMN IF NOT EXISTS funding_cex TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS planned_date TEXT;

ALTER TABLE public.portfolio_snapshot_wallets
  ADD COLUMN IF NOT EXISTS trade_status TEXT,
  ADD COLUMN IF NOT EXISTS funding_cex TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS planned_date TEXT;

CREATE INDEX IF NOT EXISTS idx_tracked_wallets_trade_status
  ON public.tracked_wallets(trade_status);

CREATE INDEX IF NOT EXISTS idx_tracked_wallets_funding_cex
  ON public.tracked_wallets(funding_cex);

CREATE INDEX IF NOT EXISTS idx_tracked_wallets_platform
  ON public.tracked_wallets(platform);
