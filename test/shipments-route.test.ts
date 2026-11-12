import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { POST } from "../src/api/admin/mondial-relay/shipments/route"
import { FAKE_API_BASE_URL, fixture, installFakeFetch, setApi2Env, xmlResponse } from "./helpers/fake-fetch"

setApi2Env()

let restore: () => void = () => {}
afterEach(() => restore())

async function postShipment(body: Record<string, unknown>) {
  const fake = installFakeFetch({
    [`${FAKE_API_BASE_URL}/api/shipment`]: () => xmlResponse(fixture("sandbox-24r.xml")),
  })
  restore = fake.restore
  const res: any = { statusCode: 200 }
  res.status = (code: number) => ((res.statusCode = code), res)
  res.json = (payload: unknown) => ((res.body = payload), res)
  await POST({ body, auth_context: { actor_id: "user_1" }, scope: { resolve: () => ({}) } } as any, res)
  return { res, request: fake.requests[0]?.body ?? "" }
}

for (const relayPointId of ["020255", "FR020255", "fr-020255", " FR-020255 "]) {
  test(`POST shipments: le point relais « ${relayPointId} » part au format FR-XXXXXX`, async () => {
    const { res, request } = await postShipment({ relayPointId, deliveryMode: "24R", weight: 500 })
    assert.equal(res.statusCode, 201)
    assert.match(request, /<DeliveryMode Mode="24R" Location="FR-020255" \/>/)
  })
}

test("POST shipments: en HOM, aucun point relais n'est envoyé", async () => {
  const { res, request } = await postShipment({ relayPointId: "020255", deliveryMode: "HOM", weight: 500 })
  assert.equal(res.statusCode, 201)
  assert.match(request, /<DeliveryMode Mode="HOM" Location="" \/>/)
})
