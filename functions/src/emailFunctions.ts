/**
 * Firebase Cloud Functions for sending email templates
 * Reno Dev Space - Stylized emails matching canvas aesthetic
 */

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { loadTemplate, sendEmail, isAdmin, getCampaignStats } from './email'

// Lazy getter for Firestore instance
function getDb() {
  return admin.firestore()
}

// ============================================================================
// VERIFICATION EMAIL
// ============================================================================

/**
 * Send verification email when user signs up
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

    // Load and populate template
    const html = await loadTemplate('verify-email.html', {
      VERIFICATION_LINK: link
    })

    // Send email
    await sendEmail(
      user.email,
      'Verify Your Email - Reno Dev Space',
      html
    )

    console.log(`✓ Verification email sent to ${user.email}`)
  } catch (error) {
    console.error('Error sending verification email:', error)
    // Don't throw - we don't want to block user creation
  }
})

// ============================================================================
// CAMPAIGN SUCCESS EMAIL
// ============================================================================

/**
 * Send success email to all backers when campaign reaches goal
 * Callable function - admin only
 */
export const sendCampaignSuccessEmails = functions.https.onCall(async (data, context) => {
  // Auth check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
  }

  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required')
  }

  try {
    const stats = await getCampaignStats()

    console.log(`Sending success emails to ${stats.pledges.length} backers...`)

    const emailPromises = stats.pledges.map(async (pledge) => {
      const html = await loadTemplate('campaign-success.html', {
        TOTAL_RAISED: stats.totalRaised.toLocaleString(),
        BACKER_COUNT: stats.backerCount.toString(),
        USER_PLEDGE: pledge.amount.toString()
      })

      await sendEmail(
        pledge.email,
        '🎉 We Did It! Campaign Successful - Reno Dev Space',
        html
      )
    })

    await Promise.all(emailPromises)

    console.log(`✓ Success emails sent to ${stats.pledges.length} backers`)

    // Log to email history
    const db = getDb()
    await db.collection('emailHistory').add({
      templateId: 'campaign-success',
      sentAt: Date.now(),
      sentBy: context.auth.uid,
      recipientCount: stats.pledges.length,
      recipients: stats.pledges.map(p => p.email),
      variables: {
        TOTAL_RAISED: stats.totalRaised.toLocaleString(),
        BACKER_COUNT: stats.backerCount.toString()
      },
      status: 'success'
    })

    return {
      success: true,
      emailsSent: stats.pledges.length,
      totalRaised: stats.totalRaised,
      backerCount: stats.backerCount
    }
  } catch (error) {
    console.error('Error sending success emails:', error)
    throw new functions.https.HttpsError('internal', `Failed to send emails: ${error}`)
  }
})

// ============================================================================
// CAMPAIGN ENDED EMAIL (Goal Not Reached)
// ============================================================================

/**
 * Send campaign ended email to all backers when timer expires without reaching goal
 * Callable function - admin only
 */
export const sendCampaignEndedEmails = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
  }

  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required')
  }

  try {
    const stats = await getCampaignStats()

    console.log(`Sending campaign ended emails to ${stats.pledges.length} backers...`)

    const emailPromises = stats.pledges.map(async (pledge) => {
      const html = await loadTemplate('campaign-ended.html', {
        TOTAL_RAISED: stats.totalRaised.toLocaleString(),
        PERCENT: stats.percent.toString(),
        USER_PLEDGE: pledge.amount.toString()
      })

      await sendEmail(
        pledge.email,
        'Campaign Update - Reno Dev Space',
        html
      )
    })

    await Promise.all(emailPromises)

    console.log(`✓ Campaign ended emails sent to ${stats.pledges.length} backers`)

    // Log to email history
    const db = getDb()
    await db.collection('emailHistory').add({
      templateId: 'campaign-ended',
      sentAt: Date.now(),
      sentBy: context.auth.uid,
      recipientCount: stats.pledges.length,
      recipients: stats.pledges.map(p => p.email),
      variables: {
        TOTAL_RAISED: stats.totalRaised.toLocaleString(),
        PERCENT: stats.percent.toString()
      },
      status: 'success'
    })

    return {
      success: true,
      emailsSent: stats.pledges.length,
      totalRaised: stats.totalRaised,
      percent: stats.percent
    }
  } catch (error) {
    console.error('Error sending ended emails:', error)
    throw new functions.https.HttpsError('internal', `Failed to send emails: ${error}`)
  }
})

// ============================================================================
// CAMPAIGN UPDATE EMAIL
// ============================================================================

/**
 * Send periodic campaign update to all backers
 * Callable function - admin only
 *
 * @param data.milestoneTitle - e.g., "Halfway There!"
 * @param data.milestoneMessage - e.g., "We're 50% funded!"
 * @param data.newBackers - Number of new backers this period (optional)
 * @param data.dailyAverage - Daily pledge average (optional)
 */
