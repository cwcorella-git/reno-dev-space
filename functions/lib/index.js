"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.createCheckoutSession = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const cors_1 = __importDefault(require("cors"));
// Initialize Firebase Admin
admin.initializeApp();
// Initialize Stripe with secret key from environment
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
});
// CORS middleware
const corsMiddleware = (0, cors_1.default)({ origin: true });
// Helper to wrap function with CORS
const withCors = (handler) => {
    return functions.https.onRequest((req, res) => {
        corsMiddleware(req, res, async () => {
            await handler(req, res);
        });
    });
};
/**
 * Create a Stripe Checkout Session for donations
 */
exports.createCheckoutSession = withCors(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { amount, userId, displayName, email, updatePledge } = req.body;
        // Validate amount (minimum $1)
        if (!amount || amount < 100) {
            res.status(400).json({ error: 'Amount must be at least $1 (100 cents)' });
            return;
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
        });
        res.json({ sessionId: session.id, url: session.url });
    }
    catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});
/**
 * Stripe webhook to handle successful payments
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('Webhook secret not configured');
        res.status(500).send('Webhook secret not configured');
        return;
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err);
        res.status(400).send('Webhook signature verification failed');
        return;
    }
    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, displayName, updatePledge } = session.metadata || {};
        const amountTotal = session.amount_total || 0;
        // Record donation in Firestore
        const db = admin.firestore();
        await db.collection('donations').add({
            sessionId: session.id,
            userId: userId || null,
            displayName: displayName || 'Anonymous',
            amount: amountTotal / 100, // Convert cents to dollars
            email: session.customer_email || null,
            status: 'completed',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Update user's pledge if requested
        if (updatePledge === 'true' && userId) {
            const pledgeRef = db.collection('pledges').doc(userId);
            await pledgeRef.set({
                odId: userId,
                displayName: displayName || 'Anonymous',
                amount: amountTotal / 100,
                updatedAt: Date.now(),
            }, { merge: true });
        }
        console.log(`Donation recorded: $${amountTotal / 100} from ${displayName || 'Anonymous'}`);
    }
    res.json({ received: true });
});
//# sourceMappingURL=index.js.map