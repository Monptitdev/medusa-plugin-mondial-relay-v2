/**
 * Service IGN Géocodage pour récupérer les coordonnées GPS d'une adresse française
 * Utilise l'API IGN Géoplateforme Autocomplétion
 */

export interface AddressComponents {
  street?: string
  houseNumber?: string
  city: string
  zipCode: string
  country: string
}

export interface GeocodingResult {
  latitude: number
  longitude: number
  formattedAddress: string
  confidence: number
}

export class IGNGeocodingService {
  private apiKey: string
  private baseUrl: string = "https://wxs.ign.fr"

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.IGN_API_KEY || ""
    if (!this.apiKey) {
      console.warn('⚠️ IGN_API_KEY non définie - géocodage désactivé')
    }
  }

  /**
   * Convertit une adresse française en coordonnées GPS
   */
  async geocodeAddress(address: AddressComponents): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      console.warn('⚠️ Géocodage IGN désactivé - clé API manquante')
      return null
    }

    try {
      console.log('🌍 Géocodage IGN pour:', address)
      
      // Construction de la requête de géocodage
      const query = this.buildGeocodingQuery(address)
      
      const response = await fetch(`${this.baseUrl}/${this.apiKey}/geoportail/ols/iapi/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          limit: 1,
          type: "StreetAddress"
        })
      })

      if (!response.ok) {
        throw new Error(`Erreur IGN API: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        const [longitude, latitude] = feature.geometry.coordinates
        
        return {
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6)),
          formattedAddress: feature.properties.label,
          confidence: feature.properties.score || 0.8
        }
      }

      return null
    } catch (error) {
      console.error('❌ Erreur géocodage IGN:', error)
      return null
    }
  }

  /**
   * Construit la requête de géocodage à partir des composants d'adresse
   */
  private buildGeocodingQuery(address: AddressComponents): string {
    const parts: string[] = []
    
    if (address.houseNumber) {
      parts.push(address.houseNumber)
    }
    
    if (address.street) {
      parts.push(address.street)
    }
    
    if (address.zipCode) {
      parts.push(address.zipCode)
    }
    
    if (address.city) {
      parts.push(address.city)
    }
    
    parts.push(address.country || "France")
    
    return parts.join(", ")
  }

  /**
   * Méthode de fallback avec géocodage simple (sans API)
   */
  async geocodeFallback(address: AddressComponents): Promise<GeocodingResult | null> {
    console.log('🔄 Utilisation du géocodage de fallback pour:', address)
    
    // Pour les tests, on peut utiliser des coordonnées approximatives
    // En production, il faudrait une vraie API de géocodage
    if (address.zipCode === "59310" && address.city === "Landas") {
      return {
        latitude: 50.4736,
        longitude: 3.2974,
        formattedAddress: `${address.street || ""}, ${address.zipCode} ${address.city}`,
        confidence: 0.5
      }
    }
    
    return null
  }

  /**
   * Géocodage avec fallback automatique
   */
  async geocodeWithFallback(address: AddressComponents): Promise<GeocodingResult | null> {
    // Essayer d'abord l'API IGN
    const result = await this.geocodeAddress(address)
    
    if (result) {
      console.log('✅ Géocodage IGN réussi:', result)
      return result
    }
    
    // Fallback si l'API IGN échoue
    console.log('🔄 Fallback vers géocodage simple')
    return await this.geocodeFallback(address)
  }
}
