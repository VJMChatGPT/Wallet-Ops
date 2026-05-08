-- Extend portfolio snapshots to emphasize token ownership over USD valuation

ALTER TABLE public.portfolio_snapshots
  ADD COLUMN IF NOT EXISTS selected_token_mint TEXT,
  ADD COLUMN IF NOT EXISTS selected_token_symbol TEXT,
  ADD COLUMN IF NOT EXISTS total_sol_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS total_usdc_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS total_selected_token_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS total_selected_token_supply_percent NUMERIC;

ALTER TABLE public.portfolio_snapshot_wallets
  ADD COLUMN IF NOT EXISTS usdc_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS selected_token_mint TEXT,
  ADD COLUMN IF NOT EXISTS selected_token_symbol TEXT,
  ADD COLUMN IF NOT EXISTS selected_token_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS selected_token_supply_percent NUMERIC;

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_selected_token_mint
  ON public.portfolio_snapshots(selected_token_mint);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshot_wallets_selected_token_mint
  ON public.portfolio_snapshot_wallets(selected_token_mint);
