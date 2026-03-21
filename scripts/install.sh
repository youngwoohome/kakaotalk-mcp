#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="cli"

for arg in "$@"; do
  case "$arg" in
    --gui)
      MODE="gui"
      ;;
    --cli)
      MODE="cli"
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/install.sh [--cli] [--gui]

Defaults to CLI-only installation.
  --cli   Install runtime without optional GUI dependencies
  --gui   Install runtime including Electron GUI dependencies
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$PROJECT_ROOT"

if [[ "$MODE" == "gui" ]]; then
  npm install --include=optional
  echo "Installed CLI + GUI dependencies."
else
  npm install --omit=optional
  echo "Installed CLI-only dependencies."
fi
