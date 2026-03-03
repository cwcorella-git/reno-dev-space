# Email System Documentation

This document covers the Reno Dev Space email infrastructure: templates, Cloud Functions, the admin dashboard, and template editing.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN UI                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ EmailsPanel  │  │ CampaignPanel│  │ CampaignUpdateModal  │  │
│  │ (Templates)  │  │ (Dashboard)  │  │ (Compose Updates)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FIREBASE CLOUD FUNCTIONS                      │
│  sendVerificationEmail    sendCampaignSuccessEmails              │
│  sendCampaignEndedEmails  sendCampaignUpdate  sendTestEmail      │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FIRESTORE                                │
│  emailTemplates/    emailHistory/    pledges/    settings/       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Email Templates

### Available Templates

| Template ID | Trigger | Variables |
|-------------|---------|-----------|
| `verify-email` | Auto on signup | `VERIFICATION_LINK` |
| `campaign-success` | Manual (admin) | `TOTAL_RAISED`, `BACKER_COUNT`, `USER_PLEDGE` |
| `campaign-ended` | Manual (admin) | `TOTAL_RAISED`, `PERCENT`, `USER_PLEDGE` |
| `campaign-update` | Manual (admin) | `MILESTONE_TITLE`, `MILESTONE_MESSAGE`, `DAYS_LEFT`, `CURRENT_AMOUNT`, `GOAL_AMOUNT`, `PERCENT`, `BACKER_COUNT`, `USER_PLEDGE`, `NEW_BACKERS`, `DAILY_AVERAGE`, `NEEDED` |

### Template Storage

Templates are loaded with a **Firestore-first fallback pattern**:

1. Check `emailTemplates/{templateId}` in Firestore for custom HTML
2. If found → use custom template
3. If not found → use static file from `functions/templates/{templateId}.html`

This allows admins to customize templates without redeploying code.

### Static Template Files

Located in `functions/templates/`:
```
functions/templates/
├── verify-email.html
├── campaign-success.html
├── campaign-ended.html
└── campaign-update.html
```

---

## Cloud Functions

All email functions are in `functions/src/emailFunctions.ts`.

### sendVerificationEmail
- **Trigger**: `functions.auth.user().onCreate()`
- **Automatic**: Fires when any user signs up
- **Template**: `verify-email.html`

### sendCampaignSuccessEmails
- **Trigger**: `functions.https.onCall()` (admin only)
- **Use case**: Campaign reached funding goal
- **Recipients**: All backers with pledges
- **Logs to**: `emailHistory` collection

### sendCampaignEndedEmails
- **Trigger**: `functions.https.onCall()` (admin only)
- **Use case**: Campaign expired without reaching goal
- **Recipients**: All backers with pledges
- **Logs to**: `emailHistory` collection

### sendCampaignUpdate
- **Trigger**: `functions.https.onCall()` (admin only)
- **Use case**: Milestone updates, progress announcements
- **Input**: `{ milestoneTitle, milestoneMessage, newBackers?, dailyAverage? }`
- **Recipients**: All backers with pledges
- **Logs to**: `emailHistory` collection

### sendTestEmail
- **Trigger**: `functions.https.onCall()` (admin only)
- **Use case**: Verify email setup, preview templates
- **Input**: `{ template, email? }`
- **Recipients**: Specified email or current admin
- **Logs to**: `emailHistory` collection

---

## Firestore Collections

### emailTemplates
Custom template overrides (optional).

```typescript
{
  id: 'campaign-update'       // Template ID (doc ID)
  html: string                // Full HTML with {{VARIABLES}}
  variables: string[]         // Extracted variable names
  updatedAt: number
  updatedBy: string           // Admin UID
  version: number             // Auto-incremented
}
```

### emailHistory
Audit log of all sent emails.

```typescript
{
  id: string                  // Auto-generated
  templateId: 'campaign-success' | 'campaign-ended' | 'campaign-update' | 'test'
  sentAt: number              // Timestamp
  sentBy: string              // Admin UID
  recipientCount: number
  recipients: string[]        // Email addresses
  variables: Record<string, string>
  status: 'success' | 'partial' | 'failed'
  errorMessage?: string
}
```

---

## Admin UI Components

### EmailsPanel (`src/components/panel/EmailsPanel.tsx`)

Full template editor with preview:

- **Template Selector**: Dropdown to choose template
- **Preview Button**: Loads template with sample/live data
- **Edit Mode**: Side-by-side preview + editor
- **Visual Editing**: Click directly on preview to edit text
- **HTML Tab**: Raw HTML editing
- **Variables Tab**: Edit variable values with live data toggle

### CampaignPanel Email Dashboard (`src/components/panel/CampaignPanel.tsx`)

Quick-access email controls:

```
┌───────────────────────────────────────────────┐
│ 📧 Email Dashboard                            │
│ $6,250 raised • 23 backers • 7 days • 42%     │
├───────────────────────────────────────────────┤
│ Send Emails                                   │
│ [✓ Success] [⏰ Ended] [✏️ Update] [Test]      │
├───────────────────────────────────────────────┤
│ Recipients (23 backers)                       │
│ john... ($100)  jane... ($50)  +21 more       │
├───────────────────────────────────────────────┤
│ Recent Sends                                  │
│ Campaign Update → 23 → 2h ago                 │
└───────────────────────────────────────────────┘
```

