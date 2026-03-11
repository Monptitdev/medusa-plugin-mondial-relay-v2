# Configuration des Shipping Options Mondial Relay

## Vue d'ensemble

Pour que le calcul des tarifs Mondial Relay fonctionne correctement avec les shipping options de type "calculated", il faut configurer le `delivery_mode` dans les métadonnées de chaque shipping option.

## Étapes de configuration

### 1. Créer/Modifier les Shipping Options dans l'Admin Medusa

1. Aller dans **Settings → Locations → Shipping Options**
2. Pour chaque option Mondial Relay, configurer :
   - **Provider**: `mondial-relay` (ou `mondial_relay`)
   - **Price Type**: `calculated` (pas `flat`)
   - **Option Data** (métadonnées) : Ajouter le `delivery_mode`

### 2. Configuration de l'Option Data

Dans l'interface d'administration, lorsque vous créez ou modifiez une shipping option, vous devez ajouter dans les métadonnées (Option Data) :

```json
{
  "delivery_mode": "24R"
}
```

Les valeurs possibles pour `delivery_mode` :
- `"24R"` : Point relais standard (défaut)
- `"24L"` : Point relais volumineux
- `"SMA"` : Colis léger (≤ 3kg, longueur ≤ 40cm, développé ≤ 80cm)
- `"LOCKERS"` : Casiers 24/7 (max 25kg)

### 3. Exemple de configuration via l'API

Si vous créez les shipping options via l'API, voici un exemple :

```typescript
{
  name: "Mondial Relay Point Relais Standard",
  price_type: "calculated",
  provider_id: "mondial-relay",
  service_zone_id: "votre_service_zone_id",
  shipping_profile_id: "votre_shipping_profile_id",
  type: {
    label: "Standard",
    description: "Livraison en point relais standard",
    code: "mondial-relay-24r",
  },
  option_data: {
    delivery_mode: "24R"
  },
  // Pas de prices car c'est "calculated"
}
```

### 4. Vérification

Pour vérifier que la configuration est correcte :

1. Dans l'admin, ouvrir une shipping option Mondial Relay
2. Vérifier que :
   - `price_type` = `calculated`
   - `provider_id` = `mondial-relay`
   - `option_data` contient `delivery_mode`

### 5. Calcul automatique

Une fois configuré, lorsque le frontend appelle `/store/shipping-options/{id}/calculate` :
- Le provider `calculatePrice` sera appelé automatiquement
- Le `delivery_mode` sera récupéré depuis `optionData`
- Le tarif sera calculé en fonction du poids, des dimensions et du delivery mode

## Notes importantes

- **Pas de fallback** : Si le tarif ne peut pas être calculé, une erreur sera retournée (pas de prix par défaut)
- **Validation automatique** : Le provider vérifie automatiquement les contraintes (ex: Lockers max 25kg) et ajuste le delivery mode si nécessaire
- **Dimensions** : Les dimensions sont calculées depuis les variants des produits du panier, ou des valeurs par défaut (30x20x10 cm) si non spécifiées



