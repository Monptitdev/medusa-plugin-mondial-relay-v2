import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MondialRelayAPI1Service } from "../../../../../services/mondial-relay-api1.service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { trackingNumber } = req.params

    if (!trackingNumber) {
      return res.status(400).json({ 
        success: false, 
        error: "Numéro de suivi requis" 
      })
    }

    console.log('🔍 Tracking expédition:', trackingNumber)

    // Configuration API 1
    const api1Service = new MondialRelayAPI1Service(
      process.env.MONDIAL_RELAY_API1_URL,
      process.env.MONDIAL_RELAY_ENSEIGNE,
      process.env.MONDIAL_RELAY_PRIVATE_KEY
    )

    // Vérifier que les variables d'environnement sont configurées
    if (!process.env.MONDIAL_RELAY_API1_URL || !process.env.MONDIAL_RELAY_ENSEIGNE || !process.env.MONDIAL_RELAY_PRIVATE_KEY) {
      return res.status(500).json({
        success: false,
        error: "Configuration API 1 manquante. Vérifiez les variables d'environnement."
      })
    }

    // Appel au service de tracking
    const trackingResult = await api1Service.trackShipment(trackingNumber)

    if (!trackingResult.success) {
      return res.status(500).json({
        success: false,
        error: trackingResult.error || "Erreur lors du suivi de l'expédition"
      })
    }

    console.log('✅ Tracking réussi:', {
      trackingNumber,
      eventsCount: trackingResult.tracking_events.length,
      status: trackingResult.status
    })

    res.json({
      success: true,
      tracking_events: trackingResult.tracking_events,
      status: trackingResult.status,
      trackingNumber
    })

  } catch (error) {
    console.error('❌ Erreur tracking expédition:', error)
    res.status(500).json({
      success: false,
      error: "Erreur interne du serveur",
      details: error.message
    })
  }
};