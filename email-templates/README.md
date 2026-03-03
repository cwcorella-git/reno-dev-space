# Email Templates - Reno Dev Space

Stylized email templates matching the canvas aesthetic with gradient backgrounds, fancy lettering, and indigo/purple color scheme.

## Templates

### 1. **verify-email.html**
Sent when a user signs up to verify their email address.

**Variables:**
- `{{VERIFICATION_LINK}}` - Firebase email verification URL

**Design:** Indigo gradient header with large "RENO DEV SPACE" title, envelope icon, prominent verification button, alternative link, and security notice.

---

### 2. **campaign-success.html**
Sent when the campaign reaches its funding goal.

**Variables:**
- `{{TOTAL_RAISED}}` - Total amount raised (e.g., "15,250")
- `{{BACKER_COUNT}}` - Number of backers (e.g., "47")
- `{{USER_PLEDGE}}` - Individual user's pledge amount (e.g., "50")

**Design:** Green success banner with 🎉, stats grid showing total raised and backer count, next steps numbered list.

---

### 3. **campaign-ended.html**
Sent when the campaign ends without reaching the goal.

**Variables:**
- `{{TOTAL_RAISED}}` - Total amount pledged (e.g., "8,500")
- `{{PERCENT}}` - Percentage of goal reached (e.g., "56")
- `{{USER_PLEDGE}}` - Individual user's pledge amount (e.g., "50")

**Design:** Amber/yellow banner, stats showing pledged amount and percentage, reassurance that no charges will occur, hopeful message about continuing the community.

---

### 4. **campaign-update.html**
Sent periodically during active campaign to keep backers engaged.

**Variables:**
- `{{MILESTONE_TITLE}}` - Update title (e.g., "Halfway There!", "48 Hours Left!")
- `{{DAYS_LEFT}}` - Days remaining (e.g., "7")
- `{{CURRENT_AMOUNT}}` - Current total (e.g., "6,250")
- `{{GOAL_AMOUNT}}` - Funding goal (e.g., "15,000")
- `{{PERCENT}}` - Progress percentage (e.g., "42")
- `{{BACKER_COUNT}}` - Total backers (e.g., "23")
- `{{USER_PLEDGE}}` - Individual pledge (e.g., "50")
- `{{NEW_BACKERS}}` - New backers this week (e.g., "5")
- `{{DAILY_AVERAGE}}` - Daily pledge average (e.g., "125")
- `{{NEEDED}}` - Amount still needed (e.g., "8,750")
- `{{MILESTONE_MESSAGE}}` - Custom message for this update

**Design:** Purple gradient banner with 🚀, animated progress bar, stats grid, recent activity feed, share CTA.

---

## Implementation

### Option 1: Firebase Custom Email Handler (Recommended for Verification)

Create a custom email action handler page to send verification emails with your template.

```typescript
// functions/src/email.ts
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

export const sendVerificationEmail = functions.auth.user().onCreate(async (user) => {
  // Generate verification link
  const link = await admin.auth().generateEmailVerificationLink(user.email!)

  // Load template
  const template = await loadTemplate('verify-email.html')
  const html = template.replace('{{VERIFICATION_LINK}}', link)

  // Send via your email service (see options below)
  await sendEmail({
    to: user.email!,
    subject: 'Verify Your Email - Reno Dev Space',
    html
  })
})
```

### Option 2: Firebase Extension (Easiest)

Install the **Trigger Email** extension:

```bash
firebase ext:install firebase/firestore-send-email
```

Configure it to watch a `mail` collection and send emails via SMTP or SendGrid.

```typescript
// Trigger an email
await admin.firestore().collection('mail').add({
  to: user.email,
  message: {
    subject: 'Campaign Success!',
    html: template.replace(/{{(\w+)}}/g, (_, key) => data[key])
  }
})
```

### Option 3: Direct SMTP (Most Control)

Use Nodemailer in Cloud Functions:

