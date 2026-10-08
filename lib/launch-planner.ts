import { mergeTrackedTokensWithDefaults } from "@/lib/default-tokens"
import { getLiveHoldingsData } from "@/lib/holdings"
import { getMergedSheetWallets, getOrCreateMasterSheet } from "@/lib/sheets"
import type {
  LaunchPlan,
  LaunchPlannerDetail,
  LaunchPlanTransfer,
  LaunchPlanWallet,
  LaunchPlanWalletView,
  LaunchPlannerSelectionSummary,
  LaunchSelectionMode,
  TrackedToken,
  TrackedWallet,
  WalletHoldingSummary,
  WorkbookSheet,
} from "@/lib/types"

type SupabaseClientLike = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>

interface PlannerWalletContext {
  wallet: TrackedWallet
  summary: WalletHoldingSummary
  historicalTimesUsed: number
  historicalLastUsedAt: string | null
  historicalLastLaunchId: string | null
  historicalLastLaunchName: string | null
  wasUsedInPreviousLaunch: boolean
}

interface PlannerComputationInput {
  plan: LaunchPlan
  selectedWalletIds?: string[]
  excludedWalletIds?: string[]
  regenerateSelection?: boolean
}

interface PlannerComputationResult {
  wallets: LaunchPlanWalletView[]
  transfers: LaunchPlanTransfer[]
  summary: LaunchPlannerSelectionSummary
  selectedWalletIds: string[]
}

interface UsageStats {
  timesUsed: number
  lastUsedAt: string | null
  lastLaunchId: string | null
  lastLaunchName: string | null
}

const SELECTION_MODES: LaunchSelectionMode[] = [
  "manual",
  "automatic_rotation",
  "least_recently_used",
  "weighted_random",
]

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = toNumber(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeSelectionMode(value: unknown): LaunchSelectionMode {
  return SELECTION_MODES.includes(value as LaunchSelectionMode)
    ? (value as LaunchSelectionMode)
    : "manual"
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }

  return value.filter((entry): entry is string => typeof entry === "string")
}

function normalizeVarianceConfig(value: unknown) {
  const allowedVariance =
    value && typeof value === "object" && "allowedVariance" in value
      ? nullableNumber((value as { allowedVariance?: unknown }).allowedVariance)
      : null

  return {
    allowedVariance,
  }
}

function normalizePlan(snapshot: Record<string, unknown>): LaunchPlan {
  const desiredWalletCount = Math.max(1, Math.trunc(toNumber(snapshot.desired_wallet_count, 1)))
  const legacyAverageTarget = nullableNumber(snapshot.target_average_sol)

  return {
    id: String(snapshot.id),
    name: normalizeText(snapshot.name),
    previous_sheet_id:
      typeof snapshot.previous_sheet_id === "string" ? snapshot.previous_sheet_id : null,
    previous_sheet_name:
      typeof snapshot.previous_sheet_name === "string" ? snapshot.previous_sheet_name : null,
    token_mint: typeof snapshot.token_mint === "string" ? snapshot.token_mint : null,
    token_symbol: typeof snapshot.token_symbol === "string" ? snapshot.token_symbol : null,
    selection_mode: normalizeSelectionMode(snapshot.selection_mode),
    desired_wallet_count: desiredWalletCount,
    exclude_previous_launch: Boolean(snapshot.exclude_previous_launch),
    prefer_lower_historical_usage:
      snapshot.prefer_lower_historical_usage !== undefined
        ? Boolean(snapshot.prefer_lower_historical_usage)
        : true,
    randomness_factor: Math.max(0, Math.min(1, toNumber(snapshot.randomness_factor, 0))),
    target_total_sol:
      nullableNumber(snapshot.target_total_sol) ??
      (legacyAverageTarget === null ? null : legacyAverageTarget * desiredWalletCount),
    min_sol: nullableNumber(snapshot.min_sol),
    max_sol: nullableNumber(snapshot.max_sol),
    variance_config: normalizeVarianceConfig(snapshot.variance_config),
    reserve_floor: nullableNumber(snapshot.reserve_floor),
    excluded_wallet_ids: normalizeStringArray(snapshot.excluded_wallet_ids),
    created_at:
      typeof snapshot.created_at === "string" ? snapshot.created_at : new Date().toISOString(),
    updated_at:
      typeof snapshot.updated_at === "string" ? snapshot.updated_at : new Date().toISOString(),
  }
}

function normalizePlanWallet(
  row: Record<string, unknown>,
  wallet: TrackedWallet,
  summary: WalletHoldingSummary
): LaunchPlanWalletView {
  return {
    id: String(row.id),
    launch_plan_id: String(row.launch_plan_id),
    wallet_id: String(row.wallet_id),
    role: (row.role as LaunchPlanWallet["role"]) || "non_selected",
    current_sol: nullableNumber(row.current_sol),
    target_sol: nullableNumber(row.target_sol),
    deficit_sol: nullableNumber(row.deficit_sol),
    surplus_sol: nullableNumber(row.surplus_sol),
    was_used_in_previous_launch: Boolean(row.was_used_in_previous_launch),
    selected_for_next_launch: Boolean(row.selected_for_next_launch),
    selection_reason: normalizeText(row.selection_reason),
    historical_times_used: Math.max(0, Math.trunc(toNumber(row.historical_times_used, 0))),
    historical_last_used_at:
      typeof row.historical_last_used_at === "string" ? row.historical_last_used_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    walletAddress: wallet.address,
    walletLabel: summary.walletLabel,
    walletType: wallet.type,
    eligibleForRotation: wallet.eligible_for_rotation,
    active: wallet.active,
    tradeStatus: summary.tradeStatus,
    fundingSourceLabel: summary.fundingSourceLabel,
    platform: summary.platform,
    fundedAt: summary.fundedAt,
    selectedTokenBalance: summary.selectedTokenBalance,
    selectedTokenSupplyPercent: summary.selectedTokenSupplyPercent,
  }
}

