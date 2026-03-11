import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const { orderId, trackingNumber, shipmentId, labelUrl, relayPointInfo } = req.body as any

    console.log('📦 Mise à jour des métadonnées de commande:', { orderId, trackingNumber })

    // Résoudre le service Order
    const orderService = req.scope.resolve(Modules.ORDER) as any

    // Récupérer la commande actuelle
    const order = await orderService.retrieveOrder(orderId)
    
    if (!order) {
      return res.status(404).json({ error: "Commande non trouvée" })
    }

    // Mettre à jour les métadonnées
    const updatedOrder = await orderService.updateOrders([{
      id: orderId,
      metadata: {
        ...order.metadata,
        shipping_metadata: {
          ...(order.metadata?.shipping_metadata || {}),
          carrier: 'mondial-relay',
          mondial_relay_tracking_number: trackingNumber,
          mondial_relay_shipment_id: shipmentId,
          mondial_relay_label_url: labelUrl,
          mondial_relay_delivery_mode: relayPointInfo?.deliveryMode,
          mondial_relay_relay_point_id: relayPointInfo?.relayPointId,
          mondial_relay_relay_point_name: relayPointInfo?.relayPointName,
          mondial_relay_relay_point_address: relayPointInfo?.relayPointAddress
        },
        mondial_relay_shipment: {
          id: `ship_${Date.now()}`,
          orderId: orderId,
          trackingNumber: trackingNumber,
          status: 'created',
          relayPointId: relayPointInfo?.relayPointId,
          weight: relayPointInfo?.weight || 500, // Poids par défaut plus réaliste
          shipmentId: shipmentId,
          labelUrl: labelUrl,
          createdAt: new Date().toISOString()
        }
      }
    }])

    console.log('✅ Métadonnées de commande mises à jour avec succès')
    console.log('📦 Numéro de suivi:', trackingNumber)
    console.log('🏪 Point relais:', relayPointInfo?.relayPointName)

    res.status(200).json({ 
      success: true, 
      order: updatedOrder[0],
      message: "Métadonnées mises à jour avec succès"
    })
  } catch (error) {
    console.error('❌ Erreur mise à jour métadonnées:', error)
    res.status(500).json({ 
      error: "Erreur lors de la mise à jour des métadonnées",
      details: error.message 
    })
  }
}
