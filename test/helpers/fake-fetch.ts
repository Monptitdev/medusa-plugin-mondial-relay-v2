import { readFileSync } from "fs"
import { join } from "path"

export const FAKE_API_BASE_URL = "https://mondial-relay.invalid"

export type RecordedRequest = { url: string; method: string; body: string }

type Responder = (request: RecordedRequest) => Response

export function fixture(name: string): string {
  return readFileSync(join(__dirname, "..", "fixtures", name), "utf8")
}

/**
 * Remplace fetch pour toute la durée d'un test. Toute URL sans réponse prévue
 * fait échouer le test : aucun appel réseau réel ne peut partir.
 */
export function installFakeFetch(routes: Record<string, Responder>) {
  const requests: RecordedRequest[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const request = { url, method: init?.method ?? "GET", body: String(init?.body ?? "") }
    requests.push(request)
    const route = Object.keys(routes).find((prefix) => url.startsWith(prefix))
    if (!route) {
      throw new Error(`Appel réseau inattendu dans les tests : ${url}`)
    }
    return routes[route](request)
  }) as typeof fetch
  return {
    requests,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

export function xmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "application/xml" } })
}

export function setApi2Env() {
  process.env.MONDIAL_RELAY_API_BASE_URL = FAKE_API_BASE_URL
  process.env.MONDIAL_RELAY_LOGIN = "TESTLOGIN@business-api.mondialrelay.com"
  process.env.MONDIAL_RELAY_PASSWORD = "dummy&<pass>"
  process.env.MONDIAL_RELAY_CUSTOMER_ID = "TESTCUST"
}
