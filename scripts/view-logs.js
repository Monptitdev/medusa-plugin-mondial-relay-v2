#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

/**
 * Script pour visualiser les logs XML de Mondial Relay
 */
function viewLogs() {
  console.log('🔍 Visualisation des logs Mondial Relay\n')
  
  const logsDir = path.join(process.cwd(), 'logs')
  
  if (!fs.existsSync(logsDir)) {
    console.log('❌ Aucun dossier de logs trouvé')
    return
  }
  
  // Lister les dossiers de logs
  const logDirs = fs.readdirSync(logsDir).filter(item => {
    return fs.statSync(path.join(logsDir, item)).isDirectory()
  })
  
  if (logDirs.length === 0) {
    console.log('❌ Aucun dossier de logs trouvé')
    return
  }
  
  console.log('📁 Dossiers de logs disponibles:')
  logDirs.forEach((dir, index) => {
    const dirPath = path.join(logsDir, dir)
    const files = fs.readdirSync(dirPath)
    console.log(`  ${index + 1}. ${dir} (${files.length} fichiers)`)
  })
  
  console.log('\n📋 Fichiers récents:')
  
  // Afficher les fichiers les plus récents
  const allFiles = []
  logDirs.forEach(dir => {
    const dirPath = path.join(logsDir, dir)
    const files = fs.readdirSync(dirPath)
    files.forEach(file => {
      const filePath = path.join(dirPath, file)
      const stats = fs.statSync(filePath)
      allFiles.push({
        name: file,
        path: filePath,
        dir: dir,
        size: stats.size,
        modified: stats.mtime
      })
    })
  })
  
  // Trier par date de modification (plus récent en premier)
  allFiles.sort((a, b) => b.modified - a.modified)
  
  // Afficher les 10 fichiers les plus récents
  allFiles.slice(0, 10).forEach((file, index) => {
    const sizeKB = Math.round(file.size / 1024 * 100) / 100
    const modified = file.modified.toLocaleString('fr-FR')
    console.log(`  ${index + 1}. ${file.dir}/${file.name} (${sizeKB} KB, ${modified})`)
  })
  
  console.log('\n💡 Pour voir le contenu d\'un fichier:')
  console.log('   node scripts/view-logs.js <chemin-du-fichier>')
  console.log('\n💡 Pour nettoyer les logs:')
  console.log('   node scripts/view-logs.js --clean')
}

/**
 * Affiche le contenu d'un fichier XML
 */
function viewFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('❌ Fichier non trouvé:', filePath)
    return
  }
  
  const content = fs.readFileSync(filePath, 'utf8')
  const stats = fs.statSync(filePath)
  
  console.log(`📄 Contenu du fichier: ${filePath}`)
  console.log(`📊 Taille: ${Math.round(stats.size / 1024 * 100) / 100} KB`)
  console.log(`📅 Modifié: ${stats.mtime.toLocaleString('fr-FR')}`)
  console.log('─'.repeat(80))
  console.log(content)
  console.log('─'.repeat(80))
}

/**
 * Nettoie les logs anciens
 */
function cleanLogs() {
  const logsDir = path.join(process.cwd(), 'logs')
  
  if (!fs.existsSync(logsDir)) {
    console.log('❌ Aucun dossier de logs trouvé')
    return
  }
  
  console.log('🧹 Nettoyage des logs...')
  
  const logDirs = fs.readdirSync(logsDir).filter(item => {
    return fs.statSync(path.join(logsDir, item)).isDirectory()
  })
  
  let totalDeleted = 0
  
  logDirs.forEach(dir => {
    const dirPath = path.join(logsDir, dir)
    const files = fs.readdirSync(dirPath)
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file)
      const stats = fs.statSync(filePath)
      
      // Supprimer les fichiers de plus de 7 jours
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      
      if (stats.mtime < sevenDaysAgo) {
        fs.unlinkSync(filePath)
        totalDeleted++
        console.log(`🗑️  Supprimé: ${dir}/${file}`)
      }
    })
  })
  
  console.log(`✅ Nettoyage terminé: ${totalDeleted} fichiers supprimés`)
}

// Gestion des arguments de ligne de commande
const args = process.argv.slice(2)

if (args.length === 0) {
  viewLogs()
} else if (args[0] === '--clean') {
  cleanLogs()
} else {
  const filePath = args[0]
  viewFile(filePath)
}


