import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { redactSensitive } from "../../../../utils/redact-sensitive"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MondialRelayAPI2Service, formatRelayPointLocation } from "../../../../services/mondial-relay-api2.service"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    console.log('📋 Récupération des expéditions Mondial Relay')
    
    // Accéder à l'utilisateur connecté
    const userId = req.auth_context?.actor_id
    console.log('👤 Utilisateur connecté:', userId)
    
    // Utiliser Query pour récupérer les commandes avec les informations du customer et des items
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "created_at",
        "updated_at",
        "metadata",
        "customer.*",
        "items.*"
      ]
    })
    
    // Récupérer tous les fulfillments avec leurs orders et labels via Query (exclure les annulés)
    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: [
        "id",
        "canceled_at",
        "order.*",
        "order.items.*",
        "labels.*"
      ],
      filters: {
        canceled_at: {
          $eq: null  // Exclure les fulfillments annulés
        }
      }
    })
    
    console.log(`📦 ${fulfillments.length} fulfillments récupérés avec leurs orders et labels`)
    fulfillments.forEach((fulfillment, index) => {
      console.log(`📦 Fulfillment ${index + 1}:`, {
        id: fulfillment.id,
        order_id: fulfillment.order?.id || 'N/A',
        labels_count: fulfillment.labels?.length || 0,
        tracking_number: fulfillment.labels?.[0]?.tracking_number || 'Aucun'
      })
    })
    
    const shipments: any[] = []
    console.log(`🔍 Analyse de ${orders.length} commandes...`)
    console.log(`📦 ${fulfillments.length} fulfillments trouvés`)
    
    // Créer un map des orders pour un accès rapide
    const ordersMap = new Map(orders.map(order => [order.id, order]))
    
    // Parcourir les fulfillments et créer les shipments
    for (const fulfillment of fulfillments) {
      if (fulfillment.order && fulfillment.order.id) {
        const order = ordersMap.get(fulfillment.order.id)
        
        if (order && order.metadata && order.metadata.shipping_metadata && order.metadata.shipping_metadata.carrier === 'mondial-relay') {
          console.log(`✅ Fulfillment ${fulfillment.id} associé à la commande ${order.id}`)
          
          // Récupérer le tracking number depuis les labels du fulfillment
          const trackingNumber = fulfillment.labels?.[0]?.tracking_number || 
                                order.metadata.mondial_relay_shipment?.trackingNumber || 
                                order.metadata.shipping_metadata?.mondial_relay_tracking_number || 
                                'En attente'
          
          // Récupérer le labelUrl depuis les labels du fulfillment ou les métadonnées
          const labelUrl = fulfillment.labels?.[0]?.label_url || 
                          order.metadata.mondial_relay_shipment?.labelUrl || 
                          order.metadata.shipping_metadata?.mondial_relay_label_url
          
          console.log(`🔍 Tracking number pour ${order.id}:`, trackingNumber)
          console.log(`🔗 Label URL pour ${order.id}:`, redactSensitive(String(labelUrl ?? "")))
          
          shipments.push({
            id: `ship_${fulfillment.id}`,
            orderId: order.id,
            orderDisplayId: order.display_id,
            customerName: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || order.customer.email : order.email || 'N/A',
            itemsCount: order.items?.length || 0,
            trackingNumber: trackingNumber,
            status: 'created',
            relayPointId: order.metadata.shipping_metadata.mondial_relay_relay_point_id,
            weight: order.metadata.shipping_metadata.mondial_relay_weight || 1000,
            deliveryMode: order.metadata.shipping_metadata.mondial_relay_delivery_mode,
            relayPointName: order.metadata.shipping_metadata.mondial_relay_relay_point_name,
            relayPointAddress: order.metadata.shipping_metadata.mondial_relay_relay_point_address,
            labelUrl: labelUrl,
            createdAt: order.created_at,
            updatedAt: order.updated_at
          })
        }
      }
    }
    
    console.log(`✅ ${shipments.length} expéditions récupérées depuis les commandes`)
    res.status(200).json({ shipments })
  } catch (error) {
    console.error('❌ Erreur récupération expéditions:', error)
    res.status(500).json({ message: error.message })
  }
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    // Accéder à l'utilisateur connecté
    const userId = req.auth_context?.actor_id
    console.log('👤 Utilisateur connecté:', userId)
    
    const { orderId, relayPointId, weight, deliveryMode, recipient, sender } = req.body as any

    console.log('🚚 Création d\'une expédition Mondial Relay')
    console.log('📋 Données reçues:', { orderId, relayPointId, weight, deliveryMode })

    // Configuration API 2 - Utiliser les variables d'environnement du backend
    const baseUrl = process.env.MONDIAL_RELAY_API_BASE_URL
    const login = process.env.MONDIAL_RELAY_LOGIN
    const password = process.env.MONDIAL_RELAY_PASSWORD
    const customerId = process.env.MONDIAL_RELAY_CUSTOMER_ID

    console.log('🔧 Configuration API 2 depuis variables d\'environnement:', { baseUrl, login: login ? '[redacted]' : 'absent', customerId: customerId ? '[redacted]' : 'absent' })

    const api2Service = new MondialRelayAPI2Service(baseUrl, login, password, customerId)

    // Données d'expédition
    const shipmentData = {
      orderNumber: orderId || `ORDER_${Date.now()}`,
      customerNumber: `CUSTOMER_${Date.now()}`,
      deliveryMode: deliveryMode || "24R",
      location: formatRelayPointLocation(String(relayPointId || "FR-071039"), recipient?.countryCode || "FR"),
      weight: weight || 500, // Poids par défaut plus réaliste pour les jouets
      content: "Jouets et articles pour enfants",
      deliveryInstruction: "",
      recipient: recipient || {
        title: "M.",
        firstname: "Client",
        lastname: "Test",
        streetname: "Adresse de livraison",
        houseNo: "",
        countryCode: "FR",
        postCode: "59310",
        city: "Landas",
        phoneNo: "",
        email: ""
      },
      sender: sender || {
        title: process.env.BUSINESS_TITLE,
        firstname: process.env.BUSINESS_FIRSTNAME,
        lastname: process.env.BUSINESS_LASTNAME,
        streetname: process.env.BUSINESS_STREET,
        houseNo: process.env.BUSINESS_ADDRESS_1,
        countryCode: process.env.BUSINESS_COUNTRY,
        postCode: process.env.BUSINESS_POSTCODE,
        city: process.env.BUSINESS_CITY,
        phoneNo: process.env.BUSINESS_PHONE,
        mobileNo: process.env.BUSINESS_MOBILE,
        email: process.env.BUSINESS_EMAIL
      }
    }

    console.log('🚀 Appel API 2 Mondial Relay...')
    const shipmentResult = await api2Service.createShipment(shipmentData)

    const newShipment = {
      id: `ship_${Date.now()}`,
      orderId,
      trackingNumber: shipmentResult.trackingNumber,
      status: shipmentResult.status,
      relayPointId,
      weight,
      shipmentId: shipmentResult.shipmentId,
      labelUrl: shipmentResult.labelUrl,
      sandbox: shipmentResult.sandbox,
      barcode: shipmentResult.barcode
    }

    // Stocker l'expédition dans les métadonnées de la commande
    if (orderId) {
      const orderService = req.scope.resolve(Modules.ORDER) as any
      const order = await orderService.retrieveOrder(orderId)
      
      // Mettre à jour les métadonnées de la commande avec le vrai numéro de suivi
      await orderService.updateOrders([{
        id: orderId,
        metadata: {
          ...order.metadata,
          shipping_metadata: {
            ...order.metadata.shipping_metadata,
            mondial_relay_tracking_number: shipmentResult.trackingNumber,
            mondial_relay_shipment_id: shipmentResult.shipmentId,
            mondial_relay_label_url: shipmentResult.labelUrl,
            mondial_relay_sandbox: shipmentResult.sandbox,
            mondial_relay_barcode: shipmentResult.barcode
          },
          mondial_relay_shipment: newShipment
        }
      }])
      
      console.log('✅ Expédition stockée dans les métadonnées de la commande:', orderId)
      console.log('📦 Numéro de suivi:', shipmentResult.trackingNumber)
    }
    
    console.log('✅ Expédition créée avec succès:', newShipment)
    res.status(201).json({ shipment: newShipment })
    
  } catch (error) {
    console.error('❌ Erreur création expédition:', error)
    res.status(500).json({ message: error.message })
  }
}