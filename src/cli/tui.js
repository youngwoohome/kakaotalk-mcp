'use strict';

const fs = require('fs/promises');
const path = require('path');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');

const { createEngine } = require('../runtime/create-engine');
const { createMacAutomationDriver } = require('../macos/automation-driver');
const { getStoreDir, createConsoleLogger, createConsoleProgress } = require('./common');

const PAGE_SIZE = 6;
const ANALYSIS_KEYWORDS = [
  '안녕하세요',
  '개발',
  '서비스',
  '론칭',
  '출시',
  '마케팅',
  '고객',
  '소개',
  '피드백',
  '커피챗',
  '연락',
  '채용',
  '모집',
  '투자',
  'mrr',
  'revenue',
  'growth',
  'thread',
  'threads',
  'instagram',
  'homepage',
  '홈페이지',
];

const FOCUS_STOPWORDS = [
  '그리고',
  '또는',
  '중심',
  '위주',
  '기준',
  '내용',
  '관련',
  '정리',
  '요약',
  '분석',
  '해주세요',
  '해줘',
  '보기',
  '포인트',
  '대화',
  '메시지',
  '추출',
  '최근',
  '방',
];

function clearScreen() {
  stdout.write('\x1Bc');
}

function printHeader(title, subtitle = '') {
  clearScreen();
  stdout.write(`KakaoTalk Auto Mac CLI\n`);
  stdout.write(`${title}\n`);
  if (subtitle) {
    stdout.write(`${subtitle}\n`);
  }
  stdout.write('\n');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'room';
}

function formatRoomLine(index, room) {
  const number = String(index + 1).padStart(2, ' ');
  const activity = room.lastActivity ? ` | ${room.lastActivity}` : '';
  return `${number}. ${room.roomName}${activity}`;
}

function filterRooms(rooms, keyword) {
  const normalized = String(keyword || '').trim().toLowerCase();
  if (!normalized) {
    return rooms;
  }

  return rooms.filter((room) => room.roomName.toLowerCase().includes(normalized));
}

function parseSelection(input, max) {
  const result = new Set();
  const tokens = String(input || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      for (let value = from; value <= to; value += 1) {
        if (value >= 1 && value <= max) {
          result.add(value - 1);
        }
      }
      continue;
    }

    const numeric = Number(token);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= max) {
      result.add(numeric - 1);
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}

async function promptMultilineMessage(rl) {
  stdout.write('메시지를 입력하세요. 빈 줄 한 번으로 종료합니다.\n');
  const lines = [];

  while (true) {
    const line = await rl.question(lines.length === 0 ? '> ' : '. ');
    if (!line && lines.length > 0) {
      break;
    }
    if (!line && lines.length === 0) {
      return '';
    }
    lines.push(line);
  }

  return lines.join('\n');
}

async function chooseTargets(rl, driver) {
  let limit = PAGE_SIZE;
  let rooms = [];
  let filtered = rooms;

  while (true) {
    if (rooms.length === 0) {
      try {
        rooms = await driver.listChatRooms(limit);
        filtered = rooms;
      } catch (error) {
        printHeader('채팅방 로드 실패', `${error.message}\n`);
        const action = await rl.question('retry=다시 시도, more=개수 늘리기, quit=종료: ');
        if (action.trim() === 'more') {
          limit += PAGE_SIZE;
          continue;
        }
        if (action.trim() === 'quit') {
          throw new Error('사용자가 종료했습니다.');
        }
        continue;
      }
    }

    printHeader(
      '채팅방 선택',
      `상단 ${rooms.length}개 로드됨. more=더 불러오기, /검색어=필터, all=전체`
    );

    if (filtered.length === 0) {
      stdout.write('표시할 채팅방이 없습니다.\n\n');
    } else {
      stdout.write(`${filtered.map((room, index) => formatRoomLine(index, room)).join('\n')}\n\n`);
    }

    const input = await rl.question('선택 번호(예: 1,3-5) 또는 명령 입력: ');
    const trimmed = input.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed === 'more') {
      limit += PAGE_SIZE;
      rooms = [];
      continue;
    }

    if (trimmed === 'all') {
      filtered = rooms;
      continue;
    }

    if (trimmed.startsWith('/')) {
      filtered = filterRooms(rooms, trimmed.slice(1));
      continue;
    }

    const indexes = parseSelection(trimmed, filtered.length);
    if (indexes.length === 0) {
      stdout.write('\n유효한 번호가 없습니다. Enter를 누르면 계속합니다.');
      await rl.question('');
      continue;
    }

    return indexes.map((index) => filtered[index]);
  }
}

