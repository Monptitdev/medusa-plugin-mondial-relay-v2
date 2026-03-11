# 📁 Système de Logging XML - Mondial Relay

## 🎯 **Objectif**

Ce système permet de sauvegarder automatiquement toutes les requêtes et réponses XML des APIs Mondial Relay pour faciliter le debugging et la maintenance.

## 📂 **Structure des Logs**

```
logs/
├── mondial-relay-api1/          # Logs API 1 (SOAP)
│   ├── request_WSI4_PointRelais_Recherche_2025-01-17T20-30-45-123Z.xml
│   ├── response_WSI4_PointRelais_Recherche_2025-01-17T20-30-45-456Z.xml
│   ├── request_WSI2_TracingColisDetaille_2025-01-17T20-31-12-789Z.xml
│   └── response_WSI2_TracingColisDetaille_2025-01-17T20-31-12-012Z.xml
└── mondial-relay-api2/          # Logs API 2 (REST)
    ├── request_ORDER_123_2025-01-17T20-32-15-345Z.xml
    └── response_ORDER_123_2025-01-17T20-32-15-678Z.xml
```

## 🔧 **Fonctionnalités**

### ✅ **Sauvegarde Automatique**
- **Requêtes XML** : Sauvegardées avant chaque appel API
- **Réponses XML** : Sauvegardées après chaque réponse
- **Horodatage** : Chaque fichier contient un timestamp précis
- **Nommage** : Fichiers nommés selon l'opération et l'ordre

### 📊 **Informations Loggées**
- **URLs** des endpoints
- **Headers** des requêtes
- **Status codes** des réponses
- **Contenu XML** complet
- **Paramètres** d'authentification (masqués)

## 🚀 **Utilisation**

### **1. Visualiser les Logs**
```bash
# Depuis le plugin
node scripts/view-logs.js

# Depuis le backend
node scripts/view-mondial-relay-logs.js
```

### **2. Voir le Contenu d'un Fichier**
```bash
# Voir un fichier spécifique
node scripts/view-mondial-relay-logs.js logs/mondial-relay-api2/request_ORDER_123_2025-01-17T20-32-15-345Z.xml
```

### **3. Nettoyer les Logs Anciens**
```bash
# Supprimer les logs de plus de 7 jours
node scripts/view-mondial-relay-logs.js --clean
```

## 🔍 **Types de Logs**

### **API 1 (SOAP) - Recherche de Points Relais**
- **Fichier requête** : `request_WSI4_PointRelais_Recherche_[timestamp].xml`
- **Fichier réponse** : `response_WSI4_PointRelais_Recherche_[timestamp].xml`
- **Contenu** : XML SOAP avec paramètres de recherche

### **API 1 (SOAP) - Suivi d'Expédition**
- **Fichier requête** : `request_WSI2_TracingColisDetaille_[timestamp].xml`
- **Fichier réponse** : `response_WSI2_TracingColisDetaille_[timestamp].xml`
- **Contenu** : XML SOAP avec numéro de suivi

### **API 2 (REST) - Création d'Expédition**
- **Fichier requête** : `request_[orderNumber]_[timestamp].xml`
- **Fichier réponse** : `response_[orderNumber]_[timestamp].xml`
- **Contenu** : XML de création d'expédition

## 🛠️ **Debugging**

### **Problème : API 2 ne retourne pas de numéro d'expédition**
1. Vérifiez les logs dans `logs/mondial-relay-api2/`
2. Regardez le fichier `response_[orderNumber]_[timestamp].xml`
3. Vérifiez si la réponse contient un `<ShipmentNumber>`
4. Si vide, vérifiez les credentials et l'URL

### **Problème : API 1 ne trouve pas de points relais**
1. Vérifiez les logs dans `logs/mondial-relay-api1/`
2. Regardez le fichier `response_WSI4_PointRelais_Recherche_[timestamp].xml`
3. Vérifiez le code d'erreur dans `<STAT>`
4. Vérifiez les paramètres de recherche

### **Problème : Suivi d'expédition échoue**
1. Vérifiez les logs dans `logs/mondial-relay-api1/`
2. Regardez le fichier `response_WSI2_TracingColisDetaille_[timestamp].xml`
3. Vérifiez si le numéro de suivi est valide

## 📋 **Exemple de Logs**

### **Requête API 2 (Création d'expédition)**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ShipmentRequest>
  <OrderNumber>ORDER_123</OrderNumber>
  <CustomerNumber>CUSTOMER_456</CustomerNumber>
  <DeliveryMode>24R</DeliveryMode>
  <Location>FR-071039</Location>
  <Weight>1500</Weight>
  <Content>Jouets et articles pour enfants</Content>
  <Recipient>
    <Title>M.</Title>
    <Firstname>Quentin</Firstname>
    <Lastname>Millet</Lastname>
    <!-- ... -->
  </Recipient>
</ShipmentRequest>
```

### **Réponse API 2 (Succès)**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ShipmentResponse>
  <Shipment ShipmentNumber="123456789">
    <Status Code="0" Message="OK"/>
    <Output>https://connect-sandbox.mondialrelay.com/...</Output>
  </Shipment>
</ShipmentResponse>
```

## 🔧 **Configuration**

### **Variables d'Environnement**
```env
# API 1 (SOAP)
MONDIAL_RELAY_API1_URL=https://api.mondialrelay.com/Web_Services.asmx
MONDIAL_RELAY_ENSEIGNE=BDTEST13
MONDIAL_RELAY_PRIVATE_KEY=TestAPI1key

# API 2 (REST)
MONDIAL_RELAY_API_BASE_URL=https://connect-api-sandbox.mondialrelay.com
MONDIAL_RELAY_LOGIN=TTMRSDBX@business-api.mondialrelay.com
MONDIAL_RELAY_PASSWORD=_iVfPcMexuOcOmF:6sq0
MONDIAL_RELAY_CUSTOMER_ID=TTMRSDBX
```

### **Désactiver le Logging**
Pour désactiver le logging, commentez les appels `saveRequest*` et `saveResponse*` dans les services.

## 📈 **Maintenance**

### **Nettoyage Automatique**
- Les logs sont automatiquement nettoyés après 7 jours
- Utilisez `--clean` pour forcer le nettoyage
- Les logs sont organisés par API et par date

### **Surveillance**
- Surveillez la taille du dossier `logs/`
- Vérifiez régulièrement les erreurs dans les réponses
- Analysez les patterns d'erreur pour optimiser les appels

## 🎯 **Avantages**

1. **Debugging Facile** : Voir exactement ce qui est envoyé/reçu
2. **Traçabilité** : Historique complet des appels API
3. **Analyse** : Identifier les problèmes récurrents
4. **Support** : Fournir des logs détaillés à Mondial Relay
5. **Optimisation** : Améliorer les requêtes basées sur les logs

---

**💡 Conseil** : Gardez toujours les logs des dernières 24h pour le debugging, et nettoyez régulièrement les anciens logs pour économiser l'espace disque.