```typescript
import * as nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // Or your SMTP provider
  port: 587,
  secure: false,
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.pass
  }
})

async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: '"Reno Dev Space" <noreply@renodevspace.org>',
    to,
    subject,
    html
  })
}
```

---

## Email Service Recommendations

### For Verification Emails
- **Firebase Custom Email Handler** - Free, full control
- **SendGrid Free Tier** - 100 emails/day
- **Gmail SMTP** - Simple, 500 emails/day limit

### For Campaign Updates
- **SendGrid** - $15/month for 40k emails
- **Mailgun** - $15/month for 50k emails
- **AWS SES** - $0.10 per 1,000 emails (cheapest for bulk)

---

## Template Variables Reference

### Common Variables
- `{{USER_PLEDGE}}` - User's pledge amount (no $ symbol)
- `{{VERIFICATION_LINK}}` - Email verification URL

### Campaign Variables
- `{{TOTAL_RAISED}}` - Total amount raised (no $ symbol, no commas)
- `{{GOAL_AMOUNT}}` - Funding goal (no $ symbol, no commas)
- `{{CURRENT_AMOUNT}}` - Current total (no $ symbol, no commas)
- `{{PERCENT}}` - Percentage (number only, no % symbol)
- `{{BACKER_COUNT}}` - Number of backers (number only)
- `{{DAYS_LEFT}}` - Days remaining (number only)
- `{{NEEDED}}` - Amount still needed (no $ symbol, no commas)

### Update-Specific Variables
- `{{MILESTONE_TITLE}}` - Custom title
- `{{MILESTONE_MESSAGE}}` - Custom message
- `{{NEW_BACKERS}}` - New backers this period
- `{{DAILY_AVERAGE}}` - Daily pledge average

---

## Testing Templates

Open the HTML files in a browser to preview. For email client testing, use:

- **Litmus** - Paid service, tests across 90+ email clients
- **Email on Acid** - Similar to Litmus
- **PutsMail** - Free, simple HTML email sender for testing
- **Mailtrap** - Free dev email inbox for testing

Send test emails:
```bash
node scripts/test-email.js verify-email your@email.com
```

---

## Design Notes

### Color Palette
- **Primary Gradient**: `#6366f1` → `#8b5cf6` (Indigo → Purple)
- **Success**: `#10b981` (Green)
- **Warning**: `#fbbf24` (Amber)
- **Background**: `#0f172a` (Dark slate)
- **Text**: `#e2e8f0` (Light gray)

### Typography
- **Headings**: System font stack, 42-48px, 800 weight
- **Body**: 14-16px, 1.6-1.7 line height
- **Accent**: Gradient text with `-webkit-background-clip`

### Email-Safe Practices
- ✅ Inline CSS (all styles in `style` attributes)
- ✅ Table layouts (Flexbox/Grid not widely supported)
- ✅ Web-safe fonts with fallbacks
- ✅ Alt text for images
- ✅ Plain text version (generated automatically by most services)
- ✅ Tested in Gmail, Outlook, Apple Mail

---

## Automation Ideas

### 1. Welcome Series
- Day 0: Verification email
- Day 1: "Explore the canvas" with tutorial
- Day 7: "Join the chat" reminder

### 2. Campaign Milestones
- 25% funded: "We're making progress!"
- 50% funded: "Halfway there!"
- 75% funded: "Almost at our goal!"
- 48 hours left: "Final push!"
- Goal reached: Success email
- Timer expired: Campaign ended email

### 3. Engagement Triggers
- User hasn't visited in 7 days: "Miss you!" email
- New potential space added: "Check out this location"
- Campaign starts: "We're live!" announcement
- Backer limit reached: "Early bird special ending soon"

---

## Next Steps

1. **Choose an email service** (SendGrid recommended for ease)
2. **Set up Cloud Functions** to trigger emails
3. **Test templates** with real data
4. **Add unsubscribe links** (required by law)
5. **Track email metrics** (opens, clicks, conversions)
6. **A/B test subject lines** to improve open rates

Need help? Check the Firebase docs or ask in the Reno Dev Space chat! 🚀
