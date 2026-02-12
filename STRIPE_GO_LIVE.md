# Stripe Go-Live Guide

**IMPORTANT**: This guide walks you through switching Reno Dev Space from Stripe test mode to live production payments. Real money will be processed after this change. Follow each step carefully and verify before proceeding.

## Pre-Go-Live Checklist

Run the verification script first:
```bash
./scripts/verify-production-ready.sh
```

This checks for:
- ✓ No hardcoded test keys in source code
- ✓ Firebase secrets configured correctly
- ✓ .env files properly gitignored
- ✓ Functions deployed to Firebase
- ✓ Webhook endpoint reachable

Fix any errors before continuing.

---

## Step 1: Backup Current Configuration

**Before making any changes**, save your current test mode configuration:

```bash
# Save current Firebase secrets (test mode)
firebase functions:secrets:access STRIPE_SECRET_KEY > ~/stripe-backup-test-key.txt
firebase functions:secrets:access STRIPE_WEBHOOK_SECRET > ~/stripe-backup-test-webhook.txt

# Note: Store these securely! You'll need them to rollback if needed
chmod 600 ~/stripe-backup-*.txt
```

**CRITICAL**: Keep these files safe. You'll need them if you need to rollback.

---

## Step 2: Stripe Dashboard - Switch to Live Mode

1. **Login to Stripe Dashboard**: https://dashboard.stripe.com
2. **Toggle Test Mode OFF**:
   - Look for the "Test mode" toggle in the top-right corner
   - Click to switch to "Live mode"
   - The interface will change (usually darker color scheme)

3. **Verify Account Status**:
   - Go to **Settings → Account**
   - Check that "Account verification" shows complete (green checkmark)
   - If not complete:
     - Provide business details
     - Connect bank account for payouts
     - Complete identity verification
   - This may take 1-3 business days for Stripe to review

4. **Update Business Name**:
   - Go to **Settings → Public details**
   - Update "Public business name" to: **Reno Dev Space**
   - Update "Statement descriptor" to: **RENO DEV SPACE** (appears on credit card statements)
   - Save changes

5. **Configure Branding** (Optional but recommended):
   - Go to **Settings → Branding**
   - Upload logo (ideally square, 512x512px)
   - Set brand color to match site theme: `#6366f1` (indigo)
   - This branding appears in Stripe Checkout

---

## Step 3: Get Live API Keys

**IMPORTANT**: Never commit these keys to git. They provide access to real money.

1. In Stripe Dashboard, go to **Developers → API keys**
2. Confirm you're in **Live mode** (toggle should be OFF)
3. Copy the **Secret key** (starts with `sk_live_...`)
   - Click "Reveal test key token" → Copy
   - Store temporarily in a secure note (not in code!)

4. Copy the **Publishable key** (starts with `pk_live_...`)
   - You'll need this for the frontend .env.local file

---

## Step 4: Update Firebase Secrets

**⚠️ CRITICAL**: Use `printf` (not `echo`) to avoid newline issues that break webhook validation.

```bash
# Set live secret key (no trailing newlines!)
printf "sk_live_YOUR_ACTUAL_KEY_HERE" | firebase functions:secrets:set STRIPE_SECRET_KEY

# You'll see: "✔  Created a new secret version..."
```

**Verify the secret was set correctly**:
```bash
firebase functions:secrets:access STRIPE_SECRET_KEY
# Should output: sk_live_... (your key)
```

**Redeploy functions** to use the new secret:
```bash
cd functions
firebase deploy --only functions

# Wait for deployment to complete (usually 1-2 minutes)
# You should see: ✔  functions: Finished running deploy script
```

---

## Step 5: Set Up Live Webhook

Stripe needs to send payment confirmations to your server.

1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click **Add endpoint** button
3. Configure the webhook:
   - **Endpoint URL**:
     ```
     https://us-central1-reno-dev-space.cloudfunctions.net/stripeWebhook
     ```
   - **Description**: "Reno Dev Space Payment Notifications"
   - **Events to send**:
     - Click "Select events"
     - Search for and select: `checkout.session.completed`
     - Click "Add events"
   - Click **Add endpoint**

4. **Copy the Signing Secret**:
   - After creating the endpoint, click on it
   - In the "Signing secret" section, click **Reveal**
   - Copy the secret (starts with `whsec_...`)

5. **Set the webhook secret in Firebase**:
   ```bash
   printf "whsec_YOUR_WEBHOOK_SECRET_HERE" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

   # Redeploy functions again
   firebase deploy --only functions
   ```

6. **Test the webhook**:
   - In the Stripe Webhook page, click **Send test webhook**
   - Select event: `checkout.session.completed`
   - Click **Send test webhook**
   - Check that it shows "Succeeded" (200 response)
   - If it fails, check Firebase Functions logs: `firebase functions:log`

---

## Step 6: Update Frontend Environment

Update your local `.env.local` file (NOT committed to git):

```bash
# Open .env.local in your editor
# Find the line: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
# Replace with your live publishable key:
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_ACTUAL_KEY_HERE
```

**Rebuild and redeploy the frontend**:
```bash
npm run build

# If using GitHub Pages (auto-deployed via Actions):
git add .env.local  # NO! Never do this
# Instead, update GitHub Actions secrets:
# Go to: GitHub repo → Settings → Secrets and variables → Actions
# Update: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY with pk_live_...

# Or if deploying manually:
npm run build
# Deploy the 'out/' directory to your hosting
```

---

## Step 7: Test with Real Money

**CRITICAL**: Test with a small amount first ($1-2) to verify the full flow.

