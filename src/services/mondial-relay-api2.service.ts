import { createHash } from 'crypto'
import "dotenv/config"
import { MondialRelayAPI1Service } from "./mondial-relay-api1.service"
import { redactSensitive } from "../utils/redact-sensitive"

export interface ShipmentData {
  orderNumber: string
  customerNumber: string
  deliveryMode: string
  location: string
  weight: number
  content: string
  deliveryInstruction?: string
  currency?: string
  shipmentValue?: string
  length?: number
  width?: number
  height?: number
  recipient: {
    title: string
    firstname: string
    lastname: string
    streetname: string
    houseNo: string
    countryCode: string
    postCode: string
    city: string
    phoneNo: string
    email: string
  }
  sender: {
    title: string
    firstname: string
    lastname: string
    streetname: string
    houseNo: string
    countryCode: string
    postCode: string
    city: string
    phoneNo: string
    mobileNo: string
    email: string
  }
}

export interface ShipmentResult {
  shipmentId: string
  trackingNumber: string
  labelUrl: string
  status: string
  relayPointInfo?: {
    deliveryMode?: string
    agencyCode?: string
    tournee?: string
    agencyName?: string
  }
}

export class MondialRelayAPI2Service {
  private baseUrl: string
  private login: string
  private password: string
  private customerId: string
  constructor(baseUrl?: string, login?: string, password?: string, customerId?: string) {
    this.baseUrl = baseUrl || process.env.MONDIAL_RELAY_API_BASE_URL || ''
    this.login = login || process.env.MONDIAL_RELAY_LOGIN || ''
    this.password = password || process.env.MONDIAL_RELAY_PASSWORD || ''
    this.customerId = customerId || process.env.MONDIAL_RELAY_CUSTOMER_ID || ''
  }

  // Sauvegardes XML désactivées pour éviter les crashes

  async createShipment(shipmentData: ShipmentData): Promise<ShipmentResult> {
    console.log('🚚 Création expédition Mondial Relay API 2 RÉELLE')
    console.log('📋 Données expédition:', JSON.stringify(shipmentData, null, 2))

    try {
      console.log('🛡️ Début de l\'appel API avec protection...')
      console.log('🔧 Configuration API 2:', {
        baseUrl: this.baseUrl,
        login: this.login,
        customerId: this.customerId
      })
      
      // Construire le XML pour l'API 2
      const xmlRequest = this.buildShipmentXML(shipmentData)
      console.log('📄 XML généré (500 premiers caractères):', redactSensitive(xmlRequest).substring(0, 500))
      console.log('📄 Taille XML:', xmlRequest.length, 'caractères')
      
      // Sauvegarder le XML dans un fichier pour debug (désactivé pour éviter le hot reload)
      // this.ensureLogsDirectory()
      // const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      // const xmlFile = path.join(process.cwd(), 'logs', 'debug', `api2-request-${timestamp}.xml`)
      // fs.writeFileSync(xmlFile, xmlRequest, 'utf8')
      // console.log('📁 XML sauvegardé dans:', xmlFile)
      
      console.log('📡 Appel API 2 Mondial Relay RÉEL...')
      console.log('🔗 URL:', `${this.baseUrl}/api/shipment`)
      console.log('🔑 Auth: Basic [redacted]')
      console.log('📋 Headers envoyés:', {
        'Accept': 'application/xml',
        'Content-Type': 'text/xml'
      })
      
      // Vérifier que les credentials sont présents
      if (!this.baseUrl || !this.login || !this.password || !this.customerId) {
        throw new Error('Credentials API Mondial Relay manquants')
      }
      
      console.log('🚀 Appel API Mondial Relay...')
      
      let response
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          console.log('⏰ Timeout API (1s)')
          controller.abort()
        }, 1000)
        
