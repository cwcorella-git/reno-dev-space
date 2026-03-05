#!/usr/bin/env node

const EMAIL_TO_DELETE = process.argv[2]
if (!EMAIL_TO_DELETE) {
  console.error('Usage: node scripts/delete-user.js <email>')
  console.error('Note: This is NOT a full cascade delete. Use in-app admin deletion for cascade.')
  process.exit(1)
}

const admin = require('firebase-admin')
const path = require('path')

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()
db.settings({ databaseId: 'main' })

async function deleteUser() {
  console.log(`🔍 Finding user with email: ${EMAIL_TO_DELETE}`)

  // Find user in Auth
  const userRecord = await admin.auth().getUserByEmail(EMAIL_TO_DELETE)
  const uid = userRecord.uid
  console.log(`Found user: ${userRecord.displayName} (${uid})`)

  // Delete from Firestore users collection
  console.log('Deleting Firestore profile...')
  await db.collection('users').doc(uid).delete()

  // Delete any pledges
  console.log('Deleting pledges...')
  await db.collection('pledges').doc(uid).delete().catch(() => {})

  // Delete from Firebase Auth
  console.log('Deleting from Firebase Auth...')
  await admin.auth().deleteUser(uid)

  console.log(`✅ User ${EMAIL_TO_DELETE} deleted completely`)
}

deleteUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
  })
