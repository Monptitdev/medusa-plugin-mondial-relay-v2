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

// Test pour examiner la réponse de l'API 1
async function testAPI1Response() {
  console.log('🔍 Test de la réponse API 1 Mondial Relay')
  console.log('='.repeat(60))

  try {
    // Test avec différentes localisations pour avoir plus de variété
    const testCases = [
      { zipCode: '59000', city: 'Lille', weight: 1 },
      { zipCode: '75001', city: 'Paris', weight: 5 },
      { zipCode: '69001', city: 'Lyon', weight: 15 }
    ]

    for (const testCase of testCases) {
      console.log(`\n📍 Test: ${testCase.city} (${testCase.zipCode}) - ${testCase.weight}kg`)
      console.log('-'.repeat(40))

      const response = await makeRequest(
        `/store/mondial-relay/relay-points?zipCode=${testCase.zipCode}&city=${testCase.city}&weight=${testCase.weight}`
      )

      if (response.status === 200) {
        const relayPoints = response.data.relayPoints || []
        console.log(`✅ ${relayPoints.length} points relais trouvés`)

        // Analyser les premiers points pour voir les champs disponibles
        relayPoints.slice(0, 3).forEach((point, index) => {
          console.log(`\n📦 Point ${index + 1}:`)
          console.log(`   ID: ${point.id}`)
          console.log(`   Nom: ${point.name}`)
          console.log(`   Adresse: ${point.address}`)
          console.log(`   Ville: ${point.city}`)
          console.log(`   Code postal: ${point.zipCode}`)
          console.log(`   Type: ${point.type}`)
          console.log(`   Latitude: ${point.latitude}`)
          console.log(`   Longitude: ${point.longitude}`)
          console.log(`   Horaires: ${point.openingHours?.join(', ') || 'N/A'}`)
          
          // Vérifier s'il y a d'autres champs dans l'objet
          const allFields = Object.keys(point)
          const unknownFields = allFields.filter(field => 
            !['id', 'name', 'address', 'city', 'zipCode', 'country', 'latitude', 'longitude', 'openingHours', 'distance', 'type'].includes(field)
          )
          
          if (unknownFields.length > 0) {
            console.log(`   🔍 Champs supplémentaires: ${unknownFields.join(', ')}`)
            unknownFields.forEach(field => {
              console.log(`      ${field}: ${point[field]}`)
            })
          }
        })

        // Compter les types
        const types = {}
        relayPoints.forEach(point => {
          types[point.type] = (types[point.type] || 0) + 1
        })
        
        console.log(`\n📊 Types trouvés:`)
        Object.entries(types).forEach(([type, count]) => {
          console.log(`   ${type}: ${count}`)
        })

        // Vérifier s'il y a des patterns dans les noms pour identifier les lockers
        const lockerCandidates = relayPoints.filter(point => 
          point.name.toLowerCase().includes('locker') ||
          point.name.toLowerCase().includes('casier') ||
          point.name.toLowerCase().includes('24/7') ||
          point.name.toLowerCase().includes('automatique')
        )

        if (lockerCandidates.length > 0) {
          console.log(`\n🔒 Candidats lockers détectés (${lockerCandidates.length}):`)
          lockerCandidates.forEach(point => {
            console.log(`   - ${point.name} (${point.type})`)
          })
        }

      } else {
        console.log(`❌ Erreur: ${response.status} - ${JSON.stringify(response.data)}`)
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

// Test pour examiner la réponse XML brute (si possible)
async function testRawXMLResponse() {
  console.log('\n\n🔍 Test de la réponse XML brute')
  console.log('='.repeat(60))

  try {
    // On va regarder les logs du backend pour voir la réponse XML
    console.log('📝 Pour voir la réponse XML brute, regardez les logs du backend Medusa')
    console.log('📝 Cherchez les lignes qui commencent par "📄 Contenu XML complet:"')
    console.log('📝 Dans cette réponse, cherchez les champs suivants pour identifier les lockers:')
    console.log('   - TypeActivite')
    console.log('   - NACE')
    console.log('   - Action')
    console.log('   - Taille')
    console.log('   - Ou tout autre champ qui pourrait indiquer le type de point')

  } catch (error) {
    console.error('❌ Erreur:', error)
  }
}

// Exécution des tests
async function runTests() {
  console.log('🚀 Analyse de la réponse API 1 Mondial Relay')
  console.log('='.repeat(60))
  
  try {
    await testAPI1Response()
    await testRawXMLResponse()
    
    console.log('\n\n🎯 Tests terminés!')
    console.log('='.repeat(60))
    console.log('📝 Prochaines étapes:')
    console.log('   1. Examiner la réponse XML brute dans les logs backend')
    console.log('   2. Identifier le champ qui distingue les lockers')
    console.log('   3. Modifier le parsing pour utiliser ce champ')
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error)
  }
}

runTests()











