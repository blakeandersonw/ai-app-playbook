#!/usr/bin/env bash
# Copy to .github/scripts/migration-guard.sh and `chmod +x` it (playbook/14-shipping.md).
# The migrations an env has not applied yet must be additive, unless the PR that brought this commit
# has the `destructive-migration` label.
#   .github/scripts/migration-guard.sh staging|production
# Runs in apps/api with CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and GH_TOKEN (pull-requests: read).
set -euo pipefail
env="$1"
[[ "$env" == staging || "$env" == production ]] || { echo "usage: $0 staging|production"; exit 2; }

# binding:migrations_dir for each D1 database in wrangler.jsonc.
pending=()
for pair in DB:migrations; do
  binding="${pair%%:*}" dir="${pair#*:}"
  list=$(bunx wrangler d1 migrations list "$binding" --env "$env" --remote)
  while read -r name; do
    [[ -n "$name" ]] && pending+=("$dir/$name")
  done < <(grep -oE '[0-9]{4}_[A-Za-z0-9_.-]+\.sql' <<<"$list" | sort -u)
done
if (( ${#pending[@]} == 0 )); then
  echo "No migrations to apply on $env."
  exit 0
fi
echo "Not yet applied on $env: ${pending[*]}"

allow=()
labels=$(gh api "repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/pulls" --jq '[.[].labels[].name] | join(",")')
if [[ ",$labels," == *",destructive-migration,"* ]]; then
  echo "The PR has the destructive-migration label."
  allow=(--allow)
fi
bun scripts/migration-guard.ts ${allow[@]+"${allow[@]}"} "${pending[@]}"
