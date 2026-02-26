/**
 * Email utilities for Reno Dev Space
 * Sends stylized email templates matching the canvas aesthetic
 */

import * as functions from 'firebase-functions'
import { getFirestore } from 'firebase-admin/firestore'
import * as nodemailer from 'nodemailer'
import * as fs from 'fs'
import * as path from 'path'

// Lazy getter for Firestore instance (uses 'main' database, not default)
function getDb() {
  return getFirestore('main')
}

/**
 * Create email transporter
 * Supports Gmail SMTP by default
 */
function createTransporter(): nodemailer.Transporter {
  const emailConfig = functions.config().email

  if (!emailConfig || !emailConfig.user || !emailConfig.pass) {
    console.warn('Email config not set. Run: firebase functions:config:set email.user="your-email@gmail.com" email.pass="your-app-password"')

    // Return a test transporter that logs instead of sending
    return nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    })
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass
    }
  })
}

/**
 * Load and populate an email template with variables
 * Checks Firestore for custom template first, falls back to static file
 */
export async function loadTemplate(templateName: string, variables: Record<string, string>): Promise<string> {
  let html: string

  // Template ID is filename without .html extension
  const templateId = templateName.replace('.html', '')

  // Try Firestore first (custom templates)
  try {
    const db = getDb()
    const customDoc = await db.collection('emailTemplates').doc(templateId).get()

    if (customDoc.exists) {
      const data = customDoc.data()
      if (data?.html) {
        console.log(`✓ Using custom template from Firestore: ${templateId}`)
        html = data.html
      } else {
        throw new Error('Custom template has no HTML')
      }
    } else {
      throw new Error('No custom template found')
    }
  } catch {
    // Fall back to static file
    const templatePath = path.join(__dirname, '../templates', templateName)

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templateName}`)
    }

    console.log(`Using static template file: ${templateName}`)
    html = fs.readFileSync(templatePath, 'utf-8')
  }

  // Replace all {{VARIABLE}} placeholders
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    html = html.replace(regex, value || '')
  })

  return html
}

/**
 * Send email with error handling and logging
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const transporter = createTransporter()

  try {
    const info = await transporter.sendMail({
      from: '"Reno Dev Space" <noreply@renodevspace.org>',
      to,
      subject,
      html
    })

    console.log(`✓ Email sent to ${to}: ${subject}`)
    console.log(`  Message ID: ${info.messageId}`)
  } catch (error) {
    console.error(`✗ Failed to send email to ${to}:`, error)
    throw error
  }
}

/**
 * Check if a user is an admin
 */
export async function isAdmin(uid: string): Promise<boolean> {
  const db = getDb()
  const userDoc = await db.collection('users').doc(uid).get()
  const user = userDoc.data()

  // Super admin
  if (user?.email === 'christopher@corella.com') {
    return true
  }

  // Check admins collection
  if (user?.email) {
    const adminDoc = await db.collection('admins').doc(user.email).get()
    return adminDoc.exists
  }

  return false
}

/**
 * Get all pledges with user data
 */
export async function getPledgesWithUsers(): Promise<Array<{
  pledgeId: string
  userId: string
  email: string
  displayName: string
  amount: number
}>> {
  const db = getDb()
  const pledgesSnap = await db.collection('pledges').get()
  const pledges = await Promise.all(
    pledgesSnap.docs.map(async (pledgeDoc) => {
      const pledge = pledgeDoc.data()
      const userDoc = await db.collection('users').doc(pledge.odId).get()
      const user = userDoc.data()

      return {
        pledgeId: pledgeDoc.id,
        userId: pledge.odId,
        email: user?.email || '',
        displayName: pledge.displayName || user?.displayName || 'Unknown',
        amount: pledge.amount || 0
      }
    })
  )

  return pledges.filter(p => p.email) // Only return pledges with valid emails
}

/**
 * Get campaign statistics
 */
export async function getCampaignStats() {
  const db = getDb()
  const campaignDoc = await db.collection('settings').doc('campaign').get()
  const campaign = campaignDoc.data()

  const pledges = await getPledgesWithUsers()

  const totalRaised = pledges.reduce((sum, p) => sum + p.amount, 0)
  const goalAmount = campaign?.fundingGoal || 15000
  const percent = Math.round((totalRaised / goalAmount) * 100)
  const needed = Math.max(0, goalAmount - totalRaised)

  // Calculate days left
  const timerStartedAt = campaign?.timerStartedAt || Date.now()
  const timerDurationMs = campaign?.timerDurationMs || (14 * 24 * 60 * 60 * 1000)
  const endTime = timerStartedAt + timerDurationMs
  const daysLeft = Math.max(0, Math.ceil((endTime - Date.now()) / (24 * 60 * 60 * 1000)))

  return {
    totalRaised,
    goalAmount,
    percent,
    needed,
    backerCount: pledges.length,
    daysLeft,
    pledges
  }
}