async function confirmSend(rl, targets, message) {
  printHeader('발송 확인');
  stdout.write(`선택 방 ${targets.length}개\n`);
  stdout.write(`${targets.map((target) => `- ${target.roomName}`).join('\n')}\n\n`);
  stdout.write(`메시지:\n${message}\n\n`);
  const answer = await rl.question('보내려면 yes 입력: ');
  return answer.trim().toLowerCase() === 'yes';
}

async function chooseMode(rl) {
  while (true) {
    printHeader('메뉴', '1=메시지 발송, 2=방 분석, q=종료');
    const answer = (await rl.question('선택: ')).trim().toLowerCase();
    if (answer === '1' || answer === 'send') {
      return 'send';
    }
    if (answer === '2' || answer === 'analyze') {
      return 'analyze';
    }
    if (answer === 'q' || answer === 'quit') {
      return 'quit';
    }
  }
}

async function chooseSingleTarget(rl, driver) {
  const targets = await chooseTargets(rl, driver);
  return targets[0];
}

async function promptTailLimit(rl) {
  printHeader('분석 범위', '최근 몇 개 메시지 행을 읽을지 정합니다. 기본값은 80입니다.');
  const answer = (await rl.question('최근 행 수 [80]: ')).trim();
  if (!answer) {
    return 80;
  }
  const parsed = Number(answer);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 80;
  }
  return Math.min(parsed, 400);
}

async function promptAnalysisFocus(rl) {
  printHeader(
    '분석 목적',
    '어떤 내용 위주로 볼지 적어주세요. 예: 고객 니즈, 영업기회, 연락처/링크, 불만 포인트, 협업 제안'
  );
  const answer = (await rl.question('분석 목적 [중요한 내용 자동 선별]: ')).trim();
  return answer || '중요한 내용 자동 선별';
}

function extractFocusKeywords(focusText) {
  return Array.from(new Set(
    String(focusText || '')
      .toLowerCase()
      .split(/[^a-z0-9가-힣]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
      .filter((token) => !FOCUS_STOPWORDS.includes(token))
  ));
}

function normalizeMessageRows(rows) {
  return rows
    .map((row) => Array.isArray(row) ? row.map((entry) => String(entry || '').trim()).filter(Boolean) : [])
    .filter((row) => row.length > 0)
    .map((row) => {
      const text = row.join(' | ').replace(/\s+/g, ' ').trim();
      return {
        parts: row,
        text,
      };
    })
    .filter((row) => row.text);
}

function scoreMessageRow(text, focus = null) {
  const lower = text.toLowerCase();
  let score = 0;

  if (/https?:\/\/\S+/i.test(text) || /\b[a-z0-9.-]+\.[a-z]{2,}\b/i.test(text)) {
    score += 3;
  }
  if (/\b\d{2,4}-\d{3,4}-\d{4}\b/.test(text) || /\b01\d-\d{3,4}-\d{4}\b/.test(text)) {
    score += 3;
  }
  if (text.length >= 80) {
    score += 2;
  }
  for (const keyword of ANALYSIS_KEYWORDS) {
    if (lower.includes(keyword)) {
      score += 1;
    }
  }
  if (/joined the chatroom|view post|share|report|precautions/i.test(lower)) {
    score -= 2;
  }

  if (focus && Array.isArray(focus.keywords)) {
    for (const keyword of focus.keywords) {
      if (lower.includes(keyword)) {
        score += 2;
      }
    }
  }

  return score;
}

function buildMessageAnalysis(rows, focus = null) {
  const normalized = normalizeMessageRows(rows);
  const highlights = normalized
    .map((row) => ({
      ...row,
      score: scoreMessageRow(row.text, focus),
    }))
    .filter((row) => row.score >= 3)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);

  const uniqueHighlights = [];
  const seen = new Set();
  for (const row of highlights) {
    if (seen.has(row.text)) {
      continue;
    }
    seen.add(row.text);
    uniqueHighlights.push(row);
    if (uniqueHighlights.length >= 8) {
      break;
    }
  }

  const linkRows = normalized.filter((row) => /https?:\/\/\S+|[a-z0-9.-]+\.[a-z]{2,}/i.test(row.text));
  const contactRows = normalized.filter((row) => /\b\d{2,4}-\d{3,4}-\d{4}\b|\b01\d-\d{3,4}-\d{4}\b/.test(row.text));

  return {
    focus,
    totalRows: normalized.length,
    linkRows,
    contactRows,
    highlights: uniqueHighlights,
    rawRows: normalized,
  };
}

