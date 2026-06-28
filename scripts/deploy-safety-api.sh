#!/usr/bin/env bash
# Deploy safety-api to Fly.io (always-on, single instance for escalation scheduler).
set -euo pipefail
cd "$(dirname "$0")/../services/safety-api"

echo "Deploying where2go-safety-api to Fly.io..."
fly deploy --app where2go-safety-api

echo ""
echo "Post-deploy checklist:"
echo "  1. fly logs -a where2go-safety-api | grep -i scheduler"
echo "  2. curl https://safety.where2go.app/healthz"
echo "  3. Set TWILIO_* + CLERK_* secrets: fly secrets list -a where2go-safety-api"
echo "  4. Complete Twilio A2P 10DLC registration for US SMS"
