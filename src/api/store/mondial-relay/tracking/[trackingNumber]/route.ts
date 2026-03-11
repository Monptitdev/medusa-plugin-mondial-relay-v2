import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MondialRelayAPI1Service } from "../../../../../services/mondial-relay-api1.service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { trackingNumber } = req.params as { trackingNumber: string }

    console.log('🔍 Suivi de colis Mondial Relay Store API')
    console.log('📋 Numéro de suivi:', trackingNumber)

    // Configuration API 1 - Utiliser les variables d'environnement du backend
    const apiUrl = process.env.MONDIAL_RELAY_API1_URL
    const enseigne = process.env.MONDIAL_RELAY_ENSEIGNE
    const privateKey = process.env.MONDIAL_RELAY_PRIVATE_KEY

    console.log('🔧 Configuration API 1 depuis variables d\'environnement:', { apiUrl, enseigne, privateKey })

    const api1Service = new MondialRelayAPI1Service(apiUrl, enseigne, privateKey)

    console.log('🚀 Appel API 1 Mondial Relay pour le suivi...')
    const trackingResult = await api1Service.trackShipment(trackingNumber)

    console.log('✅ Suivi récupéré avec succès:', trackingResult)
    res.status(200).json({ tracking: trackingResult })
  } catch (error) {
    console.error('❌ Erreur suivi de colis:', error)
    res.status(500).json({ message: error.message })
  }
}
