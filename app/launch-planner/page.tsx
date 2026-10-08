"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { CreateLaunchPlanDialog } from "@/components/create-launch-plan-dialog"
import { Navigation } from "@/components/navigation"
import { PlannerSummaryCard } from "@/components/launch-planner/planner-summary-card"
import { PlannerTransfersTable } from "@/components/launch-planner/planner-transfers-table"
import { PlannerWalletTable } from "@/components/launch-planner/planner-wallet-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { jsonFetcher, readApiResponse } from "@/lib/http"
import type {
  LaunchPlan,
  LaunchPlannerDetail,
  LaunchPlanWalletView,
  LaunchSelectionMode,
  TrackedToken,
  WorkbookSheet,
  WorkbookSheetWithWalletCount,
} from "@/lib/types"

interface LaunchPlansResponse {
  plans: LaunchPlan[]
}

interface TokensResponse {
  tokens: TrackedToken[]
}

interface SheetsResponse {
  sheets: WorkbookSheetWithWalletCount[]
}

const selectionModes: Array<{ value: LaunchSelectionMode; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "automatic_rotation", label: "Automatic rotation" },
  { value: "least_recently_used", label: "Least recently used" },
  { value: "weighted_random", label: "Weighted random" },
]

function LaunchPlannerPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const planParam = searchParams.get("plan")

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [selectionMode, setSelectionMode] =
    useState<LaunchSelectionMode>("automatic_rotation")
  const [desiredWalletCount, setDesiredWalletCount] = useState("10")
  const [previousSheetId, setPreviousSheetId] = useState("auto")
  const [tokenMint, setTokenMint] = useState("none")
  const [excludePreviousLaunch, setExcludePreviousLaunch] = useState(true)
  const [preferLowerHistoricalUsage, setPreferLowerHistoricalUsage] = useState(true)
  const [randomnessFactor, setRandomnessFactor] = useState("0")
  const [targetTotalSol, setTargetTotalSol] = useState("0")
  const [minSol, setMinSol] = useState("")
  const [maxSol, setMaxSol] = useState("")
  const [allowedVariance, setAllowedVariance] = useState("")
  const [reserveFloor, setReserveFloor] = useState("0.25")
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>([])
  const [excludedWalletIds, setExcludedWalletIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingSheet, setIsCreatingSheet] = useState(false)

  const { data: plansData, mutate: mutatePlans } = useSWR<LaunchPlansResponse>(
    "/api/launch-plans",
    jsonFetcher,
    { revalidateOnFocus: false }
  )
  const { data: sheetsData } = useSWR<SheetsResponse>("/api/sheets", jsonFetcher, {
    revalidateOnFocus: false,
  })
  const { data: tokensData } = useSWR<TokensResponse>("/api/tokens", jsonFetcher, {
    revalidateOnFocus: false,
  })

  const plans = plansData?.plans || []
  const sheets = sheetsData?.sheets || []
  const tokens = tokensData?.tokens || []
  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === planParam) || plans[0] || null,
    [planParam, plans]
  )

  const {
    data: detail,
    error,
    isLoading,
    mutate: mutateDetail,
  } = useSWR<LaunchPlannerDetail>(
    activePlan ? `/api/launch-plans/${activePlan.id}` : null,
    jsonFetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (!activePlan) return
    if (planParam === activePlan.id) return

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set("plan", activePlan.id)
    router.replace(`${pathname}?${nextParams.toString()}`)
  }, [activePlan, pathname, planParam, router, searchParams])

  useEffect(() => {
    if (!detail) return
    const plan = detail.plan
    setName(plan.name || "")
    setSelectionMode(plan.selection_mode)
    setDesiredWalletCount(String(plan.desired_wallet_count))
    setPreviousSheetId(plan.previous_sheet_id || "auto")
    setTokenMint(plan.token_mint || "none")
    setExcludePreviousLaunch(plan.exclude_previous_launch)
    setPreferLowerHistoricalUsage(plan.prefer_lower_historical_usage)
    setRandomnessFactor(String(plan.randomness_factor))
    setTargetTotalSol(String(plan.target_total_sol ?? detail.summary.targetTotalSolNeeded))
    setMinSol(plan.min_sol === null ? "" : String(plan.min_sol))
    setMaxSol(plan.max_sol === null ? "" : String(plan.max_sol))
    setAllowedVariance(
      plan.variance_config?.allowedVariance === null ||
        plan.variance_config?.allowedVariance === undefined
        ? ""
        : String(plan.variance_config.allowedVariance)
    )
    setReserveFloor(String(plan.reserve_floor ?? 0))
    setExcludedWalletIds(plan.excluded_wallet_ids || [])
    setSelectedWalletIds(
      detail.wallets
        .filter((wallet) => wallet.selected_for_next_launch)
        .map((wallet) => wallet.wallet_id)
    )
  }, [detail])

  const walletById = useMemo(
    () =>
      new Map<string, LaunchPlanWalletView>(
        (detail?.wallets || []).map((wallet) => [wallet.wallet_id, wallet] as const)
      ),
    [detail?.wallets]
  )

  const previousLaunchRows = useMemo(
    () => (detail?.wallets || []).filter((wallet) => wallet.was_used_in_previous_launch),
    [detail?.wallets]
  )
  const selectedRows = useMemo(
    () => (detail?.wallets || []).filter((wallet) => selectedWalletIds.includes(wallet.wallet_id)),
    [detail?.wallets, selectedWalletIds]
  )
  const surplusRows = useMemo(
    () =>
      (detail?.wallets || [])
        .filter(
          (wallet) =>
            !selectedWalletIds.includes(wallet.wallet_id) &&
            Number(wallet.surplus_sol || 0) > 0
        )
        .sort((left, right) => Number(right.surplus_sol || 0) - Number(left.surplus_sol || 0)),
    [detail?.wallets, selectedWalletIds]
  )

  const handleSelectPlan = useCallback(
    (planId: string) => {
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set("plan", planId)
      router.push(`${pathname}?${nextParams.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const handleToggleSelected = useCallback((walletId: string, checked: boolean) => {
    if (checked) {
      setExcludedWalletIds((current) => current.filter((id) => id !== walletId))
    }
    setSelectedWalletIds((current) => {
      if (checked) {
        return current.includes(walletId) ? current : [...current, walletId]
      }
      return current.filter((id) => id !== walletId)
    })
  }, [])

  const handleToggleExcluded = useCallback((walletId: string, checked: boolean) => {
    if (checked) {
      setSelectedWalletIds((current) => current.filter((id) => id !== walletId))
    }

    setExcludedWalletIds((current) => {
      if (checked) {
        return current.includes(walletId) ? current : [...current, walletId]
      }
      return current.filter((id) => id !== walletId)
    })
  }, [])

  const persistPlan = useCallback(
    async (regenerateSelection: boolean) => {
      if (!activePlan) return

      setIsSaving(true)
      try {
          const nextDetail = await readApiResponse<LaunchPlannerDetail>(
          await fetch(`/api/launch-plans/${activePlan.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              selection_mode: selectionMode,
              desired_wallet_count: Number(desiredWalletCount),
              previous_sheet_id: previousSheetId === "auto" ? null : previousSheetId,
              token_mint: tokenMint === "none" ? null : tokenMint,
              exclude_previous_launch: excludePreviousLaunch,
              prefer_lower_historical_usage: preferLowerHistoricalUsage,
              randomness_factor: Number(randomnessFactor),
              target_total_sol: Number(targetTotalSol),
              min_sol: minSol === "" ? null : Number(minSol),
              max_sol: maxSol === "" ? null : Number(maxSol),
              variance_config: {
                allowedVariance: allowedVariance === "" ? null : Number(allowedVariance),
              },
              reserve_floor: reserveFloor === "" ? 0 : Number(reserveFloor),
              selectedWalletIds,
              excludedWalletIds,
              regenerateSelection,
            }),
          })
        )

        await mutateDetail(nextDetail, { revalidate: false })
        await mutatePlans()
        toast.success(
          regenerateSelection ? "Selection regenerated" : "Funding plan refreshed"
        )
      } catch (saveError) {
        toast.error("Failed to update plan", {
          description: saveError instanceof Error ? saveError.message : "Unknown error",
        })
      } finally {
        setIsSaving(false)
      }
    },
    [
      activePlan,
      allowedVariance,
      desiredWalletCount,
      excludePreviousLaunch,
      maxSol,
      minSol,
      mutateDetail,
      mutatePlans,
      name,
      preferLowerHistoricalUsage,
      previousSheetId,
      randomnessFactor,
      reserveFloor,
      excludedWalletIds,
      selectedWalletIds,
      selectionMode,
      targetTotalSol,
      tokenMint,
    ]
  )

  const handleCreateLaunchSheet = useCallback(async () => {
    if (!detail) return

    setIsCreatingSheet(true)
    try {
      const created = await readApiResponse<{ sheet: WorkbookSheet }>(
        await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: detail.plan.name || "Prepared Launch Sheet",
            token_mint: detail.plan.token_mint,
            token_symbol: detail.plan.token_symbol,
            walletIds: selectedWalletIds,
          }),
        })
      )

      toast.success("Launch sheet created", {
        description: "You can now save a workbook snapshot from the new sheet.",
      })
      router.push(`/?sheet=${created.sheet.id}`)
    } catch (createError) {
      toast.error("Failed to create launch sheet", {
        description: createError instanceof Error ? createError.message : "Unknown error",
      })
    } finally {
      setIsCreatingSheet(false)
    }
  }, [detail, router, selectedWalletIds])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Launch Preparation Planner</h1>
            <p className="text-muted-foreground">
              Plan wallet rotation, equalize SOL, and keep the reasoning auditable.
            </p>
          </div>

          <Button onClick={() => setCreateDialogOpen(true)}>New launch plan</Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Saved Plans</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No launch plans yet. Create one to start rotating wallets.
                  </p>
                ) : null}

                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                      activePlan?.id === plan.id
                        ? "border-primary bg-primary/10"
                        : "border-border/70 hover:border-muted-foreground/40"
                    }`}
                  >
                    <p className="font-medium">{plan.name || "Untitled launch plan"}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.selection_mode.replaceAll("_", " ")} • {plan.desired_wallet_count} wallets
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {plan.created_at.slice(0, 10)}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-6">
            {!activePlan && !isLoading ? (
              <Card className="border-border/70 bg-card/70">
                <CardContent className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <h2 className="text-xl font-semibold">No launch plan selected</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Create a plan to generate a new wallet rotation, compare it to the previous
                    launch, and build an efficient SOL funding plan.
                  </p>
                  <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                    Create launch plan
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {error ? (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardContent className="py-6 text-sm text-destructive">
                  {error instanceof Error ? error.message : "Failed to load launch plan"}
                </CardContent>
              </Card>
            ) : null}

            {detail ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <PlannerSummaryCard
                    title="Selected wallets"
                    value={detail.summary.totalWalletsSelected}
                    subtitle="Next launch set"
                  />
                  <PlannerSummaryCard
                    title="Selected SOL"
                    value={detail.summary.totalCurrentSolSelected}
                    subtitle="Current SOL across selected wallets"
                  />
                  <PlannerSummaryCard
                    title="Previous launch SOL"
                    value={detail.summary.totalCurrentSolPreviousLaunch}
                    subtitle="Current SOL on the previous launch set"
                  />
                  <PlannerSummaryCard
                    title="Current deficit"
                    value={detail.summary.currentTotalDeficit}
                    subtitle={`${detail.summary.walletsBelowTarget} wallets below target`}
                  />
                  <PlannerSummaryCard
                    title="Derived average"
                    value={detail.summary.derivedAverageSolPerSelected}
                    subtitle="Average after distributing the total target"
                  />
                  <PlannerSummaryCard
                    title="Target total"
                    value={detail.summary.targetTotalSolNeeded}
                    subtitle="Desired SOL across selected wallets"
                  />
                  <PlannerSummaryCard
                    title="Selected token"
                    value={detail.summary.totalSelectedTokenPlanned}
                    subtitle="Total amount on selected wallets"
                  />
                  <PlannerSummaryCard
                    title="Transfers"
                    value={detail.summary.proposedTransfers}
                    subtitle="Proposed funding moves"
                  />
                </div>

                <Card className="border-border/70 bg-card/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Planner Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="planner-name">Plan name</Label>
                      <Input
                        id="planner-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="planner-mode">Selection mode</Label>
                      <Select
                        value={selectionMode}
                        onValueChange={(value) => setSelectionMode(value as LaunchSelectionMode)}
                      >
                        <SelectTrigger id="planner-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectionModes.map((mode) => (
                            <SelectItem key={mode.value} value={mode.value}>
                              {mode.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="planner-count">Desired wallet count</Label>
                      <Input
                        id="planner-count"
                        type="number"
                        min={1}
                        value={desiredWalletCount}
                        onChange={(event) => setDesiredWalletCount(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="planner-previous">Previous launch sheet</Label>
                      <Select value={previousSheetId} onValueChange={setPreviousSheetId}>
                        <SelectTrigger id="planner-previous">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Most recent launch sheet</SelectItem>
                          {sheets
                            .filter((sheet) => sheet.type === "launch")
                            .map((sheet) => (
                              <SelectItem key={sheet.id} value={sheet.id}>
                                {sheet.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="planner-token">Token context</Label>
                      <Select value={tokenMint} onValueChange={setTokenMint}>
                        <SelectTrigger id="planner-token">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No token assigned</SelectItem>
                          {tokens.map((token) => (
                            <SelectItem key={token.mint} value={token.mint}>
                              {token.symbol} - {token.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="planner-target">Total Target SOL</Label>
                      <Input
                        id="planner-target"
                        type="number"
                        min={0}
                        step="0.01"
                        value={targetTotalSol}
                        onChange={(event) => setTargetTotalSol(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="planner-min">Min SOL</Label>
                      <Input
                        id="planner-min"
                        type="number"
                        min={0}
                        step="0.01"
                        value={minSol}
                        onChange={(event) => setMinSol(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="planner-max">Max SOL</Label>
                      <Input
                        id="planner-max"
                        type="number"
                        min={0}
                        step="0.01"
                        value={maxSol}
                        onChange={(event) => setMaxSol(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="planner-variance">Allowed variance</Label>
                      <Input
                        id="planner-variance"
                        type="number"
                        min={0}
                        step="0.01"
                        value={allowedVariance}
                        onChange={(event) => setAllowedVariance(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="planner-floor">Reserve floor</Label>
                      <Input
                        id="planner-floor"
                        type="number"
                        min={0}
                        step="0.01"
                        value={reserveFloor}
                        onChange={(event) => setReserveFloor(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="planner-randomness">Randomness factor</Label>
                      <Input
                        id="planner-randomness"
                        type="number"
                        min={0}
                        max={1}
                        step="0.05"
                        value={randomnessFactor}
                        onChange={(event) => setRandomnessFactor(event.target.value)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Exclude previous launch wallets</p>
                        <p className="text-xs text-muted-foreground">Bias toward a fresh rotation.</p>
                      </div>
                      <Switch
                        checked={excludePreviousLaunch}
                        onCheckedChange={setExcludePreviousLaunch}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Prefer lower historical usage</p>
                        <p className="text-xs text-muted-foreground">
                          Favors wallets used less often or less recently.
                        </p>
                      </div>
                      <Switch
                        checked={preferLowerHistoricalUsage}
                        onCheckedChange={setPreferLowerHistoricalUsage}
                      />
                    </div>

                    <div className="xl:col-span-4 flex flex-wrap gap-3">
                      <Button onClick={() => void persistPlan(false)} disabled={isSaving}>
                        Save settings / refresh funding
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void persistPlan(true)}
                        disabled={isSaving}
                      >
                        Regenerate selection
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleCreateLaunchSheet}
                        disabled={isCreatingSheet || selectedWalletIds.length === 0}
                      >
                        Create launch sheet from selection
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-muted/20">
                  <CardContent className="flex flex-col gap-2 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                    <div>
                      Launch plan = proposed operational setup. Snapshot = frozen historical capture.
                      After creating a launch sheet from this selection, you can save a workbook
                      snapshot from that sheet.
                    </div>
                    <div>
                      Excluded wallets are skipped during automatic selection, but can still stay in
                      the broader pool for later review.
                    </div>
                  </CardContent>
                </Card>

                <PlannerWalletTable
                  title="Wallet Pool"
                  description="This is the full operational wallet universe. Pick wallets manually or exclude them from auto-selection before regenerating."
                  rows={detail.wallets}
                  emptyMessage="No tracked wallets found in the planner pool."
                  selectable
                  selectedWalletIds={selectedWalletIds}
                  onToggleSelected={handleToggleSelected}
                  excludedWalletIds={excludedWalletIds}
                  onToggleExcluded={handleToggleExcluded}
                  showReason
                  showTargets
                />

                <div className="grid gap-6 xl:grid-cols-2">
                  <PlannerWalletTable
                    title="Previous Launch Wallets"
                    description="Wallets considered part of the previous launch context."
                    rows={previousLaunchRows}
                    emptyMessage="No previous launch wallets were found."
                    showTargets
                  />

                  <PlannerWalletTable
                    title="Selected Wallets for Next Launch"
                    description="The current selected set for the next launch."
                    rows={selectedRows}
                    emptyMessage="No wallets selected for the next launch yet."
                    showTargets
                    showReason
                  />
                </div>

                <PlannerWalletTable
                  title="Surplus Source Wallets"
                  description="Non-selected wallets with available SOL above the reserve floor."
                  rows={surplusRows}
                  emptyMessage="No surplus source wallets are available with the current reserve floor."
                  showTargets
                />

                <PlannerTransfersTable
                  transfers={detail.transfers}
                  walletById={walletById}
                />
              </>
            ) : null}
          </section>
        </div>
      </main>

      <CreateLaunchPlanDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        sheets={sheets}
        tokens={tokens}
        onCreated={async (nextDetail) => {
          await mutatePlans()
          await mutateDetail(nextDetail, { revalidate: false })
          const nextParams = new URLSearchParams(searchParams.toString())
          nextParams.set("plan", nextDetail.plan.id)
          router.push(`${pathname}?${nextParams.toString()}`)
        }}
      />
    </div>
  )
}

export default function LaunchPlannerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LaunchPlannerPageContent />
    </Suspense>
  )
}
