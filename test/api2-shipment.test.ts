import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { MondialRelayAPI2Service, ShipmentData } from "../src/services/mondial-relay-api2.service"
import { FAKE_API_BASE_URL, fixture, installFakeFetch, setApi2Env, xmlResponse } from "./helpers/fake-fetch"

setApi2Env()

let restore: () => void = () => {}
afterEach(() => restore())

function shipmentData(overrides: Partial<ShipmentData> = {}): ShipmentData {
  return {
    orderNumber: "1042",
    customerNumber: "cus_01ABC",
    deliveryMode: "24R",
    location: "FR-020255",
    weight: 500,
    content: "Jouets",
    recipient: {
      title: "M.",
      firstname: "Jean",
      lastname: "Test",
      streetname: "10 rue de Paris",
      houseNo: "",
      countryCode: "FR",
      postCode: "75001",
      city: "Paris",
      phoneNo: "06 00 00 00 01",
      email: "client@example.com",
    },
    sender: {
      title: "M.",
      firstname: "Tactigrip",
      lastname: "Test",
      streetname: "1 rue de Test",
      houseNo: "",
      countryCode: "FR",
      postCode: "59310",
      city: "Landas",
      phoneNo: "0100000000",
      mobileNo: "+33600000000",
      email: "test@example.com",
    },
    ...overrides,
  }
}

function createWith(responseFixture: string, data = shipmentData()) {
  const fake = installFakeFetch({
    [`${FAKE_API_BASE_URL}/api/shipment`]: () => xmlResponse(fixture(responseFixture)),
  })
  restore = fake.restore
  return { fake, result: new MondialRelayAPI2Service().createShipment(data) }
}

test("sandbox: stocke le vrai numéro d'expédition et un drapeau sandbox, pas « SANDBOX MODE »", async () => {
  const { result } = createWith("sandbox-24r.xml")
  const shipment = await result
  assert.equal(shipment.shipmentId, "00581134")
  assert.equal(shipment.trackingNumber, "00581134")
  assert.equal(shipment.sandbox, true)
  assert.equal(shipment.barcode, null)
  assert.equal(
    shipment.labelUrl,
    "https://connect-sandbox.mondialrelay.com//TTMRSDBX/etiquette/GetStickersExpeditionsAnonyme2?ens=TTMRSDBX&expedition=00581134&lg=fr-FR&format=10x15&crc=FAKE"
  )
})

test("sandbox: sans attribut ShipmentNumber, le numéro vient du paramètre expedition= de l'URL", async () => {
  const { result } = createWith("sandbox-24r-no-shipment-number.xml")
  const shipment = await result
  assert.equal(shipment.shipmentId, "00581134")
  assert.equal(shipment.sandbox, true)
})

test("prod: le numéro d'expédition (8 chiffres) sert au suivi, le code-barres est gardé à part", async () => {
  const { result } = createWith("prod-24r.xml")
  const shipment = await result
  assert.equal(shipment.shipmentId, "96408887")
  assert.equal(shipment.trackingNumber, "96408887")
  assert.equal(shipment.barcode, "11964088870301006623669740")
  assert.equal(shipment.sandbox, false)
  assert.equal(shipment.relayPointInfo?.agencyName, "HEM")
})

test("une erreur critique (10001) remonte avec son code et son message", async () => {
  const { result } = createWith("error-10001.xml")
  await assert.rejects(result, /10001.*Login et\/ou mot de passe non valide/)
})

test("expéditeur et destinataire: AddressAdd1 et AddressAdd3 restent vides", async () => {
  const { fake, result } = createWith("sandbox-hom.xml")
  await result
  const body = fake.requests[0].body
  assert.doesNotMatch(body, /<AddressAdd1>[^<]+<\/AddressAdd1>/)
  assert.doesNotMatch(body, /<AddressAdd3>[^<]+<\/AddressAdd3>/)
  assert.doesNotMatch(body, /Mondial Relay<\/AddressAdd/i)
})

test("téléphones normalisés au format XSD \\+\\d{3,20}", async () => {
  const { fake, result } = createWith("sandbox-24r.xml")
  await result
  const body = fake.requests[0].body
  const phones = [...body.matchAll(/<(PhoneNo|MobileNo)>([^<]*)<\/\1>/g)].map((m) => m[2])
  assert.deepEqual(phones, ["+33100000000", "+33600000000", "+33600000001"])
})

test("les valeurs sont échappées en XML", async () => {
  const { fake, result } = createWith("sandbox-24r.xml", shipmentData({ content: "Lego & <Duplo>" }))
  await result
  const body = fake.requests[0].body
  assert.match(body, /<Password>dummy&amp;&lt;pass&gt;<\/Password>/)
  assert.doesNotMatch(body, /<Duplo>/)
})

test("HOM: Location vide dans DeliveryMode", async () => {
  const { fake, result } = createWith("sandbox-hom.xml", shipmentData({ deliveryMode: "HOM", location: "" }))
  await result
  assert.match(fake.requests[0].body, /<DeliveryMode Mode="HOM" Location="" \/>/)
})
