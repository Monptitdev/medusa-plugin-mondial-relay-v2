import { createHash } from 'crypto'
import "dotenv/config"
import { MondialRelayAPI1Service } from "./mondial-relay-api1.service"
import { redactSensitive } from "../utils/redact-sensitive"

export interface ShipmentData {
  orderNumber: string
  customerNumber: string
  deliveryMode: string
  location: string
  weight: number
  content: string
  deliveryInstruction?: string
  currency?: string
  shipmentValue?: string
  length?: number
  width?: number
  height?: number
  recipient: {
    title: string
    firstname: string
    lastname: string
    streetname: string
    houseNo: string
    countryCode: string
    postCode: string
    city: string
    phoneNo: string
    email: string
  }
  sender: {
    title: string
    firstname: string
    lastname: string
    streetname: string
    houseNo: string
    countryCode: string
    postCode: string
    city: string
    phoneNo: string
    mobileNo: string
    email: string
  }
}

export interface ShipmentResult {
  /** Numéro d'expédition Mondial Relay (8 chiffres), seul identifiant accepté par le suivi API 1 */
  shipmentId: string
  trackingNumber: string
  /** Code-barres Code128 imprimé sur l'étiquette ; absent en sandbox, qui renvoie « SANDBOX MODE » */
  barcode: string | null
  labelUrl: string
  sandbox: boolean
  status: string
  warnings: Array<{ code: string; message: string }>
  relayPointInfo?: {
    deliveryMode?: string
    agencyCode?: string
    tournee?: string
    agencyName?: string
  }
}

const SANDBOX_PLACEHOLDER = "SANDBOX MODE"
const HOME_DELIVERY_MODES = new Set(["HOM", "HOC", "LD1", "LDS"])
const PHONE_COUNTRY_CODES: Record<string, string> = {
  FR: "33", BE: "32", LU: "352", NL: "31", ES: "34", PT: "351", IT: "39", DE: "49", AT: "43", MC: "377",
}

export function requiresRelayPoint(deliveryMode: string): boolean {
  return !HOME_DELIVERY_MODES.has(deliveryMode.toUpperCase())
}

/** Format XSD Mondial Relay : \+\d{3,20}. Renvoie "" si le numéro est inexploitable. */
export function normalizePhone(raw: string | undefined, countryCode: string | undefined): string {
  const compact = (raw ?? "").replace(/[\s.\-()\/]/g, "")
  if (!compact) return ""
  let international = compact
  if (compact.startsWith("00")) {
    international = `+${compact.slice(2)}`
  } else if (!compact.startsWith("+")) {
    const prefix = PHONE_COUNTRY_CODES[(countryCode || "FR").toUpperCase()]
    if (!prefix) return ""
    international = `+${prefix}${compact.replace(/^0/, "")}`
  }
  return /^\+\d{3,20}$/.test(international) ? international : ""
}

