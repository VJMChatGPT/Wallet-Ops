export async function readApiResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  let data: unknown = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Request failed with status ${res.status}`

    throw new Error(message)
  }

  return data as T
}

export async function jsonFetcher<T>(url: string): Promise<T> {
  return readApiResponse<T>(await fetch(url))
}
