#!/usr/bin/env node
/**
 * Randomize fonts for all existing text blocks
 *
 * Usage:
 *   1. Ensure serviceAccountKey.json exists in scripts/ folder
 *   2. Run: node scripts/randomize-fonts.js
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
  console.error('   Download it from Firebase Console > Project Settings > Service Accounts')
  process.exit(1)
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
})

// Use 'main' database
const db = admin.firestore()
db.settings({ databaseId: 'main' })

// Available fonts (CSS variables)
const TEXT_FONTS = [
  'var(--font-inter)',
  'var(--font-jetbrains-mono)',
  'var(--font-space-grotesk)',
  'var(--font-exo-2)',
  'var(--font-orbitron)',
  'var(--font-quicksand)',
  'var(--font-playfair)',
  'var(--font-lora)',
  'var(--font-oswald)',
  'var(--font-anton)',
  'var(--font-bebas-neue)',
  'var(--font-caveat)',
]

function getRandomFont() {
  return TEXT_FONTS[Math.floor(Math.random() * TEXT_FONTS.length)]
}

async function main() {
  console.log('Fetching all canvas blocks...')
  const snapshot = await db.collection('canvasBlocks').get()

  console.log(`Found ${snapshot.size} blocks. Randomizing fonts...\n`)

  let updated = 0
  for (const docSnapshot of snapshot.docs) {
    const block = docSnapshot.data()
    const newFont = getRandomFont()

    await db.collection('canvasBlocks').doc(docSnapshot.id).update({
      'style.fontFamily': newFont,
      updatedAt: Date.now(),
    })

    const content = (block.content || '').substring(0, 30).replace(/<[^>]*>/g, '')
    console.log(`  ✓ "${content}..." → ${newFont.replace('var(--font-', '').replace(')', '')}`)
    updated++
  }

  console.log(`\n✅ Done! Updated ${updated} blocks with random fonts.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