function normalizePlanTransfer(row: Record<string, unknown>): LaunchPlanTransfer {
  return {
    id: String(row.id),
    launch_plan_id: String(row.launch_plan_id),
    source_wallet_id: String(row.source_wallet_id),
    destination_wallet_id: String(row.destination_wallet_id),
    amount_sol: toNumber(row.amount_sol),
    source_before: nullableNumber(row.source_before),
    source_after: nullableNumber(row.source_after),
    destination_before: nullableNumber(row.destination_before),
    destination_after: nullableNumber(row.destination_after),
    reason: normalizeText(row.reason),
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
  }
}

function pickRole(args: {
  selected: boolean
  previous: boolean
  deficit: number
  surplus: number
}): LaunchPlanWallet["role"] {
  if (args.selected && args.deficit > 0) return "destination"
  if (!args.selected && args.surplus > 0) return "source"
  if (args.selected) return "selected"
  if (args.previous) return "previous_launch"
  return "non_selected"
}

function buildSelectionReason(
  context: PlannerWalletContext,
  mode: LaunchSelectionMode,
  index: number
) {
  const reasons: string[] = []

  if (!context.wasUsedInPreviousLaunch) {
    reasons.push("not used in previous launch")
  } else {
    reasons.push("was used in previous launch")
  }

  if (context.historicalTimesUsed === 0) {
    reasons.push("never used historically")
  } else {
    reasons.push(`used ${context.historicalTimesUsed} time${context.historicalTimesUsed === 1 ? "" : "s"}`)
  }

  if (context.historicalLastUsedAt) {
    reasons.push(`last used ${context.historicalLastUsedAt.slice(0, 10)}`)
  } else {
    reasons.push("no historical last-used date")
  }

  if (mode === "weighted_random") {
    reasons.push(`weighted random pick #${index + 1}`)
  } else if (mode === "least_recently_used") {
    reasons.push("ranked by least recent use")
  } else if (mode === "automatic_rotation") {
    reasons.push("ranked by rotation score")
  }

  return reasons.join(" | ")
}

function calculateRotationScore(
  context: PlannerWalletContext,
  options: {
    excludePreviousLaunch: boolean
    preferLowerHistoricalUsage: boolean
    randomnessFactor: number
  }
) {
  let score = 0

  if (!context.wasUsedInPreviousLaunch) {
    score += 1000
  } else if (options.excludePreviousLaunch) {
    score -= 1000
  }

  if (options.preferLowerHistoricalUsage) {
    score += Math.max(0, 200 - context.historicalTimesUsed * 20)
  }

  if (!context.historicalLastUsedAt) {
    score += 150
  } else {
    const ageMs = Date.now() - new Date(context.historicalLastUsedAt).getTime()
    const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24))
    score += Math.min(ageDays, 180)
  }

  if (options.randomnessFactor > 0) {
    score += Math.random() * 100 * options.randomnessFactor
  }

  return score
}

function weightedRandomSelection(
  pool: PlannerWalletContext[],
  desiredCount: number,
  options: {
    excludePreviousLaunch: boolean
    preferLowerHistoricalUsage: boolean
    randomnessFactor: number
  }
) {
  const selected: PlannerWalletContext[] = []
  const remaining = [...pool]

  while (selected.length < desiredCount && remaining.length > 0) {
    const weights = remaining.map((wallet) => {
      let weight = 1

      if (!wallet.wasUsedInPreviousLaunch) {
        weight += 5
      } else if (options.excludePreviousLaunch) {
        weight *= 0.25
      }

      if (options.preferLowerHistoricalUsage) {
        weight += Math.max(0, 4 - wallet.historicalTimesUsed)
      }

      if (!wallet.historicalLastUsedAt) {
        weight += 3
      }

      if (options.randomnessFactor > 0) {
        weight += Math.random() * options.randomnessFactor * 3
      }

      return Math.max(weight, 0.1)
    })

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    let threshold = Math.random() * totalWeight
    let pickedIndex = 0

    for (let index = 0; index < remaining.length; index += 1) {
      threshold -= weights[index]
      if (threshold <= 0) {
        pickedIndex = index
        break
      }
    }

    selected.push(remaining[pickedIndex])
    remaining.splice(pickedIndex, 1)
  }

  return selected
}

