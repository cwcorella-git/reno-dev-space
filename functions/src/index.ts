import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import Stripe from 'stripe'
import cors from 'cors'

// Import email functions
import {
  sendVerificationEmail,
  sendCampaignSuccessEmails,
  sendCampaignEndedEmails,
  sendCampaignUpdate,
  sendTestEmail
} from './emailFunctions'

// Define secrets that will be bound to functions
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY')
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET')

// Initialize Firebase Admin
admin.initializeApp()

// Use the 'main' database (not default)
const db = getFirestore('main')

// CORS middleware
const corsMiddleware = cors({ origin: true })

/**
 * Create a Stripe Checkout Session for donations
 */
export const createCheckoutSession = functions
  .runWith({ secrets: [stripeSecretKey] })
  .https.onRequest((req, res) => {
    corsMiddleware(req, res, async () => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' })
        return
      }

      try {
        // Initialize Stripe inside the function with the bound secret
        const stripe = new Stripe(stripeSecretKey.value(), {
          apiVersion: '2023-10-16',
        })

        const { amount, userId, displayName, email, updatePledge } = req.body

        // Validate amount (minimum $1)
        if (!amount || amount < 100) {
          res.status(400).json({ error: 'Amount must be at least $1 (100 cents)' })
          return
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'Donation to Reno Dev Space',
                  description: 'Support the game developer collective',
                },
                unit_amount: amount, // Amount in cents
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${req.headers.origin}/reno-dev-space/?donation=success`,
          cancel_url: `${req.headers.origin}/reno-dev-space/?donation=cancelled`,
          customer_email: email || undefined,
          metadata: {
            userId: userId || '',
            displayName: displayName || '',
            updatePledge: updatePledge ? 'true' : 'false',
          },
        })

        res.json({ sessionId: session.id, url: session.url })
      } catch (error) {
        console.error('Error creating checkout session:', error)
        res.status(500).json({ error: 'Failed to create checkout session' })
      }
    })
  })

/**
 * Stripe webhook to handle successful payments
 */
export const stripeWebhook = functions
  .runWith({ secrets: [stripeSecretKey, stripeWebhookSecret] })
  .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'] as string
    const webhookSecretValue = stripeWebhookSecret.value()

    if (!webhookSecretValue) {
      console.error('Webhook secret not configured')
      res.status(500).send('Webhook secret not configured')
      return
    }

    // Initialize Stripe inside the function with the bound secret
    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: '2023-10-16',
    })

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecretValue)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      res.status(400).send('Webhook signature verification failed')
      return
    }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const { userId, displayName, updatePledge } = session.metadata || {}
    const amountTotal = session.amount_total || 0

    // Record donation in Firestore
    await db.collection('donations').add({
      sessionId: session.id,
      userId: userId || null,
      displayName: displayName || 'Anonymous',
      amount: amountTotal / 100, // Convert cents to dollars
      email: session.customer_email || null,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Update user's pledge if requested
    if (updatePledge === 'true' && userId) {
      const pledgeRef = db.collection('pledges').doc(userId)
      await pledgeRef.set({
        odId: userId,
        displayName: displayName || 'Anonymous',
        amount: amountTotal / 100,
        updatedAt: Date.now(),
      }, { merge: true })
    }

    console.log(`Donation recorded: $${amountTotal / 100} from ${displayName || 'Anonymous'}`)
  }

  res.json({ received: true })
})

// ============================================================================
// EMAIL FUNCTIONS
// ============================================================================

// Export email functions
export {
  sendVerificationEmail,
  sendCampaignSuccessEmails,
  sendCampaignEndedEmails,
  sendCampaignUpdate,
  sendTestEmail
}
