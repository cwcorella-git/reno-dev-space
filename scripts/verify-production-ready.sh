#!/bin/bash

# Stripe Production Readiness Verification Script
# Run this before going live to verify configuration

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Stripe Production Readiness Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ERRORS=0
WARNINGS=0

# Check 1: No hardcoded test keys in source code
echo "✓ Checking for hardcoded test keys..."
if grep -r "sk_test_" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" src/ functions/src/ 2>/dev/null; then
  echo "  ✗ ERROR: Found hardcoded test keys in source code"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No hardcoded test keys found"
fi

# Check 2: Firebase secrets are configured (requires Firebase CLI)
echo ""
echo "✓ Checking Firebase secrets configuration..."
if command -v firebase &> /dev/null; then
  echo "  Checking STRIPE_SECRET_KEY..."
  if firebase functions:secrets:access STRIPE_SECRET_KEY 2>/dev/null | grep -q "sk_"; then
    SECRET_KEY=$(firebase functions:secrets:access STRIPE_SECRET_KEY 2>/dev/null)
    if [[ $SECRET_KEY == sk_live_* ]]; then
      echo "  ✓ STRIPE_SECRET_KEY is set (LIVE mode)"
    elif [[ $SECRET_KEY == sk_test_* ]]; then
      echo "  ⚠ WARNING: STRIPE_SECRET_KEY is still in TEST mode"
      WARNINGS=$((WARNINGS + 1))
    else
      echo "  ⚠ WARNING: STRIPE_SECRET_KEY format unexpected"
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    echo "  ✗ ERROR: STRIPE_SECRET_KEY not configured"
    ERRORS=$((ERRORS + 1))
  fi

  echo "  Checking STRIPE_WEBHOOK_SECRET..."
  if firebase functions:secrets:access STRIPE_WEBHOOK_SECRET 2>/dev/null | grep -q "whsec_"; then
    echo "  ✓ STRIPE_WEBHOOK_SECRET is set"
  else
    echo "  ✗ ERROR: STRIPE_WEBHOOK_SECRET not configured"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ⚠ WARNING: Firebase CLI not installed, skipping secret checks"
  echo "    Install: npm install -g firebase-tools"
  WARNINGS=$((WARNINGS + 1))
fi

# Check 3: .env files are gitignored
echo ""
echo "✓ Checking .gitignore configuration..."
if grep -q "\.env\*\.local" .gitignore && grep -q "\.env$" .gitignore; then
  echo "  ✓ .env files properly gitignored"
else
  echo "  ✗ ERROR: .env files not properly gitignored"
  ERRORS=$((ERRORS + 1))
fi

# Check 4: Functions are deployed
echo ""
echo "✓ Checking Firebase Functions deployment..."
if command -v firebase &> /dev/null; then
  if firebase functions:list 2>/dev/null | grep -q "createCheckoutSession"; then
    echo "  ✓ Functions appear to be deployed"
  else
    echo "  ⚠ WARNING: Functions may not be deployed"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo "  ⚠ WARNING: Firebase CLI not available, skipping"
  WARNINGS=$((WARNINGS + 1))
fi

# Check 5: Stripe webhook endpoint is reachable
echo ""
echo "✓ Checking webhook endpoint..."
FUNCTIONS_URL="https://us-central1-reno-dev-space.cloudfunctions.net"
if curl -s -o /dev/null -w "%{http_code}" "$FUNCTIONS_URL/stripeWebhook" | grep -q "405\|400"; then
  echo "  ✓ Webhook endpoint is reachable"
else
  echo "  ⚠ WARNING: Webhook endpoint returned unexpected status"
  echo "    URL: $FUNCTIONS_URL/stripeWebhook"
  WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "✓ All checks passed! Ready for production."
  echo ""
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo "⚠ $WARNINGS warning(s) found. Review before going live."
  echo ""
  exit 0
else
  echo "✗ $ERRORS error(s) and $WARNINGS warning(s) found."
  echo "  Fix errors before going live."
  echo ""
  exit 1
fi
