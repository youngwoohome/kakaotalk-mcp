'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const projectRoot = path.resolve(__dirname, '../..');
const sourcePath = path.join(projectRoot, 'native', 'KakaoMacNative.swift');
const buildDir = path.join(projectRoot, 'native', 'build');
const binaryPath = path.join(buildDir, 'kakao-mac-native');

function ensureBinary() {
  fs.mkdirSync(buildDir, { recursive: true });

  const sourceStat = fs.statSync(sourcePath);
  const binaryExists = fs.existsSync(binaryPath);
  const binaryStale = !binaryExists || fs.statSync(binaryPath).mtimeMs < sourceStat.mtimeMs;

  if (!binaryStale) {
    return binaryPath;
  }

  execFileSync('xcrun', [
    'swiftc',
    '-O',
    '-framework', 'AppKit',
    '-framework', 'ApplicationServices',
    sourcePath,
    '-o',
    binaryPath,
  ], {
    stdio: 'inherit',
  });

  return binaryPath;
}

async function runNativeHelper(args, options = {}) {
  const binary = ensureBinary();
  const result = await execFileAsync(binary, args, {
    timeout: options.timeoutMs || 0,
    maxBuffer: 1024 * 1024,
  });
  return (result.stdout || '').trim();
}

module.exports = {
  ensureBinary,
  runNativeHelper,
};
