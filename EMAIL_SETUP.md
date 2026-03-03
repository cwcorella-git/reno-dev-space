# Email System Setup Guide

Complete guide to deploying and using the Reno Dev Space email system with Firebase Cloud Functions.

## 🚀 Quick Start

### 1. Set Up Gmail App Password

**Why Gmail?** It's free, reliable, and works great for up to 500 emails/day.

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Scroll down to **App passwords**
4. Generate a new app password:
   - App: "Mail"
   - Device: "Other (Custom name)" → "Reno Dev Space"
5. Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)

### 2. Configure Firebase Functions

```bash
cd functions

# Set email credentials (use the app password you just generated)
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.pass="xxxx xxxx xxxx xxxx"

# Verify configuration
firebase functions:config:get
```

**Output should look like:**
```json
{
  "email": {
    "user": "your-email@gmail.com",
    "pass": "xxxx xxxx xxxx xxxx"
  }
}
```

### 3. Deploy Functions

```bash
# Build TypeScript
npm run build

# Deploy all functions
firebase deploy --only functions

# Or deploy only email functions
firebase deploy --only functions:sendVerificationEmail,functions:sendCampaignSuccessEmails,functions:sendCampaignEndedEmails,functions:sendCampaignUpdate,functions:sendTestEmail
```

### 4. Test Email System

Open your browser console on the deployed site and run:

```javascript
// Get Firebase Functions instance
const functions = firebase.functions()

// Send a test email (admin only)
const sendTest = functions.httpsCallable('sendTestEmail')

sendTest({
  template: 'verify-email.html',
  email: 'your-email@gmail.com'
})
  .then(result => console.log('✓ Test email sent:', result.data))
  .catch(error => console.error('✗ Error:', error))
```

Check your inbox! You should receive a stylized verification email.

---

## 📧 Available Email Functions

### 1. Verification Email (Automatic)

**Trigger:** Automatically sent when a new user signs up
**Function:** `sendVerificationEmail`
**Template:** `verify-email.html`

**No action needed** - this function runs automatically via Firebase Auth triggers.

To test manually:
```javascript
// Create a test user in Firebase Console
// Verification email will be sent automatically
```

---

### 2. Campaign Success Email

**Trigger:** Manual (when campaign reaches goal)
**Function:** `sendCampaignSuccessEmails`
**Template:** `campaign-success.html`

**How to send:**

```javascript
const functions = firebase.functions()
const sendSuccess = functions.httpsCallable('sendCampaignSuccessEmails')

sendSuccess()
  .then(result => {
    console.log(`✓ Sent to ${result.data.emailsSent} backers`)
    console.log(`  Total raised: $${result.data.totalRaised}`)
  })
  .catch(error => console.error('Error:', error))
```

**What it does:**
- Queries all pledges from Firestore
- Calculates total raised and backer count
- Sends personalized email to each backer
- Shows their individual pledge amount

---

### 3. Campaign Ended Email

**Trigger:** Manual (when campaign timer expires without reaching goal)
**Function:** `sendCampaignEndedEmails`
**Template:** `campaign-ended.html`

**How to send:**

```javascript
const sendEnded = functions.httpsCallable('sendCampaignEndedEmails')

sendEnded()
  .then(result => {
    console.log(`✓ Sent to ${result.data.emailsSent} backers`)
    console.log(`  Final amount: $${result.data.totalRaised} (${result.data.percent}%)`)
  })
  .catch(error => console.error('Error:', error))
```

**What it does:**
- Queries all pledges
- Calculates final totals and percentage
- Sends "no charge" reassurance email
- Encourages staying connected

---

### 4. Campaign Update Email

**Trigger:** Manual (send periodic updates during campaign)
**Function:** `sendCampaignUpdate`
**Template:** `campaign-update.html`

**How to send:**

```javascript
const sendUpdate = functions.httpsCallable('sendCampaignUpdate')

sendUpdate({
  milestoneTitle: 'Halfway There!',
  milestoneMessage: "We've hit 50% of our funding goal! Let's keep the momentum going.",
  newBackers: 8,        // New backers since last update
  dailyAverage: 156     // Average daily pledges
})
  .then(result => {
    console.log(`✓ Update sent to ${result.data.emailsSent} backers`)
    console.log(`  Progress: ${result.data.progress}%`)
  })
  .catch(error => console.error('Error:', error))
```

**When to send:**
- **25% funded:** "First Quarter Milestone!"
- **50% funded:** "Halfway There!"
- **75% funded:** "Almost at Our Goal!"
- **48 hours left:** "Final Push!"
- **Weekly updates:** Progress reports

---

## 🎯 Campaign Update Schedule (Suggested)

Create a reminder system or manual checklist:

**Milestone Updates (automatic triggers):**
```javascript
// Check every day for milestones
const stats = await getCampaignStats()

if (stats.percent >= 25 && stats.percent < 26) {
  sendCampaignUpdate({
    milestoneTitle: '25% Funded!',
    milestoneMessage: "We've reached our first quarter! Thank you for your support."
  })
}
// ... repeat for 50%, 75%
```

**Time-Based Updates:**
- **Day 1:** Campaign launch announcement
- **Day 7:** Weekly progress report
- **Day 12:** "48 Hours Left!" urgency email
- **Day 13:** "Last Day!" final push

