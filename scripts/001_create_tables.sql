-- Pump.fun Holdings Tracker - Database Schema
-- Version 1: Initial schema for tracked wallets and tokens

-- 1. Create tracked_wallets table
CREATE TABLE IF NOT EXISTS public.tracked_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL UNIQUE,
  label TEXT,
  type TEXT NOT NULL CHECK (type IN ('mine', 'external')) DEFAULT 'mine',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create tracked_tokens table
CREATE TABLE IF NOT EXISTS public.tracked_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mint TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 9,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create token_snapshots table (optional, for historical data)
CREATE TABLE IF NOT EXISTS public.token_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mint TEXT NOT NULL REFERENCES public.tracked_tokens(mint) ON DELETE CASCADE,
  market_cap NUMERIC,
  price_usd NUMERIC,
  total_supply_raw TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_type ON public.tracked_wallets(type);
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_address ON public.tracked_wallets(address);
CREATE INDEX IF NOT EXISTS idx_tracked_tokens_mint ON public.tracked_tokens(mint);
CREATE INDEX IF NOT EXISTS idx_token_snapshots_mint ON public.token_snapshots(mint);
CREATE INDEX IF NOT EXISTS idx_token_snapshots_created_at ON public.token_snapshots(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tracked_wallets (public read/write for this internal tool)
-- In a production app with auth, you'd use auth.uid() checks
CREATE POLICY "Allow public read access to tracked_wallets"
  ON public.tracked_wallets FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to tracked_wallets"
  ON public.tracked_wallets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to tracked_wallets"
  ON public.tracked_wallets FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to tracked_wallets"
  ON public.tracked_wallets FOR DELETE
  USING (true);

-- RLS Policies for tracked_tokens
CREATE POLICY "Allow public read access to tracked_tokens"
  ON public.tracked_tokens FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to tracked_tokens"
  ON public.tracked_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to tracked_tokens"
  ON public.tracked_tokens FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to tracked_tokens"
  ON public.tracked_tokens FOR DELETE
  USING (true);

-- RLS Policies for token_snapshots
CREATE POLICY "Allow public read access to token_snapshots"
  ON public.token_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to token_snapshots"
  ON public.token_snapshots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to token_snapshots"
  ON public.token_snapshots FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to token_snapshots"
  ON public.token_snapshots FOR DELETE
  USING (true);
