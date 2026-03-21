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
    if (uniqueHighlights.length >= 12) {
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

module.exports = {
  extractFocusKeywords,
  buildMessageAnalysis,
  normalizeMessageRows,
  scoreMessageRow,
};
