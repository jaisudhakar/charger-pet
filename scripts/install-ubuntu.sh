#!/usr/bin/env bash
# Installs Cursor Cat on Ubuntu (GNOME): a cat that chases your mouse pointer.
# No sudo needed. Works on Wayland and X11 (GNOME 42+, Ubuntu 22.04 and newer).
#
#   curl -fsSL https://raw.githubusercontent.com/jaisudhakar/charger-pet/HEAD/scripts/install-ubuntu.sh | bash
#   … | bash -s -- smokey large      # cat: ginger|smokey|snowball  size: small|medium|large
set -euo pipefail

REPO="jaisudhakar/charger-pet"
UUID="cursor-cat@jaisudhakar.github.io"
COAT="${1:-ginger}"
SIZE_NAME="${2:-medium}"

case "$COAT" in
  ginger|smokey|snowball) ;;
  *) echo "Unknown cat '$COAT'. Use ginger, smokey or snowball." >&2; exit 1 ;;
esac
case "$SIZE_NAME" in
  small) SIZE=56 ;;
  medium) SIZE=72 ;;
  large) SIZE=96 ;;
  *) echo "Unknown size '$SIZE_NAME'. Use small, medium or large." >&2; exit 1 ;;
esac

if ! command -v gnome-shell >/dev/null 2>&1; then
  echo "Cursor Cat for Ubuntu needs the GNOME desktop (Ubuntu's default desktop)." >&2
  exit 1
fi
version="$(gnome-shell --version | grep -oE '[0-9]+' | head -n1)"
if [ "$version" -lt 42 ]; then
  echo "GNOME $version is too old; Cursor Cat needs GNOME 42 or newer (Ubuntu 22.04+)." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Use this checkout when run from the repository, otherwise download it.
src=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  [ -f "$here/gnome/$UUID/metadata.json" ] && src="$here"
fi
if [ -z "$src" ]; then
  echo "==> Downloading Cursor Cat…"
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/HEAD" | tar -xz -C "$tmp"
  src="$(echo "$tmp"/*)"
fi

extensions="$HOME/.local/share/gnome-shell/extensions"

# Remove the earlier Charger Cat extension from this project, if present.
OLD="charger-cat@jaisudhakar.github.io"
if [ -d "$extensions/$OLD" ]; then
  echo "==> Removing the old Charger Cat extension…"
  gnome-extensions disable "$OLD" >/dev/null 2>&1 || true
  rm -rf "${extensions:?}/$OLD"
fi

echo "==> Installing Cursor Cat for GNOME $version…"
dest="$extensions/$UUID"
rm -rf "$dest"
mkdir -p "$dest/sprites"
cp -r "$src/gnome/$UUID/." "$dest/"
if [ "$version" -lt 45 ]; then
  # GNOME 42–44 use the older extension format.
  cp "$src/gnome/legacy/extension.js" "$src/gnome/legacy/metadata.json" "$dest/"
fi
cp "$src/sprites/$COAT/"*.png "$dest/sprites/"
# Newer GNOME releases than this version lists: allow the running one too (the
# extension only uses long-stable GNOME Shell APIs).
if ! grep -q "\"$version\"" "$dest/metadata.json"; then
  sed -i "s/\"shell-version\": \[/\"shell-version\": [ \"$version\",/" "$dest/metadata.json"
fi
printf '{"coat": "%s", "size": %s, "speed": 1}\n' "$COAT" "$SIZE" > "$dest/config.json"

echo "==> Turning it on…"
gsettings set org.gnome.shell disable-user-extensions false
enabled="$(gsettings get org.gnome.shell enabled-extensions)"
enabled="$(printf '%s' "$enabled" | sed -E "s/, *'$OLD'|'$OLD', *|'$OLD'//")"
if ! printf '%s' "$enabled" | grep -q "$UUID"; then
  case "$enabled" in
    "@as []"|"[]") enabled="['$UUID']" ;;
    *) enabled="${enabled%]}, '$UUID']" ;;
  esac
fi
gsettings set org.gnome.shell enabled-extensions "$enabled"
gnome-extensions enable "$UUID" >/dev/null 2>&1 || true

echo
if gnome-extensions info "$UUID" 2>/dev/null | grep -qiE 'state: *(active|enabled)'; then
  echo "Done! Move your mouse: the cat chases the pointer."
else
  echo "Installed! Log out and log back in once, then move your mouse:"
  echo "the cat chases the pointer, and naps when you leave it alone."
fi