function buildAgentBrief(roomName, limit, analysis) {
  const focusTitle = analysis.focus?.text || '중요한 내용 자동 선별';
  const topHighlights = analysis.highlights.map((row, index) => `${index + 1}. ${row.text}`);
  const suggestedPrompt = [
    `다음은 KakaoTalk 방 "${roomName}"에서 최근 ${limit}개 행을 추출한 내용이다.`,
    `분석 목표: ${focusTitle}`,
    '해야 할 일:',
    '- 핵심 요점 5개 이내로 정리',
    '- 사용자 요청과 직접 관련된 메시지만 우선 분류',
    '- 실행 가능한 다음 액션이나 답장 포인트가 있으면 제안',
    '- 링크, 연락처, 가격, 일정, 니즈, 불만, 협업 제안이 있으면 따로 표시',
    '',
    '우선 후보 메시지:',
    ...topHighlights,
  ].join('\n');

  const summaryLines = [
    `방: ${roomName}`,
    `분석 목표: ${focusTitle}`,
    `추출 행 수: ${analysis.totalRows}`,
    `링크 포함 행: ${analysis.linkRows.length}`,
    `연락처 포함 행: ${analysis.contactRows.length}`,
  ];

  return {
    focusTitle,
    summaryLines,
    suggestedPrompt,
  };
}

function renderAnalysisMarkdown(roomName, limit, analysis, brief) {
  const highlights = analysis.highlights.length > 0
    ? analysis.highlights.map((row, index) => `${index + 1}. ${row.text}`).join('\n\n')
    : '자동 선별된 하이라이트 없음';
  const rawTail = analysis.rawRows.slice(-12).map((row) => `- ${row.text}`).join('\n');

  return [
    `# Agent Brief`,
    '',
    `- 방: ${roomName}`,
    `- 분석 목표: ${brief.focusTitle}`,
    `- 최근 행 수: ${limit}`,
    `- 추출 행 수: ${analysis.totalRows}`,
    `- 링크 포함 행: ${analysis.linkRows.length}`,
    `- 연락처 포함 행: ${analysis.contactRows.length}`,
    '',
    `## 하이라이트`,
    '',
    highlights,
    '',
    `## 최근 원문 일부`,
    '',
    rawTail || '- 없음',
    '',
    `## Agent Prompt`,
    '',
    '```text',
    brief.suggestedPrompt,
    '```',
    '',
  ].join('\n');
}

function printAnalysisResult(roomName, limit, analysis, brief) {
  printHeader('방 분석 결과', `${roomName} | 최근 ${limit}개 행 | ${brief.focusTitle}`);
  stdout.write(`추출 행 수: ${analysis.totalRows}\n`);
  stdout.write(`링크 포함 행: ${analysis.linkRows.length}\n`);
  stdout.write(`연락처 포함 행: ${analysis.contactRows.length}\n\n`);

  if (analysis.highlights.length === 0) {
    stdout.write('쓸만한 내용으로 자동 선별된 항목이 없습니다.\n\n');
  } else {
    stdout.write('쓸만한 내용\n');
    stdout.write(`${analysis.highlights.map((row, index) => `${index + 1}. ${row.text}`).join('\n\n')}\n\n`);
  }

  stdout.write('원문 추출 일부\n');
  const tailRows = analysis.rawRows.slice(-8);
  stdout.write(`${tailRows.map((row, index) => `- ${row.text}`).join('\n')}\n\n`);

  stdout.write('에이전트 프롬프트 요약\n');
  stdout.write(`${brief.suggestedPrompt}\n\n`);
}

function printAnalysisProgress(roomName, limit, checkpointPath, progress) {
  printHeader('방 분석 중', `${roomName} | 목표 ${limit}개 행 | 체크포인트 저장 중`);
  stdout.write(`라운드: ${progress.round}/${progress.maxScrolls}\n`);
  stdout.write(`수집: ${progress.collectedCount}/${progress.targetRows}\n`);
  stdout.write(`이번 라운드 신규: ${progress.addedThisRound}\n`);
  stdout.write(`현재 스크롤: ${progress.scrollValue.toFixed(3)}\n`);
  stdout.write(`현재 rowCount: ${progress.rowCount}\n`);
  stdout.write(`읽기 모드: ${progress.mode}\n`);
  stdout.write(`중간 저장: ${checkpointPath}\n\n`);
}

