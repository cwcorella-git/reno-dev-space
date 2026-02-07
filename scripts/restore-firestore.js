#!/usr/bin/env node

/**
 * Restore script: Import Firestore data from a backup
 *
 * CAUTION: This will OVERWRITE existing documents with matching IDs.
 * It does NOT delete documents that aren't in the backup.
 *
 * Usage:
 *   node scripts/restore-firestore.js <backup-folder>
 *
 * Example:
 *   node scripts/restore-firestore.js scripts/backups/backup-2024-01-15-143022
 *
 * Options:
 *   --dry-run    Preview what would be restored without writing
 *   --collection <name>   Only restore a specific collection
 */

const admin = require('firebase-admin')
const path = require('path')
const fs = require('fs')

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const collectionIndex = args.indexOf('--collection')
const onlyCollection = collectionIndex !== -1 ? args[collectionIndex + 1] : null

// Find backup folder argument (first arg that's not a flag)
const backupFolder = args.find(arg => !arg.startsWith('--') && arg !== onlyCollection)

if (!backupFolder) {
  console.error('Usage: node scripts/restore-firestore.js <backup-folder> [--dry-run] [--collection <name>]')
  console.error('')
  console.error('Example:')
  console.error('  node scripts/restore-firestore.js scripts/backups/backup-2024-01-15-143022')
  console.error('  node scripts/restore-firestore.js scripts/backups/backup-2024-01-15-143022 --dry-run')
  console.error('  node scripts/restore-firestore.js scripts/backups/backup-2024-01-15-143022 --collection canvasBlocks')
  process.exit(1)
}

// Verify backup folder exists
const firestorePath = path.join(backupFolder, 'firestore.json')
if (!fs.existsSync(firestorePath)) {
  console.error(`❌ Backup file not found: ${firestorePath}`)
  process.exit(1)
}

// Load service account
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json')

let serviceAccount
try {
  serviceAccount = require(serviceAccountPath)
} catch (err) {
  console.error('❌ Could not load serviceAccountKey.json')
  process.exit(1)
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

// Use the 'main' database (not default)
const db = admin.firestore()
db.settings({ databaseId: 'main' })

/**
 * Restore documents to a collection
 */
async function restoreCollection(collectionName, documents) {
  let restored = 0
  let errors = 0

  // Firestore batch writes are limited to 500 operations
  const BATCH_SIZE = 500
  const batches = []

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = documents.slice(i, i + BATCH_SIZE)

    for (const doc of chunk) {
      const { _id, ...data } = doc
      const docRef = db.collection(collectionName).doc(_id)
      batch.set(docRef, data)
    }

    batches.push(batch)
  }

  for (const batch of batches) {
    if (!dryRun) {
      try {
        await batch.commit()
        restored += BATCH_SIZE
      } catch (err) {
        console.error(`   Error in batch: ${err.message}`)
        errors++
      }
    }
  }

  return { restored: Math.min(restored, documents.length), errors }
}

/**
 * Main restore function
 */
async function runRestore() {
  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log('  Reno Dev Space - Firestore Restore')
  if (dryRun) console.log('  🔍 DRY RUN MODE - No changes will be made')
  console.log('═══════════════════════════════════════════════════')
  console.log('')

  // Load backup data
  console.log(`📂 Loading backup from: ${backupFolder}`)
  const backupData = JSON.parse(fs.readFileSync(firestorePath, 'utf-8'))
  const collections = Object.keys(backupData)

  // Load manifest if available
  const manifestPath = path.join(backupFolder, 'manifest.json')
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    console.log(`   Backup created: ${manifest.createdAt}`)
  }
  console.log('')

  // Filter to specific collection if requested
  const collectionsToRestore = onlyCollection
    ? collections.filter(c => c === onlyCollection)
    : collections

  if (onlyCollection && collectionsToRestore.length === 0) {
    console.error(`❌ Collection "${onlyCollection}" not found in backup`)
    process.exit(1)
  }

  console.log('📦 Restoring collections...')
  console.log('')

  let totalRestored = 0
  let totalErrors = 0

  for (const collectionName of collectionsToRestore) {
    const documents = backupData[collectionName]
    process.stdout.write(`   ${collectionName} (${documents.length} docs)... `)

    if (documents.length === 0) {
      console.log('skipped (empty)')
      continue
    }

    if (dryRun) {
      console.log('would restore')
      totalRestored += documents.length
    } else {
      const { restored, errors } = await restoreCollection(collectionName, documents)
      totalRestored += restored
      totalErrors += errors
      console.log(errors > 0 ? `restored with ${errors} errors` : 'done')
    }
  }

  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log(dryRun ? '  Dry Run Complete!' : '  Restore Complete!')
  console.log('═══════════════════════════════════════════════════')
  console.log('')
  console.log(`  📊 Documents: ${totalRestored}`)
  if (totalErrors > 0) console.log(`  ❌ Errors: ${totalErrors}`)
  console.log('')

  if (dryRun) {
    console.log('  Run without --dry-run to actually restore the data.')
    console.log('')
  }
}

// Confirmation prompt for non-dry-run
async function confirmRestore() {
  if (dryRun) return true

  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    console.log('⚠️  WARNING: This will overwrite existing documents in Firestore.')
    console.log('')
    rl.question('Type "RESTORE" to confirm: ', (answer) => {
      rl.close()
      resolve(answer === 'RESTORE')
    })
  })
}

// Run restore
confirmRestore()
  .then((confirmed) => {
    if (!confirmed && !dryRun) {
      console.log('Restore cancelled.')
      process.exit(0)
    }
    return runRestore()
  })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Restore failed:', err)
    process.exit(1)
  })
