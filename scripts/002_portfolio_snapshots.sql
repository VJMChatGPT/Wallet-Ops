-- Portfolio snapshots for frozen before/after comparisons

CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  total_portfolio_usd NUMERIC NOT NULL DEFAULT 0,
  wallet_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portfolio_snapshot_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.portfolio_snapshots(id) ON DELETE CASCADE,
  wallet_id UUID NULL REFERENCES public.tracked_wallets(id) ON DELETE SET NULL,
  wallet_label TEXT,
  wallet_address TEXT NOT NULL,
  wallet_type TEXT CHECK (wallet_type IN ('mine', 'external')),
  sol_balance NUMERIC,
  sol_usd_value NUMERIC,
  tracked_tokens_usd_value NUMERIC,
  total_wallet_usd_value NUMERIC,
  token_breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_created_at
  ON public.portfolio_snapshots(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshot_wallets_snapshot_id
  ON public.portfolio_snapshot_wallets(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshot_wallets_wallet_address
  ON public.portfolio_snapshot_wallets(wallet_address);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshot_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to portfolio_snapshots"
  ON public.portfolio_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to portfolio_snapshots"
  ON public.portfolio_snapshots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to portfolio_snapshots"
  ON public.portfolio_snapshots FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to portfolio_snapshots"
  ON public.portfolio_snapshots FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to portfolio_snapshot_wallets"
  ON public.portfolio_snapshot_wallets FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to portfolio_snapshot_wallets"
  ON public.portfolio_snapshot_wallets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to portfolio_snapshot_wallets"
  ON public.portfolio_snapshot_wallets FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to portfolio_snapshot_wallets"
  ON public.portfolio_snapshot_wallets FOR DELETE
  USING (true);