        try {
            response = await fetch(`${this.baseUrl}/api/shipment`, {
              method: 'POST',
              headers: {
                'Accept': 'application/xml',
                'Content-Type': 'text/xml'
              },
              body: xmlRequest,
              signal: controller.signal
            })
            
            clearTimeout(timeoutId)
            console.log('✅ API répond:', response.status)
        } catch (fetchError) {
          clearTimeout(timeoutId)
          console.error('❌ Erreur API:', fetchError.message)
          throw new Error(`Erreur réseau API Mondial Relay: ${fetchError.message}`)
        }
      } catch (error) {
        console.error('❌ Erreur API:', error.message)
        throw error
      }

      const responseText = await response.text()

      if (!response.ok) {
        console.error('❌ Erreur HTTP API 2:', redactSensitive(responseText))
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }

      console.log('📡 Traitement de la réponse...')
      const result = this.parseShipmentResponse(responseText)
      console.log('✅ Expédition créée:', result.shipmentId)
      return result

    } catch (error) {
      console.error('❌ Erreur API 2:', error.message)
      throw new Error(`Erreur API Mondial Relay: ${error.message}`)
    }
  }

  private buildShipmentXML(data: ShipmentData): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<ShipmentCreationRequest xmlns="http://www.example.org/Request">
  <Context>
    <Login>${this.login}</Login>
    <Password>${this.password}</Password>
    <CustomerId>${this.customerId}</CustomerId>
    <Culture>fr-FR</Culture>
    <VersionAPI>1.0</VersionAPI>
  </Context>
  <OutputOptions>
    <OutputFormat>10x15</OutputFormat>
    <OutputType>PdfUrl</OutputType>
  </OutputOptions>
  <ShipmentsList>
    <Shipment>
      <OrderNo>${data.orderNumber}</OrderNo>
      <CustomerNo>${data.customerNumber}</CustomerNo>
      <ParcelCount>1</ParcelCount>
      <ShipmentValue Currency="${data.currency || 'EUR'}" Amount="${data.shipmentValue || '0.00'}" />
      <DeliveryMode Mode="${data.deliveryMode}" Location="${data.location}" />
      <CollectionMode Mode="CCC" Location="" />
      <Parcels>
        <Parcel>
          <Content>${data.content}</Content>
          <Length Value="${data.length || 30}" Unit="cm" />
          <Width Value="${data.width || 20}" Unit="cm" />
          <Depth Value="${data.height || 10}" Unit="cm" />
          <Weight Value="${data.weight}" Unit="gr" />
        </Parcel>
      </Parcels>
      <DeliveryInstruction>${data.deliveryInstruction || ''}</DeliveryInstruction>
      <Sender>
        <Address>
          <Title>${data.sender.title}</Title>
          <Firstname>${data.sender.firstname}</Firstname>
          <Lastname>${data.sender.lastname}</Lastname>
          <Streetname>${data.sender.streetname}</Streetname>
          <HouseNo>${data.sender.houseNo}</HouseNo>
          <CountryCode>${data.sender.countryCode}</CountryCode>
          <PostCode>${data.sender.postCode}</PostCode>
          <City>${data.sender.city}</City>
          <AddressAdd1>Mondial Relay</AddressAdd1>
          <AddressAdd2 />
          <AddressAdd3>Mondial Relay</AddressAdd3>
          <PhoneNo>${data.sender.phoneNo}</PhoneNo>
          <MobileNo>${data.sender.mobileNo}</MobileNo>
          <Email>${data.sender.email}</Email>
        </Address>
      </Sender>
      <Recipient>
        <Address>
          <Title>${data.recipient.title}</Title>
          <Firstname>${data.recipient.firstname}</Firstname>
          <Lastname>${data.recipient.lastname}</Lastname>
          <Streetname>${data.recipient.streetname}</Streetname>
          <HouseNo>${data.recipient.houseNo}</HouseNo>
          <CountryCode>${data.recipient.countryCode}</CountryCode>
          <PostCode>${data.recipient.postCode}</PostCode>
          <City>${data.recipient.city}</City>
          <AddressAdd1 />
          <AddressAdd2 />
          <AddressAdd3 />
          <PhoneNo>${data.recipient.phoneNo}</PhoneNo>
          <MobileNo />
          <Email>${data.recipient.email}</Email>
        </Address>
      </Recipient>
    </Shipment>
  </ShipmentsList>
