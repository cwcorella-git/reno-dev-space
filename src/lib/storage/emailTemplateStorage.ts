'use client'

import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  increment,
} from 'firebase/firestore'
import { getDb } from '../firebase'

const COLLECTION_NAME = 'emailTemplates'

export type EmailTemplateId = 'verify-email' | 'campaign-success' | 'campaign-ended' | 'campaign-update'

export interface EmailTemplate {
  id: EmailTemplateId
  html: string
  variables: string[]
  updatedAt: number
  updatedBy: string
  version: number
}

/**
 * Extract all {{VARIABLE}} patterns from HTML
 */
function extractVariables(html: string): string[] {
  const variables: string[] = []
  const regex = /{{([A-Z_]+)}}/g
  let match

  while ((match = regex.exec(html)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1])
    }
  }

  return variables
}

/**
 * Subscribe to all email templates with real-time updates
 */
export function subscribeToEmailTemplates(
  callback: (templates: Map<EmailTemplateId, EmailTemplate>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()

    return onSnapshot(
      collection(db, COLLECTION_NAME),
      (snapshot) => {
        const templatesMap = new Map<EmailTemplateId, EmailTemplate>()
        snapshot.docs.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Omit<EmailTemplate, 'id'>
          templatesMap.set(
            docSnapshot.id as EmailTemplateId,
            { id: docSnapshot.id as EmailTemplateId, ...data }
          )
        })
        callback(templatesMap)
      },
      (error) => {
        console.error('[emailTemplateStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[emailTemplateStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}

/**
 * Get a single email template
 */
export async function getEmailTemplate(id: EmailTemplateId): Promise<EmailTemplate | null> {
  try {
    const db = getDb()
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    const data = docSnap.data() as Omit<EmailTemplate, 'id'>
    return { id, ...data }
  } catch (error) {
    console.error('[emailTemplateStorage] Failed to get template:', error)
    throw error
  }
}

/**
 * Save email template (auto-extracts variables, increments version)
 */
export async function saveEmailTemplate(
  id: EmailTemplateId,
  html: string,
  updatedBy: string
): Promise<void> {
  console.log('[emailTemplateStorage] saveEmailTemplate called:', { id, updatedBy })

  try {
    const db = getDb()
    const docRef = doc(db, COLLECTION_NAME, id)

    // Extract variables from HTML
    const variables = extractVariables(html)

    // Get current version (if exists)
    const currentDoc = await getDoc(docRef)
    const currentVersion = currentDoc.exists() ? (currentDoc.data().version || 0) : 0

    const data: Omit<EmailTemplate, 'id'> = {
      html,
      variables,
      updatedAt: Date.now(),
      updatedBy,
      version: currentVersion + 1,
    }

    console.log('[emailTemplateStorage] Writing document:', { docRef: docRef.path, variables, version: data.version })
    await setDoc(docRef, data)
    console.log('[emailTemplateStorage] ✓ Write successful')
  } catch (error) {
    console.error('[emailTemplateStorage] ✗ Write failed:', error)
    throw error
  }
}

/**
 * Delete custom template (reverts to default static file)
 */
export async function deleteEmailTemplate(id: EmailTemplateId): Promise<void> {
  console.log('[emailTemplateStorage] deleteEmailTemplate called:', { id })

  try {
    const db = getDb()
    const docRef = doc(db, COLLECTION_NAME, id)

    await deleteDoc(docRef)
    console.log('[emailTemplateStorage] ✓ Delete successful')
  } catch (error) {
    console.error('[emailTemplateStorage] ✗ Delete failed:', error)
    throw error
  }
}