function selectWalletsForPlan(
  pool: PlannerWalletContext[],
  desiredCount: number,
  mode: LaunchSelectionMode,
  options: {
    selectedWalletIds?: string[]
    excludedWalletIds?: string[]
    regenerateSelection?: boolean
    excludePreviousLaunch: boolean
    preferLowerHistoricalUsage: boolean
    randomnessFactor: number
  }
) {
  const excludedWalletIdSet = new Set(options.excludedWalletIds || [])
  const eligiblePool = pool.filter(
    (entry) =>
      entry.wallet.active &&
      entry.wallet.eligible_for_rotation &&
      entry.wallet.type === "mine" &&
      !excludedWalletIdSet.has(entry.wallet.id)
  )

  if (!options.regenerateSelection && options.selectedWalletIds && options.selectedWalletIds.length > 0) {
    const selectedIds = new Set(options.selectedWalletIds)
    const ordered = pool.filter(
      (entry) => selectedIds.has(entry.wallet.id) && !excludedWalletIdSet.has(entry.wallet.id)
    )
    return {
      selected: ordered,
      reasonsByWalletId: new Map(
        ordered.map((entry, index) => [
          entry.wallet.id,
          `manually selected | current row ${index + 1}`,
        ])
      ),
    }
  }

  if (mode === "manual") {
    return {
      selected: [] as PlannerWalletContext[],
      reasonsByWalletId: new Map<string, string>(),
    }
  }

  let selected: PlannerWalletContext[] = []

  if (mode === "least_recently_used") {
    selected = [...eligiblePool]
      .sort((left, right) => {
        const leftDate = left.historicalLastUsedAt || ""
        const rightDate = right.historicalLastUsedAt || ""
        if (leftDate !== rightDate) {
          return leftDate.localeCompare(rightDate)
        }
        if (left.historicalTimesUsed !== right.historicalTimesUsed) {
          return left.historicalTimesUsed - right.historicalTimesUsed
        }
        return (left.summary.sortOrder || 0) - (right.summary.sortOrder || 0)
      })
      .slice(0, desiredCount)
  } else if (mode === "weighted_random") {
    selected = weightedRandomSelection(eligiblePool, desiredCount, options)
  } else {
    selected = [...eligiblePool]
      .sort(
        (left, right) =>
          calculateRotationScore(right, options) - calculateRotationScore(left, options)
      )
      .slice(0, desiredCount)
  }

  const reasonsByWalletId = new Map<string, string>()
  selected.forEach((entry, index) => {
    reasonsByWalletId.set(entry.wallet.id, buildSelectionReason(entry, mode, index))
  })

  return {
    selected,
    reasonsByWalletId,
  }
}

function buildTransferPlan(
  wallets: PlannerWalletContext[],
  targetByWalletId: Map<string, number>,
  reserveFloor: number,
  minSol: number | null
) {
  const destinations = wallets
    .filter((wallet) => targetByWalletId.has(wallet.wallet.id))
    .map((wallet) => {
      const currentSol = wallet.summary.solBalance || 0
      const targetSol = targetByWalletId.get(wallet.wallet.id) || 0
      return {
        wallet,
        before: currentSol,
        remainingDeficit: Math.max(0, targetSol - currentSol),
      }
    })
    .filter((wallet) => wallet.remainingDeficit > 0)
    .sort((left, right) => right.remainingDeficit - left.remainingDeficit)

  const sources = wallets
    .filter((wallet) => !targetByWalletId.has(wallet.wallet.id))
    .map((wallet) => {
      const currentSol = wallet.summary.solBalance || 0
      return {
        wallet,
        before: currentSol,
        remainingSurplus: Math.max(0, currentSol - reserveFloor),
      }
    })
    .filter((wallet) => wallet.remainingSurplus > 0)
    .sort((left, right) => right.remainingSurplus - left.remainingSurplus)

  const transfers: Omit<LaunchPlanTransfer, "id" | "launch_plan_id" | "created_at">[] = []

  for (const destination of destinations) {
    if (destination.remainingDeficit <= 0) {
      continue
    }

    let source =
      sources
        .filter((candidate) => candidate.remainingSurplus >= destination.remainingDeficit)
        .sort(
          (left, right) =>
            left.remainingSurplus - right.remainingSurplus ||
            right.before - left.before
        )[0] || null

    let reason =
      "Single-source full coverage chosen to avoid splitting one destination across multiple wallets"

    if (!source) {
      source =
        sources
          .filter((candidate) => candidate.remainingSurplus > 0)
          .sort((left, right) => right.remainingSurplus - left.remainingSurplus)[0] || null
      reason =
        "Single-source partial coverage chosen to avoid splitting one destination across multiple wallets"
    }

    if (!source) {
      break
    }

    const amount = Math.min(source.remainingSurplus, destination.remainingDeficit)
    if (amount <= 0) {
      continue
    }

    transfers.push({
      source_wallet_id: source.wallet.wallet.id,
      destination_wallet_id: destination.wallet.wallet.id,
      amount_sol: amount,
      source_before: source.before,
      source_after: source.before - amount,
      destination_before: destination.before,
      destination_after: destination.before + amount,
      reason,
    })

    source.before -= amount
    source.remainingSurplus -= amount
    destination.before += amount
    destination.remainingDeficit = 0

    const minTopUpNeeded =
      minSol === null || minSol === undefined
        ? 0
        : Math.max(0, minSol - destination.before)

    if (minTopUpNeeded > 0.0000001) {
      const secondSource =
        sources
          .filter(
            (candidate) =>
              candidate.wallet.wallet.id !== source.wallet.wallet.id &&
              candidate.remainingSurplus > 0
          )
          .sort((left, right) => {
            const leftCanCover = left.remainingSurplus >= minTopUpNeeded ? 0 : 1
            const rightCanCover = right.remainingSurplus >= minTopUpNeeded ? 0 : 1
            if (leftCanCover !== rightCanCover) {
              return leftCanCover - rightCanCover
            }
            if (leftCanCover === 0) {
              return left.remainingSurplus - right.remainingSurplus
            }
            return right.remainingSurplus - left.remainingSurplus
          })[0] || null

      if (secondSource) {
        const secondAmount = Math.min(secondSource.remainingSurplus, minTopUpNeeded)

        if (secondAmount > 0) {
          transfers.push({
            source_wallet_id: secondSource.wallet.wallet.id,
            destination_wallet_id: destination.wallet.wallet.id,
            amount_sol: secondAmount,
            source_before: secondSource.before,
            source_after: secondSource.before - secondAmount,
            destination_before: destination.before,
            destination_after: destination.before + secondAmount,
            reason:
              "Second source used only to bring the destination up to Min SOL after the primary transfer",
          })

          secondSource.before -= secondAmount
          secondSource.remainingSurplus -= secondAmount
          destination.before += secondAmount
        }
      }
    }
  }

  return transfers
}

