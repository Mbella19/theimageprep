#!/usr/bin/env bash
#
# One-command deploy for a VPS. Run it from inside the cloned repo:
#
#     ./scripts/deploy-vps.sh
#
# It pulls, installs, builds, and reloads Caddy. The build runs the SEO audit,
# so a broken canonical or a dead internal link aborts the deploy instead of
# going live — that is the point of doing it in this order.
#
# The site is static: the only thing that ends up being served is dist/.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

command -v node >/dev/null || die "node is not installed. Node 20 or later is required."
command -v npm  >/dev/null || die "npm is not installed."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node $NODE_MAJOR is too old. Node 20 or later is required."

# ─── 1. Pull ─────────────────────────────────────────────────────────────────
if [ -d .git ]; then
  say "Pulling latest"
  git pull --ff-only
else
  say "Not a git checkout — skipping pull"
fi

# ─── 2. Install ──────────────────────────────────────────────────────────────
# `npm ci` not `npm install`: it installs exactly what package-lock.json says
# and fails if the lockfile is out of sync, so a deploy can never silently pick
# up a different dependency version than the one that was tested.
say "Installing dependencies"
npm ci

# ─── 3. Build ────────────────────────────────────────────────────────────────
# This runs `astro build` followed by scripts/audit-seo.mjs. The audit is a
# hard gate: duplicate titles, missing canonicals, broken internal links or a
# page missing from the sitemap all exit non-zero, and `set -e` stops here.
say "Building (includes the SEO audit)"
npm run build

[ -f dist/index.html ] || die "Build produced no dist/index.html"
[ -f dist/404.html ]   || die "Build produced no dist/404.html — the 404 route is missing"

# ─── 4. Reload the server ────────────────────────────────────────────────────
# Caddy serves dist/ directly from disk, so new files are live the moment the
# build finishes. The reload only re-reads the Caddyfile, which matters when
# deploy/Caddyfile itself changed in this pull.
if command -v caddy >/dev/null && systemctl is-active --quiet caddy 2>/dev/null; then
  say "Reloading Caddy"
  sudo caddy reload --config "$ROOT/deploy/Caddyfile" --force
else
  say "Caddy is not running as a service — skipping reload"
  echo "  Files in dist/ are already live if a server is pointed at them."
  echo "  First-time setup: docs/vps-deploy.md"
fi

say "Deployed"
echo "  $(find dist -name '*.html' | wc -l | tr -d ' ') HTML pages built into $ROOT/dist"
