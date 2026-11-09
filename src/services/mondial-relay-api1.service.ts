import crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { redactSensitive } from "../utils/redact-sensitive"

export interface SearchRelayPointsParams {
  zipCode?: string
  city?: string
  action?: string
  radius?: number
  latitude?: string
  longitude?: string
  weight?: number
  size?: string
  length?: number
  width?: number
  height?: number
}

export interface OpeningHours {
  [day: string]: {
    morning?: { open: string, close: string }
    afternoon?: { open: string, close: string }
    closed?: boolean
  }
}

export interface AvailabilityInfo {
  closed?: boolean
  vacationPeriods?: Array<{
    start: string
    end: string
  }>
}

export interface RelayPoint {
  id: string
  name: string
  address: string
  city: string
  zipCode: string
  country: string
  latitude: number
  longitude: number
  openingHours: string[] // Gardé pour compatibilité
  distance?: number
  type: 'RELAY' | 'LOCKER' | 'XL' | 'L'
  
  // Nouveaux champs enrichis
  nameLine2?: string        // LgAdr2
  addressLine2?: string     // LgAdr4
  typeActivite?: string     // TypeActivite (pour détecter lockers)
  localisation1?: string    // Localisation1
  localisation2?: string    // Localisation2
  realOpeningHours?: OpeningHours  // Horaires réels parsés
  availability?: AvailabilityInfo  // Disponibilité
  urlPlan?: string          // URL_Plan (Google Maps)
  urlPhoto?: string         // URL_Photo
}

export interface TrackingEvent {
  date: string
  time: string
  status: string
  location: string
  description: string
}

export interface TrackingResult {
  success: boolean
  tracking_events: TrackingEvent[]
  status: string
  error?: string
}

export class MondialRelayAPI1Service {
  private apiUrl: string
  private enseigne: string
  private privateKey: string
  private logsDir: string

  constructor(apiUrl?: string, enseigne?: string, privateKey?: string) {
         this.apiUrl = apiUrl || process.env.MONDIAL_RELAY_API1_URL || ""
    this.enseigne = enseigne || process.env.MONDIAL_RELAY_ENSEIGNE || ""
    this.privateKey = privateKey || process.env.MONDIAL_RELAY_PRIVATE_KEY || ""
    this.logsDir = path.join(process.cwd(), 'logs', 'mondial-relay-api1')
    this.ensureLogsDirectory()
  }

