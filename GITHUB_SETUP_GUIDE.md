# GitHub Setup Guide — reno-dev-space

**Repo:** `https://github.com/cwcorella-git/reno-dev-space`
**Type:** Next.js + Firebase (Reno game dev community space)
**Updated:** March 2, 2026
**Status:** Workflow live — secret still needed

---

## Current State

- [x] `.github/workflows/claude.yml` committed and pushed
- [ ] Secret `CLAUDE_CODE_OAUTH_TOKEN` added to repository settings — **ACTION NEEDED**
- [ ] Tested by commenting `@claude help` on an issue/PR

---

## Step 1: Add the OAuth Secret

Go to:
```
https://github.com/cwcorella-git/reno-dev-space/settings/secrets/actions
```

Click **"New repository secret"** and add:
- **Name:** `CLAUDE_CODE_OAUTH_TOKEN`
- **Value:**
  ```bash
  cat ~/.claude/.credentials.json | jq '.claudeAiOauth.accessToken' -r
  ```

---

## Step 2: Verify the Workflow

The workflow is already live at `.github/workflows/claude.yml`:

```yaml
name: Claude Code

on:
  issue_comment:
    types: [created, edited]
  pull_request_review_comment:
    types: [created, edited]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  claude-response:
    if: |
      contains(github.event.comment.body, '@claude') ||
      contains(github.event.comment.author_association, 'OWNER')
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

Verify it appears under the **Actions** tab on GitHub after adding the secret.

---

## Step 3: Test the Integration

Comment on any issue or PR:
```
@claude Can you help with [feature]?
```

---

## Notes

- Firebase Functions have their own `functions/node_modules` — keep both root and `functions/` installs current.
- `gh` CLI is not installed on this machine. Push via HTTPS with a PAT if needed:
  ```bash
  git remote set-url origin https://<TOKEN>@github.com/cwcorella-git/reno-dev-space.git
  git push origin main
  git remote set-url origin https://github.com/cwcorella-git/reno-dev-space.git
  ```
- File permissions committed as `100755` across most files due to WSL/NTFS filesystem. Suppress future noise with:
  ```bash
  git config core.fileMode false
  ```
- `.env.local` is gitignored — never commit Firebase credentials or API keys.

---

## Troubleshooting

**"Claude Code Action not responding"**
- Check Actions tab for workflow errors
- Verify `CLAUDE_CODE_OAUTH_TOKEN` secret is set
- Try re-commenting to trigger the workflow

**"401 Unauthorized"**
- OAuth token may have expired — run `claude setup-token` to refresh
- Update the secret at the settings URL above

**Workflow not triggering**
- Confirm `.github/workflows/claude.yml` is pushed to `main`
- Check the Actions tab is enabled for the repo
