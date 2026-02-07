#!/usr/bin/env node

/**
 * Backup script: Export all Firestore data and Firebase Auth users to JSON
 *
 * Creates timestamped backup files that can be used to restore the database
 * if Firebase suspends the account or data is lost.
 *
 * Usage:
 *   1. Ensure serviceAccountKey.json exists (see migrate-users.js for instructions)
 *   2. Run: node scripts/backup-firestore.js
 *   3. Backups saved to: scripts/backups/backup-YYYY-MM-DD-HHmmss/
 *
 * Output files:
 *   - firestore.json     (all Firestore collections)
 *   - auth-users.json    (Firebase Auth user metadata)
 *   - manifest.json      (backup metadata and stats)
 */

const admin = require('firebase-admin')
const path = require('path')
const fs = require('fs')

// All Firestore collections to back up
const COLLECTIONS = [
  'canvasBlocks',
  'chatMessages',
  'users',
  'pledges',
  'siteContent',
  'settings',
  'admins',
  'bannedEmails',
  'deletedBlocks',
  'blockEdits',
  'donations',
]

// Load service account
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json')

let serviceAccount
try {
  serviceAccount = require(serviceAccountPath)
} catch (err) {
  console.error('❌ Could not load serviceAccountKey.json')
  console.error('')
  console.error('Please download your service account key from Firebase Console:')
  console.error('  1. Go to Project Settings > Service Accounts')
  console.error('  2. Click "Generate New Private Key"')
  console.error('  3. Save the file as: scripts/serviceAccountKey.json')
  console.error('')
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
 * Create backup directory with timestamp
 */
function createBackupDir() {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, 19)

  const backupDir = path.join(__dirname, 'backups', `backup-${timestamp}`)
  fs.mkdirSync(backupDir, { recursive: true })
  return backupDir
}

/**
 * Export all Firestore collections
 */
async function exportFirestore() {
  console.log('📦 Exporting Firestore collections...')

  const backup = {}
  const stats = {}

  for (const collectionName of COLLECTIONS) {
    process.stdout.write(`   ${collectionName}... `)

    try {
      const snapshot = await db.collection(collectionName).get()
      const docs = snapshot.docs.map(doc => ({
        _id: doc.id,
        ...doc.data()
      }))

      backup[collectionName] = docs
      stats[collectionName] = docs.length
      console.log(`${docs.length} documents`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      backup[collectionName] = []
      stats[collectionName] = 0
    }
  }

  return { backup, stats }
}

/**
 * Export Firebase Auth users
 */
async function exportAuthUsers() {
  console.log('👤 Exporting Firebase Auth users...')

  const users = []
  let nextPageToken

  try {
    do {
      const listResult = await admin.auth().listUsers(1000, nextPageToken)

      for (const user of listResult.users) {
        users.push({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
          disabled: user.disabled,
          createdAt: user.metadata.creationTime,
          lastSignIn: user.metadata.lastSignInTime,
          // Note: passwords cannot be exported (Firebase doesn't allow it)
        })
      }

      nextPageToken = listResult.pageToken
    } while (nextPageToken)

    console.log(`   Found ${users.length} user(s)`)
  } catch (err) {
    console.log(`   ERROR: ${err.message}`)
  }

  return users
}

/**
 * Main backup function
 */
async function runBackup() {
  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log('  Reno Dev Space - Firestore Backup')
  console.log('═══════════════════════════════════════════════════')
  console.log('')

  const startTime = Date.now()
  const backupDir = createBackupDir()

  console.log(`📁 Backup directory: ${backupDir}`)
  console.log('')

  // Export Firestore
  const { backup: firestoreData, stats: firestoreStats } = await exportFirestore()
  const firestorePath = path.join(backupDir, 'firestore.json')
  fs.writeFileSync(firestorePath, JSON.stringify(firestoreData, null, 2))
  console.log('')

  // Export Auth users
  const authUsers = await exportAuthUsers()
  const authPath = path.join(backupDir, 'auth-users.json')
  fs.writeFileSync(authPath, JSON.stringify(authUsers, null, 2))
  console.log('')

  // Calculate totals
  const totalDocs = Object.values(firestoreStats).reduce((a, b) => a + b, 0)
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  // Create manifest
  const manifest = {
    createdAt: new Date().toISOString(),
    durationSeconds: parseFloat(duration),
    firestore: {
      collections: firestoreStats,
      totalDocuments: totalDocs,
    },
    auth: {
      totalUsers: authUsers.length,
    },
    files: ['firestore.json', 'auth-users.json', 'manifest.json'],
  }

  const manifestPath = path.join(backupDir, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  // Summary
  console.log('═══════════════════════════════════════════════════')
  console.log('  Backup Complete!')
  console.log('═══════════════════════════════════════════════════')
  console.log('')
  console.log(`  📊 Firestore: ${totalDocs} documents across ${COLLECTIONS.length} collections`)
  console.log(`  👤 Auth:      ${authUsers.length} users`)
  console.log(`  ⏱️  Duration:  ${duration}s`)
  console.log('')
  console.log(`  📂 Files saved to:`)
  console.log(`     ${backupDir}/`)
  console.log('')

  // File sizes
  const firestoreSize = (fs.statSync(firestorePath).size / 1024).toFixed(1)
  const authSize = (fs.statSync(authPath).size / 1024).toFixed(1)
  console.log(`  📦 File sizes:`)
  console.log(`     firestore.json:  ${firestoreSize} KB`)
  console.log(`     auth-users.json: ${authSize} KB`)
  console.log('')
}

// Run backup
runBackup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backup failed:', err)
    process.exit(1)
  })
