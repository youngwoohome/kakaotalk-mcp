'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const SERVER_NAME = 'kakaotalk';

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

  const commandName = path.basename(process.argv[1] || 'kakotalk-mcp');
  process.stdout.write(`MCP 서버 등록 중: ${commandName} serve\n`);

  execFileSync('claude', ['mcp', 'add', SERVER_NAME, '-s', 'user', '--', commandName, 'serve'], {
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
  const commandName = path.basename(process.argv[1] || 'kakotalk-mcp');

  process.stdout.write(
    [
      `Usage: ${commandName} <subcommand>`,
      '',
      'Subcommands:',
      '  install    Claude Code에 kakaotalk MCP 서버를 등록합니다',
      '  remove     Claude Code에서 kakaotalk MCP 서버를 제거합니다',
      '  serve      MCP 서버를 stdio로 실행합니다 (Claude Code 내부 실행용)',
      '',
      'Examples:',
      `  ${commandName} install`,
      `  ${commandName} remove`,
    ].join('\n') + '\n'
  );
}

function main() {
  const sub = process.argv[2] || '';

  if (sub === 'install') {
    install();
  } else if (sub === 'remove' || sub === 'uninstall') {
    remove();
  } else if (sub === '' || sub === 'help' || sub === '--help' || sub === '-h') {
    printHelp();
  } else {
    printHelp();
    process.exit(1);
  }
}

main();
