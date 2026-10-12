#!/usr/bin/env bash
# Prints why Cursor Cat is or isn't running on Ubuntu (GNOME). Paste the output when
# asking for help:
#   curl -fsSL https://raw.githubusercontent.com/jaisudhakar/charger-pet/HEAD/scripts/check-ubuntu.sh | bash
UUID="cursor-cat@jaisudhakar.github.io"
dir="$HOME/.local/share/gnome-shell/extensions/$UUID"
echo "Ubuntu:            $(lsb_release -ds 2>/dev/null || grep PRETTY_NAME /etc/os-release | cut -d= -f2)"
echo "Desktop/session:   ${XDG_CURRENT_DESKTOP:-?} / ${XDG_SESSION_TYPE:-?}"
echo "GNOME Shell:       $(gnome-shell --version 2>/dev/null || echo 'not found')"
echo "Installed:         $([ -f "$dir/extension.js" ] && echo yes || echo NO)"
[ -f "$dir/metadata.json" ] && echo "Supports GNOME:    $(tr -d '\n ' < "$dir/metadata.json" | grep -o '"shell-version":\[[^]]*\]')"
[ -f "$dir/config.json" ] && echo "Config:            $(cat "$dir/config.json")"
echo "Sprites:           $(ls "$dir/sprites" 2>/dev/null | wc -l) frames"
echo "User extensions:   $(gsettings get org.gnome.shell disable-user-extensions 2>/dev/null | sed 's/true/DISABLED/; s/false/allowed/')"
echo "Enabled list:      $(gsettings get org.gnome.shell enabled-extensions 2>/dev/null | grep -q "$UUID" && echo 'contains Cursor Cat' || echo 'MISSING Cursor Cat')"
echo "--- gnome-extensions info ---"
gnome-extensions info "$UUID" 2>&1 | sed 's/^/  /'
echo "--- recent GNOME Shell errors about the extension ---"
journalctl --user -b --no-pager -o cat 2>/dev/null | grep -iE "cursor-cat|cursor cat|CursorCat" | tail -n 15 | sed 's/^/  /'
journalctl -b --no-pager -o cat /usr/bin/gnome-shell 2>/dev/null | grep -iE "cursor-cat|CursorCat" | tail -n 15 | sed 's/^/  /'
echo "--- what to do ---"
info="$(gnome-extensions info "$UUID" 2>&1)"
if [ ! -f "$dir/extension.js" ]; then
  echo "  Cursor Cat is not installed (or was removed). Install it, then log out and back in:"
  echo "  curl -fsSL https://raw.githubusercontent.com/jaisudhakar/charger-pet/HEAD/scripts/install-ubuntu.sh | bash"
elif ! gsettings get org.gnome.shell enabled-extensions 2>/dev/null | grep -q "$UUID"; then
  echo "  Installed but switched off. Run the install command again, then log out and back in."
elif printf '%s' "$info" | grep -qi "doesn't exist\|does not exist"; then
  echo "  Installed and switched on, but GNOME hasn't loaded it yet: log out and log back in."
elif printf '%s' "$info" | grep -qiE "failed to connect|not running|cannot autolaunch|no such interface"; then
  echo "  Couldn't reach GNOME Shell. Run this check from a terminal inside your Ubuntu desktop."
elif printf '%s' "$info" | grep -qiE 'state: *(active|enabled)'; then
  echo "  Cursor Cat is running. Move the mouse; the cat chases the pointer."
else
  echo "  GNOME reports a problem (see the info and errors above). Send this whole output."
fi
