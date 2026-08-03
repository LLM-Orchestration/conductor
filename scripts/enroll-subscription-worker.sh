#!/usr/bin/env bash
set -euo pipefail

repo="${1:-}"
auth_file="${CODEX_AUTH_FILE:-${CODEX_HOME:-$HOME/.codex}/auth.json}"
template="templates/subscription-worker/conductor-subscription.yml"

if [ -z "$repo" ]; then
  owner="$(gh api user --jq .login)"
  repo="$owner/conductor-credentials"
fi

if ! [[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Repository must be OWNER/REPO." >&2
  exit 1
fi

if [ ! -s "$auth_file" ]; then
  echo "Codex file-backed auth was not found at $auth_file." >&2
  echo "Configure cli_auth_credentials_store=file and run codex login --device-auth." >&2
  exit 1
fi

node -e 'const fs=require("fs"); const value=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if (!value || Array.isArray(value) || typeof value !== "object") process.exit(1)' "$auth_file"

if ! gh repo view "$repo" >/dev/null 2>&1; then
  gh repo create "$repo" --private --description "Private Codex subscription worker for Conductor"
fi

worker_checkout="$(mktemp -d "${TMPDIR:-/tmp}/conductor-credentials.XXXXXX")"
trap 'node -e '\''require("fs").rmSync(process.argv[1], {recursive:true,force:true})'\'' "$worker_checkout"' EXIT
gh repo clone "$repo" "$worker_checkout"
mkdir -p "$worker_checkout/.github/workflows"
cp "$template" "$worker_checkout/.github/workflows/conductor-subscription.yml"
git -C "$worker_checkout" add .github/workflows/conductor-subscription.yml
if ! git -C "$worker_checkout" diff --cached --quiet; then
  git -C "$worker_checkout" commit -m "Install Conductor subscription worker"
  git -C "$worker_checkout" push --set-upstream origin HEAD
fi

gh secret set CODEX_AUTH_JSON --repo "$repo" < "$auth_file"
gh auth token | gh secret set CONDUCTOR_TOKEN --repo "$repo"
gh auth token | gh secret set CODEX_CREDENTIALS_WRITE_TOKEN --repo "$repo"

current_ref="$(git branch --show-current)"
gh variable set CONDUCTOR_REF --repo "$repo" --body "$current_ref"

echo "Enrolled subscription worker repository: $repo"
echo "Conductor ref: $current_ref"
echo "Run the two-worker smoke test with:"
echo "  gh workflow run conductor-subscription.yml --repo $repo"
