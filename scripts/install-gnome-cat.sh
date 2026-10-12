#!/usr/bin/env bash
# Installs Charger Cat: a GNOME Shell extension that shows an animated 3D cat right next
# to Ubuntu's own battery icon while the charger is plugged in. No sudo needed.
#
#   curl -fsSL https://raw.githubusercontent.com/jaisudhakar/charger-pet/HEAD/scripts/install-gnome-cat.sh | bash
#   … | bash -s -- smokey        # pick a cat: ginger (default), smokey or snowball
set -euo pipefail

REPO="jaisudhakar/charger-pet"
UUID="charger-cat@jaisudhakar.github.io"
COAT="${1:-ginger}"

case "$COAT" in
  ginger|smokey|snowball) ;;
  *) echo "Unknown cat '$COAT'. Use ginger, smokey or snowball." >&2; exit 1 ;;
esac

if ! command -v gnome-shell >/dev/null 2>&1; then
  echo "Charger Cat needs the GNOME desktop (Ubuntu's default desktop)." >&2
  exit 1
fi
version="$(gnome-shell --version | grep -oE '[0-9]+' | head -n1)"
if [ "$version" -lt 42 ]; then
  echo "GNOME $version is too old; Charger Cat needs GNOME 42 or newer (Ubuntu 22.04+)." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Use this checkout when run from the repository, otherwise download it.
src=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  [ -f "$here/gnome-extension/$UUID/metadata.json" ] && src="$here/gnome-extension"
fi
if [ -z "$src" ]; then
  echo "==> Downloading Charger Cat…"
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/HEAD" | tar -xz -C "$tmp"
  src="$(echo "$tmp"/*/gnome-extension)"
fi

echo "==> Installing the extension for GNOME $version…"
dest="$HOME/.local/share/gnome-shell/extensions/$UUID"
rm -rf "$dest"
mkdir -p "$dest"
cp -r "$src/$UUID/." "$dest/"
if [ "$version" -lt 45 ]; then
  # GNOME 42–44 use the older extension format.
  cp "$src/legacy/extension.js" "$src/legacy/metadata.json" "$dest/"
fi
echo "$COAT" > "$dest/coat"

echo "==> Turning it on…"
gsettings set org.gnome.shell disable-user-extensions false
enabled="$(gsettings get org.gnome.shell enabled-extensions)"
if ! printf '%s' "$enabled" | grep -q "$UUID"; then
  case "$enabled" in
    "@as []"|"[]") enabled="['$UUID']" ;;
    *) enabled="${enabled%]}, '$UUID']" ;;
  esac
  gsettings set org.gnome.shell enabled-extensions "$enabled"
fi
gnome-extensions enable "$UUID" >/dev/null 2>&1 || true

echo
if gnome-extensions info "$UUID" 2>/dev/null | grep -qiE 'state: *(active|enabled)'; then
  echo "Done! Plug in your charger: the cat runs next to the battery icon in the top bar."
else
  echo "Installed! Log out and log back in once, then plug in your charger:"
  echo "the cat runs next to the battery icon in the top bar while charging,"
  echo "and sits beside it when the battery is full."
fi
if command -v charger-pet >/dev/null 2>&1; then
  echo
  echo "You don't need the older Charger Pet tray app any more. Remove it with:"
  echo "  sudo apt remove charger-pet"
fi