  /**
   * Crée le dossier de logs s'il n'existe pas
   */
  private ensureLogsDirectory(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true })
    }
  }

  // Sauvegardes XML désactivées pour éviter les crashes

  async searchRelayPoints(params: SearchRelayPointsParams): Promise<RelayPoint[]> {
    console.log('🔍 Recherche points relais Mondial Relay API 1')
    console.log('📋 Paramètres reçus:', params)

    // Déterminer si on utilise GPS ou postal
    const hasGPS = params.latitude && params.longitude
    const hasPostal = params.zipCode && params.city

    console.log('🔍 Analyse des paramètres:', {
      hasGPS,
      hasPostal,
      latitude: params.latitude,
      longitude: params.longitude,
      zipCode: params.zipCode,
      city: params.city
    })

    // Formater les coordonnées GPS selon le format attendu par l'API (11 caractères, 7 décimales)
    const formatGPS = (coord: string | number): string => {
      const num = parseFloat(String(coord))
      if (isNaN(num)) return ''
      
      // Format avec 7 décimales
      const withDecimals = num.toFixed(7)
      
      // Ajouter un zéro devant si nécessaire pour avoir 2 chiffres avant le point
      const parts = withDecimals.split('.')
      const intPart = parts[0].padStart(2, '0')
      const formatted = `${intPart}.${parts[1]}`
      
      console.log(`🔧 Formatage GPS: "${coord}" -> "${formatted}"`)
      return formatted
    }

    // Paramètres SOAP
    const soapParams = {
      Enseigne: this.enseigne,
      Pays: "FR",
      NumPointRelais: "",
      Ville: hasGPS ? "" : (params.city || ""),  // Ignorer la ville si on utilise GPS
      CP: hasGPS ? "" : (params.zipCode || ""), // Ignorer le code postal si on utilise GPS
      Latitude: hasGPS ? formatGPS(params.latitude!) : "",
      Longitude: hasGPS ? formatGPS(params.longitude!) : "",
      Taille: params.size || "",
      Poids: params.weight?.toString() || "",
      Action: params.action || "24R",
      DelaiEnvoi: "0",
      RayonRecherche: params.radius?.toString() || "20",
      TypeActivite: "",
      NACE: "",
      NombreResultats: "20"
    }

    console.log('🔧 Paramètres SOAP formatés:', soapParams)

    // Génération de la clé de sécurité MD5 selon la documentation
    // Ordre: [Enseigne][Pays][NumPointRelais][Ville][CP][Latitude][Longitude][Taille][Poids][Action][DelaiEnvoi][RayonRecherche][TypeActivite][NombreResultats][CLE PRIVEE]
    const securityString = 
      soapParams.Enseigne +
      soapParams.Pays +
      soapParams.NumPointRelais +
      soapParams.Ville +
      soapParams.CP +
      soapParams.Latitude +
      soapParams.Longitude +
      soapParams.Taille +
      soapParams.Poids +
      soapParams.Action +
      soapParams.DelaiEnvoi +
      soapParams.RayonRecherche +
      soapParams.TypeActivite +
      soapParams.NombreResultats +
      this.privateKey
    
    const securityHash = crypto.createHash('md5').update(securityString).digest('hex').toUpperCase()

    console.log('🔐 Clé de sécurité calculée: [redacted]')

    // Appel SOAP direct avec fetch
    const soapXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <WSI4_PointRelais_Recherche xmlns="http://www.mondialrelay.fr/webservice/">
      <Enseigne>${soapParams.Enseigne}</Enseigne>
      <Pays>${soapParams.Pays}</Pays>
      <NumPointRelais>${soapParams.NumPointRelais}</NumPointRelais>
      <Ville>${soapParams.Ville}</Ville>
      <CP>${soapParams.CP}</CP>
      <Latitude>${soapParams.Latitude}</Latitude>
      <Longitude>${soapParams.Longitude}</Longitude>
      <Taille>${soapParams.Taille}</Taille>
      <Poids>${soapParams.Poids}</Poids>
      <Action>${soapParams.Action}</Action>
      <DelaiEnvoi>${soapParams.DelaiEnvoi}</DelaiEnvoi>
      <RayonRecherche>${soapParams.RayonRecherche}</RayonRecherche>
      <TypeActivite>${soapParams.TypeActivite}</TypeActivite>
      <NACE>${soapParams.NACE}</NACE>
      <NombreResultats>${soapParams.NombreResultats}</NombreResultats>
      <Security>${securityHash}</Security>
    </WSI4_PointRelais_Recherche>
  </soap:Body>
</soap:Envelope>`

    try {
      // Sauvegarde XML désactivée pour éviter les crashes
      
      console.log('📡 Appel SOAP direct vers Mondial Relay...')
      console.log('🔗 URL:', this.apiUrl)
      console.log('📋 SOAPAction:', 'http://www.mondialrelay.fr/webservice/WSI4_PointRelais_Recherche')
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.mondialrelay.fr/webservice/WSI4_PointRelais_Recherche'
        },
        body: soapXml
      })

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }

      const xmlResponse = await response.text()
      console.log('✅ Réponse SOAP reçue')
      console.log('📄 Contenu XML brut:', redactSensitive(xmlResponse).substring(0, 500) + '...')
      console.log('📄 Contenu XML complet:', redactSensitive(xmlResponse))
      
      // Sauvegarde XML désactivée pour éviter les crashes

      // Parser la réponse XML
      const statMatch = xmlResponse.match(/<STAT>(\d+)<\/STAT>/)
      if (statMatch && statMatch[1] !== '0') {
        throw new Error(`API Error: ${statMatch[1]}`)
      }

      // Extraire les points relais
      const pointsMatch = xmlResponse.match(/<PointsRelais>(.*?)<\/PointsRelais>/s)
      if (!pointsMatch) {
        console.log('⚠️ Aucun point relais trouvé')
        return []
      }

      const pointMatches = pointsMatch[1].match(/<PointRelais_Details>(.*?)<\/PointRelais_Details>/gs) || []
      console.log(`✅ ${pointMatches.length} points relais trouvés`)

      const relayPoints: RelayPoint[] = []

      pointMatches.forEach((pointXml, index) => {
        try {
          // Champs de base
          const id = this.extractXmlValue(pointXml, 'Num')
          const name = this.extractXmlValue(pointXml, 'LgAdr1')
          const address = this.extractXmlValue(pointXml, 'LgAdr3')
          const city = this.extractXmlValue(pointXml, 'Ville')
          const zipCode = this.extractXmlValue(pointXml, 'CP')
          const latitudeStr = this.extractXmlValue(pointXml, 'Latitude')
          const longitudeStr = this.extractXmlValue(pointXml, 'Longitude')
          
          // Nouveaux champs enrichis
          const nameLine2 = this.extractXmlValue(pointXml, 'LgAdr2')
          const addressLine2 = this.extractXmlValue(pointXml, 'LgAdr4')
          const typeActivite = this.extractXmlValue(pointXml, 'TypeActivite')
          const localisation1 = this.extractXmlValue(pointXml, 'Localisation1')
          const localisation2 = this.extractXmlValue(pointXml, 'Localisation2')
          const urlPlan = this.extractXmlValue(pointXml, 'URL_Plan')
          const urlPhoto = this.extractXmlValue(pointXml, 'URL_Photo')
          
          console.log(`🔍 Point ${index} - Latitude brute: "${latitudeStr}", Longitude brute: "${longitudeStr}"`)
          console.log(`🔍 Point ${index} - TypeActivite: "${typeActivite}"`)
          
          // Convertir les virgules en points pour le format français
          const latitude = parseFloat(latitudeStr.replace(',', '.'))
          const longitude = parseFloat(longitudeStr.replace(',', '.'))
          console.log(`🔍 Point ${index} - Latitude parsée: ${latitude}, Longitude parsée: ${longitude}`)
          
          // Parser les horaires réels et la disponibilité
          const openingHours = this.parseOpeningHours(pointXml)
          const realOpeningHours = this.parseRealOpeningHours(pointXml)
          const availability = this.parseAvailability(pointXml)
          
          // Détecter le type de point (Locker ou Relay)
          const type = this.detectPointType(typeActivite, name)

          if (id && name && address && city && zipCode) {
            relayPoints.push({
              id,
              name,
              address,
              city,
              zipCode,
              country: 'FR',
              latitude,
              longitude,
              openingHours, // Gardé pour compatibilité
              type,
              
              // Nouveaux champs enrichis
              nameLine2: nameLine2 || undefined,
              addressLine2: addressLine2 || undefined,
              typeActivite: typeActivite || undefined,
              localisation1: localisation1 || undefined,
              localisation2: localisation2 || undefined,
              realOpeningHours: realOpeningHours || undefined,
              availability: availability || undefined,
              urlPlan: urlPlan || undefined,
              urlPhoto: urlPhoto || undefined
            })
          }
        } catch (error) {
          console.error(`❌ Erreur parsing point ${index}:`, error)
        }
      })

      console.log(`✅ ${relayPoints.length} points relais parsés avec succès`)
      return relayPoints

    } catch (error) {
      console.error('❌ Erreur API 1 Mondial Relay:', error)
      throw error
    }
  }

  private extractXmlValue(xml: string, tagName: string): string {
    const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 's')
    const match = xml.match(regex)
    return match ? match[1].trim() : ''
  }

  private parseOpeningHours(pointXml: string): string[] {
    const hours: string[] = []
    
    // Extraire les horaires d'ouverture
    const openingHoursXml = pointXml.match(/<Horaires_Livraison>(.*?)<\/Horaires_Livraison>/s)
    if (openingHoursXml) {
      const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
      days.forEach(day => {
        const dayMatch = openingHoursXml[1].match(new RegExp(`<${day}>(.*?)<\/${day}>`, 's'))
        if (dayMatch && dayMatch[1].trim()) {
          hours.push(`${day}: ${dayMatch[1].trim()}`)
        }
      })
    }

    // Si pas d'horaires spécifiques, utiliser des horaires par défaut
    if (hours.length === 0) {
      hours.push('Lun-Ven: 9h-18h', 'Sam: 9h-12h')
    }

    return hours
  }

  /**
   * Détecte le type de point relais via le nom (plus fiable que TypeActivite)
   */
  private detectPointType(typeActivite: string, name: string): 'RELAY' | 'LOCKER' | 'XL' | 'L' {
    if (!name) {
      return 'RELAY'
    }

    // Détection basée sur le nom du point relais
    const nameLower = name.toLowerCase()
    
    if (nameLower.includes('locker') || 
        nameLower.includes('casier') || 
        nameLower.includes('24/7') ||
        nameLower.includes('automatique')) {
      return 'LOCKER'
    }
    
    if (nameLower.includes('xl') || nameLower.includes('volumineux')) {
      return 'XL'
    }
    
    if (nameLower.includes(' l ') || nameLower.includes('large')) {
      return 'L'
    }

    return 'RELAY'
  }

  /**
   * Parse les horaires réels (Horaire_Lundi à Horaire_Dimanche)
   */
  private parseRealOpeningHours(pointXml: string): OpeningHours | null {
    console.log('🔍 parseRealOpeningHours appelé - Longueur XML:', pointXml.length)
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    const openingHours: OpeningHours = {}

    // Format réel: <Horaires_Lundi><string>0700</string><string>1800</string><string>0000</string><string>0000</string></Horaires_Lundi>
    // Format: [Ouverture1, Fermeture1, Ouverture2, Fermeture2]
    
    let foundAny = false
    days.forEach(day => {
      const dayKey = day.toLowerCase()
      const horairesTag = `Horaires_${day}`
      
      // Extraire le contenu entre <Horaires_Lundi> et </Horaires_Lundi>
      const horairesMatch = pointXml.match(new RegExp(`<${horairesTag}>(.*?)<\/${horairesTag}>`, 's'))
      
      if (horairesMatch && horairesMatch[1]) {
        // Extraire tous les tags <string> à l'intérieur
        const stringMatches = horairesMatch[1].match(/<string>(.*?)<\/string>/g)
        
        if (stringMatches && stringMatches.length >= 2) {
          // Extraire les valeurs (format: "0700", "1800", "0000", "0000")
          const times = stringMatches.map(match => {
            const valueMatch = match.match(/<string>(.*?)<\/string>/)
            return valueMatch ? valueMatch[1].trim() : ''
          }).filter(t => t && t !== '0')
          
          if (times.length >= 2) {
            foundAny = true
            const open1 = times[0]
            const close1 = times[1]
            
            // Vérifier si c'est vraiment fermé (0000-0000) ou locker 24/7 (0001-2359)
            const isClosed = (open1 === '0000' && close1 === '0000')
            const is24_7 = (open1 === '0001' && close1 === '2359') // Locker 24/7
            
            if (isClosed) {
              openingHours[dayKey] = { closed: true }
            } else if (is24_7) {
              // Locker 24/7: ouvert toute la journée
              openingHours[dayKey] = {
                morning: { open: '00:01', close: '23:59' },
                closed: false
              }
              console.log(`  ✅ ${day} parsé: Ouvert 24/7`)
            } else {
              const morning = {
                open: this.normalizeTime(open1),
                close: this.normalizeTime(close1)
              }
              
              let afternoon: { open: string, close: string } | undefined = undefined
              if (times.length >= 4 && times[2] !== '0000' && times[3] !== '0000') {
                afternoon = {
                  open: this.normalizeTime(times[2]),
                  close: this.normalizeTime(times[3])
                }
              }
              
              openingHours[dayKey] = {
                morning,
                afternoon,
                closed: false
              }
              console.log(`  ✅ ${day} parsé: matin ${morning.open}-${morning.close}${afternoon ? `, après-midi ${afternoon.open}-${afternoon.close}` : ''}`)
            }
          } else {
            openingHours[dayKey] = { closed: true }
          }
        } else {
          openingHours[dayKey] = { closed: true }
        }
      } else {
        openingHours[dayKey] = { closed: true }
      }
    })
    
    if (!foundAny) {
      console.log('⚠️ Aucun tag Horaires_* trouvé dans parseRealOpeningHours')
      return null
    }

    // Si tous les jours sont fermés sans horaires valides, retourner null
    const hasValidHours = Object.values(openingHours).some(h => h.morning || h.afternoon)
    if (!hasValidHours) {
      console.log('⚠️ Aucun horaire valide trouvé dans parseRealOpeningHours')
      return null
    }

    console.log('✅ Horaires parsés avec succès:', Object.keys(openingHours).filter(k => openingHours[k].morning || openingHours[k].afternoon).length, 'jours avec horaires')
    return Object.keys(openingHours).length > 0 ? openingHours : null
  }

  /**
   * Parse une chaîne d'horaires (format "09:00-12:00,14:00-18:00" ou "0900-1200,1400-1800")
   */
  private parseHourString(horaireStr: string): { morning?: { open: string, close: string }, afternoon?: { open: string, close: string }, closed: boolean } | null {
    const times = horaireStr.split(',').map(t => t.trim()).filter(t => t && t !== '0')
    
    if (times.length === 0) {
      return null
    }
    
    // Parser le premier créneau (matin)
    const morningMatch = times[0].match(/(\d{2}:?\d{2})-(\d{2}:?\d{2})/) || 
                         times[0].match(/(\d{4})-(\d{4})/)
    
    let morning: { open: string, close: string } | undefined = undefined
    
    if (morningMatch) {
      morning = {
        open: this.normalizeTime(morningMatch[1]),
        close: this.normalizeTime(morningMatch[2])
      }
    }
    
    // Parser le deuxième créneau (après-midi) s'il existe
    let afternoon: { open: string, close: string } | undefined = undefined
    if (times.length > 1 && times[1]) {
      const afternoonMatch = times[1].match(/(\d{2}:?\d{2})-(\d{2}:?\d{2})/) || 
                              times[1].match(/(\d{4})-(\d{4})/)
      if (afternoonMatch) {
        afternoon = {
          open: this.normalizeTime(afternoonMatch[1]),
          close: this.normalizeTime(afternoonMatch[2])
        }
      }
    }
    
    if (morning || afternoon) {
      return { morning, afternoon, closed: false }
    }
    
    return null
  }

  /**
   * Normalise le format de l'heure : convertit "0900" en "09:00"
   */
  private normalizeTime(timeStr: string): string {
    // Si format "0900" (4 chiffres), convertir en "09:00"
    if (/^\d{4}$/.test(timeStr)) {
      return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}`
    }
    // Si format "09:00", retourner tel quel
    return timeStr
  }

  /**
   * Parse les informations de disponibilité
   */
  private parseAvailability(pointXml: string): AvailabilityInfo | null {
    const infoDispo = this.extractXmlValue(pointXml, 'Informations_Dispo')
    const debut = this.extractXmlValue(pointXml, 'Debut')
    const fin = this.extractXmlValue(pointXml, 'Fin')
    
    if (!infoDispo && !debut && !fin) {
      return null
    }

    const availability: AvailabilityInfo = {
      closed: false,
      vacationPeriods: []
    }

    // Parser les périodes de fermeture
    if (debut && fin) {
      availability.vacationPeriods!.push({
        start: debut,
        end: fin
      })
    }

    // Parser les informations de disponibilité
    if (infoDispo) {
      // Logique pour déterminer si fermé actuellement
      // À ajuster selon le format des données
      if (infoDispo.toLowerCase().includes('fermé') || 
          infoDispo.toLowerCase().includes('ferme') ||
          infoDispo.toLowerCase().includes('closed')) {
        availability.closed = true
      }
    }

    return availability
  }



  /**
   * Suit une expédition Mondial Relay via l'API 1 (SOAP)
   * Basé sur la documentation Mondial Relay pour l'API 1
   */
  async trackShipment(trackingNumber: string): Promise<TrackingResult> {
    console.log('📦 Suivi expédition Mondial Relay API 1:', trackingNumber)

    try {
      // Construction de la requête SOAP pour le tracking
      const soapBody = this.buildTrackingSOAP(trackingNumber)
      
      console.log('🔍 Requête SOAP tracking:', redactSensitive(soapBody))

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.mondialrelay.fr/webservice/WSI2_TracingColisDetaille'
        },
        body: soapBody
      })

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`)
      }

      const xmlResponse = await response.text()
      console.log('📋 Réponse SOAP tracking:', redactSensitive(xmlResponse))

      // Parse de la réponse XML
      const trackingData = this.parseTrackingResponse(xmlResponse)
      
      return {
        success: true,
        tracking_events: trackingData.events,
        status: trackingData.status
      }

    } catch (error) {
      console.error('❌ Erreur tracking API 1:', error)
      return {
        success: false,
        tracking_events: [],
        status: 'error',
        error: error.message
      }
    }
  }

  /**
   * Construit la requête SOAP pour le tracking
   */
  private buildTrackingSOAP(trackingNumber: string): string {
    // Génération de la clé de sécurité selon la documentation
    // Ordre: [Enseigne][Expedition][Langue][CLE PRIVEE]
    const securityString = this.enseigne + trackingNumber + 'FR' + this.privateKey
    const securityHash = crypto.createHash('md5').update(securityString).digest('hex').toUpperCase()
    
    console.log('🔐 Clé de sécurité tracking calculée: [redacted]')

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <WSI2_TracingColisDetaille xmlns="http://www.mondialrelay.fr/webservice/">
      <Enseigne>${this.enseigne}</Enseigne>
      <Expedition>${trackingNumber}</Expedition>
      <Langue>FR</Langue>
      <Security>${securityHash}</Security>
    </WSI2_TracingColisDetaille>
  </soap:Body>
</soap:Envelope>`
  }

  /**
   * Parse la réponse XML du tracking
   */
  private parseTrackingResponse(xmlResponse: string): { events: TrackingEvent[], status: string } {
    const events: TrackingEvent[] = []
    let status = 'pending'

    try {
      // Extraction des événements de tracking depuis la réponse XML
      const eventMatches = xmlResponse.match(/<TracingColisDetaille>(.*?)<\/TracingColisDetaille>/gs)
      
      if (eventMatches) {
        for (const eventXml of eventMatches) {
          const dateMatch = eventXml.match(/<Date>([^<]+)<\/Date>/)
          const timeMatch = eventXml.match(/<Heure>([^<]+)<\/Heure>/)
          const statusMatch = eventXml.match(/<Libelle>([^<]+)<\/Libelle>/)
          const locationMatch = eventXml.match(/<Lieu>([^<]+)<\/Lieu>/)
          const relayMatch = eventXml.match(/<Relais>([^<]+)<\/Relais>/)
          const countryMatch = eventXml.match(/<Pays>([^<]+)<\/Pays>/)

          if (dateMatch && timeMatch && statusMatch) {
            const event: TrackingEvent = {
              date: dateMatch[1],
              time: timeMatch[1],
              status: statusMatch[1],
              location: locationMatch ? locationMatch[1] : '',
              description: `${statusMatch[1]}${locationMatch ? ` - ${locationMatch[1]}` : ''}${relayMatch ? ` (Point Relais: ${relayMatch[1]})` : ''}${countryMatch ? ` - ${countryMatch[1]}` : ''}`
            }
            events.push(event)

            // Déterminer le statut global
            if (event.status.includes('Livré') || event.status.includes('Délivré')) {
              status = 'delivered'
            } else if (event.status.includes('Disponible') || event.status.includes('En attente')) {
              status = 'in_transit'
            } else if (event.status.includes('Expédié') || event.status.includes('En cours')) {
              status = 'shipped'
            }
          }
        }
      }

      // Si aucun événement trouvé, essayer un parsing alternatif
      if (events.length === 0) {
        const errorMatch = xmlResponse.match(/<Error>([^<]+)<\/Error>/)
        if (errorMatch) {
          console.log('⚠️ Erreur dans la réponse:', errorMatch[1])
          status = 'error'
        }
      }

    } catch (error) {
      console.error('❌ Erreur parsing XML tracking:', error)
    }

    return { events, status }
  }
}
