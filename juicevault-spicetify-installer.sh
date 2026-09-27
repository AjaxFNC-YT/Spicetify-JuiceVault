#!/usr/bin/env sh
set -e

API="https://api.juicevault.xyz"
CHANNEL="${JV_CHANNEL:-stable}"
APP="juicevault"
ZIP=""
UNINSTALL=0

for arg in "$@"; do
	case "$arg" in
		--uninstall) UNINSTALL=1 ;;
		*.zip) ZIP="$arg" ;;
	esac
done

say() { printf '%s\n' "$1"; }
fail() { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

SPICETIFY="$(command -v spicetify 2>/dev/null || true)"
[ -z "$SPICETIFY" ] && [ -x "$HOME/.spicetify/spicetify" ] && SPICETIFY="$HOME/.spicetify/spicetify"
[ -z "$SPICETIFY" ] && fail "Spicetify isn't installed. Install it from https://spicetify.app first, then run this again."

has_entry() { "$SPICETIFY" config "$1" | tr '|' '\n' | tr -d ' ' | grep -qx "$2"; }

ROOT="$(dirname "$("$SPICETIFY" -c)")"
APP_DIR="$ROOT/CustomApps/$APP"

for legacy in JuiceVault.js juicevault.js; do
	if has_entry extensions "$legacy"; then
		"$SPICETIFY" config extensions "$legacy-" >/dev/null
		say "Removed the old JuiceVault extension from Spicetify"
	fi
done
rm -f "$ROOT/Extensions/JuiceVault.js"

if [ "$UNINSTALL" = 1 ]; then
	has_entry custom_apps "$APP" && "$SPICETIFY" config custom_apps "$APP-" >/dev/null
	rm -rf "$APP_DIR"
	"$SPICETIFY" apply >/dev/null
	say "JuiceVault was removed. Restart Spotify if it's open."
	exit 0
fi

SOURCE=""
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd || true)"

if [ -n "$ZIP" ]; then
	command -v unzip >/dev/null || fail "unzip is needed. Install it with your package manager and try again."
	unzip -q "$ZIP" -d "$WORK"
elif [ -n "$HERE" ] && [ -f "$HERE/$APP/index.js" ]; then
	SOURCE="$HERE/$APP"
else
	command -v curl >/dev/null || fail "curl is needed. Install it with your package manager and try again."
	command -v unzip >/dev/null || fail "unzip is needed. Install it with your package manager and try again."
	say "Downloading the latest JuiceVault release..."
	INFO="$(curl -fsSL "$API/misc/spicetify/versions?channel=$CHANNEL")"
	URL="$(printf '%s' "$INFO" | tr ',' '\n' | grep '"downloadUrl"' | head -n 1 | sed 's/.*"downloadUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"
	[ -z "$URL" ] && fail "No JuiceVault release is available yet."
	curl -fsSL "$API$URL" -o "$WORK/JuiceVault.zip"
	unzip -q "$WORK/JuiceVault.zip" -d "$WORK"
fi

if [ -z "$SOURCE" ]; then
	FOUND="$(find "$WORK" -name index.js -type f | while read -r file; do [ -f "$(dirname "$file")/extension.js" ] && dirname "$file" && break; done)"
	[ -z "$FOUND" ] && fail "Couldn't find the JuiceVault files in that package."
	SOURCE="$FOUND"
fi

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
cp "$SOURCE/index.js" "$SOURCE/extension.js" "$SOURCE/manifest.json" "$APP_DIR/"
say "Copied JuiceVault to $APP_DIR"

has_entry custom_apps "$APP" || "$SPICETIFY" config custom_apps "$APP" >/dev/null

say "Applying Spicetify..."
"$SPICETIFY" apply >/dev/null
printf '\033[32m%s\033[0m\n' "JuiceVault is installed. Restart Spotify and open it from the button in the top bar."
