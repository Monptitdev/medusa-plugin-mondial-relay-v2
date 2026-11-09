import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MondialRelayAPI1Service } from "../../../../services/mondial-relay-api1.service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { zipCode, city, latitude, longitude, weight, cart_id } = req.query as {
      zipCode?: string
      city?: string
      latitude?: string
      longitude?: string
      weight?: string
      cart_id?: string
    }

    console.log('🔍 Recherche points relais Mondial Relay RÉELS')
    console.log('📋 Paramètres reçus:', { zipCode, city, latitude, longitude, weight, cart_id })

    // Configuration API 1 - Utiliser les variables d'environnement du backend
    const apiUrl = process.env.MONDIAL_RELAY_API1_URL
    const enseigne = process.env.MONDIAL_RELAY_ENSEIGNE
    const privateKey = process.env.MONDIAL_RELAY_PRIVATE_KEY

    console.log('🔧 Configuration API 1 depuis variables d\'environnement:', {
      apiUrl,
      enseigne,
      privateKey: privateKey ? '[redacted]' : 'absent',
    })

    const api1Service = new MondialRelayAPI1Service(apiUrl, enseigne, privateKey)

    let parcelWeight = 1.0 // Poids par défaut
    
    // Si un cart_id est fourni, récupérer le poids réel du panier
    if (cart_id) {
      try {
        const query = req.scope.resolve("query")
        const { data: cart } = await query.graph({
          entity: "cart",
          fields: ["id", "items.*", "items.variant.*"]
        })
        
        const cartData = cart.find((c: any) => c.id === cart_id)
        if (cartData && cartData.items) {
          // Calculer le poids total du panier
          parcelWeight = cartData.items.reduce((total: number, item: any) => {
            const itemWeight = item.variant?.weight || 0
            return total + (itemWeight / 1000) * item.quantity // Convertir en kg
          }, 0)
          
          console.log(`📦 Poids calculé du panier ${cart_id}: ${parcelWeight.toFixed(2)}kg`)
        }
      } catch (error) {
        console.warn('⚠️ Erreur calcul poids panier:', error.message)
      }
    } else if (weight) {
      // Utiliser le poids fourni en paramètre
      parcelWeight = parseFloat(weight)
    }
    
    const isLockerEligible = parcelWeight <= 25 // Lockers acceptent jusqu'à 25kg

    // Paramètres de recherche avec logique GPS + fallback
    const searchParams: any = {
      countryCode: "FR",
      weight: parcelWeight * 1000, // Convertir en grammes
      length: 30,
      width: 20,
      height: 10,
    }

    if (latitude && longitude) {
      searchParams.latitude = parseFloat(latitude)
      searchParams.longitude = parseFloat(longitude)
      console.log('🌍 Recherche par coordonnées GPS RÉELLES:', searchParams.latitude, searchParams.longitude)
    } else if (zipCode && city) {
      searchParams.zipCode = zipCode
      searchParams.city = city
      console.log('🏙️ Recherche par code postal et ville RÉELLES:', searchParams.zipCode, searchParams.city)
    } else if (zipCode) {
      searchParams.zipCode = zipCode
      console.log('📮 Recherche par code postal RÉEL:', searchParams.zipCode)
    } else {
      return res.status(400).json({
        message: "Code postal ou coordonnées GPS (latitude et longitude) sont requis.",
      })
    }

    console.log('🚀 Appel API 1 Mondial Relay RÉEL...')
    const allRelayPoints = await api1Service.searchRelayPoints(searchParams)

    // Filtrer les points relais selon le poids
    let filteredPoints = allRelayPoints
    
    if (!isLockerEligible) {
      // Si le colis est trop lourd pour les lockers, exclure les lockers
      filteredPoints = allRelayPoints.filter(point => point.type !== 'LOCKER')
      console.log(`🔒 Colis de ${parcelWeight}kg > 25kg - Lockers exclus`)
    }

    console.log(`✅ ${filteredPoints.length} points relais RÉELS trouvés (${allRelayPoints.length - filteredPoints.length} lockers exclus)`)
    res.status(200).json({ 
      relayPoints: filteredPoints,
      meta: {
        totalFound: allRelayPoints.length,
        filteredCount: filteredPoints.length,
        lockersExcluded: !isLockerEligible,
        parcelWeight: parcelWeight
      }
    })
  } catch (error) {
    console.error('❌ Erreur récupération points relais Mondial Relay RÉELS:', error)
    res.status(500).json({ message: error.message })
  }
}