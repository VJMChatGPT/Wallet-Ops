"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { SolscanLink } from "@/components/solscan-link"
import type { TokenWatchAlert } from "@/lib/types"
import { Bell, Radar } from "lucide-react"

interface TokenWatchCardProps {
  mint: string
  symbol: string
}

interface TokenWatchResponse {
  alerts: TokenWatchAlert[]
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

function formatTimestamp(timestamp: number) {
  if (!timestamp) return "-"
  return new Date(timestamp * 1000).toLocaleTimeString()
}

function formatAmount(amount: number | null) {
  if (amount === null || amount === undefined) return "-"
  return amount.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })
}

export function TokenWatchCard({ mint, symbol }: TokenWatchCardProps) {
  const [enabled, setEnabled] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [alerts, setAlerts] = useState<TokenWatchAlert[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const seenKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    setEnabled(false)
    setStartedAt(null)
    setAlerts([])
    seenKeysRef.current = new Set()
  }, [mint])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const baseline = Math.floor(Date.now() / 1000)
    setStartedAt(baseline)
    setAlerts([])
    seenKeysRef.current = new Set()
  }, [enabled])

  useEffect(() => {
    if (!enabled || !startedAt) {
      return
    }

    let cancelled = false

    const poll = async () => {
      setIsPolling(true)
      try {
        const response = await fetch(
          `/api/token-watch?mint=${mint}&since=${startedAt}`,
          { cache: "no-store" }
        )
        const data = (await response.json()) as TokenWatchResponse
        if (!response.ok || cancelled) {
          return
        }

        const nextAlerts: TokenWatchAlert[] = []
        for (const alert of data.alerts || []) {
          const key = `${alert.signature}:${alert.buyerAddress}`
          if (seenKeysRef.current.has(key)) {
            continue
          }

          seenKeysRef.current.add(key)
          nextAlerts.push(alert)
        }

        if (nextAlerts.length > 0) {
          setAlerts((current) => [...nextAlerts, ...current].slice(0, 25))

          for (const alert of nextAlerts) {
            toast.warning(`${shortAddress(alert.buyerAddress)} bought ${symbol}`, {
              description: alert.description,
            })
          }
        }
      } catch (error) {
        console.error("Error polling token watch mode:", error)
      } finally {
        if (!cancelled) {
          setIsPolling(false)
        }
      }
    }

    poll()
    const interval = window.setInterval(poll, 15000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [enabled, mint, startedAt, symbol])

  const latestAlert = useMemo(() => alerts[0], [alerts])

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Watch Mode</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Alert if a wallet that is not yours buys {symbol} while this mode is on.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Radar className={`h-4 w-4 ${enabled ? "text-primary" : "text-muted-foreground"}`} />
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? (isPolling ? "Watching..." : "Watching") : "Off"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled ? (
          latestAlert ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">
                    <SolscanLink
                      address={latestAlert.buyerAddress}
                      label={shortAddress(latestAlert.buyerAddress)}
                    />{" "}
                    bought {symbol}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {latestAlert.source || "Unknown source"} at{" "}
                    {formatTimestamp(latestAlert.timestamp)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Estimated amount: {formatAmount(latestAlert.amount)} {symbol}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              No external buys detected since watch mode was enabled.
            </div>
          )
        ) : (
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Turn this on only while you are entering a position and want to know if
            another wallet gets in while you are buying.
          </div>
        )}

        {alerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent detections</p>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={`${alert.signature}:${alert.buyerAddress}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm">
                      <SolscanLink
                        address={alert.buyerAddress}
                        label={shortAddress(alert.buyerAddress)}
                      />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alert.source || "Unknown source"} • {formatTimestamp(alert.timestamp)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{formatAmount(alert.amount)} {symbol}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
