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

// Test avec différentes localisations pour récupérer plus de variété
async function testTypeActiviteValues() {
  console.log('🔍 Test des valeurs TypeActivite dans différentes régions')
  console.log('='.repeat(80))

  const testCases = [
    { zipCode: '59000', city: 'Lille', region: 'Nord' },
    { zipCode: '75001', city: 'Paris', region: 'Île-de-France' },
    { zipCode: '69001', city: 'Lyon', region: 'Rhône-Alpes' },
    { zipCode: '13001', city: 'Marseille', region: 'PACA' },
    { zipCode: '31000', city: 'Toulouse', region: 'Occitanie' },
    { zipCode: '44000', city: 'Nantes', region: 'Pays de la Loire' },
    { zipCode: '67000', city: 'Strasbourg', region: 'Grand Est' },
    { zipCode: '35000', city: 'Rennes', region: 'Bretagne' }
  ]

  const allTypeActiviteValues = new Set()
  const lockerCandidates = []

  for (const testCase of testCases) {
    console.log(`\n📍 Test: ${testCase.city} (${testCase.zipCode}) - ${testCase.region}`)
    console.log('-'.repeat(60))

    try {
      const response = await makeRequest(
        `/store/mondial-relay/relay-points?zipCode=${testCase.zipCode}&city=${testCase.city}&weight=5`
      )

      if (response.status === 200) {
        const relayPoints = response.data.relayPoints || []
        console.log(`✅ ${relayPoints.length} points relais trouvés`)

        // Analyser les TypeActivite
        const typeActiviteCounts = {}
        relayPoints.forEach(point => {
          const typeActivite = point.typeActivite || 'N/A'
          typeActiviteCounts[typeActivite] = (typeActiviteCounts[typeActivite] || 0) + 1
          allTypeActiviteValues.add(typeActivite)

          // Identifier les candidats lockers
          if (point.name && (
            point.name.toLowerCase().includes('locker') ||
            point.name.toLowerCase().includes('casier') ||
            point.name.toLowerCase().includes('24/7') ||
            point.name.toLowerCase().includes('automatique')
          )) {
            lockerCandidates.push({
              id: point.id,
              name: point.name,
              typeActivite: typeActivite,
              city: testCase.city
            })
          }
        })

        console.log(`📊 TypeActivite trouvés:`)
        Object.entries(typeActiviteCounts).forEach(([type, count]) => {
          console.log(`   "${type}": ${count} points`)
        })

      } else {
        console.log(`❌ Erreur: ${response.status}`)
      }

    } catch (error) {
      console.error(`❌ Erreur ${testCase.city}:`, error.message)
    }

    // Pause entre les requêtes pour éviter de surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Analyse globale
  console.log('\n\n📊 ANALYSE GLOBALE')
  console.log('='.repeat(80))
  
  console.log(`\n🔍 Toutes les valeurs TypeActivite trouvées:`)
  Array.from(allTypeActiviteValues).sort().forEach(value => {
    console.log(`   "${value}"`)
  })

  console.log(`\n🔒 Candidats lockers identifiés (${lockerCandidates.length}):`)
  lockerCandidates.forEach(locker => {
    console.log(`   - ${locker.name} (${locker.city})`)
    console.log(`     TypeActivite: "${locker.typeActivite}"`)
  })

  // Grouper les candidats lockers par TypeActivite
  const lockersByTypeActivite = {}
  lockerCandidates.forEach(locker => {
    const type = locker.typeActivite
    if (!lockersByTypeActivite[type]) {
      lockersByTypeActivite[type] = []
    }
    lockersByTypeActivite[type].push(locker)
  })

  console.log(`\n📋 Candidats lockers par TypeActivite:`)
  Object.entries(lockersByTypeActivite).forEach(([type, lockers]) => {
    console.log(`   TypeActivite "${type}": ${lockers.length} lockers`)
    lockers.forEach(locker => {
      console.log(`     - ${locker.name} (${locker.city})`)
    })
  })

  // Recommandations
  console.log(`\n💡 RECOMMANDATIONS:`)
  if (lockersByTypeActivite['000'] && lockersByTypeActivite['000'].length > 0) {
    console.log(`   ✅ TypeActivite "000" semble être utilisé pour les lockers`)
    console.log(`   📝 Ajuster la détection: if (typeActivite === "000") return 'LOCKER'`)
  } else {
    console.log(`   ❓ Aucun pattern clair identifié pour les lockers`)
    console.log(`   📝 Vérifier les logs backend pour voir les vraies valeurs XML`)
  }

  return {
    allTypeActiviteValues: Array.from(allTypeActiviteValues),
    lockerCandidates,
    lockersByTypeActivite
  }
}

// Exécution du test
async function runTest() {
  console.log('🚀 Test des valeurs TypeActivite Mondial Relay')
  console.log('='.repeat(80))
  
  try {
    const results = await testTypeActiviteValues()
    
    console.log('\n\n🎯 Test terminé!')
    console.log('='.repeat(80))
    console.log('📝 Prochaines étapes:')
    console.log('   1. Analyser les résultats ci-dessus')
    console.log('   2. Identifier le TypeActivite des lockers')
    console.log('   3. Ajuster la fonction detectPointType()')
    console.log('   4. Tester la détection corrigée')
  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

runTest()











