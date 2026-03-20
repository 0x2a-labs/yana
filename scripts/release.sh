#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Yana – release build, sign, and DMG packaging
#
# Usage:
#   ./scripts/release.sh                        # build + sign + notarize
#   ./scripts/release.sh --skip-notarize        # build + sign only (faster, local)
#   ./scripts/release.sh --profile <name>       # use a specific keychain profile
#
# Signing identity is auto-detected from the keychain.
# Override by setting APPLE_SIGNING_IDENTITY if you have multiple certs.
#
# Notarization credentials are read from the keychain via notarytool.
# Store them once with:
#   xcrun notarytool store-credentials "notarytool" \
#     --apple-id you@example.com \
#     --team-id XXXXXXXXXX \
#     --password xxxx-xxxx-xxxx-xxxx
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_NAME="Yana"
APP_BUNDLE="src-tauri/target/release/bundle/macos/${APP_NAME}.app"
OUT_DIR="dist"

SKIP_NOTARIZE=false
KEYCHAIN_PROFILE="notarytool"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-notarize) SKIP_NOTARIZE=true ;;
    --profile) KEYCHAIN_PROFILE="$2"; shift ;;
  esac
  shift
done

bold=$'\e[1m'; reset=$'\e[0m'; green=$'\e[32m'; red=$'\e[31m'; yellow=$'\e[33m'
step() { echo "${bold}${green}▶ $*${reset}"; }
warn() { echo "${bold}${yellow}⚠ $*${reset}"; }
die()  { echo "${bold}${red}✗ $*${reset}" >&2; exit 1; }

# ── Prereqs ───────────────────────────────────────────────────────────────────
step "Checking prerequisites"
command -v cargo  &>/dev/null || die "cargo not found"
command -v npm    &>/dev/null || die "npm not found"
command -v xcrun  &>/dev/null || die "xcrun not found (install Xcode Command Line Tools)"

if [[ "$SKIP_NOTARIZE" == false ]]; then
  xcrun notarytool history --keychain-profile "$KEYCHAIN_PROFILE" &>/dev/null \
    || die "Keychain profile '$KEYCHAIN_PROFILE' not found.\nRun: xcrun notarytool store-credentials \"$KEYCHAIN_PROFILE\" --apple-id you@example.com --team-id XXXXXXXXXX --password xxxx-xxxx-xxxx-xxxx"
fi

# ── Auto-detect signing identity ──────────────────────────────────────────────
step "Detecting signing identity"
if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  # Pick the first valid Developer ID Application cert from the keychain
  APPLE_SIGNING_IDENTITY=$(
    security find-identity -v -p codesigning \
      | grep "Developer ID Application" \
      | head -1 \
      | sed -E 's/.*"(.+)"/\1/'
  )
  [[ -n "$APPLE_SIGNING_IDENTITY" ]] \
    || die "No 'Developer ID Application' certificate found in keychain.\nInstall one from https://developer.apple.com/account/resources/certificates"
fi
echo "  Using: $APPLE_SIGNING_IDENTITY"

# ── Tauri release build ───────────────────────────────────────────────────────
step "Building Yana (release)"
export APPLE_SIGNING_IDENTITY
npm run tauri build -- --bundles app

[[ -d "$APP_BUNDLE" ]] || die "Build succeeded but .app not found at: $APP_BUNDLE"

# ── Create and sign DMG via create-dmg ───────────────────────────────────────
# create-dmg auto-detects the signing identity from the keychain —
# no explicit --sign flag needed.
step "Creating DMG"
mkdir -p "$OUT_DIR"

# Remove any stale DMG from a previous run (create-dmg refuses to overwrite)
rm -f "$OUT_DIR/${APP_NAME}"*.dmg

npx --yes create-dmg \
  --overwrite \
  "$APP_BUNDLE" \
  "$OUT_DIR"

DMG_PATH=$(find "$OUT_DIR" -name "*.dmg" | head -1)
[[ -n "$DMG_PATH" ]] || die "create-dmg did not produce a .dmg in $OUT_DIR"
echo "  Created: $DMG_PATH"

# ── Notarize ─────────────────────────────────────────────────────────────────
if [[ "$SKIP_NOTARIZE" == true ]]; then
  warn "Skipping notarization"
else
  step "Submitting to Apple Notary Service (this takes 1–5 min)"
  xcrun notarytool submit "$DMG_PATH" \
    --keychain-profile "$KEYCHAIN_PROFILE" \
    --wait \
    --progress

  step "Stapling notarization ticket"
  xcrun stapler staple "$DMG_PATH"
  xcrun stapler validate "$DMG_PATH"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "${bold}${green}✓ Done${reset}"
echo "  ${bold}$(pwd)/${DMG_PATH}${reset}  ($(du -sh "$DMG_PATH" | cut -f1))"