---

## 🔧 Troubleshooting

### Email not sending?

**Check function logs:**
```bash
firebase functions:log --only sendVerificationEmail
```

**Common issues:**

1. **"Email config not set"**
   ```bash
   firebase functions:config:get
   # Should show email.user and email.pass
   ```

2. **"Gmail blocked sign-in attempt"**
   - Use an App Password, not your regular password
   - Enable 2-Step Verification first
   - Make sure "Less secure app access" is OFF (we use App Passwords)

3. **"Authentication failed"**
   - Double-check email.user is correct
   - Regenerate App Password
   - Remove spaces from app password when setting config

4. **"Template not found"**
   ```bash
   # Verify templates exist
   ls functions/templates/
   # Should show: verify-email.html, campaign-success.html, etc.
   ```

### Test locally (optional)

```bash
cd functions

# Install Firebase emulator
firebase init emulators  # Select Functions

# Start emulators
npm run serve

# Functions run at: http://localhost:5001/reno-dev-space/us-central1/
```

---

## 📊 Email Analytics

### Track email opens (optional)

Add a tracking pixel to templates:

```html
<!-- At the end of <body>, before </body> -->
<img src="https://your-analytics-service.com/track?id={{USER_ID}}" width="1" height="1" style="display:none;" alt="">
```

### Monitor sending

Check Firebase Console → Functions → Logs:
- ✓ Success: "Email sent to..."
- ✗ Errors: Stack traces for debugging

---

## 💰 Cost Estimates

### Gmail (Free Tier)
- **Limit:** 500 emails/day
- **Cost:** FREE
- **Good for:** Testing, small campaigns (<100 backers)

### SendGrid
- **Free Tier:** 100 emails/day
- **Essentials Plan:** $15/month for 40,000 emails
- **Good for:** Production campaigns

### AWS SES
- **Cost:** $0.10 per 1,000 emails
- **No monthly fee**
- **Good for:** Large-scale or variable volume

### Switching to SendGrid (if needed):

1. Sign up at https://sendgrid.com/
2. Get API key from Settings → API Keys
3. Install SendGrid SDK:
   ```bash
   cd functions
   npm install @sendgrid/mail
   ```
4. Update `email.ts`:
   ```typescript
   import sgMail from '@sendgrid/mail'
   sgMail.setApiKey(functions.config().sendgrid.apikey)

   await sgMail.send({
     to: recipientEmail,
     from: 'noreply@renodevspace.org',
     subject: subject,
     html: html
   })
   ```

---

## 🔐 Security Best Practices

1. **Never commit credentials**
   - Use `firebase functions:config:set`
   - Credentials are encrypted and stored in Firebase

2. **Restrict functions to admins**
   - All campaign email functions check `isAdmin()`
   - Only super admin and admins collection can trigger

3. **Rate limiting**
   - Gmail enforces 500/day automatically
   - Add custom limits if needed:
   ```typescript
   // In functions
   const recentSends = await checkRecentSends()
   if (recentSends > 100) {
     throw new Error('Too many emails sent recently')
   }
   ```

4. **Unsubscribe links**
   - Required by law (CAN-SPAM Act)
   - Add to all campaign emails:
   ```html
   <a href="mailto:christopher@corella.com?subject=Unsubscribe">Unsubscribe</a>
   ```

---

## 📝 Adding New Email Templates

1. **Create HTML template:**
   ```bash
   cp functions/templates/verify-email.html functions/templates/new-template.html
   ```

2. **Add template variables:**
   ```html
   <p>Hello {{USER_NAME}}, your {{ITEM}} is ready!</p>
   ```

3. **Create function:**
   ```typescript
   // In emailFunctions.ts
   export const sendNewEmail = functions.https.onCall(async (data, context) => {
     const html = loadTemplate('new-template.html', {
       USER_NAME: data.userName,
       ITEM: data.item
     })
     await sendEmail(userEmail, 'Your Item is Ready', html)
   })
   ```

4. **Export in index.ts:**
   ```typescript
   export { sendNewEmail } from './emailFunctions'
   ```

5. **Deploy:**
   ```bash
   npm run build
   firebase deploy --only functions:sendNewEmail
   ```

---

## 🎓 Next Steps

1. **Deploy and test** with your own email
2. **Create a campaign** and test update emails
3. **Monitor logs** for the first few sends
4. **Scale up** to SendGrid when ready for production
5. **Add automation** for milestone emails
6. **Track metrics** (opens, clicks, conversions)

Need help? Check Firebase docs or reach out in the Reno Dev Space community! 🚀

---

## Quick Reference Commands

```bash
# Set email config
firebase functions:config:set email.user="your@email.com" email.pass="app-password"

# Deploy functions
firebase deploy --only functions

# View logs
firebase functions:log

# Test email (in browser console)
firebase.functions().httpsCallable('sendTestEmail')({ template: 'verify-email.html' })

# Send campaign success
firebase.functions().httpsCallable('sendCampaignSuccessEmails')()

# Send campaign ended
firebase.functions().httpsCallable('sendCampaignEndedEmails')()

# Send campaign update
firebase.functions().httpsCallable('sendCampaignUpdate')({
  milestoneTitle: 'Halfway There!',
  milestoneMessage: "We're at 50%!"
})
```
