#!/usr/bin/env node

/**
 * Script de test des tarifs Mondial Relay
 * Teste le service de calcul des tarifs avec différents poids et destinations
 */

const BASE_URL = 'http://localhost:9000'
const PUBLISHABLE_API_KEY = 'pk_85f973bdd2f4d0b5b7fefc60fd2e577f8998413937c81410ab3c41a4b5e39181'

async function testTarifs() {
  console.log('🧪 Test des tarifs Mondial Relay')
  console.log('=' .repeat(50))

  const tests = [
    { poids: 0.5, destination: 'FR', description: 'Colis léger France' },
    { poids: 1.5, destination: 'FR', description: 'Colis standard France' },
    { poids: 3.0, destination: 'FR', description: 'Colis volumineux France' },
    { poids: 1.0, destination: 'BE', description: 'Colis Belgique' },
    { poids: 1.0, destination: 'DE', description: 'Colis Allemagne' },
    { poids: 1.0, destination: 'ES', description: 'Colis Espagne' },
    { poids: 15.0, destination: 'FR', description: 'Colis lourd France' },
    { poids: 25.0, destination: 'FR', description: 'Colis très lourd France' },
    { poids: 35.0, destination: 'FR', description: 'Colis trop lourd (erreur attendue)' }
  ]

  for (const test of tests) {
    console.log(`\n📦 Test: ${test.description}`)
    console.log(`   Poids: ${test.poids}kg, Destination: ${test.destination}`)
    
    try {
      const url = `${BASE_URL}/store/mondial-relay/rates?poids=${test.poids}&destination=${test.destination}`
      console.log(`   URL: ${url}`)
      
      const response = await fetch(url, {
        headers: {
          'x-publishable-api-key': PUBLISHABLE_API_KEY,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      
      if (response.ok) {
        console.log(`   ✅ Succès: ${data.rates.length} tarif(s) trouvé(s)`)
        
        data.rates.forEach(rate => {
          console.log(`      - ${rate.name}: ${rate.price/100}€ (${rate.deliveryMode})`)
          console.log(`        ${rate.description}`)
        })
        
        if (data.meta) {
          console.log(`   📊 Meta: ${JSON.stringify(data.meta)}`)
        }
      } else {
        console.log(`   ❌ Erreur: ${response.status} - ${data.message || 'Erreur inconnue'}`)
      }
    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`)
    }
    
    console.log('   ' + '-'.repeat(40))
  }

  console.log('\n🎯 Test terminé!')
}

// Exécuter les tests
testTarifs().catch(console.error)
