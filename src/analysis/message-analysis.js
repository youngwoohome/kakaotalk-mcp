'use strict';

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

const TIMESTAMP_PATTERNS = [
  /^(오전|오후)\s*\d{1,2}:\d{2}$/,
  /^\d{1,2}:\d{2}(\s?[AP]M)?$/i,
  /^(today|yesterday)$/i,
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/i,
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
];

function isTimestampPart(value) {
  return TIMESTAMP_PATTERNS.some((re) => re.test(String(value || '').trim()));
}

// UI chrome strings that appear in AX tree but are not message content
const UI_NOISE = new Set(['Share', 'Reply', 'Forward', 'Like', 'Copy', 'Delete', 'More']);

function parseMessageParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return { sender: '', body: '', timestamp: '' };
  }

  let timestamp = '';
  let remaining;

  // read-room-messages returns parts[0] as "<rowIndex>\n<timestamp>"
  const rowTimestampMatch = /^\d+\n(.+)$/.exec(parts[0]);
  if (rowTimestampMatch) {
    timestamp = rowTimestampMatch[1].trim();
    remaining = parts.slice(1);
  } else if (isTimestampPart(parts[0])) {
    timestamp = parts[0];
    remaining = parts.slice(1);
  } else {
    // Fallback: scan from the end for a timestamp
    let timestampIndex = -1;
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (isTimestampPart(parts[i])) {
        timestampIndex = i;
        break;
      }
    }
    timestamp = timestampIndex >= 0 ? parts[timestampIndex] : '';
    remaining = timestampIndex >= 0 ? parts.filter((_, i) => i !== timestampIndex) : parts.slice();
  }

  // Strip UI chrome (Share, Reply, etc.)
  const meaningful = remaining.filter((p) => !UI_NOISE.has(p.trim()));

  if (meaningful.length === 0) {
    return { sender: '', body: '', timestamp };
  }

  const firstPart = meaningful[0];
  const looksLikeSender = firstPart.length <= 20
    && !/https?:\/\//.test(firstPart)
    && !/\n/.test(firstPart);

  if (meaningful.length === 1) {
    return looksLikeSender
      ? { sender: firstPart, body: '', timestamp }
      : { sender: '', body: firstPart, timestamp };
  }

  if (looksLikeSender) {
    return {
      sender: firstPart,
      body: meaningful.slice(1).join(' ').replace(/\s+/g, ' ').trim(),
      timestamp,
    };
  }

  return {
    sender: '',
    body: meaningful.join(' ').replace(/\s+/g, ' ').trim(),
    timestamp,
  };
}

function normalizeMessageRows(rows) {
  return rows
    .map((row) => Array.isArray(row) ? row.map((entry) => String(entry || '').trim()).filter(Boolean) : [])
    .filter((row) => row.length > 0)
    .map((row) => {
      const text = row.join(' | ').replace(/\s+/g, ' ').trim();
      const { sender, body, timestamp } = parseMessageParts(row);
      return { parts: row, text, sender, body, timestamp };
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
  const scored = normalized.map((row) => ({
    ...row,
    score: scoreMessageRow(row.text, focus),
  }));

  // Determine top-12 highlight texts (score >= 3, unique, by score desc)
  const highlightTexts = new Set();
  const sortedByScore = [...scored]
    .filter((row) => row.score >= 3)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);
  for (const row of sortedByScore) {
    if (highlightTexts.size >= 12) {
      break;
    }
    highlightTexts.add(row.text);
  }

  // Unified messages array: all rows in chronological order with isHighlight flag
  const messages = scored.map((row) => ({
    ...row,
    isHighlight: highlightTexts.has(row.text),
  }));

  const linkRows = normalized.filter((row) => /https?:\/\/\S+|[a-z0-9.-]+\.[a-z]{2,}/i.test(row.text));
  const contactRows = normalized.filter((row) => /\b\d{2,4}-\d{3,4}-\d{4}\b|\b01\d-\d{3,4}-\d{4}\b/.test(row.text));
  const highlights = messages.filter((m) => m.isHighlight).sort((a, b) => b.score - a.score);

  return {
    focus,
    totalRows: normalized.length,
    linkRows,
    contactRows,
    highlights,
    messages,
    rawRows: normalized,
  };
}

module.exports = {
  extractFocusKeywords,
  buildMessageAnalysis,
  normalizeMessageRows,
  scoreMessageRow,
};
