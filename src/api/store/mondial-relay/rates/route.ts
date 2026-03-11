import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import TarifsService from "../../../../services/tarifs.service"
import DivisionExpeditionsService from "../../../../services/division-expeditions.service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const tarifsService = new TarifsService()
    const divisionService = new DivisionExpeditionsService()
    
    // Récupérer les paramètres de la requête
    const { poids, destination = 'FR', codeLivraison, articles, cart_id } = req.query
    
    let poidsKg = 1.0 // Poids par défaut
    
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
          poidsKg = cartData.items.reduce((total: number, item: any) => {
            const itemWeight = item.variant?.weight || 0
            return total + (itemWeight / 1000) * item.quantity // Convertir en kg
          }, 0)
          
          console.log(`📦 Poids calculé du panier ${cart_id}: ${poidsKg.toFixed(2)}kg`)
        }
      } catch (error) {
        console.warn('⚠️ Erreur calcul poids panier:', error.message)
      }
    } else if (poids) {
      // Utiliser le poids fourni en paramètre
      poidsKg = parseFloat(poids as string)
    }
    
    console.log(`💰 Calcul des tarifs Mondial Relay RÉELS - Poids: ${poidsKg}kg, Destination: ${destination}`)
    
    // Vérifier si une division est nécessaire
    let divisionNecessaire = false
    let propositionDivision: any = null
    
    if (articles) {
      try {
        const articlesData = JSON.parse(articles as string)
        divisionNecessaire = divisionService.isDivisionNecessaire(articlesData)
        
        if (divisionNecessaire) {
          propositionDivision = divisionService.calculerDivision(articlesData, destination as string)
          
          // Si le mode de livraison est refusé, retourner une réponse d'erreur
          if (propositionDivision.refus) {
            return res.status(400).json({
              error: "Delivery method not available",
              message: propositionDivision.message,
              refus: true,
              raisonRefus: propositionDivision.raisonRefus,
              meta: {
                poids: poidsKg,
                destination: destination as string,
                calculReel: true,
                divisionActivee: false,
                timestamp: new Date().toISOString()
              }
            })
          }
          
          console.log(`🔄 Division nécessaire: ${propositionDivision.totalExpeditions} expédition(s)`)
        }
      } catch (error) {
        console.warn('⚠️ Erreur parsing articles:', error.message)
      }
    }
    
    // Si division nécessaire, retourner les tarifs avec proposition
    if (divisionNecessaire && propositionDivision) {
      const rates = propositionDivision.expeditions.map((expedition, index) => ({
        id: `mondial-relay-division-${index + 1}`,
        name: `Mondial Relay Expédition ${index + 1}`,
        price: expedition.tarif,
        deliveryMode: expedition.codeLivraison,
        estimatedDays: 2,
        description: `Expédition ${index + 1}/${propositionDivision.totalExpeditions} (${expedition.poidsTotal}kg) - ${expedition.tarif/100}€ HT`,
        disponible: true,
        division: true,
        expeditionId: expedition.id,
        poids: expedition.poidsTotal
      }))
      
      return res.status(200).json({ 
        rates,
        division: {
          necessaire: true,
          proposition: propositionDivision,
          message: propositionDivision.message
        },
        meta: {
          poids: poidsKg,
          destination: destination as string,
          calculReel: true,
          divisionActivee: true,
          timestamp: new Date().toISOString()
        }
      })
    }
    
    // Calculer les tarifs disponibles (logique normale)
    const rates: Array<{
      id: string
      name: string
      price: number
      deliveryMode: string
      estimatedDays: number
      description: string
      disponible: boolean
    }> = []
    
    // Tarif standard (24R)
    const tarifStandard = tarifsService.calculerTarif({
      poids: poidsKg,
      destination: destination as string,
      codeLivraison: '24R'
    })
    
    if (tarifStandard.disponible && tarifStandard.prix) {
      rates.push({
        id: "mondial-relay-24R",
        name: "Mondial Relay Point Relais Standard",
        price: Math.round(tarifStandard.prix * 100), // Convertir en centimes
        deliveryMode: "24R",
        estimatedDays: 2,
        description: `Livraison standard (${tarifStandard.tranchePoids}) - ${tarifStandard.prix}€ HT`,
        disponible: true
      })
    } else if (tarifStandard.refus) {
      // Ne pas ajouter le tarif si refusé
      console.log(`❌ Tarif 24R refusé: ${tarifStandard.raisonRefus}`)
    }
    
    // Tarif volumineux (24L) - seulement si poids > 2kg
    if (poidsKg > 2) {
      const tarifVolumineux = tarifsService.calculerTarif({
        poids: poidsKg,
        destination: destination as string,
        codeLivraison: '24L'
      })
      
      if (tarifVolumineux.disponible && tarifVolumineux.prix) {
        rates.push({
          id: "mondial-relay-24L",
          name: "Mondial Relay Point Relais Volumineux",
          price: Math.round(tarifVolumineux.prix * 100), // Convertir en centimes
          deliveryMode: "24L",
          estimatedDays: 3,
          description: `Livraison volumineux (${tarifVolumineux.tranchePoids}) - ${tarifVolumineux.prix}€ HT`,
          disponible: true
        })
      } else if (tarifVolumineux.refus) {
        console.log(`❌ Tarif 24L refusé: ${tarifVolumineux.raisonRefus}`)
      }
    }
    
    // Tarif léger (SMA) - seulement si poids < 1kg
    if (poidsKg < 1) {
      const tarifLeger = tarifsService.calculerTarif({
        poids: poidsKg,
        destination: destination as string,
        codeLivraison: 'SMA'
      })
      
      if (tarifLeger.disponible && tarifLeger.prix) {
        rates.push({
          id: "mondial-relay-SMA",
          name: "Mondial Relay Point Relais Léger",
          price: Math.round(tarifLeger.prix * 100), // Convertir en centimes
          deliveryMode: "SMA",
          estimatedDays: 2,
          description: `Livraison léger (${tarifLeger.tranchePoids}) - ${tarifLeger.prix}€ HT`,
          disponible: true
        })
      } else if (tarifLeger.refus) {
        console.log(`❌ Tarif SMA refusé: ${tarifLeger.raisonRefus}`)
      }
    }

    // Tarif Lockers - seulement si poids <= 25kg
    if (poidsKg <= 25) {
      const tarifLockers = tarifsService.calculerTarif({
        poids: poidsKg,
        destination: destination as string,
        codeLivraison: 'LOCKERS'
      })
      
      if (tarifLockers.disponible && tarifLockers.prix) {
        rates.push({
          id: "mondial-relay-LOCKERS",
          name: "Mondial Relay Casiers 24/7",
          price: Math.round(tarifLockers.prix * 100), // Convertir en centimes
          deliveryMode: "LOCKERS",
          estimatedDays: 2,
          description: `Casiers 24/7 (${tarifLockers.tranchePoids}) - ${tarifLockers.prix}€ HT - Max 25kg`,
          disponible: true
        })
      } else if (tarifLockers.refus) {
        console.log(`❌ Tarif Lockers refusé: ${tarifLockers.raisonRefus}`)
      }
    } else {
      console.log(`🔒 Lockers exclus: colis de ${poidsKg}kg > 25kg`)
    }
    
    // Si aucun tarif disponible, retourner un refus
    if (rates.length === 0) {
      return res.status(400).json({
        error: "Delivery method not available",
        message: `Mondial Relay non disponible pour ${poidsKg}kg (limite: 30kg)`,
        refus: true,
        raisonRefus: 'poids_trop_lourd',
        meta: {
          poids: poidsKg,
          destination: destination as string,
          calculReel: true,
          divisionActivee: false,
          timestamp: new Date().toISOString()
        }
      })
    }

    console.log(`✅ ${rates.length} tarifs Mondial Relay RÉELS calculés`)
    res.status(200).json({ 
      rates,
      division: {
        necessaire: false,
        message: `Livraison en une seule expédition (${poidsKg}kg)`
      },
      meta: {
        poids: poidsKg,
        destination: destination as string,
        calculReel: true,
        divisionActivee: false,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ Erreur calcul tarifs:', error)
    res.status(500).json({ message: error.message })
  }
}