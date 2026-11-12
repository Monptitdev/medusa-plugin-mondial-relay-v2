import { test } from "node:test"
import assert from "node:assert/strict"
import { MondialRelayAPI1Service } from "../src/services/mondial-relay-api1.service"
import { installFakeFetch } from "./helpers/fake-fetch"

test("le suivi API1 ne part jamais avec « SANDBOX MODE » ni avec un code-barres", async () => {
  const fake = installFakeFetch({})
  try {
    const api1 = new MondialRelayAPI1Service("https://mondial-relay-api1.invalid", "TESTENS", "dummy")
    for (const value of ["SANDBOX MODE", "11964088870301006623669740", ""]) {
      const result = await api1.trackShipment(value)
      assert.equal(result.success, false)
    }
    assert.equal(fake.requests.length, 0)
  } finally {
    fake.restore()
  }
})
