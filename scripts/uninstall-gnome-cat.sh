#!/usr/bin/env bash
# Removes the Charger Cat GNOME Shell extension.
set -euo pipefail
UUID="charger-cat@jaisudhakar.github.io"
gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
enabled="$(gsettings get org.gnome.shell enabled-extensions)"
enabled="$(printf '%s' "$enabled" | sed -E "s/, *'$UUID'|'$UUID', *|'$UUID'//")"
gsettings set org.gnome.shell enabled-extensions "$enabled"
rm -rf "$HOME/.local/share/gnome-shell/extensions/$UUID"
echo "Charger Cat removed. Log out and back in to clear it from the top bar."
