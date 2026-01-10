#!/usr/bin/env node

/**
 * Migration script: Sync Firebase Auth users to Firestore users collection
 *
 * This script finds all users in Firebase Auth and creates corresponding
 * documents in the Firestore `users` collection if they don't exist.
 *
 * Usage:
 *   1. Download your service account key from Firebase Console:
 *      Project Settings > Service Accounts > Generate New Private Key
 *
 *   2. Save it as `serviceAccountKey.json` in this scripts folder
 *      (DO NOT commit this file - it's in .gitignore)
 *
 *   3. Run: node scripts/migrate-users.js
 */

const admin = require('firebase-admin')
const path = require('path')

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

const USERS_COLLECTION = 'users'

async function migrateUsers() {
  console.log('🔍 Fetching users from Firebase Auth...')

  const authUsers = []
  let nextPageToken

  // List all users (paginated)
  do {
    const listResult = await admin.auth().listUsers(1000, nextPageToken)
    authUsers.push(...listResult.users)
    nextPageToken = listResult.pageToken
  } while (nextPageToken)

  console.log(`📋 Found ${authUsers.length} user(s) in Firebase Auth`)

  if (authUsers.length === 0) {
    console.log('No users to migrate.')
    return
  }

  let created = 0
  let skipped = 0
  let errors = 0

  for (const authUser of authUsers) {
    const uid = authUser.uid
    const email = authUser.email || ''
    const displayName = authUser.displayName || email.split('@')[0] || 'Anonymous'
    const createdAt = new Date(authUser.metadata.creationTime).getTime()

    try {
      // Check if user document already exists
      const userDoc = await db.collection(USERS_COLLECTION).doc(uid).get()

      if (userDoc.exists) {
        console.log(`⏭️  Skipping ${displayName} (${email}) - already exists`)
        skipped++
        continue
      }

      // Create user document
      const userProfile = {
        uid,
        email,
        displayName,
        createdAt,
      }

      await db.collection(USERS_COLLECTION).doc(uid).set(userProfile)
      console.log(`✅ Created profile for ${displayName} (${email})`)
      created++

    } catch (err) {
      console.error(`❌ Error processing ${email}:`, err.message)
      errors++
    }
  }

  console.log('')
  console.log('═══════════════════════════════════')
  console.log('Migration complete!')
  console.log(`  ✅ Created: ${created}`)
  console.log(`  ⏭️  Skipped: ${skipped}`)
  console.log(`  ❌ Errors: ${errors}`)
  console.log('═══════════════════════════════════')
}

// Run migration
migrateUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
