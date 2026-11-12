import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildLabelUrlFromEnv } from "../../../../../services/mondial-relay-api2.service"
import { redactSensitive } from "../../../../../utils/redact-sensitive"

type Query = {
  graph: (config: { entity: string; fields: string[]; filters?: Record<string, unknown> }) => Promise<{ data: any[] }>
}

/**
 * Cherche l'URL d'étiquette renvoyée par Mondial Relay à la création :
 * d'abord dans les labels du fulfillment, puis dans les métadonnées de commande.
 */
async function findStoredLabelUrl(query: Query, shipmentNumber: string): Promise<string | null> {
  try {
    const { data: labels } = await query.graph({
      entity: "fulfillment_label",
      fields: ["label_url", "tracking_number"],
      filters: { tracking_number: shipmentNumber },
    })
    const fromLabel = labels.find((label) => label?.label_url)?.label_url
    if (fromLabel) return fromLabel
  } catch (error) {
    console.warn("⚠️ Lecture des labels de fulfillment impossible:", error.message)
  }

  const { data: orders } = await query.graph({ entity: "order", fields: ["id", "metadata"] })
  for (const order of orders) {
    const shipment = order?.metadata?.mondial_relay_shipment
    const shipping = order?.metadata?.shipping_metadata
    if (shipment?.labelUrl && [shipment.shipmentId, shipment.trackingNumber].includes(shipmentNumber)) {
      return shipment.labelUrl
    }
    if (
      shipping?.mondial_relay_label_url &&
      [shipping.mondial_relay_shipment_id, shipping.mondial_relay_tracking_number].includes(shipmentNumber)
    ) {
      return shipping.mondial_relay_label_url
    }
  }
  return null
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { shipmentNumber } = req.params
  if (!shipmentNumber) {
    return res.status(400).json({ error: "Shipment number is required" })
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as Query
    const labelUrl = (await findStoredLabelUrl(query, shipmentNumber)) ?? buildLabelUrlFromEnv(shipmentNumber)
    if (!labelUrl) {
      return res.status(404).json({
        error: "Aucune URL d'étiquette enregistrée pour cette expédition",
        shipmentNumber,
      })
    }

    console.log("🔗 URL étiquette:", redactSensitive(labelUrl))
    const response = await fetch(labelUrl, { method: "GET", headers: { Accept: "application/pdf" } })
    const contentType = response.headers.get("content-type") ?? ""
    if (!response.ok || !contentType.includes("pdf")) {
      console.error("❌ Étiquette non récupérable:", response.status, contentType)
      return res.status(502).json({
        error: "Mondial Relay n'a pas renvoyé de PDF pour cette étiquette",
        labelUrl,
        shipmentNumber,
      })
    }

    const pdfData = Buffer.from(await response.arrayBuffer())
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="etiquette-${shipmentNumber}.pdf"`)
    res.setHeader("Content-Length", pdfData.length)
    return res.send(pdfData)
  } catch (error) {
    console.error("❌ Erreur récupération étiquette Mondial Relay:", redactSensitive(String(error?.message ?? error)))
    return res.status(500).json({
      error: "Erreur lors de la récupération de l'étiquette",
      details: redactSensitive(String(error?.message ?? error)),
    })
  }
}
