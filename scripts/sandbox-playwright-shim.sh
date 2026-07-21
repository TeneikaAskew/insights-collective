#!/usr/bin/env bash
# ABOUTME: Bridges the Lovable sandbox's preinstalled Chromium/Firefox builds
# ABOUTME: to the versioned paths Playwright expects, so `npx playwright test` runs without a browser download.
set -euo pipefail

# Discover installed sandbox builds
CHROMIUM_SRC=$(ls -d /chromium-* 2>/dev/null | grep -v headless_shell | head -n1 || true)
CHROMIUM_HS_SRC=$(ls -d /chromium_headless_shell-* 2>/dev/null | head -n1 || true)
FIREFOX_SRC=$(ls -d /firefox-* 2>/dev/null | head -n1 || true)

# Discover the versions Playwright wants
cd "$(dirname "$0")/.."
CHROMIUM_EXPECTED=$(node -e "console.log(require('@playwright/test').chromium.executablePath())" 2>/dev/null || true)
FIREFOX_EXPECTED=$(node -e "console.log(require('@playwright/test').firefox.executablePath())" 2>/dev/null || true)

link_chromium() {
  [[ -z "$CHROMIUM_SRC" || -z "$CHROMIUM_HS_SRC" || -z "$CHROMIUM_EXPECTED" ]] && return
  local target_dir hs_dir
  target_dir=$(echo "$CHROMIUM_EXPECTED" | sed -E 's#(/chromium-[0-9]+)/.*#\1#')
  hs_dir=$(echo "$CHROMIUM_EXPECTED" | sed -E 's#/chromium-([0-9]+)/.*#/chromium_headless_shell-\1#')
  if [[ ! -e "$CHROMIUM_EXPECTED" ]]; then
    rm -rf "$target_dir"
    mkdir -p "$target_dir"
    ln -sfn "$CHROMIUM_SRC/chrome-linux" "$target_dir/chrome-linux64"
  fi
  local hs_expected="$hs_dir/chrome-headless-shell-linux64/chrome-headless-shell"
  if [[ ! -e "$hs_expected" ]]; then
    rm -rf "$hs_dir"
    mkdir -p "$hs_dir/chrome-headless-shell-linux64"
    for f in "$CHROMIUM_HS_SRC"/chrome-linux/*; do
      ln -sfn "$f" "$hs_dir/chrome-headless-shell-linux64/$(basename "$f")"
    done
    ln -sfn "$CHROMIUM_HS_SRC/chrome-linux/headless_shell" "$hs_expected"
  fi
  echo "Chromium shim: $CHROMIUM_SRC -> $target_dir (+ headless shell)"
}

link_firefox() {
  [[ -z "$FIREFOX_SRC" || -z "$FIREFOX_EXPECTED" ]] && return
  local target_dir
  target_dir=$(echo "$FIREFOX_EXPECTED" | sed -E 's#(/firefox-[0-9]+)/.*#\1#')
  if [[ ! -e "$FIREFOX_EXPECTED" ]]; then
    ln -sfn "$FIREFOX_SRC" "$target_dir"
  fi
  echo "Firefox shim: $FIREFOX_SRC -> $target_dir"
}

link_chromium
link_firefox
