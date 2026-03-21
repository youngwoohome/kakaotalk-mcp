'use strict';

const { createMacAutomationDriver } = require('../macos/automation-driver');
const { extractFocusKeywords, buildMessageAnalysis } = require('../analysis/message-analysis');

function parseArgs(argv) {
  const result = {
    room: '',
    limit: 80,
    focus: '중요한 내용 자동 선별',
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--json') {
      result.json = true;
      continue;
    }

    if (token === '--room') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('--room 뒤에 채팅방 이름이 필요합니다.');
      }
      result.room = next.trim();
      index += 1;
      continue;
    }

    if (token === '--limit') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('--limit 뒤에 숫자가 필요합니다.');
      }
      result.limit = Math.min(400, Math.max(1, Number(next) || 80));
      index += 1;
      continue;
    }

    if (token === '--focus') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('--focus 뒤에 분석 목적이 필요합니다.');
      }
      result.focus = next.trim();
      index += 1;
    }
  }

  if (!result.room) {
    throw new Error('분석할 채팅방 이름을 `--room`으로 전달해야 합니다.');
  }

  return result;
}

function buildSummary(result) {
  const summary = [];
  summary.push(`방: ${result.roomName}`);
  summary.push(`분석 목표: ${result.focus.text}`);
  summary.push(`요청 행 수: ${result.requestedRows}`);
  summary.push(`실제 추출 행 수: ${result.collectedRows}`);
  summary.push(`링크 포함 행: ${result.linkCount}`);
  summary.push(`연락처 포함 행: ${result.contactCount}`);

  if (result.crawl?.stopReason && result.collectedRows < result.requestedRows) {
    summary.push(`주의: 목표만큼 못 읽음 (${result.crawl.stopReason})`);
  }

  return summary;
}

function printReadable(result) {
  process.stdout.write(`${buildSummary(result).join('\n')}\n\n`);

  process.stdout.write('핵심 하이라이트\n');
  if (result.highlights.length === 0) {
    process.stdout.write('- 자동 선별된 항목 없음\n\n');
  } else {
    for (const [index, row] of result.highlights.entries()) {
      process.stdout.write(`${index + 1}. ${row.text}\n\n`);
    }
  }

  process.stdout.write('최근 원문 일부\n');
  if (result.tailRows.length === 0) {
    process.stdout.write('- 없음\n');
    return;
  }

  for (const row of result.tailRows) {
    process.stdout.write(`- ${row.text}\n`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const driver = createMacAutomationDriver();
  const focus = {
    text: options.focus,
    keywords: extractFocusKeywords(options.focus),
  };

  const crawlResult = options.limit > 80
    ? await driver.crawlRoomHistory(options.room, {
        targetRows: options.limit,
        pageSize: Math.min(32, Math.max(18, Math.floor(options.limit / 6))),
        maxScrolls: Math.min(80, Math.max(16, Math.ceil(options.limit / 4))),
      })
    : { rows: await driver.readRoomMessages(options.room, options.limit), crawl: null };

  const analysis = buildMessageAnalysis(crawlResult.rows, focus);
  const result = {
    roomName: options.room,
    requestedRows: options.limit,
    collectedRows: crawlResult.rows.length,
    focus,
    linkCount: analysis.linkRows.length,
    contactCount: analysis.contactRows.length,
    highlights: analysis.highlights,
    tailRows: analysis.rawRows.slice(-8),
    crawl: crawlResult.crawl,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  printReadable(result);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
