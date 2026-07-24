const TIMEOUT_MS = 10000
const MAX_RETRIES = 2
const BASE_DELAY_MS = 300

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

/**
 * A fetch implementation for the Supabase client that adds:
 * - a hard timeout, so a paused/unreachable project fails fast instead of hanging the UI forever
 * - retry with exponential backoff, but ONLY for GET/HEAD (read) requests — retrying a
 *   POST/PATCH/DELETE after a network error risks double-submitting since we can't tell
 *   whether the original request already reached the server before the connection dropped
 */
export function createResilientFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const retriable = methodOf(input, init) === 'GET' || methodOf(input, init) === 'HEAD'
    const attempts = retriable ? MAX_RETRIES + 1 : 1
    let lastError: unknown

    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

      try {
        const response = await fetch(input, { ...init, signal: controller.signal })
        clearTimeout(timeoutId)

        if (retriable && response.status >= 500 && attempt < attempts - 1) {
          await sleep(BASE_DELAY_MS * 2 ** attempt)
          continue
        }
        return response
      } catch (err) {
        clearTimeout(timeoutId)
        lastError = err
        if (attempt < attempts - 1) {
          await sleep(BASE_DELAY_MS * 2 ** attempt)
          continue
        }
        throw err
      }
    }

    throw lastError
  }
}
