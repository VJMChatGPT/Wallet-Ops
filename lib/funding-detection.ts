import { normalizeFundingSourceLabel } from "@/lib/wallet-fields"
import type { TrackedWallet } from "@/lib/types"

const HELIUS_API_KEY = process.env.HELIUS_API_KEY
const HELIUS_API_BASE_URL = "https://api.helius.xyz"
const HELIUS_ENHANCED_BASE_URL = "https://api-mainnet.helius-rpc.com/v0/addresses"

type FundingLabelSource =
  | "tracked_wallet"
  | "helius_funded_by"
  | "helius_identity"
  | "local_mapping"
  | "fallback"

interface HeliusEnhancedTransfer {
  fromUserAccount?: string
  toUserAccount?: string
}

interface HeliusEnhancedTransaction {
  timestamp?: number
  source?: string
  description?: string
  type?: string
  nativeTransfers?: HeliusEnhancedTransfer[]
  tokenTransfers?: HeliusEnhancedTransfer[]
}

interface HeliusFundedByResponse {
  funder: string
  timestamp?: number
  date?: string
  funderName?: string
  funderType?: string
}

interface HeliusIdentityResponse {
  address: string
  type?: string
  name?: string
  category?: string
  tags?: string[]
}

interface FundingSourceAddressRow {
  label: string
  address: string
  source: string | null
}

interface FundingDetectionResult {
  fundedAt: string | null
  firstFunderAddress: string | null
  fundingSourceAddress: string | null
  fundingSourceLabel: string | null
  fundingLabelSource: FundingLabelSource
  fundingDetectionMethod: string | null
}

function normalizeAddress(value: string | null | undefined) {
  return value?.trim() || null
}

function toIsoDate(timestamp?: number, date?: string) {
  if (date) {
    const parsed = new Date(date)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return new Date(timestamp * 1000).toISOString()
  }

  return null
}

