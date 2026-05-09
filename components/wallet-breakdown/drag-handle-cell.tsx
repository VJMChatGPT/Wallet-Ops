"use client"

import type { DraggableAttributes } from "@dnd-kit/core"
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"
import { GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DragHandleCellProps {
  attributes: DraggableAttributes
  listeners: SyntheticListenerMap | undefined
  setActivatorNodeRef: (element: HTMLElement | null) => void
  isDragging?: boolean
}

export function DragHandleCell({
  attributes,
  listeners,
  setActivatorNodeRef,
  isDragging,
}: DragHandleCellProps) {
  return (
    <Button
      ref={setActivatorNodeRef}
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8 cursor-grab touch-none text-muted-foreground hover:text-foreground",
        isDragging && "cursor-grabbing text-primary"
      )}
      aria-label="Drag wallet row"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </Button>
  )
}
