#!/usr/bin/env bash
#
# Assembles a Foundry /data dir for the Quench CI run: the built OSE system
# masqueraded as "ose" v999.0.0-dev (like release.yml), the latest Quench
# release, and a bare "quench-ci" world fixture. Foundry itself and the license
# are handled by the felddy container at boot, not here.
#
# Usage: setup-data-dir.sh <data-dir> <repo-root>   (repo-root/dist must be built)
set -euo pipefail

DATA_DIR="${1:?usage: setup-data-dir.sh <data-dir> <repo-root>}"
REPO="${2:?usage: setup-data-dir.sh <data-dir> <repo-root>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SYS_DIR="$DATA_DIR/Data/systems/ose"
MOD_DIR="$DATA_DIR/Data/modules/quench"
WORLD_DIR="$DATA_DIR/Data/worlds/quench-ci"

echo "==> Preparing data dir at $DATA_DIR"
mkdir -p "$SYS_DIR" "$MOD_DIR" "$WORLD_DIR" "$DATA_DIR/container_cache"

if [[ ! -f "$REPO/dist/ose.js" ]]; then
  echo "ERROR: $REPO/dist/ose.js not found -- run 'npm run build' first." >&2
  exit 1
fi

echo "==> Installing masqueraded OSE system (id ose, version 999.0.0-dev)"
rm -rf "$SYS_DIR"
mkdir -p "$SYS_DIR"
cp -R "$REPO/dist" "$SYS_DIR/dist"
cp -R "$REPO/assets" "$SYS_DIR/assets"
cp "$REPO/template.json" "$SYS_DIR/template.json"

# Masquerade (mirrors release.yml): rewrite the dev id throughout dist (temp file = portable sed -i).
find "$SYS_DIR/dist" -type f -print0 | while IFS= read -r -d '' f; do
  sed 's/ose-dev/ose/g' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done
jq '.id = "ose" | .version = "999.0.0-dev" | .title = "Old-School Essentials (CI)"' \
  "$REPO/system.json" > "$SYS_DIR/system.json"

if grep -rlq "ose-dev" "$SYS_DIR/dist" 2>/dev/null; then
  echo "ERROR: stray 'ose-dev' references remain in dist after masquerade." >&2
  exit 1
fi

echo "==> Downloading latest Quench module"
QUENCH_MANIFEST="https://github.com/Ethaks/FVTT-Quench/releases/latest/download/module.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$QUENCH_MANIFEST" -o "$TMP/module.json"
QUENCH_DL="$(jq -r '.download' "$TMP/module.json")"
QUENCH_VER="$(jq -r '.version' "$TMP/module.json")"
echo "    Quench $QUENCH_VER -> $QUENCH_DL"
curl -fsSL "$QUENCH_DL" -o "$TMP/quench.zip"
unzip -oq "$TMP/quench.zip" -d "$TMP/quench"
rm -rf "$MOD_DIR"
mkdir -p "$MOD_DIR"
# module.json may be at the zip root or one level down.
if [[ -f "$TMP/quench/module.json" ]]; then
  cp -R "$TMP/quench/." "$MOD_DIR/"
else
  SUB="$(find "$TMP/quench" -maxdepth 2 -name module.json -print -quit)"
  cp -R "$(dirname "$SUB")/." "$MOD_DIR/"
fi
[[ -f "$MOD_DIR/module.json" ]] || { echo "ERROR: Quench module.json missing after extract." >&2; exit 1; }

echo "==> Installing minimal world fixture (quench-ci)"
# Foundry creates the LevelDB + a passwordless Gamemaster on first launch, so a bare world.json suffices.
cp "$HERE/fixtures/world/world.json" "$WORLD_DIR/world.json"

echo "==> Data dir ready:"
echo "    system:  $SYS_DIR  ($(jq -r '.id + " " + .version' "$SYS_DIR/system.json"))"
echo "    module:  $MOD_DIR  (quench $QUENCH_VER)"
echo "    world:   $WORLD_DIR (system $(jq -r '.system' "$WORLD_DIR/world.json"))"