function buildTargetSolDistribution(
  selected: PlannerWalletContext[],
  options: {
    targetTotalSol: number
    minSol: number | null
    maxSol: number | null
    allowedVariance: number | null
    randomnessFactor: number
  }
) {
  const targetByWalletId = new Map<string, number>()
  if (selected.length === 0) {
    return targetByWalletId
  }

  const count = selected.length
  const targetTotalSol = Math.max(0, options.targetTotalSol)
  const averageTarget = targetTotalSol / count

  const configuredMin = Math.max(0, options.minSol ?? 0)
  const configuredMax =
    options.maxSol === null || options.maxSol === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(configuredMin, options.maxSol)

  const varianceFloor =
    options.allowedVariance === null || options.allowedVariance === undefined
      ? Number.NEGATIVE_INFINITY
      : averageTarget - options.allowedVariance
  const varianceCeiling =
    options.allowedVariance === null || options.allowedVariance === undefined
      ? Number.POSITIVE_INFINITY
      : averageTarget + options.allowedVariance

  let lowerBound = Math.max(0, configuredMin, varianceFloor)
  let upperBound = Math.min(configuredMax, varianceCeiling)

  if (!Number.isFinite(upperBound)) {
    upperBound = Math.max(averageTarget, configuredMax)
  }
  if (upperBound < averageTarget) {
    upperBound = averageTarget
  }
  if (lowerBound > averageTarget) {
    lowerBound = averageTarget
  }

  if (lowerBound * count > targetTotalSol) {
    lowerBound = averageTarget
  }
  if (upperBound * count < targetTotalSol) {
    upperBound = averageTarget
  }

  const varianceFromBounds = Math.min(
    Math.max(0, upperBound - averageTarget),
    Math.max(0, averageTarget - lowerBound)
  )
  const allowedVariance = Math.max(
    0,
    options.allowedVariance ?? varianceFromBounds
  )
  const varianceScale = Math.min(
    allowedVariance,
    varianceFromBounds
  ) * Math.max(0, Math.min(1, options.randomnessFactor))

  const rawOffsets = selected.map(() => Math.random() * 2 - 1)
  const rawAverage =
    rawOffsets.reduce((sum, value) => sum + value, 0) / rawOffsets.length

  const targets = selected.map((wallet, index) => ({
    walletId: wallet.wallet.id,
    target: Math.min(
      upperBound,
      Math.max(
        lowerBound,
        averageTarget + (rawOffsets[index] - rawAverage) * varianceScale
      )
    ),
  }))

  let iterations = 0
  while (iterations < 50) {
    const currentTotal = targets.reduce((sum, entry) => sum + entry.target, 0)
    const residual = targetTotalSol - currentTotal

    if (Math.abs(residual) <= 0.000001) {
      break
    }

    const adjustable = targets.filter((entry) =>
      residual > 0 ? entry.target < upperBound - 0.000001 : entry.target > lowerBound + 0.000001
    )

    if (adjustable.length === 0) {
      break
    }

    const perWalletAdjustment = residual / adjustable.length
    for (const entry of adjustable) {
      const nextTarget = entry.target + perWalletAdjustment
      entry.target = Math.min(upperBound, Math.max(lowerBound, nextTarget))
    }

    iterations += 1
  }

  for (const entry of targets) {
    targetByWalletId.set(entry.walletId, entry.target)
  }

  return targetByWalletId
}

async function getLatestLaunchSheet(
  supabase: SupabaseClientLike
): Promise<WorkbookSheet | null> {
  const { data, error } = await supabase
    .from("sheets")
    .select("*")
    .eq("type", "launch")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as WorkbookSheet | null) ?? null
}

async function getPreviousLaunchSheet(
  supabase: SupabaseClientLike,
  previousSheetId: string | null
) {
  if (previousSheetId) {
    const { data, error } = await supabase
      .from("sheets")
      .select("*")
      .eq("id", previousSheetId)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    return (data as WorkbookSheet | null) ?? null
  }

  return getLatestLaunchSheet(supabase)
}

async function getPreviousLaunchWalletIds(
  supabase: SupabaseClientLike,
  previousSheet: WorkbookSheet | null
) {
  if (!previousSheet) {
    return {
      sheet: null,
      walletIds: new Set<string>(),
    }
  }

  const rows = await getMergedSheetWallets(supabase, previousSheet)
  const usedRows = rows.filter((row) => row.used_in_launch)
  const effectiveRows = usedRows.length > 0 ? usedRows : rows

  return {
    sheet: previousSheet,
    walletIds: new Set(effectiveRows.map((row) => row.walletId)),
  }
}

async function getUsageStatsByWalletId(supabase: SupabaseClientLike) {
  const { data, error } = await supabase
    .from("sheet_wallets")
    .select("wallet_id, used_in_launch, sheet:sheets(id, name, created_at, type)")
    .eq("used_in_launch", true)

  if (error) {
    throw new Error(error.message)
  }

  const usageByWalletId = new Map<string, UsageStats>()

  for (const row of (data || []) as Array<{
    wallet_id: string
    used_in_launch: boolean
    sheet: Array<{ id: string; name: string; created_at: string; type: string }> | null
  }>) {
    const sheet = Array.isArray(row.sheet) ? row.sheet[0] : row.sheet

    if (!sheet || sheet.type !== "launch") {
      continue
    }

    const existing = usageByWalletId.get(row.wallet_id) || {
      timesUsed: 0,
      lastUsedAt: null,
      lastLaunchId: null,
      lastLaunchName: null,
    }

    existing.timesUsed += 1

    if (!existing.lastUsedAt || existing.lastUsedAt < sheet.created_at) {
      existing.lastUsedAt = sheet.created_at
      existing.lastLaunchId = sheet.id
      existing.lastLaunchName = sheet.name
    }

    usageByWalletId.set(row.wallet_id, existing)
  }

  return usageByWalletId
}

