import tarifsData from '../data/tarifs-mondial-relay.json'

export interface TarifRequest {
  poids: number // en kg
  destination: string // code pays (FR, BE, DE, etc.)
  codeLivraison?: string // 24R, 24L, SMA pour la France
  supplementIles?: boolean // Corse, Baléares
}

export interface TarifResponse {
  prix: number | null // en € HT
  disponible: boolean
  codeLivraison: string
  destination: string
  tranchePoids: string
  supplementIles?: number
  refus?: boolean // true si le mode de livraison est refusé
  raisonRefus?: string // raison du refus si applicable
}

export class TarifsService {
  private tarifs = tarifsData.tarifs_mondial_relay

  /**
   * Calcule le tarif pour un envoi
   */
  calculerTarif(request: TarifRequest): TarifResponse {
    const { poids, destination, codeLivraison, supplementIles } = request

    // Log détaillé pour debug
    console.log(`🔍 TarifsService.calculerTarif:`)
    console.log(`   Poids: ${poids}kg`)
    console.log(`   Destination: ${destination}`)
    console.log(`   Code livraison: ${codeLivraison}`)
    console.log(`   Type code livraison: ${typeof codeLivraison}`)

    // Vérifier la limite pour les Lockers (25kg max)
    if (codeLivraison === 'LOCKERS' && poids > 25) {
      console.log(`   ❌ LOCKERS refusé: poids ${poids}kg > 25kg`)
      return {
        prix: null,
        disponible: false,
        codeLivraison: 'LOCKERS',
        destination,
        tranchePoids: `> 25kg`,
        refus: true,
        raisonRefus: 'lockers_poids_trop_lourd'
      }
    }

    // Vérifier le poids maximum (30kg inclus)
    if (poids > this.tarifs.poids_maximum) {
      console.log(`   ❌ Poids trop lourd: ${poids}kg > ${this.tarifs.poids_maximum}kg`)
      return {
        prix: null,
        disponible: false,
        codeLivraison: codeLivraison || '',
        destination,
        tranchePoids: `> ${this.tarifs.poids_maximum}kg`,
        refus: true,
        raisonRefus: 'poids_trop_lourd'
      }
    }

    // Trouver la tranche de poids correspondante
    const tranche = this.tarifs.tranches_poids.find(t => 
      poids >= t.min && poids <= t.max
    )

    if (!tranche) {
      console.log(`   ❌ Aucune tranche trouvée pour ${poids}kg`)
      return {
        prix: null,
        disponible: false,
        codeLivraison: codeLivraison || '',
        destination,
        tranchePoids: 'Non trouvée'
      }
    }

    console.log(`   ✅ Tranche trouvée: ${tranche.min} à ${tranche.max} kg`)

    // Déterminer la clé de destination
    let destinationKey = destination.toUpperCase()
    console.log(`   Destination key initiale: ${destinationKey}`)
    console.log(`   Code livraison: ${codeLivraison} (type: ${typeof codeLivraison})`)
    
    // Gestion spéciale pour la France avec lockers
    // Log détaillé pour debug
    console.log(`   🔍 DEBUG conversion FR_LOCKERS:`)
    console.log(`      destinationKey === 'FR': ${destinationKey === 'FR'}`)
    console.log(`      codeLivraison === 'LOCKERS': ${codeLivraison === 'LOCKERS'}`)
    console.log(`      codeLivraison type: ${typeof codeLivraison}`)
    console.log(`      codeLivraison value: ${JSON.stringify(codeLivraison)}`)
    console.log(`      codeLivraison strict ===: ${codeLivraison === 'LOCKERS'}`)
    console.log(`      codeLivraison loose ==: ${codeLivraison == 'LOCKERS'}`)
    
    if (destinationKey === 'FR' && codeLivraison === 'LOCKERS') {
      destinationKey = 'FR_LOCKERS'
      console.log(`   ✅ Conversion en FR_LOCKERS pour LOCKERS`)
    } else {
      console.log(`   ⚠️  Pas de conversion: destinationKey=${destinationKey}, codeLivraison=${codeLivraison}`)
    }

    console.log(`   Destination key finale: ${destinationKey}`)

    // Récupérer le prix
    const prix = tranche.tarifs[destinationKey as keyof typeof tranche.tarifs]
    console.log(`   Prix trouvé: ${prix}€`)

    // Calculer le supplément îles si nécessaire
    let supplementIlesMontant = 0
    if (supplementIles) {
      if (destinationKey === 'FR' || destinationKey === 'FR_LOCKERS') {
        supplementIlesMontant = this.tarifs.supplements_iles.corse
      } else if (destinationKey === 'ES') {
        supplementIlesMontant = this.tarifs.supplements_iles.baleares
      }
    }

    const prixFinal = prix !== null ? prix + supplementIlesMontant : null

    return {
      prix: prixFinal,
      disponible: prix !== null,
      codeLivraison: codeLivraison || this.getCodeLivraisonParDefaut(destinationKey),
      destination: this.tarifs.destinations[destinationKey as keyof typeof this.tarifs.destinations] || destination,
      tranchePoids: `${tranche.min} à ${tranche.max} kg`,
      supplementIles: supplementIlesMontant > 0 ? supplementIlesMontant : undefined
    }
  }

  /**
   * Obtient le code de livraison par défaut selon la destination
   */
  private getCodeLivraisonParDefaut(destination: string): string {
    if (destination === 'FR' || destination === 'FR_LOCKERS') {
      return '24R' // Standard par défaut
    }
    return destination
  }

  /**
   * Obtient tous les tarifs disponibles pour une destination
   */
  getTarifsParDestination(destination: string): Array<{
    tranchePoids: string
    prix: number | null
    codeLivraison: string
  }> {
    const destinationKey = destination.toUpperCase()
    
    return this.tarifs.tranches_poids.map(tranche => {
      const prixStandard = tranche.tarifs[destinationKey as keyof typeof tranche.tarifs]
      const prixLockers = destinationKey === 'FR' ? 
        tranche.tarifs.FR_LOCKERS : null

      return {
        tranchePoids: `${tranche.min} à ${tranche.max} kg`,
        prix: prixStandard,
        codeLivraison: destinationKey === 'FR' ? '24R' : destinationKey,
        prixLockers: prixLockers
      }
    })
  }

  /**
   * Vérifie si un service est disponible pour une destination et un poids
   */
  isServiceDisponible(poids: number, destination: string): boolean {
    const tarif = this.calculerTarif({ poids, destination })
    return tarif.disponible
  }

  /**
   * Obtient les destinations disponibles
   */
  getDestinationsDisponibles(): Array<{
    code: string
    nom: string
  }> {
    return Object.entries(this.tarifs.destinations).map(([code, nom]) => ({
      code,
      nom
    }))
  }

  /**
   * Obtient les codes de livraison disponibles pour la France
   */
  getCodesLivraisonFrance(): Array<{
    code: string
    nom: string
  }> {
    return Object.entries(this.tarifs.codes_livraison.FR).map(([code, nom]) => ({
      code,
      nom
    }))
  }
}

export default TarifsService
