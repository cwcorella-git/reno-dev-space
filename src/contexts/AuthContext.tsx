'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { getAuth, getDb } from '@/lib/firebase'

interface UserProfile {
  uid: string
  email: string
  displayName: string
  bio?: string
  createdAt: number
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signup: (email: string, password: string, displayName: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false)
      return
    }

    try {
      const auth = getAuth()
      const db = getDb()

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setUser(user)

        if (user) {
          // Fetch user profile from Firestore
          const profileDoc = await getDoc(doc(db, 'users', user.uid))
          if (profileDoc.exists()) {
            setProfile(profileDoc.data() as UserProfile)
          }
        } else {
          setProfile(null)
        }

        setLoading(false)
      })

      return unsubscribe
    } catch (error) {
      console.error('Firebase initialization error:', error)
      setLoading(false)
    }
  }, [])

  const signup = async (email: string, password: string, displayName: string) => {
    const auth = getAuth()
    const db = getDb()
    const { user } = await createUserWithEmailAndPassword(auth, email, password)

    // Update Firebase Auth profile
    await updateProfile(user, { displayName })

    // Create Firestore profile
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      displayName,
      createdAt: Date.now(),
    }

    await setDoc(doc(db, 'users', user.uid), userProfile)
    setProfile(userProfile)
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

  return (
    <AuthContext.Provider value={{ user, profile, loading, signup, login, logout, updateUserProfile }}>
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
