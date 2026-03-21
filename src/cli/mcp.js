'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVER_NAME = 'kakaotalk';

function getMcpBinaryPath() {
  // Resolve kakao-mcp path relative to this script (bin/ is next to src/)
  const projectRoot = path.resolve(__dirname, '../..');
  const binPath = path.join(projectRoot, 'bin', 'kakao-mcp');
  if (fs.existsSync(binPath)) {
    return binPath;
  }

  // Fallback: look for kakao-mcp next to kakao-auto in PATH
  const kakaoAutoPath = process.argv[1];
  if (kakaoAutoPath) {
    const siblingPath = path.join(path.dirname(kakaoAutoPath), 'kakao-mcp');
    if (fs.existsSync(siblingPath)) {
      return siblingPath;
    }
  }

  throw new Error('kakao-mcp 바이너리를 찾지 못했습니다.');
}

function checkClaudeCli() {
  try {
    execFileSync('claude', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function install() {
  if (!checkClaudeCli()) {
    process.stderr.write('Claude Code CLI가 설치되어 있지 않습니다.\nhttps://claude.ai/code 에서 설치하세요.\n');
    process.exit(1);
  }

  const mcpBin = getMcpBinaryPath();
  process.stdout.write(`MCP 서버 등록 중: ${mcpBin}\n`);

  execFileSync('claude', ['mcp', 'add', SERVER_NAME, '-s', 'user', '--', 'node', mcpBin], {
    stdio: 'inherit',
  });

  process.stdout.write(`\n완료! Claude Code를 재시작하면 kakaotalk MCP 도구가 활성화됩니다.\n`);
  process.stdout.write(`사용 가능한 도구: list_rooms, find_room, send_message, analyze_room\n`);
}

function remove() {
  if (!checkClaudeCli()) {
    process.stderr.write('Claude Code CLI가 설치되어 있지 않습니다.\n');
    process.exit(1);
  }

  process.stdout.write(`MCP 서버 제거 중: ${SERVER_NAME}\n`);

  execFileSync('claude', ['mcp', 'remove', SERVER_NAME, '-s', 'user'], {
    stdio: 'inherit',
  });

  process.stdout.write(`\n완료! kakaotalk MCP 서버가 Claude Code에서 제거되었습니다.\n`);
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: kakao-auto mcp <subcommand>',
      '',
      'Subcommands:',
      '  install    Claude Code에 kakaotalk MCP 서버를 등록합니다',
      '  remove     Claude Code에서 kakaotalk MCP 서버를 제거합니다',
      '',
      'Examples:',
      '  kakao-auto mcp install',
      '  kakao-auto mcp remove',
    ].join('\n') + '\n'
  );
}

function main() {
  const sub = process.argv[3] || '';

  if (sub === 'install') {
    install();
  } else if (sub === 'remove' || sub === 'uninstall') {
    remove();
  } else {
    printHelp();
    if (sub) {
      process.exit(1);
    }
  }
}

main();