async function getTokenMetadata(
  supabase: SupabaseClientLike,
  tokenMint: string | null
) {
  if (!tokenMint) {
    return { tokenMint: null, tokenSymbol: null }
  }

  const { data, error } = await supabase.from("tracked_tokens").select("*")
  if (error) {
    throw new Error(error.message)
  }

  const tokens = mergeTrackedTokensWithDefaults((data || []) as TrackedToken[])
  const token = tokens.find((entry) => entry.mint === tokenMint)

  return {
    tokenMint,
    tokenSymbol: token?.symbol || null,
  }
}

function buildSummary(
  wallets: LaunchPlanWalletView[],
  transfers: LaunchPlanTransfer[],
  targetTotalSol: number
): LaunchPlannerSelectionSummary {
  const selected = wallets.filter((wallet) => wallet.selected_for_next_launch)
  const previous = wallets.filter((wallet) => wallet.was_used_in_previous_launch)
  const planned = selected
  const used = wallets.filter((wallet) => wallet.was_used_in_previous_launch)
  const usedNotPlanned = wallets.filter(
    (wallet) => wallet.was_used_in_previous_launch && !wallet.selected_for_next_launch
  )

  const sum = (entries: LaunchPlanWalletView[], accessor: (entry: LaunchPlanWalletView) => number) =>
    entries.reduce((total, entry) => total + accessor(entry), 0)

  const sumNullable = (
    entries: LaunchPlanWalletView[],
    accessor: (entry: LaunchPlanWalletView) => number | null
  ) => {
    if (entries.length === 0) return null
    return entries.reduce((total, entry) => total + (accessor(entry) || 0), 0)
  }

  const totalCurrentSolSelected = sum(selected, (entry) => toNumber(entry.current_sol))
  const currentTotalDeficit = sum(selected, (entry) => toNumber(entry.deficit_sol))

  return {
    totalWalletsSelected: selected.length,
    totalCurrentSolSelected,
    totalCurrentSolPreviousLaunch: sum(previous, (entry) => toNumber(entry.current_sol)),
    derivedAverageSolPerSelected: selected.length > 0 ? targetTotalSol / selected.length : 0,
    targetTotalSolNeeded: targetTotalSol,
    currentTotalDeficit,
    walletsBelowTarget: selected.filter((entry) => toNumber(entry.deficit_sol) > 0).length,
    proposedTransfers: transfers.length,
    totalSelectedTokenPlanned: sum(planned, (entry) => entry.selectedTokenBalance),
    totalSelectedTokenUsed: sum(used, (entry) => entry.selectedTokenBalance),
    totalSelectedTokenUsedNotPlanned: sum(
      usedNotPlanned,
      (entry) => entry.selectedTokenBalance
    ),
    totalSelectedTokenAllWallets: sum(wallets, (entry) => entry.selectedTokenBalance),
    totalSelectedTokenSupplyPercentPlanned: sumNullable(
      planned,
      (entry) => entry.selectedTokenSupplyPercent
    ),
    totalSelectedTokenSupplyPercentUsed: sumNullable(
      used,
      (entry) => entry.selectedTokenSupplyPercent
    ),
    totalSelectedTokenSupplyPercentUsedNotPlanned: sumNullable(
      usedNotPlanned,
      (entry) => entry.selectedTokenSupplyPercent
    ),
    totalSelectedTokenSupplyPercentAllWallets: sumNullable(
      wallets,
      (entry) => entry.selectedTokenSupplyPercent
    ),
    totalSolPlanned: sum(planned, (entry) => toNumber(entry.current_sol)),
    totalSolUsed: sum(used, (entry) => toNumber(entry.current_sol)),
    totalSolUsedNotPlanned: sum(usedNotPlanned, (entry) => toNumber(entry.current_sol)),
    totalSolAllWallets: sum(wallets, (entry) => toNumber(entry.current_sol)),
  }
}

