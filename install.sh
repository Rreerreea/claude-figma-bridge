#!/usr/bin/env bash
# Claude Figma Bridge — install in one command (macOS / Linux):
#   curl -fsSL https://raw.githubusercontent.com/Rreerreea/claude-figma-bridge/main/install.sh | bash
#
# What it does:
#   1. puts the skill into ~/.claude/skills/figma-bridge (Claude Code picks it up after a restart)
#   2. puts the Figma plugin and the local server into ~/Documents/Claude Bridge
#   3. starts the server and shows the plugin's manifest.json in Finder
# Re-running updates everything in place. Settings: CLAUDE_SKILLS_DIR, FIGMA_BRIDGE_HOME, FIGMA_BRIDGE_PORT, NO_OPEN=1,
# NO_PRANK=1 (skip the little joke at the start: extras/bsod.js — a fake blue screen for a few seconds, then "just kidding").
set -euo pipefail

REPO_TARBALL="https://github.com/Rreerreea/claude-figma-bridge/archive/refs/heads/main.tar.gz"
SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
export FIGMA_BRIDGE_HOME="${FIGMA_BRIDGE_HOME:-$HOME/Documents/Claude Bridge}"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "✗ Не найден $1. Поставьте: $2 — и запустите установку еще раз." >&2
    exit 1
  fi
}
need node "https://nodejs.org (версия LTS)"
need python3 "https://www.python.org/downloads/"

# take the files from this checkout if the script runs inside it, otherwise download the repository
SRC=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/plugins/figma-bridge/skills/figma-bridge/SKILL.md" ]; then
  SRC="$SCRIPT_DIR"
else
  need curl "https://curl.se"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  curl -fsSL "$REPO_TARBALL" | tar -xz -C "$TMP"
  SRC="$(find "$TMP" -maxdepth 1 -mindepth 1 -type d | head -1)"
fi

# 0. a small joke on macOS (a few seconds, closes itself; NO_PRANK=1 skips it)
prank() {
  [ "${NO_PRANK:-0}" = "1" ] && return 0
  [ "$(uname -s)" = "Darwin" ] || return 0
  command -v osascript >/dev/null 2>&1 || return 0
  [ -f "$SRC/extras/bsod.js" ] || return 0
  osascript -l JavaScript "$SRC/extras/bsod.js" >/dev/null 2>&1 &
  local pid=$!
  ( sleep 12; kill "$pid" 2>/dev/null ) >/dev/null 2>&1 &
  wait "$pid" 2>/dev/null || true
  echo "😄 Это была шутка. Ставлю фигма-мост…"
}
prank

# 1. skill
mkdir -p "$SKILLS_DIR"
rm -rf "$SKILLS_DIR/figma-bridge"
cp -R "$SRC/plugins/figma-bridge/skills/figma-bridge" "$SKILLS_DIR/figma-bridge"
echo "✓ скилл: $SKILLS_DIR/figma-bridge"

# 2–3. bridge files + server
python3 "$SKILLS_DIR/figma-bridge/scripts/setup.py" install >/dev/null
echo "✓ плагин и сервер: $FIGMA_BRIDGE_HOME"
python3 "$SKILLS_DIR/figma-bridge/scripts/setup.py" start
if [ "${NO_OPEN:-0}" != "1" ]; then
  python3 "$SKILLS_DIR/figma-bridge/scripts/setup.py" open >/dev/null 2>&1 || true
fi

cat <<EOF

Готово. Осталось два шага:

1. Figma (приложение для компьютера): Plugins → Development → Import plugin from manifest…
   → Документы → Claude Bridge → manifest.json
   (папка уже открыта в Finder; это нужно сделать один раз)

2. Перезапустите Claude Code. Потом откройте свой файл в Figma, запустите
   Plugins → Development → Claude Bridge и напишите Claude задачу.

Инструкция: https://github.com/Rreerreea/claude-figma-bridge/blob/main/ИНСТРУКЦИЯ.md
EOF
