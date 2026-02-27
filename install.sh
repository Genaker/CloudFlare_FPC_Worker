#!/usr/bin/env bash
# CloudFlare FPC Worker — Auto-Install Script
#
# What this script does:
#   1. Checks for required tools (wrangler, node, npx)
#   2. Prompts for your Cloudflare credentials / site domain
#   3. Creates the KV namespace (cache version counter)
#   4. Creates the R2 bucket (page cache storage)
#   5. Patches wrangler.toml with the real KV namespace ID
#   6. Deploys the worker with `wrangler deploy`
#
# Usage:
#   chmod +x install.sh
#   ./install.sh
#
# Requirements:
#   - Node.js 18+
#   - wrangler CLI  (npm install -g wrangler  OR  npx wrangler)
#   - A Cloudflare account with Workers, KV, and R2 access

set -euo pipefail

BLUE='\033[1;34m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 0. Detect wrangler
# ---------------------------------------------------------------------------
if command -v wrangler &>/dev/null; then
  WRANGLER="wrangler"
elif command -v npx &>/dev/null; then
  warn "wrangler not found globally; will use 'npx wrangler'."
  WRANGLER="npx wrangler"
else
  die "Neither 'wrangler' nor 'npx' found. Install Node.js 18+ and run: npm install -g wrangler"
fi

if ! command -v node &>/dev/null; then
  die "Node.js not found. Install Node.js 18+ from https://nodejs.org"
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if (( NODE_MAJOR < 18 )); then
  die "Node.js 18+ required (found $(node --version)). Please upgrade."
fi

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        CloudFlare FPC Worker — Auto Installer            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ---------------------------------------------------------------------------
# 1. Authenticate (wrangler login handles the OAuth flow)
# ---------------------------------------------------------------------------
info "Checking Cloudflare authentication…"
if ! $WRANGLER whoami &>/dev/null; then
  warn "Not logged in. Launching 'wrangler login'…"
  $WRANGLER login
fi
success "Authenticated with Cloudflare."
echo ""

# ---------------------------------------------------------------------------
# 2. Gather inputs
# ---------------------------------------------------------------------------
read -rp "  Site domain (e.g. example.com): " DOMAIN
DOMAIN="${DOMAIN#https://}"   # strip protocol if accidentally included
DOMAIN="${DOMAIN%/}"          # strip trailing slash

read -rp "  Worker name [fpc-worker]: " WORKER_NAME
WORKER_NAME="${WORKER_NAME:-fpc-worker}"

read -rp "  KV namespace title [FPC_KV]: " KV_TITLE
KV_TITLE="${KV_TITLE:-FPC_KV}"

read -rp "  R2 bucket name [fpc-cache]: " R2_BUCKET
R2_BUCKET="${R2_BUCKET:-fpc-cache}"

echo ""
info "Using domain:      ${DOMAIN}"
info "Worker name:       ${WORKER_NAME}"
info "KV namespace:      ${KV_TITLE}"
info "R2 bucket:         ${R2_BUCKET}"
echo ""

# ---------------------------------------------------------------------------
# 3. Create KV namespace
# ---------------------------------------------------------------------------
info "Creating KV namespace '${KV_TITLE}'…"
KV_OUTPUT=$($WRANGLER kv namespace create "${KV_TITLE}" 2>&1) || true

# Extract the id from output like:  { binding = "KV", id = "abc123" }
KV_ID=$(echo "$KV_OUTPUT" | grep -oP '(?<=id = ")[^"]+' || true)

if [[ -z "$KV_ID" ]]; then
  # Try JSON output fallback  (newer wrangler versions)
  KV_ID=$(echo "$KV_OUTPUT" | grep -oP '"id"\s*:\s*"\K[^"]+' || true)
fi

if [[ -z "$KV_ID" ]]; then
  warn "Could not auto-detect KV namespace ID from wrangler output."
  warn "Output was:"
  echo "$KV_OUTPUT"
  read -rp "  Paste the KV namespace ID manually: " KV_ID
fi

success "KV namespace ID: ${KV_ID}"
echo ""

# ---------------------------------------------------------------------------
# 4. Create R2 bucket
# ---------------------------------------------------------------------------
info "Creating R2 bucket '${R2_BUCKET}'…"
if $WRANGLER r2 bucket create "${R2_BUCKET}" 2>&1 | grep -qi "already exists"; then
  warn "R2 bucket '${R2_BUCKET}' already exists — skipping creation."
else
  success "R2 bucket '${R2_BUCKET}' created."
fi
echo ""

# ---------------------------------------------------------------------------
# 5. Patch wrangler.toml
# ---------------------------------------------------------------------------
TOML_PATH="$(dirname "$0")/wrangler.toml"

if [[ ! -f "$TOML_PATH" ]]; then
  die "wrangler.toml not found at ${TOML_PATH}"
fi

info "Patching wrangler.toml…"

# Update name
sed -i "s|^name\s*=.*|name            = \"${WORKER_NAME}\"|" "$TOML_PATH"

# Update KV namespace ID
sed -i "s|REPLACE_WITH_KV_NAMESPACE_ID|${KV_ID}|g" "$TOML_PATH"

# Update R2 bucket name
sed -i "s|^bucket_name = \"fpc-cache\"|bucket_name = \"${R2_BUCKET}\"|" "$TOML_PATH"

# Update routes
sed -i "s|example\.com/\*|${DOMAIN}/*|g" "$TOML_PATH"
sed -i "s|zone_name = \"example\.com\"|zone_name = \"${DOMAIN}\"|g" "$TOML_PATH"

success "wrangler.toml updated."
echo ""

# ---------------------------------------------------------------------------
# 6. Deploy
# ---------------------------------------------------------------------------
read -rp "Deploy the worker now? [Y/n]: " DEPLOY_NOW
DEPLOY_NOW="${DEPLOY_NOW:-Y}"

if [[ "$DEPLOY_NOW" =~ ^[Yy]$ ]]; then
  info "Running 'wrangler deploy'…"
  $WRANGLER deploy
  echo ""
  success "Worker deployed to https://${DOMAIN}/"
else
  echo ""
  info "Skipped deploy. Run manually:"
  echo "  wrangler deploy"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  Installation complete!                  ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  KV namespace ID : ${KV_ID}${NC}"
echo -e "${GREEN}║  R2 bucket       : ${R2_BUCKET}${NC}"
echo -e "${GREEN}║  Worker          : ${WORKER_NAME}${NC}"
echo -e "${GREEN}║  Route           : ${DOMAIN}/*${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
info "Next steps:"
echo "  • Set secrets:  wrangler secret put ENV_CLOUDFLARE_API_KEY"
echo "  • Verify cache: curl -sI https://${DOMAIN}/ | grep x-html-edge-cache-status"
echo "  • Run tests:    TEST_URL=https://${DOMAIN}/ npm test"
echo ""
