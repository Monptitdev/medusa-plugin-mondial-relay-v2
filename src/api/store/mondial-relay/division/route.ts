import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import DivisionExpeditionsService, { Article } from "../../../../services/division-expeditions.service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const divisionService = new DivisionExpeditionsService()
    
    // Récupérer les données de la requête
    const body = req.body as { articles?: Article[], destination?: string }
    const { articles, destination = 'FR' } = body
    
    if (!articles || !Array.isArray(articles)) {
      return res.status(400).json({ 
        error: "Articles array is required",
        message: "La liste des articles est requise pour calculer la division"
      })
    }

    // Valider les articles
    const articlesValides: Article[] = articles.map((article: any, index: number) => {
      if (!article.id || !article.poids || !article.quantite) {
        throw new Error(`Article ${index + 1} invalide: id, poids et quantité requis`)
      }
      
      return {
        id: article.id,
        poids: parseFloat(article.poids),
        quantite: parseInt(article.quantite),
        nom: article.nom || `Article ${article.id}`
      }
    })

    console.log(`🔄 Calcul de division pour ${articlesValides.length} articles, destination: ${destination}`)

    // Calculer la division
    const proposition = divisionService.calculerDivision(articlesValides, destination)
    
    console.log(`✅ Division calculée: ${proposition.totalExpeditions} expédition(s), ${proposition.totalFraisPort/100}€ total`)

    res.status(200).json({
      success: true,
      proposition,
      meta: {
        poidsMaximum: divisionService.getPoidsMaximum(),
        divisionNecessaire: divisionService.isDivisionNecessaire(articlesValides),
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Erreur calcul division:', error)
    res.status(500).json({ 
      error: "Error calculating division",
      message: error.message 
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const divisionService = new DivisionExpeditionsService()
    
    // Retourner les informations sur les limites
    res.status(200).json({
      success: true,
      limites: {
        poidsMaximum: divisionService.getPoidsMaximum(),
        unite: 'kg',
        description: 'Poids maximum par expédition Mondial Relay'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Erreur récupération limites:', error)
    res.status(500).json({ 
      error: "Error retrieving limits",
      message: error.message 
    })
  }
}