export async function fetchJson(
  url,
  {
    attempts = 5,
    fetchImpl = fetch,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    retryDelayMs = 3000,
    requestTimeoutMs = 20000,
    fetchOptions = {}
  } = {}
) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...fetchOptions,
        headers: {
          accept: "application/json",
          "user-agent": "price-pulse/1.0",
          ...fetchOptions.headers
        },
        signal: AbortSignal.timeout(requestTimeoutMs)
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.retryAfterMs =
          parseRetryAfter(response.headers?.get?.("retry-after")) ||
          (response.status === 429 ? 65000 : 0);
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(Math.max(error.retryAfterMs ?? 0, attempt * retryDelayMs));
      }
    }
  }

  throw lastError;
}

export function parseRetryAfter(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}
