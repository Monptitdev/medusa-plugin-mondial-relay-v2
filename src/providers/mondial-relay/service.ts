import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

// Charger les variables d'environnement
require('dotenv').config()
import {
  FulfillmentItemDTO,
  FulfillmentOrderDTO,
  FulfillmentDTO,
  CreateFulfillmentResult,
  FulfillmentOption,
  CreateShippingOptionDTO,
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO
} from "@medusajs/framework/types"

// Importer le service API 2
import { MondialRelayAPI2Service, ShipmentResult } from "../../services/mondial-relay-api2.service"
// Importer le service de tarifs
import TarifsService from "../../services/tarifs.service"

type InjectedDependencies = {
  logger: Logger
  container: any
}

type MondialRelayOptions = {
  apiKey?: string
  apiSecret?: string
  customerId?: string
  businessAddress?: {
    title?: string
    firstname?: string
    lastname?: string
    streetname?: string
    houseNo?: string
    countryCode?: string
    postCode?: string
    city?: string
    phoneNo?: string
    mobileNo?: string
    email?: string
  }
  business?: {
    title?: string
    firstname?: string
    lastname?: string
    street?: string
    address1?: string
    country?: string
    postcode?: string
    city?: string
    phone?: string
    mobile?: string
    email?: string
  }
}

class MondialRelayFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "mondial-relay"
  
  // Log au chargement de la classe
  static {
  }

  protected logger_: Logger
  protected options_: MondialRelayOptions

  private mondialRelayAPI2Service: MondialRelayAPI2Service

  constructor(
    { logger }: InjectedDependencies,
    options: MondialRelayOptions
  ) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.mondialRelayAPI2Service = new MondialRelayAPI2Service()
    
  }

  /**
   * Indique si le provider peut calculer des tarifs dynamiques
   * Retourne true pour permettre l'utilisation de shipping options "calculated"
   */
  async canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    // Mondial Relay peut calculer des tarifs dynamiques via l'API
    // Retourner true pour permettre l'utilisation de shipping options "calculated"
    return true
  }

  /**
   * Valide les données de fulfillment
   */
  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: any
  ): Promise<any> {
    // Pour Mondial Relay, nous n'avons pas besoin de données spécifiques
    // La validation se fait au moment de la création de l'expédition
    return data || {}
  }

  /**
   * Met à jour les métadonnées de la commande via l'API HTTP admin
   */
  private async updateOrderMetadata(orderId: string, metadata: any): Promise<void> {
    try {
      // D'abord, récupérer la commande pour obtenir les métadonnées existantes
      const orderResponse = await fetch(`http://localhost:9000/admin/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAdminToken()}`
        }
      })

      if (!orderResponse.ok) {
        throw new Error(`Erreur récupération commande: ${orderResponse.status}`)
      }

      const order = await orderResponse.json()
      
      // Préparer les nouvelles métadonnées
      const newMetadata = {
        ...order.metadata,
        shipping_metadata: {
          ...order.metadata?.shipping_metadata,
          carrier: 'mondial-relay',
          mondial_relay_tracking_number: metadata.trackingNumber,
          mondial_relay_shipment_id: metadata.shipmentId,
          mondial_relay_label_url: metadata.labelUrl,
          mondial_relay_delivery_mode: metadata.relayPointInfo?.deliveryMode,
          mondial_relay_relay_point_id: metadata.relayPointInfo?.relayPointId,
          mondial_relay_relay_point_name: metadata.relayPointInfo?.relayPointName,
          mondial_relay_relay_point_address: metadata.relayPointInfo?.relayPointAddress,
          mondial_relay_weight: metadata.relayPointInfo?.weight
        },
        mondial_relay_shipment: {
          id: metadata.shipmentId,
          orderId: order.id,
          trackingNumber: metadata.trackingNumber,
          status: 'created',
          relayPointId: metadata.relayPointInfo?.relayPointId,
          weight: metadata.relayPointInfo?.weight,
          shipmentId: metadata.shipmentId,
          labelUrl: metadata.labelUrl,
          createdAt: new Date().toISOString()
        }
      }
      
      // Mettre à jour les métadonnées
      const updateResponse = await fetch(`http://localhost:9000/admin/orders/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAdminToken()}`
        },
        body: JSON.stringify({
          metadata: newMetadata
        })
      })

      this.logger_.info(`📊 Status mise à jour: ${updateResponse.status}`)
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        this.logger_.error(`❌ Erreur mise à jour: ${errorText}`)
        throw new Error(`Erreur mise à jour commande: ${updateResponse.status} - ${errorText}`)
      }

      this.logger_.info('✅ Métadonnées mises à jour via API HTTP admin')
    } catch (error) {
      this.logger_.error('❌ Erreur mise à jour métadonnées via API HTTP:', error)
      this.logger_.error(`❌ Stack trace: ${error.stack}`)
      throw error
    }
  }

  /**
   * Génère l'URL d'étiquette avec les vraies variables d'environnement
   */
  private generateLabelUrl(shipmentId: string): string {
    const baseLabelUrl = process.env.MONDIAL_RELAY_SANDBOX_LABEL_URL
    const customerId = process.env.MONDIAL_RELAY_ENSEIGNE
    const privateKey = process.env.MONDIAL_RELAY_PRIVATE_KEY
    
    console.log('🔧 Variables d\'environnement pour URL étiquette:', {
      baseLabelUrl,
      customerId,
      privateKey: privateKey ? '***' : 'undefined'
    })
    
    if (!baseLabelUrl || !customerId || !privateKey) {
      throw new Error('Variables d\'environnement manquantes pour génération URL étiquette')
    }
    
    const crc = this.generateCRC(shipmentId, customerId, privateKey)
    const finalUrl = `${baseLabelUrl}?ens=${customerId}&expedition=${shipmentId}&lg=fr-FR&format=10x15&crc=${crc}`
    
    console.log('🔗 URL étiquette générée:', finalUrl)
    
    return finalUrl
  }

  /**
   * Extrait le nom de rue de l'adresse complète (sans code postal et ville)
   */
  private extractStreetName(fullAddress: string): string {
    if (!fullAddress) return ""
    
    // Supprimer le code postal et la ville à la fin
    // Format: "6 Rue du Marechal de Lattre de Tassigny, 59280 Armentières"
    const cleanedAddress = fullAddress
      .replace(/,\s*\d{5}\s+[^,]+$/, '') // Supprimer ", 59280 Armentières"
      .replace(/,\s*\d{4}\s+[^,]+$/, '') // Supprimer ", 1234 Ville" (format 4 chiffres)
      .trim()
    
    // Tronquer à 30 caractères maximum pour Mondial Relay
    return cleanedAddress.length > 30 ? cleanedAddress.substring(0, 30) : cleanedAddress
  }

  /**
   * Génère le CRC de sécurité pour l'URL d'étiquette
   */
  private generateCRC(shipmentId: string, customerId: string, privateKey: string): string {
    const crypto = require('crypto')
    const data = `${customerId}${shipmentId}fr-FR10x15${privateKey}`
    return crypto.createHash('md5').update(data).digest('hex').toUpperCase()
  }

  /**
   * Obtient un token d'authentification admin
   */
  private async getAdminToken(): Promise<string> {
    try {
      // Login admin direct
      const loginResponse = await fetch('http://localhost:9000/auth/user/emailpass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'quentin@monptitdev.fr',
          password: 'Qucu14092018'
        })
      })

      if (!loginResponse.ok) {
        throw new Error(`Erreur login admin: ${loginResponse.status}`)
      }

      const loginData = await loginResponse.json()
      
      // Utiliser directement le token retourné
      return loginData.token || 'dummy-token'
    } catch (error) {
      this.logger_.error('❌ Erreur authentification admin:', error)
      return 'dummy-token'
    }
  }

  /**
   * Crée une expédition Mondial Relay
   */
  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<Omit<FulfillmentOrderDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    try {
      // Validation des données d'entrée
      if (!data || !items || !order) {
        throw new Error("Données manquantes pour la création de l'expédition")
      }
      
      if (!items.length) {
        throw new Error("Aucun article à expédier")
      }

      // Récupérer les données de l'adresse de livraison
      // Dans Medusa v2, l'adresse peut être dans différents endroits
      const deliveryAddress = (order as any).shipping_address || 
                             (order as any).delivery_address || 
                             (order as any).address ||
                             (data as any).shipping_address ||
                             (data as any).delivery_address

      if (!deliveryAddress) {
        throw new Error("Adresse de livraison requise")
      }

      // Récupérer les métadonnées du point relais depuis l'ordre
      // Les métadonnées Mondial Relay sont dans les métadonnées de la commande
      // Mais elles peuvent aussi être dans les métadonnées du shipping method
      // Récupérer les métadonnées depuis l'API Admin HTTP
      
      const http = require('http');
      
      // 1. S'authentifier d'abord pour obtenir le token JWT
      console.log(`🔑 DEBUG: Authentification admin...`)
      this.logger_.info(`🔑 Authentification admin...`)
      
      const authResponse = await new Promise<{status: number, data: any}>((resolve, reject) => {
        const authOptions = {
          hostname: 'localhost',
          port: 9000,
          path: '/auth/user/emailpass',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        };
        
        const authReq = http.request(authOptions, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(body);
              resolve({ status: res.statusCode, data: result });
            } catch (e) {
              resolve({ status: res.statusCode, data: body });
            }
          });
        });
        
        authReq.on('error', (e) => {
          reject(e);
        });
        
        authReq.write(JSON.stringify({
          email: 'quentin@monptitdev.fr',
          password: 'Qucu14092018'
        }));
        
        authReq.end();
      });
      
      console.log(`🔑 DEBUG: Statut d'authentification: ${authResponse.status}`)
      console.log(`🔑 DEBUG: Données d'authentification: ${JSON.stringify(authResponse.data, null, 2)}`)
      
      if (authResponse.status !== 200) {
        throw new Error(`Erreur authentification: ${authResponse.status} ${JSON.stringify(authResponse.data)}`);
      }
      
      console.log(`🔑 DEBUG: Réponse d'authentification complète: ${JSON.stringify(authResponse.data, null, 2)}`)
      const jwtToken = authResponse.data.token;
      console.log(`✅ DEBUG: Token JWT obtenu: ${jwtToken.substring(0, 20)}...`)
      this.logger_.info(`✅ Token JWT obtenu: ${jwtToken.substring(0, 20)}...`)
      
      // 2. Récupérer les métadonnées de la commande avec le token
      const orderResponse = await new Promise<{status: number, data: any}>((resolve, reject) => {
        const options = {
          hostname: 'localhost',
          port: 9000,
          path: `/admin/orders/${order.id}?fields=id,metadata`,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          }
        };
        
        const req = http.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(body);
              resolve({ status: res.statusCode, data: result });
            } catch (e) {
              resolve({ status: res.statusCode, data: body });
            }
          });
        });
        
        req.on('error', (e) => {
          reject(e);
        });
        
        req.end();
      });
      
      if (orderResponse.status !== 200) {
        throw new Error(`Erreur récupération commande: ${orderResponse.status} ${JSON.stringify(orderResponse.data)}`);
      }
      
      console.log(`📦 DEBUG: Structure complète de orderResponse.data: ${JSON.stringify(orderResponse.data, null, 2)}`)
      const orderMetadata = orderResponse.data.order.metadata
      
      console.log(`📦 DEBUG: Métadonnées complètes de la commande: ${JSON.stringify(orderMetadata, null, 2)}`)
      this.logger_.info(`📦 Métadonnées complètes de la commande: ${JSON.stringify(orderMetadata, null, 2)}`)
      
      // Vérifier si les métadonnées Mondial Relay sont présentes
      if (!orderMetadata || !orderMetadata.carrier || orderMetadata.carrier !== 'mondial-relay') {
        this.logger_.error(`❌ Aucune métadonnée Mondial Relay trouvée dans la commande`)
        this.logger_.error(`📦 Métadonnées actuelles: ${JSON.stringify(orderMetadata, null, 2)}`)
        throw new Error("❌ CRITIQUE: Métadonnées Mondial Relay manquantes dans la commande")
      }
      
      this.logger_.info(`📦 Métadonnées complètes de la commande: ${JSON.stringify(orderMetadata, null, 2)}`)
      
      // DEBUG: Vérifier si orderMetadata est undefined
      if (!orderMetadata) {
        console.log("❌ CRITIQUE: orderMetadata est undefined après récupération depuis l'API !")
        
        // Sauvegarder les logs dans un fichier
        const fs = require('fs');
        const path = require('path');
        const logDir = path.join(process.cwd(), 'logs', 'debug');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(logDir, `debug-order-metadata-${timestamp}.json`);
        
        const debugData = {
          timestamp: new Date().toISOString(),
          orderId: order.id,
          orderMetadata: orderMetadata,
          data: data,
          items: items
        };
        
        fs.writeFileSync(logFile, JSON.stringify(debugData, null, 2));
        console.log(`📁 Logs sauvegardés dans: ${logFile}`);
        
        this.logger_.error("❌ CRITIQUE: orderMetadata est undefined après récupération depuis l'API !")
        throw new Error("❌ CRITIQUE: Métadonnées de la commande manquantes dans l'API")
      }

      // Les informations du point relais seront récupérées depuis la réponse de l'API 2
      // Pour l'instant, utiliser les métadonnées de la commande comme fallback
      const relayPointId = orderMetadata?.relayPointId || data.relayPointId
      const deliveryMode = orderMetadata?.deliveryMode
      const relayPointName = orderMetadata?.relayPointName
      const relayPointAddress = orderMetadata?.relayPointAddress

      this.logger_.info(`🎯 Point relais depuis métadonnées: ${relayPointName} (${relayPointId})`)
      this.logger_.info(`📍 Adresse du point relais: ${relayPointAddress}`)
      this.logger_.info(`📦 Mode de livraison: ${deliveryMode}`)
      
      // Debug des métadonnées complètes
      this.logger_.info(`🔍 DEBUG - Métadonnées complètes de la commande: ${JSON.stringify(orderMetadata, null, 2)}`)
      this.logger_.info(`🔍 DEBUG - relayPointId type: ${typeof relayPointId}, value: ${relayPointId}`)

      // Calculer le poids total des articles (RÉEL)
      let totalWeight = 0
      for (const item of items) {
        // Récupérer le poids du variant si disponible
        const variantWeight = (item as any).variant?.weight || 0
        const quantity = item.quantity || 1
        if (variantWeight > 0) {
          totalWeight += variantWeight * quantity
        } else {
          // Poids par défaut si non spécifié (500g pour les jouets)
          totalWeight += 500 * quantity
        }
      }
      
      // Poids minimum de 100g pour Mondial Relay
      if (totalWeight < 100) {
        totalWeight = 100
      }
      
      this.logger_.info(`⚖️ Poids total calculé: ${totalWeight}g (${items.length} articles)`)

      // Calculer les dimensions totales des articles (RÉEL)
      let totalLength = 0
      let totalWidth = 0  
      let totalHeight = 0
      
      for (const item of items) {
        const quantity = item.quantity || 1
        const variant = (item as any).variant
        
        if (variant) {
          // Utiliser les dimensions du variant si disponibles
          const length = variant.length || 0
          const width = variant.width || 0
          const height = variant.height || 0
          
          if (length > 0 && width > 0 && height > 0) {
            // Pour plusieurs articles, on empile (hauteur) et on additionne (longueur/largeur)
            totalLength += length * quantity
            totalWidth += width * quantity  
            totalHeight += height * quantity
          } else {
            // Dimensions par défaut pour les jouets si non spécifiées
            totalLength += 30 * quantity
            totalWidth += 20 * quantity
            totalHeight += 10 * quantity
          }
        } else {
          // Dimensions par défaut si pas de variant
          totalLength += 30 * quantity
          totalWidth += 20 * quantity
          totalHeight += 10 * quantity
        }
      }
      
      // Dimensions minimum pour Mondial Relay
      if (totalLength < 10) totalLength = 10
      if (totalWidth < 10) totalWidth = 10  
      if (totalHeight < 5) totalHeight = 5
      
      // Vérifier les contraintes Mondial Relay
      const developedLength = totalLength + totalWidth + totalHeight
      if (totalLength > 40) {
        this.logger_.warn(`⚠️ Longueur ${totalLength}cm dépasse la limite de 40cm`)
      }
      if (developedLength > 80) {
        this.logger_.warn(`⚠️ Développé ${developedLength}cm dépasse la limite de 80cm`)
      }
      if (totalWeight > 3000) {
        this.logger_.warn(`⚠️ Poids ${totalWeight}g dépasse la limite de 3kg`)
      }
      
      this.logger_.info(`📏 Dimensions calculées: L=${totalLength}cm, W=${totalWidth}cm, H=${totalHeight}cm (développé: ${developedLength}cm)`)

      // Créer l'expédition via l'API 2 Mondial Relay
      // Formater le code du point relais avec le préfixe FR- pour l'API 2
      if (!relayPointId) {
        throw new Error(`❌ CRITIQUE: ID du point relais manquant dans les métadonnées de la commande`)
      }
      
      const formattedRelayPointId = relayPointId.startsWith('FR-') ? relayPointId : `FR-${relayPointId}`
      
      const shipmentData = {
        orderNumber: order.display_id || `ORDER_${Date.now()}`,
        customerNumber: order.customer_id || "CUSTOMER_001",
        deliveryMode: deliveryMode,
        location: formattedRelayPointId,
        weight: totalWeight,
        content: "Jouets et articles pour enfants",
        deliveryInstruction: data.deliveryInstruction || "",
        length: totalLength,
        width: totalWidth,
        height: totalHeight,
        currency: order.currency_code || "EUR",
        shipmentValue: order.total ? (Number(order.total) / 100).toFixed(2) : "0.00",
        recipient: {
          title: "M.",
          firstname: deliveryAddress.first_name || "",
          lastname: deliveryAddress.last_name || "",
          streetname: this.extractStreetName(deliveryAddress.address_1 || ""),
          houseNo: deliveryAddress.address_2 || "",
          countryCode: deliveryAddress.country_code || "FR",
          postCode: deliveryAddress.postal_code || "",
          city: deliveryAddress.city || "",
          phoneNo: deliveryAddress.phone || "",
          email: ""
        },
        sender: {
          title: this.options_.business?.title || process.env.BUSINESS_TITLE,
          firstname: this.options_.business?.firstname || process.env.BUSINESS_FIRSTNAME,
          lastname: this.options_.business?.lastname || process.env.BUSINESS_LASTNAME,
          streetname: this.options_.business?.street || process.env.BUSINESS_STREET,
          houseNo: this.options_.business?.address1 || process.env.BUSINESS_ADDRESS_1,
          countryCode: this.options_.business?.country || process.env.BUSINESS_COUNTRY,
          postCode: this.options_.business?.postcode || process.env.BUSINESS_POSTCODE,
          city: this.options_.business?.city || process.env.BUSINESS_CITY,
          phoneNo: this.options_.business?.phone || process.env.BUSINESS_PHONE,
          mobileNo: this.options_.business?.mobile || process.env.BUSINESS_PHONE,
          email: this.options_.business?.email || process.env.BUSINESS_EMAIL
        }
      }

      // Log des informations de l'expéditeur utilisées
      this.logger_.info(`📋 Informations expéditeur utilisées: ${JSON.stringify({
        title: shipmentData.sender.title,
        firstname: shipmentData.sender.firstname,
        lastname: shipmentData.sender.lastname,
        streetname: shipmentData.sender.streetname,
        houseNo: shipmentData.sender.houseNo,
        countryCode: shipmentData.sender.countryCode,
        postCode: shipmentData.sender.postCode,
        city: shipmentData.sender.city,
        phoneNo: shipmentData.sender.phoneNo,
        email: shipmentData.sender.email
      }, null, 2)}`)

      // Appeler l'API 2 pour créer l'expédition
      this.logger_.info("🚀 Appel de l'API 2 Mondial Relay...")
      this.logger_.info(`📋 Données envoyées à l'API 2: ${JSON.stringify(shipmentData, null, 2)}`)
      console.log("🚀 DEBUG: Appel API 2 avec données:", JSON.stringify(shipmentData, null, 2))
      
      const shipmentResult = await this.createShipmentViaAPI2(shipmentData)
      console.log("🚀 DEBUG: Résultat API 2 reçu:", JSON.stringify(shipmentResult, null, 2))
      
      this.logger_.info("✅ API 2 Mondial Relay appelée avec succès")
      this.logger_.info(`📦 Résultat API 2: ${JSON.stringify(shipmentResult, null, 2)}`)

      this.logger_.info("✅ Expédition Mondial Relay créée")

      // Mettre à jour les métadonnées de la commande via le service order
      this.logger_.info("📝 Mise à jour des métadonnées de la commande...")
      try {
        this.logger_.info(`📋 ID de la commande: ${order.id}`)
        
        // Utiliser les informations du point relais depuis la réponse API 2 si disponibles
        const finalRelayPointInfo = shipmentResult.relayPointInfo || {}
        const finalDeliveryMode = finalRelayPointInfo.deliveryMode || deliveryMode
        const finalRelayPointId = finalRelayPointInfo.tournee || relayPointId
        const finalRelayPointName = finalRelayPointInfo.agencyName || relayPointName
        const finalRelayPointAddress = finalRelayPointInfo.agencyCode ? 
          `Agence ${finalRelayPointInfo.agencyCode}` : relayPointAddress
        
        this.logger_.info(`📋 Données à mettre à jour: ${JSON.stringify({
          trackingNumber: shipmentResult.trackingNumber,
          shipmentId: shipmentResult.shipmentId,
          labelUrl: shipmentResult.labelUrl,
          relayPointInfo: {
            deliveryMode: finalDeliveryMode,
            relayPointId: finalRelayPointId,
            relayPointName: finalRelayPointName,
            relayPointAddress: finalRelayPointAddress,
            weight: totalWeight
          }
        }, null, 2)}`)
        
        await this.updateOrderMetadata(order.id || '', {
          trackingNumber: shipmentResult.trackingNumber,
          shipmentId: shipmentResult.shipmentId,
          labelUrl: shipmentResult.labelUrl,
          relayPointInfo: {
            deliveryMode: finalDeliveryMode,
            relayPointId: finalRelayPointId,
            relayPointName: finalRelayPointName,
            relayPointAddress: finalRelayPointAddress,
            weight: totalWeight
          }
        })
        
        this.logger_.info(`✅ Métadonnées de commande mises à jour avec le numéro de suivi: ${shipmentResult.trackingNumber}`)
        this.logger_.info(`🏪 Point relais final: ${finalRelayPointName} (${finalRelayPointId})`)
        this.logger_.info(`📦 Mode de livraison final: ${finalDeliveryMode}`)
      } catch (updateError) {
        this.logger_.error(`❌ Erreur lors de la mise à jour des métadonnées: ${updateError.message}`)
        this.logger_.error(`❌ Stack trace: ${updateError.stack}`)
        // Ne pas faire échouer l'expédition pour une erreur de métadonnées
        this.logger_.warn(`⚠️ L'expédition a été créée mais les métadonnées n'ont pas pu être mises à jour`)
      }

      // Préparer le résultat de retour
      const result = {
        data: {
          shipmentId: shipmentResult.shipmentId,
          trackingNumber: shipmentResult.trackingNumber,
          labelUrl: shipmentResult.labelUrl,
          relayPointId: data.relayPointId,
          deliveryMode: shipmentData.deliveryMode,
          weight: totalWeight
        },
        labels: []
      }
      
      this.logger_.info("📤 Retour du service Mondial Relay")
      this.logger_.info(`📦 Résultat final: ${JSON.stringify(result, null, 2)}`)
      
      return result
    } catch (error) {
      this.logger_.error("❌ Erreur création expédition Mondial Relay", error)
      this.logger_.error(`❌ Détails de l'erreur: ${error.message}`)
      this.logger_.error(`❌ Stack trace: ${error.stack}`)
      
      // Re-throw l'erreur avec plus de contexte
      throw new Error(`Mondial Relay fulfillment error: ${error.message}`)
    }
  }

  /**
   * Calcule le prix d'un shipping option dynamiquement
   * Cette méthode est appelée pour les shipping options de type "calculated"
   * Utilise le service TarifsService pour calculer les tarifs réels basés sur le poids, les dimensions et le delivery mode
   */
  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    try {
      this.logger_.info("💰 Calcul du prix dynamique pour Mondial Relay")
      this.logger_.debug(`Option data: ${JSON.stringify(optionData, null, 2)}`)
      this.logger_.debug(`Data: ${JSON.stringify(data, null, 2)}`)
      this.logger_.debug(`Context: ${JSON.stringify(context, null, 2)}`)

      // Initialiser le service de tarifs
      const tarifsService = new TarifsService()

      // Récupérer le delivery mode depuis data (priorité) ou optionData (fallback)
      // Log détaillé pour debug LOCKERS
      this.logger_.info(`🔍 DEBUG extraction delivery_mode:`)
      this.logger_.info(`   optionData?.delivery_mode: ${optionData?.delivery_mode}`)
      this.logger_.info(`   optionData?.deliveryMode: ${optionData?.deliveryMode}`)
      this.logger_.info(`   data?.delivery_mode: ${data?.delivery_mode}`)
      this.logger_.info(`   data?.deliveryMode: ${data?.deliveryMode}`)
      this.logger_.info(`   data?.codeLivraison: ${data?.codeLivraison}`)
      this.logger_.info(`   optionData: ${JSON.stringify(optionData || {}, null, 2)}`)
      this.logger_.info(`   data: ${JSON.stringify(data || {}, null, 2)}`)
      
      // Essayer de récupérer le delivery_mode depuis le shipping method stocké dans le panier
      // Cela permet de conserver le delivery_mode lors des recalculs
      let deliveryModeFromShippingMethod: string | undefined
      
      // Log pour debug : vérifier si context contient shipping_methods
      this.logger_.info(`🔍 DEBUG context.shipping_methods:`)
      this.logger_.info(`   context?.shipping_methods existe: ${!!context?.shipping_methods}`)
      this.logger_.info(`   context?.shipping_methods est array: ${Array.isArray(context?.shipping_methods)}`)
      if (context?.shipping_methods && Array.isArray(context.shipping_methods)) {
        this.logger_.info(`   Nombre de shipping methods: ${context.shipping_methods.length}`)
        context.shipping_methods.forEach((sm: any, index: number) => {
          this.logger_.info(`   Shipping method ${index + 1}:`)
          this.logger_.info(`      shipping_option_id: ${sm.shipping_option_id}`)
          this.logger_.info(`      optionData?.id: ${optionData?.id}`)
          this.logger_.info(`      data: ${JSON.stringify(sm.data || {}, null, 2)}`)
        })
      }
      
      if (context?.shipping_methods && Array.isArray(context.shipping_methods)) {
        // Chercher le shipping method correspondant à l'option de livraison en cours de calcul
        // Essayer plusieurs façons de matcher le shipping method
        const shippingMethod = context.shipping_methods.find((sm: any) => {
          const matchesOptionId = sm.shipping_option_id === optionData?.id
          const matchesContextOptionId = sm.shipping_option_id === (context as any).shipping_option_id
          const matchesOptionIdString = String(sm.shipping_option_id) === String(optionData?.id)
          
          this.logger_.info(`   🔍 Comparaison shipping method ${sm.shipping_option_id}:`)
          this.logger_.info(`      matchesOptionId: ${matchesOptionId}`)
          this.logger_.info(`      matchesContextOptionId: ${matchesContextOptionId}`)
          this.logger_.info(`      matchesOptionIdString: ${matchesOptionIdString}`)
          
          return matchesOptionId || matchesContextOptionId || matchesOptionIdString
        })
        
        if (shippingMethod) {
          this.logger_.info(`   ✅ Shipping method trouvé: ${shippingMethod.shipping_option_id}`)
          if (shippingMethod?.data) {
            deliveryModeFromShippingMethod = shippingMethod.data.delivery_mode || 
                                           shippingMethod.data.deliveryMode ||
                                           shippingMethod.data.codeLivraison
            this.logger_.info(`   📦 Delivery mode depuis shipping method stocké: ${deliveryModeFromShippingMethod}`)
          } else {
            this.logger_.info(`   ⚠️ Shipping method trouvé mais pas de data`)
          }
        } else {
          this.logger_.info(`   ⚠️ Aucun shipping method correspondant trouvé`)
        }
      }
      
      // PRIORITÉ : data (passé dans le POST) > shipping method stocké > optionData (configuré dans l'admin) > default
      const deliveryMode = data?.delivery_mode || 
                          data?.deliveryMode || 
                          data?.codeLivraison ||
                          deliveryModeFromShippingMethod ||
                          optionData?.delivery_mode || 
                          optionData?.deliveryMode || 
                          "24R"
      
      this.logger_.info(`📦 Delivery mode extrait: ${deliveryMode}`)
      this.logger_.info(`   Type: ${typeof deliveryMode}`)
      this.logger_.info(`   === 'LOCKERS': ${deliveryMode === 'LOCKERS'}`)

      // Calculer le poids total depuis les items du panier
      const items = context?.items || []
      let totalWeightGrams = 0
      
      for (const item of items) {
        const quantity = Number(item.quantity || 1)
        const variant = (item as any).variant
        
        if (variant?.weight) {
          // Le poids dans Medusa peut être en grammes ou en kg
          // Si le poids est < 100, on considère qu'il est en kg et on le convertit en grammes
          let itemWeight = Number(variant.weight)
          if (itemWeight < 100) {
            itemWeight = itemWeight * 1000 // Convertir de kg en grammes
          }
          totalWeightGrams += itemWeight * quantity
        } else {
          // Poids par défaut si non spécifié (1kg = 1000g pour les jouets)
          totalWeightGrams += 1000 * quantity
        }
      }
      
      // Convertir en kilogrammes pour le service de tarifs
      const poidsKg = totalWeightGrams / 1000
      
      this.logger_.info(`⚖️ Poids total calculé: ${poidsKg.toFixed(2)}kg (${totalWeightGrams}g)`)

      // Récupérer la destination depuis le context (adresse de livraison)
      const shippingAddress = (context?.shipping_address || context?.address) as any
      const destination = ((shippingAddress?.country_code || 
                         (context?.region as any)?.currency_code || 
                         "FR") as string).toUpperCase()
      
      this.logger_.info(`🌍 Destination: ${destination}`)

      // Calculer les dimensions si disponibles
      let totalLength = 0
      let totalWidth = 0
      let totalHeight = 0
      
      for (const item of items) {
        const quantity = Number(item.quantity || 1)
        const variant = (item as any).variant
        
        if (variant?.length && variant?.width && variant?.height) {
          // Pour plusieurs articles, on empile (hauteur) et on additionne (longueur/largeur)
          totalLength += Number(variant.length) * quantity
          totalWidth += Number(variant.width) * quantity
          totalHeight += Number(variant.height) * quantity
        } else {
          // Dimensions par défaut pour les jouets si non spécifiées (30x20x10 cm)
          totalLength += 30 * quantity
          totalWidth += 20 * quantity
          totalHeight += 10 * quantity
        }
      }
      
      // Dimensions minimum pour Mondial Relay
      if (totalLength < 10) totalLength = 10
      if (totalWidth < 10) totalWidth = 10
      if (totalHeight < 5) totalHeight = 5
      
      this.logger_.info(`📏 Dimensions calculées: L=${totalLength}cm, W=${totalWidth}cm, H=${totalHeight}cm`)

      // Vérifier si le delivery mode est compatible avec les dimensions et le poids
      // Si le delivery mode demandé n'est pas compatible, ajuster automatiquement
      let finalDeliveryMode = deliveryMode
      
      // Vérifier les contraintes pour les lockers (max 25kg)
      if (deliveryMode === "LOCKERS" && poidsKg > 25) {
        this.logger_.warn(`🔒 Lockers non disponible pour ${poidsKg}kg > 25kg, passage à 24R`)
        finalDeliveryMode = "24R"
      }
      
      // Vérifier les contraintes pour SMA (≤ 3kg, longueur max 40cm, développé ≤ 80cm)
      if (deliveryMode === "SMA") {
        const developed = totalLength + totalWidth + totalHeight
        if (poidsKg > 3 || totalLength > 40 || developed > 80) {
          this.logger_.warn(`📦 SMA non disponible (poids: ${poidsKg}kg, L: ${totalLength}cm, développé: ${developed}cm), passage à 24R`)
          finalDeliveryMode = "24R"
        }
      }
      
      // Calculer le tarif réel avec le service TarifsService
      // Log détaillé pour debug LOCKERS
      this.logger_.info(`🔍 Debug calcul tarif:`)
      this.logger_.info(`   Poids: ${poidsKg}kg`)
      this.logger_.info(`   Destination: ${destination}`)
      this.logger_.info(`   Delivery mode demandé: ${deliveryMode}`)
      this.logger_.info(`   Delivery mode final: ${finalDeliveryMode}`)
      
      const tarifRequest = {
        poids: poidsKg,
        destination: destination as string,
        codeLivraison: finalDeliveryMode as string,
        supplementIles: false // TODO: Détecter si c'est la Corse ou les Baléares depuis l'adresse
      }
      
      this.logger_.debug(`📋 Requête tarif: ${JSON.stringify(tarifRequest, null, 2)}`)
      
      const tarifResult = tarifsService.calculerTarif(tarifRequest)
      
      this.logger_.info(`📊 Résultat tarif:`)
      this.logger_.info(`   Prix: ${tarifResult.prix}€`)
      this.logger_.info(`   Disponible: ${tarifResult.disponible}`)
      this.logger_.info(`   Code livraison: ${tarifResult.codeLivraison}`)
      this.logger_.info(`   Destination: ${tarifResult.destination}`)
      this.logger_.info(`   Tranche poids: ${tarifResult.tranchePoids}`)
      
      if (!tarifResult.disponible || tarifResult.prix === null) {
        const errorMessage = `Tarif non disponible pour Mondial Relay: ${tarifResult.raisonRefus || 'Raison inconnue'}`
        this.logger_.error(`❌ ${errorMessage}`)
        this.logger_.error(`   Poids: ${poidsKg}kg, Destination: ${destination}, Delivery mode: ${finalDeliveryMode}`)
        throw new Error(errorMessage)
      }
      
      // Dans Medusa v2, les montants sont stockés en unités de base (euros)
      // calculated_amount doit être en euros, pas en centimes
      // Le service TarifsService retourne déjà en euros, on utilise directement
      const calculatedAmount = tarifResult.prix
      
      this.logger_.info(`💰 Prix calculé: ${calculatedAmount}€ HT pour ${finalDeliveryMode} - ${tarifResult.tranchePoids}`)
      
      if (tarifResult.supplementIles) {
        this.logger_.info(`🏝️ Supplément îles: ${tarifResult.supplementIles}€`)
      }
      
      return {
        calculated_amount: calculatedAmount,
        is_calculated_price_tax_inclusive: false
      } as CalculatedShippingOptionPrice
    } catch (error) {
      this.logger_.error("❌ Erreur lors du calcul du prix:", error)
      this.logger_.error(`Stack trace: ${error.stack}`)
      // Propager l'erreur sans fallback
      throw error
    }
  }

  /**
   * Récupérer les options de fulfillment disponibles
   */
  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    try {
      this.logger_.info("🔍 Récupération des options de fulfillment Mondial Relay")

      // Retourner les options de fulfillment disponibles
      return [
        {
          id: "mondial-relay-standard",
          name: "Mondial Relay Standard",
          description: "Livraison en point relais standard",
          price: 500, // 5€ en centimes
          deliveryMode: "24R",
          estimatedDays: 2
        },
        {
          id: "mondial-relay-volumineux",
          name: "Mondial Relay Volumineux", 
          description: "Livraison en point relais pour colis volumineux",
          price: 700, // 7€ en centimes
          deliveryMode: "24L",
          estimatedDays: 3
        },
        {
          id: "mondial-relay-leger",
          name: "Mondial Relay Léger",
          description: "Livraison en point relais pour colis légers",
          price: 400, // 4€ en centimes
          deliveryMode: "SMA",
          estimatedDays: 2
        }
      ]
    } catch (error) {
      this.logger_.error("❌ Erreur récupération options fulfillment", error)
      throw error
    }
  }

  /**
   * Annuler une expédition
   */
  async cancelFulfillment(
    fulfillment: Partial<FulfillmentDTO>
  ): Promise<{ data: Record<string, unknown> }> {
    try {
      this.logger_.info("🚫 Annulation d'une expédition Mondial Relay")

      // En mode sandbox, on simule l'annulation
      // En production, il faudrait appeler l'API Mondial Relay pour annuler

      return {
        data: {
          cancelled: true,
          cancelledAt: new Date().toISOString()
        }
      }
    } catch (error) {
      this.logger_.error("❌ Erreur annulation expédition Mondial Relay", error)
      throw error
    }
  }

  /**
   * Appeler l'API 2 Mondial Relay pour créer une expédition
   */
  private async createShipmentViaAPI2(shipmentData: any) {
    this.logger_.info("🚚 Création expédition Mondial Relay API 2 RÉELLE")
    this.logger_.info(`📋 Données expédition: ${JSON.stringify(shipmentData, null, 2)}`)

    // Créer une instance du service API 2
    const api2Service = new MondialRelayAPI2Service()
    
    // Appeler l'API 2 avec gestion d'erreur Medusa recommandée
    const result = await api2Service.createShipment(shipmentData)
      .catch((error) => {
        this.logger_.error("❌ Erreur API 2 Mondial Relay RÉELLE:", error)
        // Lancer une erreur claire au lieu de retourner des données par défaut
        throw new Error(`❌ CRITIQUE: Échec de création expédition Mondial Relay: ${error.message}`)
      })
    
    this.logger_.info("✅ Expédition traitée via API 2 RÉELLE")
    this.logger_.info(`📦 Résultat: ${JSON.stringify(result, null, 2)}`)
    
    return {
      shipmentId: result.shipmentId,
      trackingNumber: result.trackingNumber,
      labelUrl: result.labelUrl,
      status: result.status,
      relayPointInfo: result.relayPointInfo
    }
  }

  /**
   * Construire le XML pour l'API 2 Mondial Relay
   */
  private buildShipmentXML(data: any): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<ShipmentCreationRequest xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://www.example.org/Request">
  <Context>
    <Login>${this.options_.apiKey}</Login>
    <Password>${this.options_.apiSecret}</Password>
    <CustomerId>${this.options_.customerId}</CustomerId>
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
      <DeliveryMode Mode="${data.deliveryMode}" Location="${data.location}" />
      <CollectionMode Mode="CCC" Location="" />
      <Parcels>
        <Parcel>
          <Content>${data.content}</Content>
          <Weight Value="${data.weight}" Unit="gr" />
        </Parcel>
      </Parcels>
      <DeliveryInstruction>${data.deliveryInstruction}</DeliveryInstruction>
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
}

export default MondialRelayFulfillmentService
