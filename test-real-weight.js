const http = require('http')

// Configuration
const BASE_URL = 'http://localhost:9000'
const PUBLISHABLE_KEY = 'pk_85f973bdd2f4d0b5b7fefc60fd2e577f8998413937c81410ab3c41a4b5e39181'

// Fonction pour faire des requêtes HTTP
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 9000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-publishable-api-key': PUBLISHABLE_KEY
      }
    }

    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => body += chunk)
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(body)
          resolve({ status: res.statusCode, data: jsonData })
        } catch (e) {
          resolve({ status: res.statusCode, data: body })
        }
      })
    })

    req.on('error', reject)
    
    if (data) {
      req.write(JSON.stringify(data))
    }
    
    req.end()
  })
}

// Test avec un panier fictif
async function testWithCartId() {
  console.log('🧪 Test avec cart_id (poids calculé automatiquement)')
  console.log('='.repeat(60))

  // Simuler un cart_id (en réalité, il faudrait créer un vrai panier)
  const cartId = 'cart_test_123'
  
  try {
    console.log(`📦 Test avec cart_id: ${cartId}`)
    
    // Test des tarifs
    const ratesResponse = await makeRequest(`/store/mondial-relay/rates?cart_id=${cartId}&destination=FR`)
    
    if (ratesResponse.status === 200) {
      const rates = ratesResponse.data.rates || []
      console.log(`   ✅ Tarifs: ${rates.length} option(s) trouvée(s)`)
      
      rates.forEach(rate => {
        const isLocker = rate.deliveryMode === 'LOCKERS'
        const icon = isLocker ? '🔒' : '🚚'
        console.log(`      ${icon} ${rate.name}: ${rate.price/100}€ (${rate.deliveryMode})`)
      })
      
      console.log(`   📊 Métadonnées:`, ratesResponse.data.meta)
    } else {
      console.log(`   ❌ Erreur tarifs: ${ratesResponse.status} - ${JSON.stringify(ratesResponse.data)}`)
    }
    
    // Test des points relais
    const pointsResponse = await makeRequest(`/store/mondial-relay/relay-points?zipCode=59000&city=Lille&cart_id=${cartId}`)
    
    if (pointsResponse.status === 200) {
      const relayPoints = pointsResponse.data.relayPoints || []
      const meta = pointsResponse.data.meta || {}
      
      console.log(`   ✅ Points relais: ${relayPoints.length} trouvé(s)`)
      console.log(`   📊 Poids calculé: ${meta.parcelWeight || 'N/A'}kg`)
      console.log(`   🔒 Lockers exclus: ${meta.lockersExcluded ? 'Oui' : 'Non'}`)
      
      // Compter les types
      const types = {}
      relayPoints.forEach(point => {
        types[point.type] = (types[point.type] || 0) + 1
      })
      
      console.log(`   📋 Types disponibles:`)
      Object.entries(types).forEach(([type, count]) => {
        const icon = type === 'LOCKER' ? '🔒' : '🚚'
        console.log(`      ${icon} ${type}: ${count}`)
      })
    } else {
      console.log(`   ❌ Erreur points relais: ${pointsResponse.status} - ${JSON.stringify(pointsResponse.data)}`)
    }
    
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}`)
  }
}

// Test avec poids explicite (fallback)
async function testWithExplicitWeight() {
  console.log('\n\n🧪 Test avec poids explicite (fallback)')
  console.log('='.repeat(60))

  const testWeights = [15, 27, 30]
  
  for (const weight of testWeights) {
    console.log(`\n📦 Test avec poids: ${weight}kg`)
    
    try {
      // Test des tarifs
      const ratesResponse = await makeRequest(`/store/mondial-relay/rates?poids=${weight}&destination=FR`)
      
      if (ratesResponse.status === 200) {
        const rates = ratesResponse.data.rates || []
        const hasLockers = rates.some(rate => rate.deliveryMode === 'LOCKERS')
        
        console.log(`   ✅ Tarifs: ${rates.length} option(s)`)
        console.log(`   🔒 Lockers: ${hasLockers ? 'Disponibles' : 'Exclus'}`)
        
        rates.forEach(rate => {
          const isLocker = rate.deliveryMode === 'LOCKERS'
          const icon = isLocker ? '🔒' : '🚚'
          console.log(`      ${icon} ${rate.name}: ${rate.price/100}€`)
        })
      } else {
        console.log(`   ❌ Erreur: ${ratesResponse.status}`)
      }
      
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`)
    }
  }
}

// Exécution des tests
async function runTests() {
  console.log('🚀 Test du calcul de poids réel du panier')
  console.log('='.repeat(60))
  
  try {
    await testWithCartId()
    await testWithExplicitWeight()
    
    console.log('\n\n🎯 Tests terminés!')
    console.log('='.repeat(60))
    console.log('📝 Note: Le cart_id test ne fonctionnera que si un panier existe réellement')
    console.log('📝 En production, le poids sera calculé automatiquement depuis les articles du panier')
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error)
  }
}

runTests()











