#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = require(path.join(projectRoot, 'package.json'));

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

function toFileUrl(filePath) {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  return `file://${normalized}`;
}

function sha256ForFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const args = parseArgs(process.argv.slice(2));
const outputPath = path.resolve(args.output || path.join(projectRoot, 'Formula', 'kakao-auto.rb'));
const version = args.version || packageJson.version;
const homepage = args.homepage || 'https://example.com/kakao-auto';

let url = args.url;
let sha256 = args.sha256;

if (args['local-archive']) {
  const archivePath = path.resolve(args['local-archive']);
  url = toFileUrl(archivePath);
  sha256 = sha256ForFile(archivePath);
}

if (!url || !sha256) {
  process.stderr.write(
    'Usage: node scripts/render-homebrew-formula.js --url <archive-url> --sha256 <sha256> [--homepage <url>] [--output <path>]\n' +
    '   or: node scripts/render-homebrew-formula.js --local-archive <tar.gz> [--homepage <url>] [--output <path>]\n'
  );
  process.exit(1);
}

const formula = `class KakaoAuto < Formula
  desc "macOS KakaoTalk automation CLI"
  homepage "${homepage}"
  url "${url}"
  sha256 "${sha256}"
  version "${version}"

  depends_on "node"
  depends_on :macos

  def install
    ENV["npm_config_cache"] = buildpath/"npm_cache"
    ENV["npm_config_omit"] = "optional"

    system "npm", "install", *std_npm_args
    bin.install_symlink libexec/"bin/kakao-auto"
  end

  def caveats
    <<~EOS
      KakaoTalk.app must be installed at /Applications/KakaoTalk.app.
      Accessibility permission is required for your terminal app.

      This Homebrew formula installs the CLI runtime only.
      If you need the Electron GUI, use the source checkout with:
        npm install --include=optional
        ./bin/kakao-auto gui
    EOS
  end

  test do
    assert_match "Usage: kakao-auto", shell_output("#{bin}/kakao-auto --help")
  end
end
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, formula);
process.stdout.write(`${outputPath}\n`);
