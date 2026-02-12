/**
 * Example Firebase Cloud Functions for sending email templates
 *
 * Install dependencies:
 *   npm install --save nodemailer @types/nodemailer
 *
 * Set email credentials:
 *   firebase functions:config:set email.user="your-email@gmail.com" email.pass="your-app-password"
 */

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import * as nodemailer from 'nodemailer'
import * as fs from 'fs'
import * as path from 'path'

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: functions.config().email?.user || 'your-email@gmail.com',
    pass: functions.config().email?.pass || 'your-app-password'
  }
})

/**
 * Load and populate an email template
 */
function loadTemplate(templateName: string, variables: Record<string, string>): string {
  const templatePath = path.join(__dirname, '../email-templates', templateName)
  let html = fs.readFileSync(templatePath, 'utf-8')

  // Replace all {{VARIABLE}} placeholders
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    html = html.replace(regex, value)
  })

  return html
}

/**
 * Send email with error handling
 */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: '"Reno Dev Space" <noreply@renodevspace.org>',
      to,
      subject,
      html
    })
    console.log(`Email sent to ${to}: ${subject}`)
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error)
    throw error
  }
}

// ============================================================================
// VERIFICATION EMAIL
// ============================================================================

/**
 * Send verification email when user signs up
 *
 * Triggered automatically by Firebase Auth
 */
export const sendVerificationEmail = functions.auth.user().onCreate(async (user) => {
  if (!user.email) {
    console.log('User has no email, skipping verification email')
    return
  }

  try {
    // Generate Firebase email verification link
    const link = await admin.auth().generateEmailVerificationLink(user.email)

    // Load template
    const html = loadTemplate('verify-email.html', {
      VERIFICATION_LINK: link
    })

    // Send email
    await sendEmail(
      user.email,
      'Verify Your Email - Reno Dev Space',
      html
    )
  } catch (error) {
    console.error('Error sending verification email:', error)
  }
})

// ============================================================================
// CAMPAIGN SUCCESS EMAIL
// ============================================================================

/**
 * Send success email to all backers when campaign reaches goal
 *
 * Call this from your campaign monitoring function when goal is reached
 */