**Button States**:
- **Success**: Green, enabled when `totalRaised >= fundingGoal`
- **Ended**: Amber, enabled when campaign expired AND goal not reached
- **Update**: Indigo, opens CampaignUpdateModal
- **Test**: Gray, sends test email to admin

### CampaignUpdateModal (`src/components/panel/CampaignUpdateModal.tsx`)

Compose milestone/update emails:

- Title input (e.g., "Halfway There!")
- Message textarea
- Live stats preview (raised, goal, percent, days left)
- Recipient count
- Send button

---

## Frontend Wrappers

Located in `src/lib/emailFunctions.ts`:

```typescript
// Send success emails to all backers
sendCampaignSuccessEmails(): Promise<SendResult>

// Send ended emails to all backers
sendCampaignEndedEmails(): Promise<SendResult>

// Send milestone update to all backers
sendCampaignUpdate(data: CampaignUpdateData): Promise<SendResult>

// Send test email to admin
sendTestEmail(template: string, email?: string): Promise<SendResult>
```

---

## Template Editor Features

### Live Data Mode

Toggle "Sample → Live" in the Variables tab to:
- Fetch real campaign stats from Firestore
- Auto-populate all available variables
- Variables show "LIVE" badge
- Values become read-only (green styling)

### Visual Editing

When editing is enabled:
1. Preview iframe becomes contentEditable
2. Click directly on text to edit
3. Changes are captured via input listeners
4. Variable values are reverse-substituted back to `{{VAR}}`
5. Updated HTML syncs to the HTML tab

### Saving Templates

"Save Changes" writes to `emailTemplates/{templateId}` in Firestore:
- Extracts all `{{VARIABLE}}` patterns
- Increments version number
- Records updatedBy and updatedAt

### Resetting Templates

"Reset to Default" deletes the custom template from Firestore, reverting to the static file.

---

## Email Configuration

Cloud Functions require SMTP credentials:

```bash
firebase functions:config:set email.user="your-email@gmail.com" email.pass="your-app-password"
```

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) (not your regular password).

---

## Firestore Security Rules

```javascript
// Email templates - admin-only editing
match /emailTemplates/{templateId} {
  allow read: if true;
  allow write: if request.auth != null
    && get(/databases/main/documents/admins/$(request.auth.token.email)).exists;
}

// Email send history - admin-only
match /emailHistory/{docId} {
  allow read: if request.auth != null
    && get(/databases/main/documents/admins/$(request.auth.token.email)).exists;
  allow write: if request.auth != null
    && get(/databases/main/documents/admins/$(request.auth.token.email)).exists;
}
```

---

## Troubleshooting

### 500 Error on sendTestEmail

**Cause**: Cloud Functions querying wrong Firestore database.

**Fix**: Ensure `getDb()` uses the `main` database:
```typescript
import { getFirestore } from 'firebase-admin/firestore'

function getDb() {
  return getFirestore('main')  // NOT admin.firestore()
}
```

### Template Changes Not Affecting Sent Emails

**Cause**: Templates saved to Firestore but Cloud Functions reading static files.

**Fix**: Cloud Functions must check Firestore first:
```typescript
export async function loadTemplate(templateName: string, variables: Record<string, string>): Promise<string> {
  const templateId = templateName.replace('.html', '')

  // Try Firestore first
  const customDoc = await getDb().collection('emailTemplates').doc(templateId).get()
  if (customDoc.exists && customDoc.data()?.html) {
    return customDoc.data().html
  }

  // Fall back to static file
  return fs.readFileSync(path.join(__dirname, '../templates', templateName), 'utf-8')
}
```

### Email Not Sending

1. Check Firebase Functions logs: `firebase functions:log --only sendTestEmail`
2. Verify email config: `firebase functions:config:get email`
3. Check recipient has valid email in `users` collection
4. Ensure admin status in `admins` collection

---

## File Reference

| File | Purpose |
|------|---------|
| `functions/src/email.ts` | Core email utilities (loadTemplate, sendEmail, getCampaignStats) |
| `functions/src/emailFunctions.ts` | Cloud Function exports |
| `functions/templates/*.html` | Static email templates |
| `src/lib/emailFunctions.ts` | Frontend Cloud Function wrappers |
| `src/lib/storage/emailTemplateStorage.ts` | Firestore CRUD for custom templates |
| `src/lib/storage/emailHistoryStorage.ts` | Firestore CRUD for email history |
| `src/components/panel/EmailsPanel.tsx` | Template editor UI |
| `src/components/panel/EmailVariableEditor.tsx` | Variable editor with live data |
| `src/components/panel/EmailHtmlEditor.tsx` | Raw HTML editor |
| `src/components/panel/CampaignPanel.tsx` | Email dashboard |
| `src/components/panel/CampaignUpdateModal.tsx` | Milestone email composer |