1. **Make a test donation**:
   - Go to your live site
   - Click **Donate** button
   - Enter **$1.00** (minimum amount)
   - Use a **real credit card** (your own)
   - Complete the checkout

2. **Verify in Stripe Dashboard**:
   - Go to **Payments** (in Live mode)
   - You should see your $1 payment
   - Status should be "Succeeded"

3. **Verify in Firestore**:
   - Open Firebase Console → Firestore Database
   - Check `donations` collection
   - Should have a new document with:
     - `amount: 1`
     - `status: "completed"`
     - `displayName`: your name

4. **Verify on your website**:
   - If you enabled "update pledge", check that your pledge amount increased
   - Check that your name appears in the backers list

5. **Refund the test payment** (optional):
   - In Stripe Dashboard → Payments
   - Click on the payment
   - Click **Refund** → **Refund $1.00**
   - Confirm refund
   - Note: Stripe fees (~$0.30) are NOT refunded

---

## Step 8: Monitor for 24 Hours

After going live, keep an eye on things:

1. **Check Firebase Functions Logs**:
   ```bash
   firebase functions:log --limit 100
   # Look for any errors
   ```

2. **Monitor Stripe Dashboard**:
   - **Payments** tab: Watch for successful payments
   - **Radar** tab: Fraud detection (should be mostly green)

3. **Set Up Alerts** (recommended):
   - Stripe Dashboard → **Developers → Webhooks**
   - Enable email alerts for webhook failures

4. **Test a few more donations**:
   - Ask a friend/colleague to donate $1
   - Verify it works from a different device/network

---

## Rollback Procedure

If something goes wrong, you can revert to test mode:

### Option A: Quick Rollback (Restore Test Keys)

```bash
# Restore test mode secrets from backup
cat ~/stripe-backup-test-key.txt | firebase functions:secrets:set STRIPE_SECRET_KEY
cat ~/stripe-backup-test-webhook.txt | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# Redeploy functions
firebase deploy --only functions

# Update frontend .env.local back to pk_test_...
# Rebuild: npm run build
```

### Option B: Full Rollback (Manual)

1. **Stripe Dashboard**:
   - Toggle **Test mode** back ON

2. **Get test keys again**:
   - Developers → API keys (in Test mode)
   - Copy test secret key (`sk_test_...`)

3. **Update Firebase secrets**:
   ```bash
   printf "sk_test_YOUR_KEY" | firebase functions:secrets:set STRIPE_SECRET_KEY
   printf "whsec_YOUR_TEST_WEBHOOK" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   firebase deploy --only functions
   ```

4. **Update frontend**:
   - Change `.env.local` back to `pk_test_...`
   - Rebuild and redeploy

5. **Delete live webhook** (optional):
   - Stripe Dashboard → Developers → Webhooks
   - Find your live webhook endpoint
   - Click **...** → **Delete**

---

## Common Issues & Solutions

### Issue: Webhook shows "Failed" in Stripe Dashboard

**Solution**:
- Check Firebase Functions logs: `firebase functions:log`
- Common causes:
  - Wrong webhook secret (typo when setting)
  - Functions not redeployed after secret update
  - Function timeout (increase to 60s if needed)

### Issue: "Error creating checkout session"

**Solution**:
- Check that `STRIPE_SECRET_KEY` is set: `firebase functions:secrets:access STRIPE_SECRET_KEY`
- Verify it starts with `sk_live_` (not `sk_test_`)
- Check Functions logs for detailed error

### Issue: Payment succeeds in Stripe but doesn't appear in Firestore

**Solution**:
- Check webhook is configured correctly
- Verify webhook secret: `firebase functions:secrets:access STRIPE_WEBHOOK_SECRET`
- Check Functions logs for webhook errors
- Manually trigger test webhook in Stripe Dashboard

### Issue: Customers see test mode checkout page

**Solution**:
- Check that frontend `.env.local` uses `pk_live_...` (not `pk_test_...`)
- Rebuild frontend: `npm run build`
- Clear browser cache / try incognito mode

---

## Security Reminders

✓ **Never commit API keys** to git (they're in `.env.local`, which is gitignored)

✓ **Use Firebase secrets** for backend keys (already configured)

✓ **Rotate keys immediately** if accidentally exposed:
  - Stripe Dashboard → Developers → API keys → Roll secret key

✓ **Enable 2FA** on Stripe account:
  - Stripe Dashboard → Settings → Team and security → Two-step authentication

✓ **Review Stripe Radar rules**:
  - Dashboard → Radar → Rules
  - Default rules block suspicious transactions automatically

---

## Post-Go-Live Checklist

After successfully going live and testing:

- [ ] Delete test keys backup files (after 48h of stable operation):
  ```bash
  rm ~/stripe-backup-*.txt
  ```

- [ ] Update project documentation:
  - Mark Stripe as "Live mode (production)" in README
  - Update CLAUDE.md if needed

- [ ] Set up monthly reconciliation:
  - Compare Stripe payouts to Firestore `donations` collection
  - Verify totals match (accounting for fees)

- [ ] Consider upgrading Stripe plan:
  - If you expect high volume (>$20k/month)
  - Custom pricing may reduce fees

---

## Need Help?

- **Stripe Support**: https://support.stripe.com (24/7 chat available)
- **Firebase Support**: https://firebase.google.com/support
- **Project Issues**: https://github.com/cwcorella-git/reno-dev-space/issues

---

**Remember**: You can always rollback to test mode if anything goes wrong. Take your time and verify each step!
