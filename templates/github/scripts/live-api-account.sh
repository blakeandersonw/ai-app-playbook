#!/usr/bin/env bash
# Copy to .github/scripts/live-api-account.sh and `chmod +x` it (playbook/14-shipping.md).
# Makes an anonymous staging account with Pro for an hour, for the live API tests. Pro is written
# straight into the staging D1 `entitlements` table (playbook/03-database.md) with source
# 'live_api_check', so no payment-provider secret is needed. Refuses any URL without "staging".
#   live-api-account.sh <staging-api-url>            prints USER_ID=… and TOKEN=… lines
#   live-api-account.sh --delete <staging-api-url> <token>
# wrangler runs in $API_DIR (default apps/api next to this script).
set -euo pipefail

url=${2:-${1:-}}
case "$url" in *staging*) ;; *) echo "refusing a URL that isn't staging: $url" >&2; exit 1 ;; esac

if [ "${1:-}" = --delete ]; then
  # Better Auth's account deletion (deleteUser enabled in templates/auth.ts); use your own route if you have one.
  curl -fsS -X POST "$2/api/auth/delete-user" -H "Authorization: Bearer $3" \
    -H 'content-type: application/json' -d '{}' >/dev/null
  exit 0
fi

headers=$(mktemp)
body=$(curl -fsS -D "$headers" -X POST "$url/api/auth/sign-in/anonymous" -H 'content-type: application/json' -d '{}')
user=$(jq -r '.user.id' <<<"$body")
token=$(grep -i '^set-auth-token:' "$headers" | cut -d' ' -f2 | tr -d '\r')
rm -f "$headers"
[[ "$user" =~ ^[A-Za-z0-9_-]+$ ]] && [ -n "$token" ] || { echo "anonymous sign-in failed" >&2; exit 1; }

now=$(($(date +%s) * 1000))
end=$((now + 3600 * 1000))
(cd "${API_DIR:-$(dirname "$0")/../../apps/api}" && bunx wrangler d1 execute DB --env staging --remote --command \
  "INSERT INTO entitlements (user_id, entitlement, source, product_id, status, current_period_end, original_transaction_id, updated_at)
   VALUES ('$user', 'pro', 'live_api_check', NULL, 'active', $end, NULL, $now)" >/dev/null)

echo "USER_ID=$user"
echo "TOKEN=$token"
