import TarifsService from './tarifs.service'

export interface Article {
  id: string
  poids: number // en kg
  quantite: number
  nom: string
}

export interface Expedition {
  id: string
  articles: Article[]
  poidsTotal: number
  tarif: number // en centimes
  codeLivraison: string
  destination: string
}

export interface PropositionDivision {
  expeditions: Expedition[]
  totalExpeditions: number
  totalFraisPort: number // en centimes
  poidsTotal: number
  economie: number // économie par rapport à un transporteur alternatif
  message: string
  refus?: boolean // true si le mode de livraison est refusé
  raisonRefus?: string // raison du refus si applicable
}

export class DivisionExpeditionsService {
  private tarifsService = new TarifsService()
  private POIDS_MAX_MONDIAL_RELAY = 30 // kg

  /**
   * Calcule la division optimale des expéditions
   */
  calculerDivision(
    articles: Article[], 
    destination: string = 'FR'
  ): PropositionDivision {
    const poidsTotal = this.calculerPoidsTotal(articles)
    
    // Vérifier s'il y a un article unique qui dépasse la limite
    const articleTropLourd = articles.find(article => 
      article.poids * article.quantite > this.POIDS_MAX_MONDIAL_RELAY
    )
    
    if (articleTropLourd) {
      // Refuser le mode de livraison si un article unique dépasse la limite
      return {
        expeditions: [],
        totalExpeditions: 0,
        totalFraisPort: 0,
        poidsTotal,
        economie: 0,
        message: `Impossible de livrer avec Mondial Relay : l'article "${articleTropLourd.nom}" (${articleTropLourd.poids * articleTropLourd.quantite}kg) dépasse la limite de ${this.POIDS_MAX_MONDIAL_RELAY}kg par colis`,
        refus: true,
        raisonRefus: 'article_trop_lourd'
      }
    }
    
    // Si le poids total est acceptable, pas de division nécessaire
    if (poidsTotal <= this.POIDS_MAX_MONDIAL_RELAY) {
      const tarif = this.tarifsService.calculerTarif({
        poids: poidsTotal,
        destination,
        codeLivraison: '24R'
      })
      
      return {
        expeditions: [{
          id: 'expedition-1',
          articles,
          poidsTotal,
          tarif: tarif.prix ? Math.round(tarif.prix * 100) : 0,
          codeLivraison: '24R',
          destination
        }],
        totalExpeditions: 1,
        totalFraisPort: tarif.prix ? Math.round(tarif.prix * 100) : 0,
        poidsTotal,
        economie: 0,
        message: `Livraison en une seule expédition (${poidsTotal}kg)`,
        refus: false
      }
    }

    // Division nécessaire (plusieurs articles légers qui totalisent > 30kg)
    const expeditions = this.diviserArticles(articles, destination)
    const totalFraisPort = expeditions.reduce((sum, exp) => sum + exp.tarif, 0)
    
    return {
      expeditions,
      totalExpeditions: expeditions.length,
      totalFraisPort,
      poidsTotal,
      economie: this.calculerEconomie(totalFraisPort, poidsTotal),
      message: this.genererMessage(expeditions.length, poidsTotal),
      refus: false
    }
  }

  /**
   * Divise les articles en expéditions optimales
   * Note: Cette méthode ne sera appelée que si aucun article unique ne dépasse la limite
   */
  private diviserArticles(articles: Article[], destination: string): Expedition[] {
    const expeditions: Expedition[] = []
    let expeditionCourante: Article[] = []
    let poidsCourant = 0
    let expeditionIndex = 1

    // Trier les articles par poids décroissant pour optimiser le remplissage
    const articlesTries = [...articles].sort((a, b) => (b.poids * b.quantite) - (a.poids * a.quantite))

    for (const article of articlesTries) {
      const poidsArticle = article.poids * article.quantite
      
      // Si ajouter cet article dépasserait la limite
      if (poidsCourant + poidsArticle > this.POIDS_MAX_MONDIAL_RELAY) {
        // Créer l'expédition courante
        expeditions.push(this.creerExpedition(expeditionCourante, destination, expeditionIndex++))
        expeditionCourante = [article]
        poidsCourant = poidsArticle
      } else {
        // Ajouter l'article à l'expédition courante
        expeditionCourante.push(article)
        poidsCourant += poidsArticle
      }
    }

    // Créer la dernière expédition si elle n'est pas vide
    if (expeditionCourante.length > 0) {
      expeditions.push(this.creerExpedition(expeditionCourante, destination, expeditionIndex))
    }

    return expeditions
  }


  /**
   * Crée une expédition avec calcul du tarif
   */
  private creerExpedition(articles: Article[], destination: string, index: number): Expedition {
    const poidsTotal = this.calculerPoidsTotal(articles)
    const tarif = this.tarifsService.calculerTarif({
      poids: poidsTotal,
      destination,
      codeLivraison: this.getCodeLivraisonOptimal(poidsTotal)
    })

    return {
      id: `expedition-${index}`,
      articles,
      poidsTotal,
      tarif: tarif.prix ? Math.round(tarif.prix * 100) : 0,
      codeLivraison: tarif.codeLivraison,
      destination
    }
  }

  /**
   * Calcule le poids total d'une liste d'articles
   */
  private calculerPoidsTotal(articles: Article[]): number {
    return articles.reduce((total, article) => total + (article.poids * article.quantite), 0)
  }

  /**
   * Détermine le code de livraison optimal selon le poids
   */
  private getCodeLivraisonOptimal(poids: number): string {
    if (poids < 1) return 'SMA' // Léger
    if (poids > 2) return '24L' // Volumineux
    return '24R' // Standard
  }

  /**
   * Calcule l'économie par rapport à un transporteur alternatif
   */
  private calculerEconomie(fraisMondialRelay: number, poidsTotal: number): number {
    // Estimation d'un transporteur alternatif (ex: Colissimo)
    // Prix approximatif : 8€ + 1€ par kg supplémentaire
    const prixAlternatif = Math.max(800, 800 + (poidsTotal - 1) * 100) // en centimes
    return Math.max(0, prixAlternatif - fraisMondialRelay)
  }

  /**
   * Génère un message explicatif
   */
  private genererMessage(nombreExpeditions: number, poidsTotal: number): string {
    if (nombreExpeditions === 1) {
      return `Livraison en une seule expédition (${poidsTotal}kg)`
    }
    
    return `Votre commande de ${poidsTotal}kg sera divisée en ${nombreExpeditions} expéditions pour respecter la limite de ${this.POIDS_MAX_MONDIAL_RELAY}kg par colis.`
  }

  /**
   * Vérifie si une division est nécessaire
   */
  isDivisionNecessaire(articles: Article[]): boolean {
    return this.calculerPoidsTotal(articles) > this.POIDS_MAX_MONDIAL_RELAY
  }

  /**
   * Obtient le poids maximum autorisé
   */
  getPoidsMaximum(): number {
    return this.POIDS_MAX_MONDIAL_RELAY
  }
}

export default DivisionExpeditionsService
