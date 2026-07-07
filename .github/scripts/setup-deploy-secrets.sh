#!/usr/bin/env bash
# Set adrift deploy secrets to match pinchards.is (run on your Mac as repo owner).
#
# GitHub never shows stored secret values, so copy from the same sources you used
# for pinchards.is: DreamHost panel + ~/.ssh/pinchards_deploy
#
# Usage:
#   gh auth login   # as adamsimms, with repo admin
#   ./.github/scripts/setup-deploy-secrets.sh
#
# Or pass values via environment:
#   FTP_SERVER=psNNNN.dreamhost.com FTP_USERNAME=you FTP_SERVER_DIR=/home/you/pinchards.is \
#     ./.github/scripts/setup-deploy-secrets.sh

set -euo pipefail

REPO="${REPO:-adamsimms/adrift}"
KEY_FILE="${KEY_FILE:-$HOME/.ssh/pinchards_deploy}"

if ! command -v gh >/dev/null; then
	echo "Install GitHub CLI: https://cli.github.com/"
	exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
	echo "Run: gh auth login"
	exit 1
fi

prompt() {
	local name="$1" hint="$2" value=""
	if [[ -n "${!name:-}" ]]; then
		return 0
	fi
	read -r -p "${name} (${hint}): " value
	printf -v "$name" '%s' "$value"
}

prompt FTP_SERVER "SSH hostname only, e.g. psNNNN.dreamhost.com"
prompt FTP_USERNAME "DreamHost shell user"
prompt FTP_SERVER_DIR "absolute site root, e.g. /home/USER/pinchards.is"

if [[ ! -f "$KEY_FILE" ]]; then
	echo "SSH key not found at ${KEY_FILE}"
	echo "Set KEY_FILE to your deploy private key path, or create one per pinchards.is/docs/DEPLOY.md"
	exit 1
fi

echo "Setting secrets on ${REPO}..."
gh secret set FTP_SERVER --repo "$REPO" --body "$FTP_SERVER"
gh secret set FTP_USERNAME --repo "$REPO" --body "$FTP_USERNAME"
gh secret set FTP_SERVER_DIR --repo "$REPO" --body "$FTP_SERVER_DIR"
gh secret set SSH_DEPLOY_KEY --repo "$REPO" < "$KEY_FILE"

echo "Done. Run a dry-run deploy:"
echo "  gh workflow run deploy.yml --repo ${REPO} -f dry_run=true"
