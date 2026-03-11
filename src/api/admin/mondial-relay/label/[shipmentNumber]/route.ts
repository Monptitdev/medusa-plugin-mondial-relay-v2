import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MondialRelayAPI2Service } from "../../../../../services/mondial-relay-api2.service"

/**
 * Génère le CRC de sécurité pour l'URL d'étiquette
 */
function generateCRC(shipmentId: string, customerId: string, privateKey: string): string {
  const crypto = require('crypto')
  const data = `${customerId}${shipmentId}fr-FR10x15${privateKey}`
  return crypto.createHash('md5').update(data).digest('hex').toUpperCase()
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    // Accéder à l'utilisateur connecté
    const userId = req.auth_context?.actor_id
    console.log('👤 Utilisateur connecté:', userId)
    
    const { shipmentNumber } = req.params
    
    if (!shipmentNumber) {
      return res.status(400).json({ error: "Shipment number is required" })
    }

    console.log('🏷️ Récupération étiquette pour expédition:', shipmentNumber)

           // Configuration API 2 - Utiliser les variables d'environnement
           const baseUrl = process.env.MONDIAL_RELAY_API_BASE_URL
           const login = process.env.MONDIAL_RELAY_LOGIN
           const password = process.env.MONDIAL_RELAY_PASSWORD
           const customerId = process.env.MONDIAL_RELAY_CUSTOMER_ID

    const api2Service = new MondialRelayAPI2Service(baseUrl, login, password, customerId)

           try {
             // Essayer de récupérer l'étiquette via l'API 2
             console.log('🚀 Appel API 2 Mondial Relay pour récupérer l\'étiquette...')
             
             // Utiliser les vraies variables d'environnement
             const baseLabelUrl = process.env.MONDIAL_RELAY_SANDBOX_LABEL_URL
             const customerId = process.env.MONDIAL_RELAY_ENSEIGNE
             const privateKey = process.env.MONDIAL_RELAY_PRIVATE_KEY
             
             if (!baseLabelUrl || !customerId || !privateKey) {
               throw new Error('Variables d\'environnement manquantes pour génération URL étiquette')
             }
             
             const crc = generateCRC(shipmentNumber, customerId, privateKey)
             const labelUrl = `${baseLabelUrl}?ens=${customerId}&expedition=${shipmentNumber}&lg=fr-FR&format=10x15&crc=${crc}`
      
      console.log('🔗 URL étiquette:', labelUrl)

      // Faire la requête vers Mondial Relay pour récupérer le PDF
      const response = await fetch(labelUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!response.ok) {
        console.error('❌ Erreur récupération étiquette:', response.status, response.statusText)
        return res.status(response.status).json({ 
          error: "Erreur lors de la récupération de l'étiquette",
          details: response.statusText
        })
      }

      // Récupérer le contenu PDF
      const pdfBuffer = await response.arrayBuffer()
      const pdfData = Buffer.from(pdfBuffer)

      console.log('✅ Étiquette récupérée:', pdfData.length, 'bytes')

      // Retourner le PDF avec les bons headers
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="etiquette-${shipmentNumber}.pdf"`)
      res.setHeader('Content-Length', pdfData.length)
      
      return res.send(pdfData)

    } catch (apiError) {
      console.log('⚠️ Erreur API 2, utilisation de l\'URL d\'étiquette standard')
      
      // Fallback vers l'URL d'étiquette avec nouveau format
      const fallbackBaseLabelUrl = process.env.MONDIAL_RELAY_SANDBOX_LABEL_URL
      const fallbackCustomerId = process.env.MONDIAL_RELAY_ENSEIGNE
      const fallbackPrivateKey = process.env.MONDIAL_RELAY_PRIVATE_KEY
      
      if (!fallbackBaseLabelUrl || !fallbackCustomerId || !fallbackPrivateKey) {
        throw new Error('Variables d\'environnement manquantes pour génération URL étiquette fallback')
      }
      
      const fallbackCrc = generateCRC(shipmentNumber, fallbackCustomerId, fallbackPrivateKey)
      const fallbackLabelUrl = `${fallbackBaseLabelUrl}?ens=${fallbackCustomerId}&expedition=${shipmentNumber}&lg=fr-FR&format=10x15&crc=${fallbackCrc}`
      
      console.log('🔗 URL étiquette fallback:', fallbackLabelUrl)
      
      try {
        const fallbackResponse = await fetch(fallbackLabelUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/pdf',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })

        if (fallbackResponse.ok) {
          const pdfBuffer = await fallbackResponse.arrayBuffer()
          const pdfData = Buffer.from(pdfBuffer)

          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', `attachment; filename="etiquette-${shipmentNumber}.pdf"`)
          res.setHeader('Content-Length', pdfData.length)
          
          return res.send(pdfData)
        }
      } catch (fallbackError) {
        console.error('❌ Erreur fallback étiquette:', fallbackError)
      }
      
      // Si tout échoue, retourner l'URL
      return res.status(200).json({ 
        labelUrl: fallbackLabelUrl,
        shipmentNumber,
        message: "URL d'étiquette disponible (PDF non récupérable directement)"
      })
    }

  } catch (error) {
    console.error('❌ Erreur récupération étiquette Mondial Relay:', error)
    res.status(500).json({ 
      error: "Erreur lors de la récupération de l'étiquette",
      details: error.message 
    })
  }
}