'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, onSnapshot as onDocSnapshot } from 'firebase/firestore'
import { getAuth, getDb } from '@/lib/firebase'
import { isAdmin as checkIsAdmin } from '@/lib/admin'
import { subscribeToAdmins } from '@/lib/storage/adminStorage'
import { setPledge } from '@/lib/storage/pledgeStorage'

interface UserProfile {
  uid: string
  email: string
  displayName: string
  bio?: string
  createdAt: number
  emailVerified?: boolean
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  adminEmails: Set<string>
  signup: (email: string, password: string, displayName: string, pledgeAmount: number) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>
  resendVerificationEmail: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminEmails, setAdminEmails] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false)
      return
    }

    try {
      const auth = getAuth()
      const db = getDb()

      const unsubAdmins = subscribeToAdmins(setAdminEmails)

      // Track profile listener so we can tear it down on sign-out
      let unsubProfile: (() => void) | null = null

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user)

        // Clean up previous profile listener
        if (unsubProfile) {
          unsubProfile()
          unsubProfile = null
        }

        if (user) {
          // Real-time listener on user profile doc.
          // If admin deletes the profile, this fires with exists()=false
          // and we auto-sign the user out.
          const profileRef = doc(db, 'users', user.uid)

          const onProfileSnapshot = async (snap: import('firebase/firestore').DocumentSnapshot) => {
            if (snap.exists()) {
              const profileData = snap.data() as UserProfile
              setProfile(profileData)

              // Sync emailVerified from Firebase Auth to Firestore if it changed
              if (user.emailVerified && !profileData.emailVerified) {
                updateDoc(doc(db, 'users', user.uid), { emailVerified: true }).catch(() => {})
              }
            } else {
              // Profile was deleted (admin cascade) — force sign out
              setProfile(null)
              await signOut(auth)
            }
            setLoading(false)
          }

          const onProfileError = (error: Error) => {
            // Auth token may not be ready yet (cached session restoring).
            // Retry after a short delay to let the token propagate.
            console.warn('[AuthContext] Profile listener error, retrying:', error.message)
            setTimeout(() => {
              if (unsubProfile) { unsubProfile(); unsubProfile = null }
              unsubProfile = onDocSnapshot(profileRef, onProfileSnapshot, (retryError) => {
                console.warn('[AuthContext] Profile retry also failed:', retryError.message)
                setLoading(false)
              })
            }, 1500)
          }

          unsubProfile = onDocSnapshot(profileRef, onProfileSnapshot, onProfileError)
        } else {
          setProfile(null)
          setLoading(false)
        }
      })

      return () => {
        unsubscribe()
        unsubAdmins()
        if (unsubProfile) unsubProfile()
      }
    } catch (error) {
      console.error('Firebase initialization error:', error)
      setLoading(false)
    }
  }, [])

  const signup = async (email: string, password: string, displayName: string, pledgeAmount: number) => {
    const auth = getAuth()
    const db = getDb()
    const { user } = await createUserWithEmailAndPassword(auth, email, password)

    // Update Firebase Auth profile
    await updateProfile(user, { displayName })

    // Send verification email
    await sendEmailVerification(user)

    // Create Firestore profile
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      displayName,
      createdAt: Date.now(),
    }

    await setDoc(doc(db, 'users', user.uid), userProfile)
    setProfile(userProfile)

    // Create initial pledge
    if (pledgeAmount > 0) {
      await setPledge(user.uid, displayName, pledgeAmount)
    }
  }

  const login = async (email: string, password: string) => {
    const auth = getAuth()
    await signInWithEmailAndPassword(auth, email, password)
  }

  const logout = async () => {
    const auth = getAuth()
    await signOut(auth)
    setProfile(null)
  }

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return

    const auth = getAuth()
    const db = getDb()
    const updatedProfile = { ...profile, ...data } as UserProfile
    await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true })
    setProfile(updatedProfile)

    if (data.displayName) {
      await updateProfile(user, { displayName: data.displayName })
    }
  }

  const resendVerificationEmail = async () => {
    if (!user) return
    await sendEmailVerification(user)
  }

  const isAdmin = checkIsAdmin(user?.email, adminEmails)

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, adminEmails, signup, login, logout, updateUserProfile, resendVerificationEmail }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
