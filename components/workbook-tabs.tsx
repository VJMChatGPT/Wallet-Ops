"use client"

import { MoreHorizontal, Plus, ArrowLeftRight, Copy, Archive, Pencil } from "lucide-react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { WorkbookSheetWithWalletCount } from "@/lib/types"

interface WorkbookTabsProps {
  sheets: WorkbookSheetWithWalletCount[]
  activeSheetId: string | null
  onSelect: (sheetId: string) => void
  onCreate: () => void
  onRename: (sheet: WorkbookSheetWithWalletCount) => void
  onDuplicate: (sheet: WorkbookSheetWithWalletCount) => void
  onArchive: (sheet: WorkbookSheetWithWalletCount) => void
  onMoveLeft: (sheet: WorkbookSheetWithWalletCount) => void
  onMoveRight: (sheet: WorkbookSheetWithWalletCount) => void
}

export function WorkbookTabs({
  sheets,
  activeSheetId,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onArchive,
  onMoveLeft,
  onMoveRight,
}: WorkbookTabsProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center gap-2 px-3 py-3">
          {sheets.map((sheet, index) => {
            const isActive = sheet.id === activeSheetId
            const isMaster = sheet.type === "master"

            return (
              <div
                key={sheet.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1.5",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(sheet.id)}
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <span>{sheet.name}</span>
                  {sheet.token_symbol && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {sheet.token_symbol}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {sheet.wallet_count}
                  </Badge>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onRename(sheet)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    {!isMaster && (
                      <DropdownMenuItem onClick={() => onDuplicate(sheet)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isMaster || index === 1}
                      onClick={() => onMoveLeft(sheet)}
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      Move left
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isMaster || index === sheets.length - 1}
                      onClick={() => onMoveRight(sheet)}
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      Move right
                    </DropdownMenuItem>
                    {!isMaster && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onArchive(sheet)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}

          <Button variant="outline" size="sm" className="gap-2" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            New Launch Sheet
          </Button>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
