export const TRADE_STATUS_OPTIONS = ["SI", "NO", "+0-", "Dev"] as const
export const FUNDING_SOURCE_OPTIONS = [
  "COINEX",
  "MEXC",
  "BINGX",
  "OKX",
  "MERGEN",
  "BLOFIN",
  "WEEX",
  "Bitunix",
  "HTX",
  "De wallet",
  "---",
] as const
export const PLATFORM_OPTIONS = [
  "PADRE",
  "AXIOM",
  "GMGN",
  "rapidlaunch",
  "Pump",
  "PepeBoost",
  "Uxento",
  "---",
] as const

export type TradeStatusOption = (typeof TRADE_STATUS_OPTIONS)[number]
export type FundingSourceOption = (typeof FUNDING_SOURCE_OPTIONS)[number]
export type PlatformOption = (typeof PLATFORM_OPTIONS)[number]

type WalletFieldOption = TradeStatusOption | FundingSourceOption | PlatformOption

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeOption<T extends readonly string[]>(
  value: unknown,
  options: T
): T[number] | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  return options.includes(normalized as T[number])
    ? (normalized as T[number])
    : null
}

export function normalizeTradeStatus(value: unknown) {
  return normalizeOption(value, TRADE_STATUS_OPTIONS)
}

export function normalizeFundingSourceLabel(value: unknown) {
  return normalizeOption(value, FUNDING_SOURCE_OPTIONS)
}

export function normalizePlatform(value: unknown) {
  return normalizeOption(value, PLATFORM_OPTIONS)
}

export function normalizeFundedAt(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = new Date(`${normalized}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function formatFundedAtInputValue(value: string | null | undefined) {
  if (!value) return ""

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }

  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function formatFundedAtDisplay(value: string | null | undefined) {
  if (!value) return "---"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed)
}

export function getWalletFieldBadgeClass(value: WalletFieldOption | null | undefined) {
  switch (value) {
    case "SI":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    case "NO":
      return "border-slate-500/40 bg-slate-500/10 text-slate-300"
    case "+0-":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300"
    case "Dev":
      return "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
    case "COINEX":
    case "MEXC":
    case "BINGX":
    case "OKX":
    case "MERGEN":
    case "BLOFIN":
    case "WEEX":
    case "Bitunix":
    case "HTX":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300"
    case "De wallet":
      return "border-violet-500/40 bg-violet-500/10 text-violet-300"
    case "PADRE":
    case "AXIOM":
    case "GMGN":
    case "rapidlaunch":
    case "Pump":
    case "PepeBoost":
    case "Uxento":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
    case "---":
      return "border-border bg-muted/40 text-muted-foreground"
    default:
      return "border-border bg-muted/40 text-muted-foreground"
  }
}
