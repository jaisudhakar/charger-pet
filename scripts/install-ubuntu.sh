#!/usr/bin/env bash
# Installs (or updates) Charger Pet on Ubuntu/Debian from the latest GitHub release,
# makes sure the top bar can show app icons, and starts the cat.
#
#   curl -fsSL https://raw.githubusercontent.com/jaisudhakar/charger-pet/HEAD/scripts/install-ubuntu.sh | bash
set -euo pipefail

REPO="jaisudhakar/charger-pet"

arch="$(dpkg --print-architecture)"
if [ "$arch" != "amd64" ]; then
  echo "Sorry, only 64-bit Intel/AMD (amd64) builds are available; this machine is $arch." >&2
  exit 1
fi

echo "==> Finding the latest Charger Pet release…"
url="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep -o '"browser_download_url": *"[^"]*_amd64\.deb"' | head -n1 | cut -d'"' -f4)"
if [ -z "$url" ]; then
  echo "Could not find a .deb in the latest release of $REPO." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
chmod 755 "$tmp" # apt's sandbox user needs to read the package

echo "==> Downloading $(basename "$url")…"
curl -fL --progress-bar -o "$tmp/charger-pet.deb" "$url"
chmod 644 "$tmp/charger-pet.deb"

echo "==> Installing (you may be asked for your password)…"
sudo apt-get install -y "$tmp/charger-pet.deb"

# Ubuntu shows app icons in the top bar through the AppIndicator extension.
relogin=0
if command -v gnome-extensions >/dev/null 2>&1; then
  if ! gnome-extensions list --enabled 2>/dev/null | grep -qi appindicator; then
    uuid="$(gnome-extensions list 2>/dev/null | grep -i appindicator | head -n1 || true)"
    if [ -z "$uuid" ]; then
      echo "==> Installing top-bar icon support (AppIndicator extension)…"
      sudo apt-get install -y gnome-shell-extension-appindicator
      uuid="$(gnome-extensions list 2>/dev/null | grep -i appindicator | head -n1 || true)"
      relogin=1
    fi
    if [ -n "$uuid" ]; then
      echo "==> Turning on top-bar icon support ($uuid)…"
      gnome-extensions enable "$uuid" || relogin=1
    else
      relogin=1
    fi
  fi
fi

echo "==> Starting Charger Pet…"
nohup charger-pet >/dev/null 2>&1 &

echo
echo "Done! The cat window pops up for a few seconds, then the cat lives in the top bar"
echo "next to the battery icon. Open it any time from your app menu: \"Charger Pet\"."
if [ "$relogin" = 1 ]; then
  echo
  echo "Note: log out and back in once so the top bar can show the cat icon."
fi
