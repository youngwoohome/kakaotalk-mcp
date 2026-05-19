#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for arg in "$@"; do
  case "$arg" in
    --cli)
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/install.sh [--cli]

Installs CLI/MCP runtime dependencies.
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
npm install
echo "Installed CLI/MCP dependencies."
