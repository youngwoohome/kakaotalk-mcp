#!/usr/bin/env node
'use strict';

// Only run on macOS - skip silently on other platforms
if (process.platform !== 'darwin') {
  process.stdout.write('kakaotalk-cli: skipping Swift build (macOS only)\n');
  process.exit(0);
}

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(projectRoot, 'native', 'KakaoMacNative.swift');
const buildDir = path.join(projectRoot, 'native', 'build');
const binaryPath = path.join(buildDir, 'kakaotalk-native');

// Skip if binary is up to date
if (fs.existsSync(binaryPath)) {
  const srcMtime = fs.statSync(sourcePath).mtimeMs;
  const binMtime = fs.statSync(binaryPath).mtimeMs;
  if (binMtime >= srcMtime) {
    process.stdout.write('kakaotalk-cli: native binary is up to date\n');
    process.exit(0);
  }
}

process.stdout.write('kakaotalk-cli: building native Swift helper...\n');

try {
  fs.mkdirSync(buildDir, { recursive: true });
  execFileSync('xcrun', [
    'swiftc', '-O',
    '-framework', 'AppKit',
    '-framework', 'ApplicationServices',
    sourcePath,
    '-o', binaryPath,
  ], { stdio: 'inherit' });
  process.stdout.write('kakaotalk-cli: native build complete\n');
} catch (error) {
  process.stderr.write(`kakaotalk-cli: native build failed (${error.message})\n`);
  process.stderr.write('You may need Xcode Command Line Tools: xcode-select --install\n');
  // Don't exit with error — CLI still works via AppleScript fallback
}