function escapeXml(value: unknown): string {
  return (value === undefined || value === null ? "" : String(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`))
  return match ? decodeXmlEntities(match[1]) : undefined
}

function optionalElement(name: string, value: string): string {
  return value ? `<${name}>${escapeXml(value)}</${name}>` : `<${name} />`
}

/**
 * Lit la réponse XML de création d'expédition (API 2).
 * Le numéro d'expédition vient de Shipment@ShipmentNumber, puis de
 * MR.Expedition.NumeroExpedition, puis du paramètre expedition= de l'URL d'étiquette :
 * en sandbox, le code-barres et NumeroExpedition valent « SANDBOX MODE ».
 */
export function parseShipmentResponse(xml: string): ShipmentResult {
  const statuses = [...xml.matchAll(/<Status\b[^>]*>/g)].map(([tag]) => ({
    code: attribute(tag, "Code") ?? "",
    level: attribute(tag, "Level") ?? "",
    message: attribute(tag, "Message") ?? "",
  }))
  const error = statuses.find((s) => /error/i.test(s.level))
  if (error) {
    throw new Error(`Status ${error.code}: ${error.message}`)
  }

  const labelValues = new Map<string, string>()
  for (const [tag] of xml.matchAll(/<LabelValues\b[^>]*>/g)) {
    const key = attribute(tag, "Key")
    if (key) labelValues.set(key, attribute(tag, "Value") ?? "")
  }

  const barcodeTag = xml.match(/<Barcode\b[^>]*>/)?.[0]
  const barcodeValue = barcodeTag ? attribute(barcodeTag, "Value") ?? "" : ""
  const outputMatch = xml.match(/<Output>([^<]*)<\/Output>/)
  const labelUrl = outputMatch ? decodeXmlEntities(outputMatch[1].trim()) : ""

  const sandbox =
    labelValues.get("ModeSandbox")?.toLowerCase() === "true" ||
    barcodeValue === SANDBOX_PLACEHOLDER ||
    labelValues.get("MR.Expedition.NumeroExpedition") === SANDBOX_PLACEHOLDER

  const shipmentTag = xml.match(/<Shipment\b[^>]*>/)?.[0]
  const candidates = [
    shipmentTag ? attribute(shipmentTag, "ShipmentNumber") : undefined,
    labelValues.get("MR.Expedition.NumeroExpedition"),
    expeditionFromLabelUrl(labelUrl),
  ]
  const shipmentNumber = candidates.find((c): c is string => !!c && /^\d+$/.test(c))

  if (!shipmentNumber) {
    const status = statuses.find((s) => s.code && s.code !== "0")
    const detail = status ? ` (Status ${status.code}: ${status.message})` : ""
    console.log("🔍 Réponse XML sans numéro d'expédition:", redactSensitive(xml))
    throw new Error(`Impossible de récupérer le numéro d'expédition depuis l'API Mondial Relay${detail}`)
  }

  return {
    shipmentId: shipmentNumber,
    trackingNumber: shipmentNumber,
    barcode: sandbox || !barcodeValue ? null : barcodeValue,
    labelUrl,
    sandbox,
    status: "created",
    warnings: statuses
      .filter((s) => s.code && s.code !== "0")
      .map(({ code, message }) => ({ code, message })),
    relayPointInfo: {
      deliveryMode: labelValues.get("MR.PlanTri.Mode"),
      agencyCode: labelValues.get("MR.PlanTri.CodeAgence"),
      tournee: labelValues.get("MR.PlanTri.Tournee"),
      agencyName: labelValues.get("MR.PlanTri.LibelleAgence"),
    },
  }
}

function expeditionFromLabelUrl(labelUrl: string): string | undefined {
  if (!labelUrl) return undefined
  try {
    return new URL(labelUrl).searchParams.get("expedition") ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Repli quand aucune URL d'étiquette renvoyée par Mondial Relay n'est stockée.
 * Renvoie null si la configuration manque.
 */
export function buildLabelUrlFromEnv(shipmentNumber: string): string | null {
  const baseLabelUrl = process.env.MONDIAL_RELAY_SANDBOX_LABEL_URL
  const enseigne = process.env.MONDIAL_RELAY_ENSEIGNE
  const privateKey = process.env.MONDIAL_RELAY_PRIVATE_KEY
  if (!baseLabelUrl || !enseigne || !privateKey) {
    return null
  }
  const crc = createHash("md5")
    .update(`${enseigne}${shipmentNumber}fr-FR10x15${privateKey}`)
    .digest("hex")
    .toUpperCase()
  return `${baseLabelUrl}?ens=${enseigne}&expedition=${shipmentNumber}&lg=fr-FR&format=10x15&crc=${crc}`
}

export class MondialRelayAPI2Service {
  private baseUrl: string
  private login: string
  private password: string
  private customerId: string
  constructor(baseUrl?: string, login?: string, password?: string, customerId?: string) {
    this.baseUrl = baseUrl || process.env.MONDIAL_RELAY_API_BASE_URL || ''
    this.login = login || process.env.MONDIAL_RELAY_LOGIN || ''
    this.password = password || process.env.MONDIAL_RELAY_PASSWORD || ''
    this.customerId = customerId || process.env.MONDIAL_RELAY_CUSTOMER_ID || ''
  }

  async createShipment(shipmentData: ShipmentData): Promise<ShipmentResult> {
    console.log('🚚 Création expédition Mondial Relay API 2')
    console.log('🔧 Configuration API 2:', {
      baseUrl: this.baseUrl,
      login: this.login ? '[redacted]' : 'absent',
      customerId: this.customerId ? '[redacted]' : 'absent'
    })

    try {
      if (!this.baseUrl || !this.login || !this.password || !this.customerId) {
        throw new Error('Credentials API Mondial Relay manquants')
      }

      const xmlRequest = this.buildShipmentXML(shipmentData)
      console.log('📄 XML généré (500 premiers caractères):', redactSensitive(xmlRequest).substring(0, 500))
      console.log('🔗 URL:', `${this.baseUrl}/api/shipment`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      let response: Response
      try {
        response = await fetch(`${this.baseUrl}/api/shipment`, {
          method: 'POST',
          headers: {
            'Accept': 'application/xml',
            'Content-Type': 'text/xml'
          },
          body: xmlRequest,
          signal: controller.signal
        })
      } catch (fetchError) {
        throw new Error(`Erreur réseau API Mondial Relay: ${fetchError.message}`)
      } finally {
        clearTimeout(timeoutId)
      }

      const responseText = await response.text()
      if (!response.ok) {
        console.error('❌ Erreur HTTP API 2:', redactSensitive(responseText))
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }

      const result = parseShipmentResponse(responseText.trim())
      console.log('✅ Expédition créée:', result.shipmentId, result.sandbox ? '(sandbox)' : '')
      for (const warning of result.warnings) {
        console.warn(`⚠️ Mondial Relay ${warning.code}: ${warning.message}`)
      }
      return result
    } catch (error) {
      console.error('❌ Erreur API 2:', error.message)
      throw new Error(`Erreur API Mondial Relay: ${error.message}`)
    }
  }

  private buildShipmentXML(data: ShipmentData): string {
    const deliveryMode = (data.deliveryMode || '24R').toUpperCase()
    const location = requiresRelayPoint(deliveryMode) ? data.location : ''
    const orderNo = String(data.orderNumber ?? '').toUpperCase().replace(/[^0-9A-Z_ -]/g, '').slice(0, 15)
    const customerNo = String(data.customerNumber ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9)
    const address = (a: ShipmentData['recipient'] & { mobileNo?: string }) => `
          <Title>${escapeXml(a.title)}</Title>
          <Firstname>${escapeXml(a.firstname)}</Firstname>
          <Lastname>${escapeXml(a.lastname)}</Lastname>
          <Streetname>${escapeXml(a.streetname)}</Streetname>
          <HouseNo>${escapeXml(a.houseNo)}</HouseNo>
          <CountryCode>${escapeXml(a.countryCode)}</CountryCode>
          <PostCode>${escapeXml(a.postCode)}</PostCode>
          <City>${escapeXml(a.city)}</City>
          <AddressAdd1 />
          <AddressAdd2 />
          <AddressAdd3 />
          ${optionalElement('PhoneNo', normalizePhone(a.phoneNo, a.countryCode))}
          ${optionalElement('MobileNo', normalizePhone(a.mobileNo, a.countryCode))}
          <Email>${escapeXml(a.email)}</Email>`

    return `<?xml version="1.0" encoding="utf-8"?>
<ShipmentCreationRequest xmlns="http://www.example.org/Request">
  <Context>
    <Login>${escapeXml(this.login)}</Login>
    <Password>${escapeXml(this.password)}</Password>
    <CustomerId>${escapeXml(this.customerId)}</CustomerId>
    <Culture>fr-FR</Culture>
    <VersionAPI>1.0</VersionAPI>
  </Context>
  <OutputOptions>
    <OutputFormat>10x15</OutputFormat>
    <OutputType>PdfUrl</OutputType>
  </OutputOptions>
  <ShipmentsList>
    <Shipment>
      <OrderNo>${escapeXml(orderNo)}</OrderNo>
      <CustomerNo>${escapeXml(customerNo)}</CustomerNo>
      <ParcelCount>1</ParcelCount>
      <ShipmentValue Currency="${escapeXml((data.currency || 'EUR').toUpperCase())}" Amount="${escapeXml(data.shipmentValue || '0.00')}" />
      <DeliveryMode Mode="${escapeXml(deliveryMode)}" Location="${escapeXml(location)}" />
      <CollectionMode Mode="CCC" Location="" />
      <Parcels>
        <Parcel>
          <Content>${escapeXml(data.content)}</Content>
          <Length Value="${data.length || 30}" Unit="cm" />
          <Width Value="${data.width || 20}" Unit="cm" />
          <Depth Value="${data.height || 10}" Unit="cm" />
          <Weight Value="${data.weight}" Unit="gr" />
        </Parcel>
      </Parcels>
      <DeliveryInstruction>${escapeXml(data.deliveryInstruction)}</DeliveryInstruction>
      <Sender>
        <Address>${address(data.sender)}
        </Address>
      </Sender>
      <Recipient>
        <Address>${address(data.recipient)}
        </Address>
      </Recipient>
    </Shipment>
  </ShipmentsList>
</ShipmentCreationRequest>`
  }

  async trackShipment(trackingNumber: string): Promise<any> {
    console.log('🔍 Suivi expédition Mondial Relay:', trackingNumber)
    // Le suivi passe par l'API 1 (SOAP, WSI2_TracingColisDetaille), qui valide le numéro
    return new MondialRelayAPI1Service().trackShipment(trackingNumber)
  }
}
