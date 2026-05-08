interface SortableWalletLike {
  sort_order?: number | null
  created_at?: string | null
  address?: string | null
  walletAddress?: string | null
  id?: string | null
  walletId?: string | null
}

function getOrderValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER
}

function getStableKey(wallet: SortableWalletLike) {
  return (
    wallet.address ||
    wallet.walletAddress ||
    wallet.id ||
    wallet.walletId ||
    ""
  )
}

export function compareWalletOrder(
  left: SortableWalletLike,
  right: SortableWalletLike
) {
  const leftOrder = getOrderValue(left.sort_order)
  const rightOrder = getOrderValue(right.sort_order)

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  const leftCreatedAt = left.created_at || ""
  const rightCreatedAt = right.created_at || ""
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt.localeCompare(rightCreatedAt)
  }

  return getStableKey(left).localeCompare(getStableKey(right))
}

export function sortWalletsByOrder<T extends SortableWalletLike>(wallets: T[]) {
  return [...wallets].sort(compareWalletOrder)
}
