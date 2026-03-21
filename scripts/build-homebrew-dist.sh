#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
VERSION="$(node -p "require('$PROJECT_ROOT/package.json').version")"
ARCHIVE_NAME="kakao-auto-${VERSION}.tar.gz"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/kakao-auto-brew.XXXXXX")"
ARCHIVE_PATH="$DIST_DIR/$ARCHIVE_NAME"

mkdir -p "$DIST_DIR"
trap 'rm -rf "$STAGE_DIR"' EXIT

rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  --exclude 'native/build' \
  "$PROJECT_ROOT/" "$STAGE_DIR/source/"

tar -czf "$ARCHIVE_PATH" -C "$STAGE_DIR/source" .

echo "archive=$ARCHIVE_PATH"
shasum -a 256 "$ARCHIVE_PATH"
