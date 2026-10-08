"use client"

import { Card, CardContent } from "@/components/ui/card"
import { formatNumber } from "@/lib/api"

interface PlannerSummaryCardProps {
  title: string
  value: number | null
  subtitle?: string
  suffix?: string
}

export function PlannerSummaryCard({
  title,
  value,
  subtitle,
  suffix,
}: PlannerSummaryCardProps) {
  return (
    <Card className="border-border/70 bg-card/70">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">
          {typeof value === "number"
            ? `${formatNumber(value, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}${suffix ? ` ${suffix}` : ""}`
            : "-"}
        </p>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardContent>
    </Card>
  )
}
