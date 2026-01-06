import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Lazy initialization to avoid SSR issues
let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

function getApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be initialized on the client side')
  }

  if (!app) {
    if (!firebaseConfig.apiKey) {
      throw new Error('Firebase API key is not configured')
    }
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  }
  return app
}

function getAuthInstance(): Auth {
  if (!auth) {
    auth = getAuth(getApp())
  }
  return auth
}

function getDbInstance(): Firestore {
  if (!db) {
    db = getFirestore(getApp())
  }
  return db
}

// Export getters that lazily initialize
export { getAuthInstance as getAuth, getDbInstance as getDb }

// For backwards compatibility - these will throw on SSR but work on client
export const authGetter = {
  get current() {
    return getAuthInstance()
  }
}

export const dbGetter = {
  get current() {
    return getDbInstance()
  }
}
