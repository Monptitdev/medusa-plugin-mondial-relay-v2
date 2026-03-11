#!/usr/bin/env node

/**
 * Script de test de la division des expéditions Mondial Relay
 * Teste la logique de division avec différents scénarios de poids
 */

const BASE_URL = 'http://localhost:9000'
const PUBLISHABLE_API_KEY = 'pk_85f973bdd2f4d0b5b7fefc60fd2e577f8998413937c81410ab3c41a4b5e39181'

async function testDivision() {
  console.log('🧪 Test de la division des expéditions Mondial Relay')
  console.log('=' .repeat(60))

  const scenarios = [
    {
      nom: 'Commande légère (pas de division)',
      articles: [
        { id: 'jouet-1', poids: 0.5, quantite: 2, nom: 'Peluche ours' },
        { id: 'jouet-2', poids: 0.3, quantite: 1, nom: 'Petite voiture' }
      ],
      poidsTotal: 1.3,
      divisionAttendue: false
    },
    {
      nom: 'Commande moyenne (pas de division)',
      articles: [
        { id: 'jouet-1', poids: 2.0, quantite: 3, nom: 'Jeu de construction' },
        { id: 'jouet-2', poids: 1.5, quantite: 2, nom: 'Poupée' }
      ],
      poidsTotal: 9.0,
      divisionAttendue: false
    },
    {
      nom: 'Commande lourde (division nécessaire)',
      articles: [
        { id: 'jouet-1', poids: 15.0, quantite: 2, nom: 'Trampoline' },
        { id: 'jouet-2', poids: 5.0, quantite: 1, nom: 'Vélo enfant' }
      ],
      poidsTotal: 35.0,
      divisionAttendue: true
    },
    {
      nom: 'Article unique très lourd (REFUS attendu)',
      articles: [
        { id: 'jouet-1', poids: 25.0, quantite: 2, nom: 'Table de ping-pong' }
      ],
      poidsTotal: 50.0,
      divisionAttendue: false,
      refusAttendu: true
    },
    {
      nom: 'Commande complexe (mélange de poids)',
      articles: [
        { id: 'jouet-1', poids: 20.0, quantite: 1, nom: 'Cuisine enfant' },
        { id: 'jouet-2', poids: 8.0, quantite: 2, nom: 'Toboggan' },
        { id: 'jouet-3', poids: 0.5, quantite: 5, nom: 'Petits jouets' }
      ],
      poidsTotal: 36.5,
      divisionAttendue: true
    }
  ]

  for (const scenario of scenarios) {
    console.log(`\n📦 Test: ${scenario.nom}`)
    console.log(`   Poids total: ${scenario.poidsTotal}kg`)
    console.log(`   Articles: ${scenario.articles.length}`)
    
    // Afficher les articles
    scenario.articles.forEach(article => {
      console.log(`      - ${article.nom}: ${article.poids}kg x${article.quantite} = ${article.poids * article.quantite}kg`)
    })
    
    try {
      // Test de la route de division
      const url = `${BASE_URL}/store/mondial-relay/division`
      console.log(`   URL: ${url}`)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-publishable-api-key': PUBLISHABLE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          articles: scenario.articles,
          destination: 'FR'
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        console.log(`   ✅ Succès: ${data.proposition.totalExpeditions} expédition(s)`)
        console.log(`   💰 Total frais de port: ${data.proposition.totalFraisPort/100}€`)
        console.log(`   📝 Message: ${data.proposition.message}`)
        
        // Vérifier si la division correspond aux attentes
        const divisionReelle = data.proposition.totalExpeditions > 1
        if (divisionReelle === scenario.divisionAttendue) {
          console.log(`   ✅ Division correcte: ${divisionReelle ? 'OUI' : 'NON'}`)
        } else {
          console.log(`   ❌ Division incorrecte: attendu ${scenario.divisionAttendue}, obtenu ${divisionReelle}`)
        }
        
        // Vérifier le refus si attendu
        if (scenario.refusAttendu) {
          if (data.proposition.refus) {
            console.log(`   ✅ Refus correct: ${data.proposition.message}`)
          } else {
            console.log(`   ❌ Refus attendu mais non appliqué`)
          }
        }
        
        // Afficher le détail des expéditions
        if (data.proposition.expeditions && data.proposition.expeditions.length > 0) {
          data.proposition.expeditions.forEach((expedition, index) => {
            console.log(`      Expédition ${index + 1}: ${expedition.poidsTotal}kg - ${expedition.tarif/100}€ (${expedition.codeLivraison})`)
            expedition.articles.forEach(article => {
              console.log(`        - ${article.nom}: ${article.poids}kg x${article.quantite}`)
            })
          })
        }
        
        if (data.proposition.economie > 0) {
          console.log(`   💡 Économie: ${data.proposition.economie/100}€`)
        }
        
      } else {
        console.log(`   ❌ Erreur: ${response.status} - ${data.message || 'Erreur inconnue'}`)
        
        // Vérifier si c'est un refus attendu
        if (scenario.refusAttendu && data.refus) {
          console.log(`   ✅ Refus correct: ${data.message}`)
        }
      }
    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`)
    }
    
    console.log('   ' + '-'.repeat(50))
  }

  console.log('\n🎯 Test de division terminé!')
}

// Exécuter les tests
testDivision().catch(console.error)