function detectFundingLabelFromText(input: {
  source?: string
  description?: string
  type?: string
  name?: string
  category?: string
  tags?: string[]
  funderName?: string
  funderType?: string
}) {
  const haystack = [
    input.source,
    input.description,
    input.type,
    input.name,
    input.category,
    input.funderName,
    input.funderType,
    ...(input.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()

  const patterns: Array<[string, string[]]> = [
    ["COINEX", ["COINEX"]],
    ["MEXC", ["MEXC"]],
    ["BINGX", ["BINGX"]],
    ["OKX", ["OKX", "OK-EX"]],
    ["MERGEN", ["MERGEN"]],
    ["BLOFIN", ["BLOFIN"]],
    ["WEEX", ["WEEX"]],
    ["Bitunix", ["BITUNIX"]],
    ["HTX", ["HTX", "HUOBI"]],
  ]

  for (const [label, aliases] of patterns) {
    if (aliases.some((alias) => haystack.includes(alias))) {
      return label
    }
  }

  return null
}

async function fetchHeliusJson<T>(path: string): Promise<T | null> {
  if (!HELIUS_API_KEY) {
    return null
  }

  const url = new URL(path, HELIUS_API_BASE_URL)
  url.searchParams.set("api-key", HELIUS_API_KEY)

  const response = await fetch(url.toString(), {
    next: { revalidate: 0 },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Helius request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

async function fetchFundedBy(walletAddress: string) {
  return fetchHeliusJson<HeliusFundedByResponse>(
    `/v1/wallet/${walletAddress}/funded-by`
  )
}

async function fetchIdentity(walletAddress: string) {
  return fetchHeliusJson<HeliusIdentityResponse>(
    `/v1/wallet/${walletAddress}/identity`
  )
}

async function fetchEarliestFundingTransactions(walletAddress: string) {
  if (!HELIUS_API_KEY) {
    return [] as HeliusEnhancedTransaction[]
  }

  const buildUrl = () => {
    const url = new URL(`${HELIUS_ENHANCED_BASE_URL}/${walletAddress}/transactions`)
    url.searchParams.set("api-key", HELIUS_API_KEY)
    url.searchParams.set("sort-order", "asc")
    url.searchParams.set("limit", "25")
    url.searchParams.set("type", "TRANSFER")
    return url.toString()
  }

  try {
    const response = await fetch(buildUrl(), {
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      return [] as HeliusEnhancedTransaction[]
    }

    const transactions = (await response.json()) as HeliusEnhancedTransaction[]
    return Array.isArray(transactions) ? transactions : []
  } catch (error) {
    console.error("Error fetching fallback funding transactions:", error)
    return [] as HeliusEnhancedTransaction[]
  }
}

function resolveLabelFromTrackedWallet(
  fundingSourceAddress: string | null,
  trackedWalletAddresses: Set<string>
) {
  return fundingSourceAddress && trackedWalletAddresses.has(fundingSourceAddress)
    ? "De wallet"
    : null
}

function resolveLabelFromLocalMapping(
  fundingSourceAddress: string | null,
  sourceLabels: Map<string, string>
) {
  if (!fundingSourceAddress) {
    return null
  }

  return normalizeFundingSourceLabel(sourceLabels.get(fundingSourceAddress)) || null
}

function resolveLabelFromIdentity(identity: HeliusIdentityResponse | null) {
  if (!identity) {
    return null
  }

  return (
    detectFundingLabelFromText({
      name: identity.name,
      category: identity.category,
      type: identity.type,
      tags: identity.tags,
    }) || null
  )
}

function resolveLabelFromFundedBy(fundedBy: HeliusFundedByResponse | null) {
  if (!fundedBy) {
    return null
  }

  return (
    detectFundingLabelFromText({
      funderName: fundedBy.funderName,
      funderType: fundedBy.funderType,
    }) || null
  )
}

function buildResolvedFundingLabel(input: {
  fundingSourceAddress: string | null
  trackedWalletAddresses: Set<string>
  sourceLabels: Map<string, string>
  identity: HeliusIdentityResponse | null
  fundedBy: HeliusFundedByResponse | null
}) {
  const trackedLabel = resolveLabelFromTrackedWallet(
    input.fundingSourceAddress,
    input.trackedWalletAddresses
  )
  if (trackedLabel) {
    return {
      fundingSourceLabel: trackedLabel,
      fundingLabelSource: "tracked_wallet" as const,
    }
  }

  const identityLabel = resolveLabelFromIdentity(input.identity)
  if (identityLabel) {
    return {
      fundingSourceLabel: identityLabel,
      fundingLabelSource: "helius_identity" as const,
    }
  }

  const localLabel = resolveLabelFromLocalMapping(
    input.fundingSourceAddress,
    input.sourceLabels
  )
  if (localLabel) {
    return {
      fundingSourceLabel: localLabel,
      fundingLabelSource: "local_mapping" as const,
    }
  }

  const fundedByLabel = resolveLabelFromFundedBy(input.fundedBy)
  if (fundedByLabel) {
    return {
      fundingSourceLabel: fundedByLabel,
      fundingLabelSource: "helius_funded_by" as const,
    }
  }

  return {
    fundingSourceLabel: "---",
    fundingLabelSource: "fallback" as const,
  }
}

export async function detectWalletFundingMetadata(
  walletAddress: string,
  trackedWalletAddresses: Set<string>,
  sourceLabels: Map<string, string>
): Promise<FundingDetectionResult> {
  try {
    const fundedBy = await fetchFundedBy(walletAddress)
    const fundingSourceAddress = normalizeAddress(fundedBy?.funder)
    const fundedAt = toIsoDate(fundedBy?.timestamp, fundedBy?.date)

    const identity = fundingSourceAddress
      ? await fetchIdentity(fundingSourceAddress)
      : null

    const resolvedLabel = buildResolvedFundingLabel({
      fundingSourceAddress,
      trackedWalletAddresses,
      sourceLabels,
      identity,
      fundedBy,
    })

    if (fundingSourceAddress || fundedAt) {
      return {
        fundedAt,
        firstFunderAddress: fundingSourceAddress,
        fundingSourceAddress,
        fundingSourceLabel: resolvedLabel.fundingSourceLabel,
        fundingLabelSource: resolvedLabel.fundingLabelSource,
        fundingDetectionMethod: "helius_wallet_funded_by",
      }
    }
  } catch (error) {
    console.error("Error resolving funding via Helius funded-by:", error)
  }

  const transactions = await fetchEarliestFundingTransactions(walletAddress)

  for (const transaction of transactions) {
    const inboundTransfer =
      (transaction.nativeTransfers || []).find(
        (transfer) => normalizeAddress(transfer.toUserAccount) === walletAddress
      ) ||
      (transaction.tokenTransfers || []).find(
        (transfer) => normalizeAddress(transfer.toUserAccount) === walletAddress
      )

    if (!inboundTransfer) {
      continue
    }

    const fundingSourceAddress = normalizeAddress(inboundTransfer.fromUserAccount)
    const identity = fundingSourceAddress
      ? await fetchIdentity(fundingSourceAddress).catch(() => null)
      : null
    const resolvedLabel = buildResolvedFundingLabel({
      fundingSourceAddress,
      trackedWalletAddresses,
      sourceLabels,
      identity,
      fundedBy: null,
    })

    return {
      fundedAt: transaction.timestamp
        ? new Date(transaction.timestamp * 1000).toISOString()
        : null,
      firstFunderAddress: fundingSourceAddress,
      fundingSourceAddress,
      fundingSourceLabel: resolvedLabel.fundingSourceLabel,
      fundingLabelSource: resolvedLabel.fundingLabelSource,
      fundingDetectionMethod: "helius_enhanced_transfer_fallback",
    }
  }

  return {
    fundedAt: null,
    firstFunderAddress: null,
    fundingSourceAddress: null,
    fundingSourceLabel: "---",
    fundingLabelSource: "fallback",
    fundingDetectionMethod: null,
  }
}

export async function loadFundingSourceAddressMap(supabase: {
  from: (table: string) => {
    select: (columns?: string) => Promise<{
      data: FundingSourceAddressRow[] | null
      error: { message: string } | null
    }>
  }
}) {
  const { data, error } = await supabase
    .from("funding_source_addresses")
    .select("label,address,source")

  if (error) {
    throw new Error(error.message)
  }

  return new Map(
    (data || [])
      .filter((row) => row.address && row.label)
      .map((row) => [row.address, row.label])
  )
}

export async function enrichWalletFundingMetadata(
  supabase: {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{
          error: { message: string } | null
        }>
      }
      select: (columns?: string) => Promise<{
        data: FundingSourceAddressRow[] | null
        error: { message: string } | null
      }>
    }
  },
  wallets: TrackedWallet[]
) {
  if (!HELIUS_API_KEY || wallets.length === 0) {
    return wallets
  }

  const trackedWalletAddresses = new Set(wallets.map((wallet) => wallet.address))
  let sourceLabels = new Map<string, string>()

  try {
    sourceLabels = await loadFundingSourceAddressMap(supabase)
  } catch (error) {
    console.error("Failed to load funding source address map:", error)
  }

  const updatedWallets = [...wallets]

  for (let index = 0; index < updatedWallets.length; index += 1) {
    const wallet = updatedWallets[index]
    const needsDetection =
      !wallet.funded_at ||
      !wallet.funding_source_address ||
      !wallet.funding_source_label ||
      !wallet.funding_label_source

    if (!needsDetection) {
      continue
    }

    const detection = await detectWalletFundingMetadata(
      wallet.address,
      trackedWalletAddresses,
      sourceLabels
    )

    const nextWallet: TrackedWallet = {
      ...wallet,
      funded_at: wallet.funded_at || detection.fundedAt,
      first_funder_address:
        wallet.first_funder_address || detection.firstFunderAddress,
      funding_source_address:
        wallet.funding_source_address || detection.fundingSourceAddress,
      funding_source_label:
        wallet.funding_source_label ||
        detection.fundingSourceLabel ||
        "---",
      funding_label_source:
        wallet.funding_label_source || detection.fundingLabelSource,
      funding_detection_method:
        detection.fundingDetectionMethod || wallet.funding_detection_method,
      funding_detected_at:
        detection.fundingDetectionMethod || detection.fundingSourceAddress
          ? new Date().toISOString()
          : wallet.funding_detected_at,
    }

    const updatePayload: Record<string, unknown> = {}

    if (!wallet.funded_at && nextWallet.funded_at) {
      updatePayload.funded_at = nextWallet.funded_at
    }
    if (!wallet.first_funder_address && nextWallet.first_funder_address) {
      updatePayload.first_funder_address = nextWallet.first_funder_address
    }
    if (!wallet.funding_source_address && nextWallet.funding_source_address) {
      updatePayload.funding_source_address = nextWallet.funding_source_address
    }
    if (!wallet.funding_source_label && nextWallet.funding_source_label) {
      updatePayload.funding_source_label = nextWallet.funding_source_label
    }
    if (!wallet.funding_label_source && nextWallet.funding_label_source) {
      updatePayload.funding_label_source = nextWallet.funding_label_source
    }
    if (
      (nextWallet.funding_source_address || nextWallet.funded_at) &&
      nextWallet.funding_detection_method
    ) {
      updatePayload.funding_detection_method = nextWallet.funding_detection_method
      updatePayload.funding_detected_at = nextWallet.funding_detected_at
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from("tracked_wallets")
        .update(updatePayload)
        .eq("id", wallet.id)

      if (error) {
        console.error("Failed to persist funding metadata:", error.message)
      }
    }

    updatedWallets[index] = nextWallet
  }

  return updatedWallets
}