export async function computeLaunchPlan(
  supabase: SupabaseClientLike,
  input: PlannerComputationInput
): Promise<PlannerComputationResult> {
  const masterSheet = await getOrCreateMasterSheet(supabase)
  const previousSheet = await getPreviousLaunchSheet(supabase, input.plan.previous_sheet_id)
  const previousLaunch = await getPreviousLaunchWalletIds(supabase, previousSheet)
  const usageByWalletId = await getUsageStatsByWalletId(supabase)
  const holdings = await getLiveHoldingsData(supabase, {
    sheetId: masterSheet.id,
    tokenMint: input.plan.token_mint,
  })

  const trackedWalletMap = new Map<string, TrackedWallet>()
  const { data: trackedWallets, error: walletsError } = await supabase
    .from("tracked_wallets")
    .select("*")

  if (walletsError) {
    throw new Error(walletsError.message)
  }

  for (const wallet of (trackedWallets || []) as TrackedWallet[]) {
    trackedWalletMap.set(wallet.id, {
      ...wallet,
      eligible_for_rotation:
        wallet.eligible_for_rotation === undefined ? true : wallet.eligible_for_rotation,
      active: wallet.active === undefined ? true : wallet.active,
      times_used: wallet.times_used ?? 0,
      last_used_at: wallet.last_used_at ?? null,
      last_launch_id: wallet.last_launch_id ?? null,
      last_launch_name: wallet.last_launch_name ?? null,
      notes: wallet.notes ?? null,
    })
  }

  const pool: PlannerWalletContext[] = holdings.walletSummaries
    .map((summary) => {
      if (!summary.walletId) return null
      const wallet = trackedWalletMap.get(summary.walletId)
      if (!wallet) return null
      const usage = usageByWalletId.get(wallet.id)

      return {
        wallet,
        summary,
        historicalTimesUsed: usage?.timesUsed ?? wallet.times_used ?? 0,
        historicalLastUsedAt: usage?.lastUsedAt ?? wallet.last_used_at ?? null,
        historicalLastLaunchId: usage?.lastLaunchId ?? wallet.last_launch_id ?? null,
        historicalLastLaunchName: usage?.lastLaunchName ?? wallet.last_launch_name ?? null,
        wasUsedInPreviousLaunch: previousLaunch.walletIds.has(wallet.id),
      } satisfies PlannerWalletContext
    })
    .filter((entry): entry is PlannerWalletContext => Boolean(entry))

  const { selected, reasonsByWalletId } = selectWalletsForPlan(
    pool,
    input.plan.desired_wallet_count,
    input.plan.selection_mode,
    {
      selectedWalletIds: input.selectedWalletIds,
      excludedWalletIds: input.excludedWalletIds ?? input.plan.excluded_wallet_ids,
      regenerateSelection: input.regenerateSelection,
      excludePreviousLaunch: input.plan.exclude_previous_launch,
      preferLowerHistoricalUsage: input.plan.prefer_lower_historical_usage,
      randomnessFactor: input.plan.randomness_factor,
    }
  )

  const selectedWalletIds = selected.map((wallet) => wallet.wallet.id)
  const selectedWalletIdSet = new Set(selectedWalletIds)
  const selectedCurrentSolTotal = selected.reduce(
    (sum, wallet) => sum + (wallet.summary.solBalance || 0),
    0
  )

  const targetTotalSol =
    input.plan.target_total_sol ?? selectedCurrentSolTotal
  const reserveFloor = input.plan.reserve_floor ?? 0
  const targetByWalletId = buildTargetSolDistribution(selected, {
    targetTotalSol,
    minSol: input.plan.min_sol,
    maxSol: input.plan.max_sol,
    allowedVariance: input.plan.variance_config?.allowedVariance ?? null,
    randomnessFactor: input.plan.randomness_factor,
  })

  const transfers = buildTransferPlan(pool, targetByWalletId, reserveFloor, input.plan.min_sol)

  const wallets: LaunchPlanWalletView[] = pool.map((entry) => {
    const selectedForNextLaunch = selectedWalletIdSet.has(entry.wallet.id)
    const currentSol = entry.summary.solBalance || 0
    const targetSol = selectedForNextLaunch ? targetByWalletId.get(entry.wallet.id) ?? null : null
    const deficitSol =
      selectedForNextLaunch && targetSol !== null ? Math.max(0, targetSol - currentSol) : 0
    const surplusSol = selectedForNextLaunch ? 0 : Math.max(0, currentSol - reserveFloor)

    return {
      id: entry.wallet.id,
      launch_plan_id: input.plan.id,
      wallet_id: entry.wallet.id,
      role: pickRole({
        selected: selectedForNextLaunch,
        previous: entry.wasUsedInPreviousLaunch,
        deficit: deficitSol,
        surplus: surplusSol,
      }),
      current_sol: currentSol,
      target_sol: targetSol,
      deficit_sol: deficitSol,
      surplus_sol: surplusSol,
      was_used_in_previous_launch: entry.wasUsedInPreviousLaunch,
      selected_for_next_launch: selectedForNextLaunch,
      selection_reason: selectedForNextLaunch
        ? reasonsByWalletId.get(entry.wallet.id) || "manually selected"
        : null,
      historical_times_used: entry.historicalTimesUsed,
      historical_last_used_at: entry.historicalLastUsedAt,
      created_at: input.plan.created_at,
      walletAddress: entry.wallet.address,
      walletLabel: entry.summary.walletLabel,
      walletType: entry.wallet.type,
      eligibleForRotation: entry.wallet.eligible_for_rotation,
      active: entry.wallet.active,
      tradeStatus: entry.summary.tradeStatus,
      fundingSourceLabel: entry.summary.fundingSourceLabel,
      platform: entry.summary.platform,
      fundedAt: entry.summary.fundedAt,
      selectedTokenBalance: entry.summary.selectedTokenBalance,
      selectedTokenSupplyPercent: entry.summary.selectedTokenSupplyPercent,
    }
  })

  const persistedTransfers: LaunchPlanTransfer[] = transfers.map((transfer, index) => ({
    id: `${input.plan.id}-${index}`,
    launch_plan_id: input.plan.id,
    ...transfer,
    created_at: input.plan.created_at,
  }))

  return {
    wallets,
    transfers: persistedTransfers,
    summary: buildSummary(wallets, persistedTransfers, targetTotalSol),
    selectedWalletIds,
  }
}

export async function persistLaunchPlanComputation(
  supabase: SupabaseClientLike,
  planId: string,
  computation: PlannerComputationResult
) {
  const { error: deleteWalletsError } = await supabase
    .from("launch_plan_wallets")
    .delete()
    .eq("launch_plan_id", planId)

  if (deleteWalletsError) {
    throw new Error(deleteWalletsError.message)
  }

  const { error: deleteTransfersError } = await supabase
    .from("launch_plan_transfers")
    .delete()
    .eq("launch_plan_id", planId)

  if (deleteTransfersError) {
    throw new Error(deleteTransfersError.message)
  }

  if (computation.wallets.length > 0) {
    const { error: insertWalletsError } = await supabase.from("launch_plan_wallets").insert(
      computation.wallets.map((wallet) => ({
        launch_plan_id: planId,
        wallet_id: wallet.wallet_id,
        role: wallet.role,
        current_sol: wallet.current_sol,
        target_sol: wallet.target_sol,
        deficit_sol: wallet.deficit_sol,
        surplus_sol: wallet.surplus_sol,
        was_used_in_previous_launch: wallet.was_used_in_previous_launch,
        selected_for_next_launch: wallet.selected_for_next_launch,
        selection_reason: wallet.selection_reason,
        historical_times_used: wallet.historical_times_used,
        historical_last_used_at: wallet.historical_last_used_at,
      }))
    )

    if (insertWalletsError) {
      throw new Error(insertWalletsError.message)
    }
  }

  if (computation.transfers.length > 0) {
    const { error: insertTransfersError } = await supabase.from("launch_plan_transfers").insert(
      computation.transfers.map((transfer) => ({
        launch_plan_id: planId,
        source_wallet_id: transfer.source_wallet_id,
        destination_wallet_id: transfer.destination_wallet_id,
        amount_sol: transfer.amount_sol,
        source_before: transfer.source_before,
        source_after: transfer.source_after,
        destination_before: transfer.destination_before,
        destination_after: transfer.destination_after,
        reason: transfer.reason,
      }))
    )

    if (insertTransfersError) {
      throw new Error(insertTransfersError.message)
    }
  }
}

