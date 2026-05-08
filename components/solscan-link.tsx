"use client"

import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface SolscanLinkProps {
  address: string
  kind?: "account" | "token"
  label?: string
  className?: string
  showIcon?: boolean
}

export function SolscanLink({
  address,
  kind = "account",
  label,
  className,
  showIcon = false,
}: SolscanLinkProps) {
  const href =
    kind === "token"
      ? `https://solscan.io/token/${address}`
      : `https://solscan.io/account/${address}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-inherit transition-colors hover:text-primary hover:underline",
        className
      )}
    >
      <span>{label || address}</span>
      {showIcon && <ExternalLink className="h-3 w-3 shrink-0" />}
    </a>
  )
}
