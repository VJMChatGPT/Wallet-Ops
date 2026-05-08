export function formatSnapshotTimestamp(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC"
}