export async function createLaunchPlan(
  supabase: SupabaseClientLike,
  input: {
    name?: unknown
    previous_sheet_id?: unknown
    token_mint?: unknown
    selection_mode?: unknown
    desired_wallet_count?: unknown
    exclude_previous_launch?: unknown
    prefer_lower_historical_usage?: unknown
    randomness_factor?: unknown
    target_total_sol?: unknown
    min_sol?: unknown
    max_sol?: unknown
    variance_config?: unknown
    reserve_floor?: unknown
    selectedWalletIds?: unknown
    excludedWalletIds?: unknown
  }
) {
  const previousSheet = await getPreviousLaunchSheet(
    supabase,
    typeof input.previous_sheet_id === "string" ? input.previous_sheet_id : null
  )
  const { tokenMint, tokenSymbol } = await getTokenMetadata(
    supabase,
    typeof input.token_mint === "string" ? input.token_mint : null
  )

  const baseInsert = {
    name: normalizeText(input.name),
    previous_sheet_id: previousSheet?.id || null,
    previous_sheet_name: previousSheet?.name || null,
    token_mint: tokenMint,
    token_symbol: tokenSymbol,
    selection_mode: normalizeSelectionMode(input.selection_mode),
    desired_wallet_count: Math.max(1, Math.trunc(toNumber(input.desired_wallet_count, 10))),
    exclude_previous_launch: Boolean(input.exclude_previous_launch),
    prefer_lower_historical_usage:
      input.prefer_lower_historical_usage !== undefined
        ? Boolean(input.prefer_lower_historical_usage)
        : true,
    randomness_factor: Math.max(0, Math.min(1, toNumber(input.randomness_factor, 0))),
    target_total_sol: nullableNumber(input.target_total_sol),
    min_sol: nullableNumber(input.min_sol),
    max_sol: nullableNumber(input.max_sol),
    variance_config: normalizeVarianceConfig(input.variance_config),
    reserve_floor: nullableNumber(input.reserve_floor) ?? 0,
    excluded_wallet_ids: normalizeStringArray(input.excludedWalletIds),
  }

  const { data, error } = await supabase.from("launch_plans").insert(baseInsert).select("*").single()
  if (error || !data) {
    throw new Error(error?.message || "Failed to create launch plan")
  }

  const plan = normalizePlan(data)
  const selectedWalletIds = Array.isArray(input.selectedWalletIds)
    ? input.selectedWalletIds.filter((value): value is string => typeof value === "string")
    : undefined
  const excludedWalletIds = Array.isArray(input.excludedWalletIds)
    ? input.excludedWalletIds.filter((value): value is string => typeof value === "string")
    : undefined
  const computation = await computeLaunchPlan(supabase, {
    plan,
    selectedWalletIds,
    excludedWalletIds,
    regenerateSelection: plan.selection_mode !== "manual",
  })
  await persistLaunchPlanComputation(supabase, plan.id, computation)

  return getLaunchPlanDetail(supabase, plan.id)
}

