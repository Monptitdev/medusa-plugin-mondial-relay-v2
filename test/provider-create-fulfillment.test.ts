import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import MondialRelayFulfillmentService from "../src/providers/mondial-relay/service"
import { FAKE_API_BASE_URL, fixture, installFakeFetch, setApi2Env, xmlResponse } from "./helpers/fake-fetch"

setApi2Env()

let restore: () => void = () => {}
afterEach(() => restore())

const silentLogger = { info() {}, warn() {}, error() {}, debug() {} }

function buildProvider(metadata: Record<string, unknown>) {
  const saved: Array<Record<string, unknown>> = []
  const orderService = {
    retrieveOrder: async () => ({ id: "order_1", metadata }),
    updateOrders: async (updates: Array<{ id: string; metadata: Record<string, unknown> }>) => {
      saved.push(...updates.map((u) => u.metadata))
    },
  }
  const provider = new MondialRelayFulfillmentService(
    { logger: silentLogger as any, order: orderService },
    {
      business: {
        title: "M.",
        firstname: "Tactigrip",
        lastname: "Test",
        street: "1 rue de Test",
        country: "FR",
        postcode: "59310",
        city: "Landas",
        phone: "0100000000",
        email: "test@example.com",
      },
    }
  )
  return { provider, saved }
}

const order = {
  id: "order_1",
  display_id: 1042,
  currency_code: "eur",
  email: "client@example.com",
  shipping_address: {
    first_name: "Jean",
    last_name: "Test",
    address_1: "10 rue de Paris",
    postal_code: "75001",
    city: "Paris",
    country_code: "fr",
    phone: "0600000001",
  },
} as any

const items = [{ quantity: 1 }] as any

function stubApi2(responseFixture: string) {
  const fake = installFakeFetch({
    [`${FAKE_API_BASE_URL}/api/shipment`]: () => xmlResponse(fixture(responseFixture)),
  })
  restore = fake.restore
  return fake
}

test("24R sandbox: labels contient l'URL Mondial Relay et le vrai numéro de suivi", async () => {
  stubApi2("sandbox-24r.xml")
  const { provider, saved } = buildProvider({ carrier: "mondial-relay", deliveryMode: "24R", relayPointId: "020255" })
  const result = await provider.createFulfillment({}, items, order)
  assert.deepEqual(result.labels, [
    {
      tracking_number: "00581134",
      tracking_url: "",
      label_url:
        "https://connect-sandbox.mondialrelay.com//TTMRSDBX/etiquette/GetStickersExpeditionsAnonyme2?ens=TTMRSDBX&expedition=00581134&lg=fr-FR&format=10x15&crc=FAKE",
    },
  ])
  assert.equal(result.data.trackingNumber, "00581134")
  assert.equal(result.data.sandbox, true)
  const shipping = (saved[0] as any).shipping_metadata
  assert.equal(shipping.mondial_relay_tracking_number, "00581134")
  assert.equal(shipping.mondial_relay_sandbox, true)
})

test("24R prod: labels porte le numéro d'expédition, pas le code-barres", async () => {
  stubApi2("prod-24r.xml")
  const { provider } = buildProvider({ carrier: "mondial-relay", deliveryMode: "24R", relayPointId: "FR-066974" })
  const result = await provider.createFulfillment({}, items, order)
  assert.equal(result.labels[0].tracking_number, "96408887")
  assert.equal(result.data.barcode, "11964088870301006623669740")
  assert.equal(result.data.sandbox, false)
})

test("HOM: pas de point relais exigé, Location vide", async () => {
  const fake = stubApi2("sandbox-hom.xml")
  const { provider } = buildProvider({ carrier: "mondial-relay", deliveryMode: "HOM" })
  const result = await provider.createFulfillment({}, items, order)
  assert.equal(result.labels[0].tracking_number, "00581135")
  assert.match(fake.requests[0].body, /<DeliveryMode Mode="HOM" Location="" \/>/)
})

test("24R sans point relais: erreur claire, aucun appel API", async () => {
  const fake = stubApi2("sandbox-24r.xml")
  const { provider } = buildProvider({ carrier: "mondial-relay", deliveryMode: "24R" })
  await assert.rejects(provider.createFulfillment({}, items, order), /point relais/i)
  assert.equal(fake.requests.length, 0)
})

test("relais: un identifiant nu est préfixé par le pays du destinataire", async () => {
  const fake = stubApi2("sandbox-24r.xml")
  const { provider } = buildProvider({ carrier: "mondial-relay", deliveryMode: "24R", relayPointId: "020255" })
  await provider.createFulfillment({}, items, order)
  assert.match(fake.requests[0].body, /<DeliveryMode Mode="24R" Location="FR-020255" \/>/)
})

test("HOM: l'e-mail de la commande est transmis au destinataire (requis en livraison à domicile, Status 10094)", async () => {
  const fake = stubApi2("sandbox-hom.xml")
  const { provider } = buildProvider({ carrier: "mondial-relay", deliveryMode: "HOM" })
  await provider.createFulfillment({}, items, order)
  const recipient = fake.requests[0].body.split("<Recipient>")[1]
  assert.match(recipient, /<Email>client@example.com<\/Email>/)
})

test("e-mail destinataire: repli sur order.customer.email quand order.email est absent (workflow Medusa)", async () => {
  const fake = stubApi2("sandbox-24r.xml")
  const { provider } = buildProvider({ carrier: "mondial-relay", deliveryMode: "24R", relayPointId: "020255" })
  const { email, ...orderWithoutEmail } = order
  await provider.createFulfillment({}, items, { ...orderWithoutEmail, customer: { email: "client.compte@example.com" } })
  const recipient = fake.requests[0].body.split("<Recipient>")[1]
  assert.match(recipient, /<Email>client.compte@example.com<\/Email>/)
})
