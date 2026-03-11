#!/usr/bin/env node

/**
 * Script de test spécifique pour vérifier le calcul des tarifs à 30kg
 */

const BASE_URL = 'http://localhost:9000'
const PUBLISHABLE_API_KEY = 'pk_85f973bdd2f4d0b5b7fefc60fd2e577f8998413937c81410ab3c41a4b5e39181'

async function testTarif30kg() {
  console.log('🧪 Test spécifique du tarif à 30kg')
  console.log('=' .repeat(50))

  const tests = [
    { poids: 29.5, description: 'Juste en dessous de 30kg' },
    { poids: 30.0, description: 'Exactement 30kg' },
    { poids: 30.1, description: 'Juste au-dessus de 30kg' },
    { poids: 25.0, description: '25kg (tranche précédente)' },
    { poids: 25.5, description: '25.5kg' }
  ]

  for (const test of tests) {
    console.log(`\n📦 Test: ${test.description}`)
    console.log(`   Poids: ${test.poids}kg`)
    
    try {
      const url = `${BASE_URL}/store/mondial-relay/rates?poids=${test.poids}&destination=FR`
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
        
        // Vérifier le tarif attendu pour 30kg
        if (test.poids === 30.0) {
          const tarifStandard = data.rates.find(r => r.deliveryMode === '24R')
          if (tarifStandard && tarifStandard.price === 2700) { // 27€ en centimes
            console.log(`   ✅ Tarif correct pour 30kg: ${tarifStandard.price/100}€`)
          } else {
            console.log(`   ❌ Tarif incorrect pour 30kg: attendu 27€, obtenu ${tarifStandard ? tarifStandard.price/100 : 'N/A'}€`)
          }
        }
        
      } else {
        console.log(`   ❌ Erreur: ${response.status} - ${data.message || 'Erreur inconnue'}`)
      }
    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`)
    }
    
    console.log('   ' + '-'.repeat(40))
  }

  console.log('\n🎯 Test tarif 30kg terminé!')
}

// Exécuter les tests
testTarif30kg().catch(console.error)











