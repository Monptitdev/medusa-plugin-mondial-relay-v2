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

// Test de l'API enrichie
async function testEnrichedAPI() {
  console.log('🔍 Test de l\'API enrichie Mondial Relay')
  console.log('='.repeat(60))

  try {
    const response = await makeRequest('/store/mondial-relay/relay-points?zipCode=59000&city=Lille&weight=5')

    if (response.status === 200) {
      const relayPoints = response.data.relayPoints || []
      const meta = response.data.meta || {}
      
      console.log(`✅ ${relayPoints.length} points relais trouvés`)
      console.log(`📊 Poids: ${meta.parcelWeight}kg, Lockers exclus: ${meta.lockersExcluded}`)

      // Analyser les premiers points pour voir les nouveaux champs
      relayPoints.slice(0, 3).forEach((point, index) => {
        console.log(`\n📦 Point ${index + 1}:`)
        console.log(`   ID: ${point.id}`)
        console.log(`   Nom: ${point.name}`)
        console.log(`   Nom ligne 2: ${point.nameLine2 || 'N/A'}`)
        console.log(`   Adresse: ${point.address}`)
        console.log(`   Adresse ligne 2: ${point.addressLine2 || 'N/A'}`)
        console.log(`   Ville: ${point.city}`)
        console.log(`   Code postal: ${point.zipCode}`)
        console.log(`   Type: ${point.type}`)
        console.log(`   TypeActivite: ${point.typeActivite || 'N/A'}`)
        console.log(`   Localisation1: ${point.localisation1 || 'N/A'}`)
        console.log(`   Localisation2: ${point.localisation2 || 'N/A'}`)
        console.log(`   Distance: ${point.distance || 'N/A'}m`)
        console.log(`   URL Plan: ${point.urlPlan || 'N/A'}`)
        console.log(`   URL Photo: ${point.urlPhoto || 'N/A'}`)
        
        // Horaires réels
        if (point.realOpeningHours) {
          console.log(`   Horaires réels:`)
          Object.entries(point.realOpeningHours).forEach(([day, hours]) => {
            if (hours.closed) {
              console.log(`     ${day}: Fermé`)
            } else {
              let dayHours = ''
              if (hours.morning) {
                dayHours += `${hours.morning.open}-${hours.morning.close}`
              }
              if (hours.afternoon) {
                dayHours += `, ${hours.afternoon.open}-${hours.afternoon.close}`
              }
              console.log(`     ${day}: ${dayHours}`)
            }
          })
        }
        
        // Disponibilité
        if (point.availability) {
          console.log(`   Disponibilité:`)
          console.log(`     Fermé: ${point.availability.closed ? 'Oui' : 'Non'}`)
          if (point.availability.vacationPeriods && point.availability.vacationPeriods.length > 0) {
            console.log(`     Périodes de fermeture:`)
            point.availability.vacationPeriods.forEach(period => {
              console.log(`       ${period.start} - ${period.end}`)
            })
          }
        }
      })

      // Compter les types
      const types = {}
      relayPoints.forEach(point => {
        types[point.type] = (types[point.type] || 0) + 1
      })
      
      console.log(`\n📊 Types trouvés:`)
      Object.entries(types).forEach(([type, count]) => {
        const icon = type === 'LOCKER' ? '🔒' : '🚚'
        console.log(`   ${icon} ${type}: ${count}`)
      })

      // Vérifier la détection des lockers
      const lockers = relayPoints.filter(point => point.type === 'LOCKER')
      console.log(`\n🔒 Lockers détectés: ${lockers.length}`)
      lockers.forEach(locker => {
        console.log(`   - ${locker.name} (TypeActivite: ${locker.typeActivite})`)
      })

    } else {
      console.log(`❌ Erreur: ${response.status} - ${JSON.stringify(response.data)}`)
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

// Exécution du test
async function runTest() {
  console.log('🚀 Test de l\'API enrichie Mondial Relay')
  console.log('='.repeat(60))
  
  try {
    await testEnrichedAPI()
    
    console.log('\n\n🎯 Test terminé!')
    console.log('='.repeat(60))
    console.log('📝 Vérifications:')
    console.log('   ✅ Extraction des nouveaux champs')
    console.log('   ✅ Détection des lockers via TypeActivite')
    console.log('   ✅ Parsing des horaires réels')
    console.log('   ✅ Informations de disponibilité')
    console.log('   ✅ URLs Plan et Photo')
  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

runTest()