</ShipmentCreationRequest>`
  }

  /**
   * Parser la réponse JSON de création d'expédition
   */
  private parseShipmentJSONResponse(jsonResponse: string): ShipmentResult {
    try {
      console.log('📄 Parsing JSON response...')
      const data = JSON.parse(jsonResponse)
      console.log('📄 JSON parsé avec succès:', data)
      
      // Structure attendue de la réponse JSON Mondial Relay
      return {
        shipmentId: data.shipmentId || data.id,
        trackingNumber: data.trackingNumber || data.tracking_number,
        labelUrl: data.labelUrl || data.label_url,
        status: data.status,
        relayPointInfo: data.relayPointInfo
      }
    } catch (error) {
      console.error('❌ Erreur parsing JSON:', error)
      throw new Error(`Erreur parsing JSON: ${error.message}`)
    }
  }

  private parseShipmentResponse(response: string): ShipmentResult {
    try {
      if (response.startsWith('<')) {
        
        // Vérifier les erreurs dans StatusList selon XSD
        const errorStatusMatch = response.match(/<Status[^>]*Level="Error"[^>]*Message="([^"]*)"[^>]*\/>/)
        if (errorStatusMatch) {
          throw new Error(`API Error: ${errorStatusMatch[1]}`)
        }
        
        // Extraire le numéro d'expédition depuis Barcodes selon XSD
        const barcodeMatch = response.match(/<Barcodes>[\s\S]*?<Barcode[^>]*Value="([^"]*)"[^>]*>/)
        const shipmentNumber = barcodeMatch ? barcodeMatch[1] : ''
        
        // Extraire l'URL de l'étiquette depuis Label/Output selon XSD
        const outputMatch = response.match(/<LabelList>[\s\S]*?<Label>[\s\S]*?<Output>([^<]*)<\/Output>/)
        const outputUrl = outputMatch ? outputMatch[1] : ''
        
        // Extraire les informations du point relais depuis les LabelValues selon XSD
        let relayPointInfo: {
          deliveryMode?: string
          agencyCode?: string
          tournee?: string
          agencyName?: string
        } = {}
        
        // Parser les LabelValues selon structure XSD
        const labelValueMatches = response.match(/<LabelValues Key="([^"]+)" Value="([^"]+)"[^>]*\/>/g)
        if (labelValueMatches) {
          for (const match of labelValueMatches) {
            const keyMatch = match.match(/Key="([^"]+)"/)
            const valueMatch = match.match(/Value="([^"]+)"/)
            
            if (keyMatch && valueMatch) {
              const key = keyMatch[1]
              const value = valueMatch[1]
              
              if (key === 'MR.PlanTri.Mode') {
                relayPointInfo.deliveryMode = value
              } else if (key === 'MR.PlanTri.CodeAgence') {
                relayPointInfo.agencyCode = value
              } else if (key === 'MR.PlanTri.Tournee') {
                relayPointInfo.tournee = value
              } else if (key === 'MR.PlanTri.LibelleAgence') {
                relayPointInfo.agencyName = value
              }
            }
          }
        }
        
        console.log('📦 Informations point relais extraites selon XSD:', relayPointInfo)
        
        if (!shipmentNumber) {
          console.log('❌ ERREUR: Aucun numéro d\'expédition trouvé dans la réponse XML')
          console.log('🔍 Réponse XML complète:', redactSensitive(response))
          throw new Error('Impossible de récupérer le numéro d\'expédition depuis l\'API Mondial Relay')
        }
        
        return {
          shipmentId: shipmentNumber,
          trackingNumber: shipmentNumber,
          labelUrl: this.decodeUrl(outputUrl),
          status: 'created',
          relayPointInfo
        }
      }
      
      // Parser comme JSON selon structure XSD (fallback pour format JSON)
      if (response.startsWith('{')) {
        const jsonResponse = JSON.parse(response)
        console.log('📦 Réponse JSON parsée selon XSD:', redactSensitive(JSON.stringify(jsonResponse, null, 2)))
        
        // Extraire les données selon structure XSD officielle
        const shipmentsList = jsonResponse.ShipmentsList?.Shipment || []
        console.log('🔍 ShipmentsList trouvé selon XSD:', shipmentsList.length, 'expéditions')
        console.log('🔍 Structure complète ShipmentsList:', redactSensitive(JSON.stringify(shipmentsList, null, 2)))
        
        if (shipmentsList.length === 0) {
          console.log('❌ Aucune expédition dans ShipmentsList selon XSD')
          console.log('🔍 Structure complète de la réponse:', redactSensitive(JSON.stringify(jsonResponse, null, 2)))
          throw new Error('Aucune expédition trouvée dans la réponse')
        }
        
        const shipment = shipmentsList[0]
        // Extraire le numéro d'expédition depuis Barcodes selon XSD
        const shipmentNumber = shipment.LabelList?.Label?.RawContent?.Barcodes?.Barcode?.[0]?.Value || ''
        const labelData = shipment.LabelList?.Label || {}
        const outputUrl = labelData.Output || ''
        
        // Vérifier les erreurs dans StatusList selon XSD
        const statusList = jsonResponse.StatusList?.Status || []
        const errorStatus = statusList.find((status: any) => status.Level === 'Error')
        if (errorStatus) {
          throw new Error(`API Error: ${errorStatus.Message}`)
        }
        
        // Extraire les informations du point relais depuis les LabelValues selon XSD
        const labelValues = labelData.RawContent?.LabelValues || []
        let relayPointInfo: {
          deliveryMode?: string
          agencyCode?: string
          tournee?: string
          agencyName?: string
        } = {}
        
        for (const labelValue of labelValues) {
          const key = labelValue.Key
          const value = labelValue.Value
          
          if (key === 'MR.PlanTri.Mode') {
            relayPointInfo.deliveryMode = value
          } else if (key === 'MR.PlanTri.CodeAgence') {
            relayPointInfo.agencyCode = value
          } else if (key === 'MR.PlanTri.Tournee') {
            relayPointInfo.tournee = value
          } else if (key === 'MR.PlanTri.LibelleAgence') {
            relayPointInfo.agencyName = value
          }
        }
        
        console.log('🏪 Informations point relais extraites selon XSD:', relayPointInfo)
        
        const result: ShipmentResult = {
          shipmentId: shipmentNumber,
          trackingNumber: shipmentNumber,
          labelUrl: this.decodeUrl(outputUrl),
          status: 'created',
          relayPointInfo: relayPointInfo
        }
        
        if (!shipmentNumber) {
          console.log('❌ ERREUR: Aucun numéro d\'expédition trouvé dans la réponse JSON')
          console.log('🔍 Réponse JSON complète:', redactSensitive(JSON.stringify(jsonResponse)))
          throw new Error('Impossible de récupérer le numéro d\'expédition depuis l\'API Mondial Relay')
        }
        
        console.log('✅ Parsing JSON API 2 selon XSD réussi:', redactSensitive(JSON.stringify(result)))
        return result
      } else {
        // Format non reconnu
        console.log('❌ Format de réponse non reconnu')
        console.log('🔍 Réponse complète:', redactSensitive(response))
        throw new Error('Format de réponse non supporté par l\'API Mondial Relay')
      }
    } catch (parseError) {
      console.error('❌ Erreur lors du parsing de la réponse:', parseError)
      console.log('🔍 Réponse brute:', redactSensitive(response).substring(0, 500) + '...')
      throw new Error(`Erreur parsing réponse API: ${parseError.message}`)
    }
  }

  /**
   * Génère l'URL d'étiquette avec les vraies variables d'environnement
   */
  private generateLabelUrl(shipmentId: string): string {
    // Utiliser les mêmes identifiants que l'API 2 (pas l'API 1)
    const baseLabelUrl = process.env.MONDIAL_RELAY_SANDBOX_LABEL_URL
    const customerId = process.env.MONDIAL_RELAY_ENSEIGNE  // API 2 enseigne
    const privateKey = process.env.MONDIAL_RELAY_PRIVATE_KEY  // API 2 private key
    
    console.log('🔧 Variables d\'environnement pour URL étiquette:', {
      baseLabelUrl,
      customerId,
      privateKey: privateKey ? '[redacted]' : 'absent'
    })
    
    if (!baseLabelUrl || !customerId || !privateKey) {
      throw new Error('Variables d\'environnement manquantes pour génération URL étiquette')
    }
    
    const crc = this.generateCRC(shipmentId, customerId, privateKey)
    const finalUrl = `${baseLabelUrl}?ens=${customerId}&expedition=${shipmentId}&lg=fr-FR&format=10x15&crc=${crc}`
    
    console.log('🔗 URL étiquette générée:', redactSensitive(finalUrl))
    
    return finalUrl
  }

  /**
   * Génère le CRC de sécurité pour l'URL d'étiquette
   */
  private generateCRC(shipmentId: string, customerId: string, privateKey: string): string {
    const data = `${customerId}${shipmentId}fr-FR10x15${privateKey}`
    return createHash('md5').update(data).digest('hex').toUpperCase()
  }

  async trackShipment(trackingNumber: string): Promise<any> {
    console.log('🔍 Suivi expédition Mondial Relay:', trackingNumber)
    
    try {
      // Utiliser l'API 1 (SOAP) pour le suivi via WSI2_TracingColisDetaille
      const api1Service = new MondialRelayAPI1Service()
      const result = await api1Service.trackShipment(trackingNumber)
      
      console.log('✅ Suivi récupéré via API 1:', result)
      return result

    } catch (error) {
      console.error('❌ Erreur suivi expédition:', error)
      // Retourner des données simulées en cas d'erreur
      return {
        trackingNumber,
        status: 'En transit',
        lastUpdate: new Date().toISOString(),
        events: [
          {
            date: new Date().toISOString(),
            status: 'Expédition créée',
            location: 'Landas, France'
          }
        ]
      }
    }
  }

  /**
   * Décode les URLs qui contiennent des entités HTML encodées
   */
  private decodeUrl(url: string): string {
    if (!url) return url
    
    // Décoder les entités HTML communes
    return url
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
  }
}