export const sendCampaignUpdate = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
  }

  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required')
  }

  const {
    milestoneTitle = 'Campaign Update',
    milestoneMessage = 'Thank you for your support!',
    newBackers = 0,
    dailyAverage = 0
  } = data

  try {
    const stats = await getCampaignStats()

    console.log(`Sending campaign update to ${stats.pledges.length} backers...`)
    console.log(`  Milestone: ${milestoneTitle}`)
    console.log(`  Progress: ${stats.percent}% ($${stats.totalRaised.toLocaleString()} of $${stats.goalAmount.toLocaleString()})`)

    const emailPromises = stats.pledges.map(async (pledge) => {
      const html = await loadTemplate('campaign-update.html', {
        MILESTONE_TITLE: milestoneTitle,
        MILESTONE_MESSAGE: milestoneMessage,
        DAYS_LEFT: stats.daysLeft.toString(),
        CURRENT_AMOUNT: stats.totalRaised.toLocaleString(),
        GOAL_AMOUNT: stats.goalAmount.toLocaleString(),
        PERCENT: stats.percent.toString(),
        BACKER_COUNT: stats.backerCount.toString(),
        USER_PLEDGE: pledge.amount.toString(),
        NEW_BACKERS: newBackers.toString(),
        DAILY_AVERAGE: dailyAverage.toString(),
        NEEDED: stats.needed.toLocaleString()
      })

      await sendEmail(
        pledge.email,
        `${milestoneTitle} - Reno Dev Space Campaign`,
        html
      )
    })

    await Promise.all(emailPromises)

    console.log(`✓ Campaign update sent to ${stats.pledges.length} backers`)

    // Log to email history
    const db = getDb()
    await db.collection('emailHistory').add({
      templateId: 'campaign-update',
      sentAt: Date.now(),
      sentBy: context.auth.uid,
      recipientCount: stats.pledges.length,
      recipients: stats.pledges.map(p => p.email),
      variables: {
        MILESTONE_TITLE: milestoneTitle,
        MILESTONE_MESSAGE: milestoneMessage,
        CURRENT_AMOUNT: stats.totalRaised.toLocaleString(),
        GOAL_AMOUNT: stats.goalAmount.toLocaleString(),
        PERCENT: stats.percent.toString(),
        BACKER_COUNT: stats.backerCount.toString(),
        DAYS_LEFT: stats.daysLeft.toString()
      },
      status: 'success'
    })

    return {
      success: true,
      emailsSent: stats.pledges.length,
      milestone: milestoneTitle,
      progress: stats.percent
    }
  } catch (error) {
    console.error('Error sending campaign update:', error)
    throw new functions.https.HttpsError('internal', `Failed to send emails: ${error}`)
  }
})

// ============================================================================
// TEST EMAIL FUNCTION
// ============================================================================

/**
 * Send a test email to verify setup
 * Callable function - admin only
 *
 * @param data.template - Template name (verify-email, campaign-success, etc.)
 * @param data.email - Email address to send to (optional, defaults to authenticated user)
 */
export const sendTestEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in')
  }

  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required')
  }

  const { template = 'verify-email', email: targetEmail } = data

  try {
    // Get user email
    const db = getDb()
    const userDoc = await db.collection('users').doc(context.auth.uid).get()
    const user = userDoc.data()
    const recipientEmail = targetEmail || user?.email

    if (!recipientEmail) {
      throw new functions.https.HttpsError('failed-precondition', 'No email address found')
    }

    // Test data
    const testData: Record<string, Record<string, string>> = {
      'verify-email.html': {
        VERIFICATION_LINK: 'https://cwcorella-git.github.io/reno-dev-space/'
      },
      'campaign-success.html': {
        TOTAL_RAISED: '15,250',
        BACKER_COUNT: '47',
        USER_PLEDGE: '100'
      },
      'campaign-ended.html': {
        TOTAL_RAISED: '8,500',
        PERCENT: '56',
        USER_PLEDGE: '100'
      },
      'campaign-update.html': {
        MILESTONE_TITLE: 'Test Update',
        MILESTONE_MESSAGE: 'This is a test email to verify your email setup.',
        DAYS_LEFT: '7',
        CURRENT_AMOUNT: '6,250',
        GOAL_AMOUNT: '15,000',
        PERCENT: '42',
        BACKER_COUNT: '23',
        USER_PLEDGE: '100',
        NEW_BACKERS: '5',
        DAILY_AVERAGE: '125',
        NEEDED: '8,750'
      }
    }

    const templateData = testData[template] || testData['verify-email.html']
    const html = await loadTemplate(template, templateData)

    await sendEmail(
      recipientEmail,
      `[TEST] ${template} - Reno Dev Space`,
      html
    )

    console.log(`✓ Test email sent to ${recipientEmail} (template: ${template})`)

    // Log to email history
    await db.collection('emailHistory').add({
      templateId: 'test',
      sentAt: Date.now(),
      sentBy: context.auth.uid,
      recipientCount: 1,
      recipients: [recipientEmail],
      variables: templateData,
      status: 'success'
    })

    return {
      success: true,
      template,
      recipient: recipientEmail
    }
  } catch (error) {
    console.error('Error sending test email:', error)
    throw new functions.https.HttpsError('internal', `Failed to send test email: ${error}`)
  }
})