export const sendCampaignSuccessEmails = functions.https.onCall(async (data, context) => {
  // Only admins can trigger this
  if (!context.auth || !(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required')
  }

  try {
    // Get campaign data
    const campaignDoc = await db.collection('settings').doc('campaign').get()
    const campaign = campaignDoc.data()

    // Get all pledges
    const pledgesSnap = await db.collection('pledges').get()
    const pledges = pledgesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // Calculate stats
    const totalRaised = pledges.reduce((sum, p: any) => sum + (p.amount || 0), 0)
    const backerCount = pledges.length

    // Send email to each backer
    const emailPromises = pledges.map(async (pledge: any) => {
      const userDoc = await db.collection('users').doc(pledge.odId).get()
      const user = userDoc.data()

      if (!user?.email) return

      const html = loadTemplate('campaign-success.html', {
        TOTAL_RAISED: totalRaised.toLocaleString(),
        BACKER_COUNT: backerCount.toString(),
        USER_PLEDGE: pledge.amount.toString()
      })

      await sendEmail(
        user.email,
        '🎉 We Did It! Campaign Successful - Reno Dev Space',
        html
      )
    })

    await Promise.all(emailPromises)

    return { success: true, emailsSent: pledges.length }
  } catch (error) {
    console.error('Error sending success emails:', error)
    throw new functions.https.HttpsError('internal', 'Failed to send emails')
  }
})

// ============================================================================
// CAMPAIGN ENDED EMAIL (No Goal Reached)
// ============================================================================

/**
 * Send campaign ended email to all backers when timer expires without reaching goal
 */
export const sendCampaignEndedEmails = functions.https.onCall(async (data, context) => {
  if (!context.auth || !(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required')
  }

  try {
    const campaignDoc = await db.collection('settings').doc('campaign').get()
    const campaign = campaignDoc.data()

    const pledgesSnap = await db.collection('pledges').get()
    const pledges = pledgesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    const totalRaised = pledges.reduce((sum, p: any) => sum + (p.amount || 0), 0)
    const goalAmount = campaign?.fundingGoal || 15000
    const percent = Math.round((totalRaised / goalAmount) * 100)

    const emailPromises = pledges.map(async (pledge: any) => {
      const userDoc = await db.collection('users').doc(pledge.odId).get()
      const user = userDoc.data()

      if (!user?.email) return

      const html = loadTemplate('campaign-ended.html', {
        TOTAL_RAISED: totalRaised.toLocaleString(),
        PERCENT: percent.toString(),
        USER_PLEDGE: pledge.amount.toString()
      })

      await sendEmail(
        user.email,
        'Campaign Update - Reno Dev Space',
        html
      )
    })

    await Promise.all(emailPromises)

    return { success: true, emailsSent: pledges.length }
  } catch (error) {
    console.error('Error sending ended emails:', error)
    throw new functions.https.HttpsError('internal', 'Failed to send emails')
  }
})

// ============================================================================
// CAMPAIGN UPDATE EMAIL
// ============================================================================

/**
 * Send periodic campaign update to all backers
 *
 * Call this manually or schedule with Cloud Scheduler
 */
export const sendCampaignUpdate = functions.https.onCall(async (data, context) => {
  if (!context.auth || !(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required')
  }

  const {
    milestoneTitle,
    milestoneMessage,
    newBackers,
    dailyAverage
  } = data

  try {
    const campaignDoc = await db.collection('settings').doc('campaign').get()
    const campaign = campaignDoc.data()

    const pledgesSnap = await db.collection('pledges').get()
    const pledges = pledgesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    const totalRaised = pledges.reduce((sum, p: any) => sum + (p.amount || 0), 0)
    const goalAmount = campaign?.fundingGoal || 15000
    const percent = Math.round((totalRaised / goalAmount) * 100)
    const needed = goalAmount - totalRaised

    // Calculate days left
    const timerStartedAt = campaign?.timerStartedAt || Date.now()
    const timerDurationMs = campaign?.timerDurationMs || (14 * 24 * 60 * 60 * 1000)
    const endTime = timerStartedAt + timerDurationMs
    const daysLeft = Math.max(0, Math.ceil((endTime - Date.now()) / (24 * 60 * 60 * 1000)))

    const emailPromises = pledges.map(async (pledge: any) => {
      const userDoc = await db.collection('users').doc(pledge.odId).get()
      const user = userDoc.data()

      if (!user?.email) return

      const html = loadTemplate('campaign-update.html', {
        MILESTONE_TITLE: milestoneTitle,
        MILESTONE_MESSAGE: milestoneMessage,
        DAYS_LEFT: daysLeft.toString(),
        CURRENT_AMOUNT: totalRaised.toLocaleString(),
        GOAL_AMOUNT: goalAmount.toLocaleString(),
        PERCENT: percent.toString(),
        BACKER_COUNT: pledges.length.toString(),
        USER_PLEDGE: pledge.amount.toString(),
        NEW_BACKERS: (newBackers || 0).toString(),
        DAILY_AVERAGE: (dailyAverage || 0).toString(),
        NEEDED: needed.toLocaleString()
      })

      await sendEmail(
        user.email,
        `${milestoneTitle} - Reno Dev Space Campaign`,
        html
      )
    })

    await Promise.all(emailPromises)

    return { success: true, emailsSent: pledges.length }
  } catch (error) {
    console.error('Error sending update emails:', error)
    throw new functions.https.HttpsError('internal', 'Failed to send emails')
  }
})

// ============================================================================
// SCHEDULED CAMPAIGN UPDATES
// ============================================================================

/**
 * Automatically send campaign updates at milestones
 *
 * Runs daily at midnight to check for milestones
 */
export const checkCampaignMilestones = functions.pubsub
  .schedule('0 0 * * *') // Daily at midnight
  .timeZone('America/Los_Angeles')
  .onRun(async () => {
    const campaignDoc = await db.collection('settings').doc('campaign').get()
    const campaign = campaignDoc.data()

    if (!campaign?.timerStartedAt) {
      console.log('Campaign not started, skipping milestone check')
      return
    }

    const pledgesSnap = await db.collection('pledges').get()
    const pledges = pledgesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    const totalRaised = pledges.reduce((sum, p: any) => sum + (p.amount || 0), 0)
    const goalAmount = campaign.fundingGoal || 15000
    const percent = Math.round((totalRaised / goalAmount) * 100)

    const timerDurationMs = campaign.timerDurationMs || (14 * 24 * 60 * 60 * 1000)
    const endTime = campaign.timerStartedAt + timerDurationMs
    const daysLeft = Math.max(0, Math.ceil((endTime - Date.now()) / (24 * 60 * 60 * 1000)))

    // Check for milestones
    let milestone: { title: string; message: string } | null = null

    if (percent >= 25 && percent < 26) {
      milestone = {
        title: '25% Funded!',
        message: "We've reached our first quarter! Thank you for your support."
      }
    } else if (percent >= 50 && percent < 51) {
      milestone = {
        title: 'Halfway There!',
        message: "We're 50% funded! Let's keep the momentum going."
      }
    } else if (percent >= 75 && percent < 76) {
      milestone = {
        title: '75% Funded!',
        message: 'So close! We can almost taste it.'
      }
    } else if (daysLeft === 2) {
      milestone = {
        title: '48 Hours Left!',
        message: 'Final push! Share with your network to help us reach our goal.'
      }
    } else if (daysLeft === 1) {
      milestone = {
        title: 'Last Day!',
        message: "This is it! Help us cross the finish line."
      }
    }

    if (milestone) {
      console.log(`Milestone reached: ${milestone.title}`)
      // You could call sendCampaignUpdate here or log for admin to trigger manually
    }
  })

// ============================================================================
// HELPERS
// ============================================================================

async function isAdmin(uid: string): Promise<boolean> {
  const userDoc = await db.collection('users').doc(uid).get()
  const user = userDoc.data()

  // Check super admin
  if (user?.email === 'christopher@corella.com') return true

  // Check admins collection
  const adminDoc = await db.collection('admins').doc(user?.email || '').get()
  return adminDoc.exists
}
