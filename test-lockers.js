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

// Tests des tarifs avec différents poids
async function testTarifs() {
  console.log('🧪 Test des tarifs Mondial Relay avec Lockers')
  console.log('='.repeat(60))

  const testCases = [
    { poids: 1, description: 'Colis léger (1kg)' },
    { poids: 15, description: 'Colis moyen (15kg)' },
    { poids: 25, description: 'Colis limite lockers (25kg)' },
    { poids: 26, description: 'Colis trop lourd pour lockers (26kg)' },
    { poids: 30, description: 'Colis limite Mondial Relay (30kg)' },
    { poids: 31, description: 'Colis trop lourd (31kg)' }
  ]

  for (const testCase of testCases) {
    console.log(`\n📦 Test: ${testCase.description}`)
    console.log(`   Poids: ${testCase.poids}kg`)
    
    try {
      const response = await makeRequest(`/store/mondial-relay/rates?poids=${testCase.poids}&destination=FR`)
      
      if (response.status === 200) {
        const rates = response.data.rates || []
        console.log(`   ✅ Succès: ${rates.length} tarif(s) trouvé(s)`)
        
        rates.forEach(rate => {
          const isLocker = rate.deliveryMode === 'LOCKERS'
          const icon = isLocker ? '🔒' : '🚚'
          console.log(`      ${icon} ${rate.name}: ${rate.price/100}€ (${rate.deliveryMode})`)
          if (isLocker) {
            console.log(`         ${rate.description}`)
          }
        })
        
        // Vérifier la logique des lockers
        const hasLockers = rates.some(rate => rate.deliveryMode === 'LOCKERS')
        if (testCase.poids <= 25) {
          if (hasLockers) {
            console.log(`   ✅ Lockers disponibles (attendu)`)
          } else {
            console.log(`   ⚠️ Lockers non disponibles (inattendu pour ${testCase.poids}kg)`)
          }
        } else {
          if (!hasLockers) {
            console.log(`   ✅ Lockers exclus (attendu pour ${testCase.poids}kg)`)
          } else {
            console.log(`   ❌ Lockers disponibles (inattendu pour ${testCase.poids}kg)`)
          }
        }
      } else if (response.status === 400) {
        console.log(`   ❌ Refus: ${response.data.message || 'Erreur inconnue'}`)
      } else {
        console.log(`   ❌ Erreur: ${response.status} - ${JSON.stringify(response.data)}`)
      }
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`)
    }
  }
}

// Tests des points relais avec différents poids
async function testRelayPoints() {
  console.log('\n\n🧪 Test des points relais avec filtrage Lockers')
  console.log('='.repeat(60))

  const testCases = [
    { poids: 15, description: 'Colis léger (15kg) - Lockers attendus' },
    { poids: 27, description: 'Colis lourd (27kg) - Lockers exclus' }
  ]

  for (const testCase of testCases) {
    console.log(`\n📦 Test: ${testCase.description}`)
    console.log(`   Poids: ${testCase.poids}kg`)
    
    try {
      const response = await makeRequest(`/store/mondial-relay/relay-points?zipCode=59000&city=Lille&weight=${testCase.poids}`)
      
      if (response.status === 200) {
        const relayPoints = response.data.relayPoints || []
        const meta = response.data.meta || {}
        
        console.log(`   ✅ Succès: ${relayPoints.length} point(s) relais trouvé(s)`)
        console.log(`   📊 Total trouvé: ${meta.totalFound || 'N/A'}`)
        console.log(`   🔒 Lockers exclus: ${meta.lockersExcluded ? 'Oui' : 'Non'}`)
        
        // Compter les types de points relais
        const types = {}
        relayPoints.forEach(point => {
          types[point.type] = (types[point.type] || 0) + 1
        })
        
        console.log(`   📋 Types disponibles:`)
        Object.entries(types).forEach(([type, count]) => {
          const icon = type === 'LOCKER' ? '🔒' : '🚚'
          console.log(`      ${icon} ${type}: ${count}`)
        })
        
        // Vérifier la logique
        const hasLockers = relayPoints.some(point => point.type === 'LOCKER')
        if (testCase.poids <= 25) {
          if (hasLockers) {
            console.log(`   ✅ Lockers présents (attendu)`)
          } else {
            console.log(`   ⚠️ Aucun locker trouvé (peut être normal selon la zone)`)
          }
        } else {
          if (!hasLockers) {
            console.log(`   ✅ Lockers exclus (attendu)`)
          } else {
            console.log(`   ❌ Lockers présents (inattendu pour ${testCase.poids}kg)`)
          }
        }
      } else {
        console.log(`   ❌ Erreur: ${response.status} - ${JSON.stringify(response.data)}`)
      }
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`)
    }
  }
}

// Exécution des tests
async function runTests() {
  console.log('🚀 Démarrage des tests Lockers Mondial Relay')
  console.log('='.repeat(60))
  
  try {
    await testTarifs()
    await testRelayPoints()
    
    console.log('\n\n🎯 Tests terminés!')
    console.log('='.repeat(60))
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error)
  }
}

runTests()











