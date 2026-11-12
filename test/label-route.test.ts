import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { GET } from "../src/api/admin/mondial-relay/label/[shipmentNumber]/route"
import { installFakeFetch } from "./helpers/fake-fetch"

const STORED_URL =
  "https://connect-sandbox.mondialrelay.com//TTMRSDBX/etiquette/GetStickersExpeditionsAnonyme2?ens=TTMRSDBX&expedition=00581134&lg=fr-FR&format=10x15&crc=FAKE"

let restore: () => void = () => {}
afterEach(() => restore())

function fakeRequest(labels: Array<{ tracking_number: string; label_url: string }>, orders: any[] = []) {
  const query = {
    graph: async ({ entity, filters }: { entity: string; filters?: any }) => {
      if (entity === "fulfillment_label") {
        return { data: labels.filter((l) => l.tracking_number === filters?.tracking_number) }
      }
      if (entity === "order") {
        return { data: orders }
      }
      throw new Error(`entité inattendue ${entity}`)
    },
  }
  return {
    params: { shipmentNumber: "00581134" },
    auth_context: { actor_id: "user_1" },
    scope: { resolve: () => query },
  } as any
}

function fakeResponse() {
  const res: any = { statusCode: 200, headers: {} as Record<string, unknown>, body: undefined as unknown }
  res.status = (code: number) => ((res.statusCode = code), res)
  res.json = (body: unknown) => ((res.body = body), res)
  res.send = (body: unknown) => ((res.body = body), res)
  res.setHeader = (k: string, v: unknown) => {
    res.headers[k] = v
  }
  return res
}

function withoutLabelEnv() {
  delete process.env.MONDIAL_RELAY_SANDBOX_LABEL_URL
  delete process.env.MONDIAL_RELAY_ENSEIGNE
  delete process.env.MONDIAL_RELAY_PRIVATE_KEY
}

test("sert l'URL d'étiquette stockée, sans variable MONDIAL_RELAY_SANDBOX_LABEL_URL", async () => {
  withoutLabelEnv()
  const fake = installFakeFetch({
    [STORED_URL]: () => new Response(Buffer.from("%PDF-1.4 fake"), { headers: { "Content-Type": "application/pdf" } }),
  })
  restore = fake.restore
  const res = fakeResponse()
  await GET(fakeRequest([{ tracking_number: "00581134", label_url: STORED_URL }]), res)
  assert.equal(fake.requests[0].url, STORED_URL)
  assert.equal(res.headers["Content-Type"], "application/pdf")
  assert.equal(Buffer.from(res.body).toString(), "%PDF-1.4 fake")
})

test("retrouve l'URL dans les métadonnées de commande si aucun label n'est enregistré", async () => {
  withoutLabelEnv()
  const fake = installFakeFetch({
    [STORED_URL]: () => new Response(Buffer.from("%PDF-1.4 fake"), { headers: { "Content-Type": "application/pdf" } }),
  })
  restore = fake.restore
  const orders = [
    { id: "order_1", metadata: { mondial_relay_shipment: { shipmentId: "00581134", labelUrl: STORED_URL } } },
  ]
  const res = fakeResponse()
  await GET(fakeRequest([], orders), res)
  assert.equal(fake.requests[0].url, STORED_URL)
  assert.equal(res.headers["Content-Type"], "application/pdf")
})

test("si Mondial Relay ne renvoie pas de PDF, renvoie l'URL stockée au lieu d'une URL reconstruite", async () => {
  withoutLabelEnv()
  const fake = installFakeFetch({
    [STORED_URL]: () => new Response("<html>erreur</html>", { status: 200, headers: { "Content-Type": "text/html" } }),
  })
  restore = fake.restore
  const res = fakeResponse()
  await GET(fakeRequest([{ tracking_number: "00581134", label_url: STORED_URL }]), res)
  assert.equal(res.statusCode, 502)
  assert.equal(res.body.labelUrl, STORED_URL)
})

test("sans URL stockée ni configuration de repli: 404 explicite, aucun appel réseau", async () => {
  withoutLabelEnv()
  const fake = installFakeFetch({})
  restore = fake.restore
  const res = fakeResponse()
  await GET(fakeRequest([]), res)
  assert.equal(res.statusCode, 404)
  assert.equal(fake.requests.length, 0)
})