async function writeCheckpoint(checkpointPath, payload) {
  await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
  const content = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload, null, 2);
  await fs.writeFile(checkpointPath, content);
}

async function analyzeRoom(rl, driver) {
  const target = await chooseSingleTarget(rl, driver);
  const limit = await promptTailLimit(rl);
  const focusText = await promptAnalysisFocus(rl);
  const focus = {
    text: focusText,
    keywords: extractFocusKeywords(focusText),
  };
  const storeDir = getStoreDir();
  const checkpointDir = path.join(storeDir, 'crawl-checkpoints');
  const checkpointPath = path.join(
    checkpointDir,
    `${slugify(target.roomName)}-latest.json`
  );
  const briefPath = path.join(
    checkpointDir,
    `${slugify(target.roomName)}-agent-brief.md`
  );

  printHeader('방 분석 중', `${target.roomName} | 최근 ${limit}개 행 | ${focusText}\n`);
  const crawlResult = limit > 80
    ? await driver.crawlRoomHistory(target.roomName, {
        targetRows: limit,
        pageSize: Math.min(32, Math.max(18, Math.floor(limit / 6))),
        maxScrolls: Math.min(80, Math.max(16, Math.ceil(limit / 4))),
        onProgress: async (progress) => {
          printAnalysisProgress(target.roomName, limit, checkpointPath, progress);
        },
        onCheckpoint: async (checkpoint) => {
          await writeCheckpoint(checkpointPath, {
            roomName: target.roomName,
            requestedRows: limit,
            focus,
            updatedAt: new Date().toISOString(),
            ...checkpoint,
          });
        },
      })
    : { rows: await driver.readRoomMessages(target.roomName, limit), crawl: null };
  const rows = crawlResult.rows;
  const analysis = buildMessageAnalysis(rows, focus);
  const brief = buildAgentBrief(target.roomName, limit, analysis);
  await writeCheckpoint(checkpointPath, {
    roomName: target.roomName,
    requestedRows: limit,
    focus,
    updatedAt: new Date().toISOString(),
    completed: true,
    rows,
    crawl: crawlResult.crawl,
    analysis: {
      totalRows: analysis.totalRows,
      linkRows: analysis.linkRows.length,
      contactRows: analysis.contactRows.length,
      highlights: analysis.highlights,
      suggestedPrompt: brief.suggestedPrompt,
    },
  });
  await writeCheckpoint(briefPath, renderAnalysisMarkdown(target.roomName, limit, analysis, brief));
  printAnalysisResult(target.roomName, limit, analysis, brief);
  stdout.write(`중간/최종 저장 파일: ${checkpointPath}\n\n`);
  if (crawlResult.crawl && rows.length < limit) {
    stdout.write(`주의: ${limit}개 요청했지만 ${rows.length}개만 수집했습니다. stopReason=${crawlResult.crawl.stopReason}\n\n`);
  }
  stdout.write(`에이전트 브리프 파일: ${briefPath}\n\n`);
  await rl.question('Enter를 누르면 메뉴로 돌아갑니다. ');
}

async function main() {
  const rl = readline.createInterface({
    input: stdin,
    output: stdout,
  });

  const driver = createMacAutomationDriver();
  const engine = createEngine({
    storeDir: getStoreDir(),
    driver,
    log: createConsoleLogger('tui'),
    onProgress: createConsoleProgress('tui-progress'),
  });

  try {
    printHeader('환경 확인 중');
    await engine.verifyReady();

    while (true) {
      const mode = await chooseMode(rl);
      if (mode === 'quit') {
        printHeader('종료');
        stdout.write('작업을 종료합니다.\n');
        return;
      }

      if (mode === 'analyze') {
        await analyzeRoom(rl, driver);
        continue;
      }

      const targets = await chooseTargets(rl, driver);
      printHeader('메시지 입력');
      const message = await promptMultilineMessage(rl);
      if (!message.trim()) {
        throw new Error('메시지가 비어 있습니다.');
      }

      const confirmed = await confirmSend(rl, targets, message);
      if (!confirmed) {
        printHeader('취소됨');
        stdout.write('발송을 취소했습니다.\n');
        await rl.question('Enter를 누르면 메뉴로 돌아갑니다. ');
        continue;
      }

      printHeader('발송 중', '진행 로그는 아래에 그대로 출력됩니다.\n');
      await engine.sendToTargets(targets, {
        message,
        filePath: '',
        fileFirst: true,
      });
      await rl.question('\nEnter를 누르면 메뉴로 돌아갑니다. ');
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
