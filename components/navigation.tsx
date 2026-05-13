"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, RefreshCw, Coins, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NavigationProps {
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function Navigation({ onRefresh, isRefreshing }: NavigationProps) {
  const pathname = usePathname()

  const links = [
    { href: "/", label: "Workbook", icon: LayoutDashboard },
    { href: "/tokens", label: "Tokens", icon: Coins },
    { href: "/snapshots", label: "Snapshots", icon: Camera },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/Wallet_Ops_logo.png"
                alt="Wallet Ops"
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg"
                priority
              />
              <span className="text-lg font-semibold tracking-tight">Wallet Ops</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