export async function updateLaunchPlan(
  supabase: SupabaseClientLike,
  planId: string,
  input: {
    name?: unknown
    previous_sheet_id?: unknown
    token_mint?: unknown
    selection_mode?: unknown
    desired_wallet_count?: unknown
    exclude_previous_launch?: unknown
    prefer_lower_historical_usage?: unknown
    randomness_factor?: unknown
    target_total_sol?: unknown
    min_sol?: unknown
    max_sol?: unknown
    variance_config?: unknown
    reserve_floor?: unknown
    selectedWalletIds?: unknown
    excludedWalletIds?: unknown
    regenerateSelection?: unknown
  }
) {
  const existing = await getLaunchPlanById(supabase, planId)
  if (!existing) {
    throw new Error("Launch plan not found")
  }

  const previousSheet =
    input.previous_sheet_id !== undefined
      ? await getPreviousLaunchSheet(
          supabase,
          typeof input.previous_sheet_id === "string" ? input.previous_sheet_id : null
        )
      : null

  const resolvedToken =
    input.token_mint !== undefined
      ? await getTokenMetadata(
          supabase,
          typeof input.token_mint === "string" ? input.token_mint : null
        )
      : null

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) updatePayload.name = normalizeText(input.name)
  if (input.previous_sheet_id !== undefined) {
    updatePayload.previous_sheet_id = previousSheet?.id || null
    updatePayload.previous_sheet_name = previousSheet?.name || null
  }
  if (resolvedToken) {
    updatePayload.token_mint = resolvedToken.tokenMint
    updatePayload.token_symbol = resolvedToken.tokenSymbol
  }
  if (input.selection_mode !== undefined) {
    updatePayload.selection_mode = normalizeSelectionMode(input.selection_mode)
  }
  if (input.desired_wallet_count !== undefined) {
    updatePayload.desired_wallet_count = Math.max(
      1,
      Math.trunc(toNumber(input.desired_wallet_count, existing.desired_wallet_count))
    )
  }
  if (input.exclude_previous_launch !== undefined) {
    updatePayload.exclude_previous_launch = Boolean(input.exclude_previous_launch)
  }
  if (input.prefer_lower_historical_usage !== undefined) {
    updatePayload.prefer_lower_historical_usage = Boolean(input.prefer_lower_historical_usage)
  }
  if (input.randomness_factor !== undefined) {
    updatePayload.randomness_factor = Math.max(
      0,
      Math.min(1, toNumber(input.randomness_factor, existing.randomness_factor))
    )
  }
  if (input.target_total_sol !== undefined) {
    updatePayload.target_total_sol = nullableNumber(input.target_total_sol)
  }
  if (input.min_sol !== undefined) updatePayload.min_sol = nullableNumber(input.min_sol)
  if (input.max_sol !== undefined) updatePayload.max_sol = nullableNumber(input.max_sol)
  if (input.variance_config !== undefined) {
    updatePayload.variance_config = normalizeVarianceConfig(input.variance_config)
  }
  if (input.reserve_floor !== undefined) {
    updatePayload.reserve_floor = nullableNumber(input.reserve_floor)
  }
  if (input.excludedWalletIds !== undefined) {
    updatePayload.excluded_wallet_ids = normalizeStringArray(input.excludedWalletIds)
  }

  const { data, error } = await supabase
    .from("launch_plans")
    .update(updatePayload)
    .eq("id", planId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Failed to update launch plan")
  }

  const updatedPlan = normalizePlan(data)
  const selectedWalletIds = Array.isArray(input.selectedWalletIds)
    ? input.selectedWalletIds.filter((value): value is string => typeof value === "string")
    : undefined
  const excludedWalletIds = Array.isArray(input.excludedWalletIds)
    ? input.excludedWalletIds.filter((value): value is string => typeof value === "string")
    : undefined

  const computation = await computeLaunchPlan(supabase, {
    plan: updatedPlan,
    selectedWalletIds,
    excludedWalletIds,
    regenerateSelection: Boolean(input.regenerateSelection),
  })

  await persistLaunchPlanComputation(supabase, planId, computation)
  return getLaunchPlanDetail(supabase, planId)
}

export async function listLaunchPlans(supabase: SupabaseClientLike) {
  const { data, error } = await supabase
    .from("launch_plans")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map((row) => normalizePlan(row as Record<string, unknown>))
}

export async function getLaunchPlanById(supabase: SupabaseClientLike, planId: string) {
  const { data, error } = await supabase
    .from("launch_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? normalizePlan(data as Record<string, unknown>) : null
}

export async function getLaunchPlanDetail(
  supabase: SupabaseClientLike,
  planId: string
): Promise<LaunchPlannerDetail> {
  const plan = await getLaunchPlanById(supabase, planId)
  if (!plan) {
    throw new Error("Launch plan not found")
  }

  const holdings = await getLiveHoldingsData(supabase, {
    sheetId: (await getOrCreateMasterSheet(supabase)).id,
    tokenMint: plan.token_mint,
  })

  const [walletRowsResult, transferRowsResult, trackedWalletsResult] = await Promise.all([
    supabase.from("launch_plan_wallets").select("*").eq("launch_plan_id", planId),
    supabase.from("launch_plan_transfers").select("*").eq("launch_plan_id", planId),
    supabase.from("tracked_wallets").select("*"),
  ])

  if (walletRowsResult.error) {
    throw new Error(walletRowsResult.error.message)
  }
  if (transferRowsResult.error) {
    throw new Error(transferRowsResult.error.message)
  }
  if (trackedWalletsResult.error) {
    throw new Error(trackedWalletsResult.error.message)
  }

  const walletById = new Map(
    ((trackedWalletsResult.data || []) as TrackedWallet[]).map((wallet) => [
      wallet.id,
      {
        ...wallet,
        eligible_for_rotation:
          wallet.eligible_for_rotation === undefined ? true : wallet.eligible_for_rotation,
        active: wallet.active === undefined ? true : wallet.active,
        times_used: wallet.times_used ?? 0,
        last_used_at: wallet.last_used_at ?? null,
        last_launch_id: wallet.last_launch_id ?? null,
        last_launch_name: wallet.last_launch_name ?? null,
        notes: wallet.notes ?? null,
      },
    ])
  )
  const summaryByWalletId = new Map(
    holdings.walletSummaries
      .filter((wallet) => wallet.walletId)
      .map((wallet) => [wallet.walletId as string, wallet])
  )

  const wallets = ((walletRowsResult.data || []) as Record<string, unknown>[])
    .map((row) => {
      const wallet = walletById.get(String(row.wallet_id))
      const summary = summaryByWalletId.get(String(row.wallet_id))
      if (!wallet || !summary) {
        return null
      }

      return normalizePlanWallet(row, wallet, summary)
    })
    .filter((row): row is LaunchPlanWalletView => Boolean(row))
    .sort((left, right) => {
      if (left.selected_for_next_launch !== right.selected_for_next_launch) {
        return left.selected_for_next_launch ? -1 : 1
      }
      return (right.current_sol as number) - (left.current_sol as number)
    })

  const transfers = ((transferRowsResult.data || []) as Record<string, unknown>[]).map(
    normalizePlanTransfer
  )

  const targetTotalSol =
    plan.target_total_sol ??
    wallets
      .filter((wallet) => wallet.selected_for_next_launch)
      .reduce((sum, wallet) => sum + toNumber(wallet.target_sol), 0)

  return {
    plan,
    wallets,
    transfers,
    summary: buildSummary(wallets, transfers, targetTotalSol),
  }
}
