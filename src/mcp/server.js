'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { createMacAutomationDriver } = require('../macos/automation-driver');
const { buildMessageAnalysis } = require('../analysis/message-analysis');
const { createEngine } = require('../runtime/create-engine');
const path = require('path');
const os = require('os');

function fuzzyMatchRoom(query, rooms) {
  const q = query.trim().toLowerCase();

  const exact = rooms.find((r) => r.roomName.toLowerCase() === q);
  if (exact) {
    return exact;
  }

  const contains = rooms.filter((r) => r.roomName.toLowerCase().includes(q));
  if (contains.length >= 1) {
    return contains.sort((a, b) => a.roomName.length - b.roomName.length)[0];
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  const tokenMatch = rooms.filter((r) => {
    const rLower = r.roomName.toLowerCase();
    return tokens.every((t) => rLower.includes(t));
  });
  if (tokenMatch.length >= 1) {
    return tokenMatch.sort((a, b) => a.roomName.length - b.roomName.length)[0];
  }

  return null;
}

async function main() {
  const server = new McpServer({ name: 'kakaotalk', version: '1.0.0' });

  server.tool(
    'list_rooms',
    '카카오톡 채팅방 목록을 가져옵니다. 최근 활동 순으로 정렬됩니다.',
    { limit: z.number().optional().describe('가져올 채팅방 수 (기본값: 50)') },
    async ({ limit }) => {
      const driver = createMacAutomationDriver();
      const n = Math.min(400, Math.max(1, Number(limit) || 50));
      const rooms = await driver.listChatRooms(n);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(rooms.map((r) => ({
            roomName: r.roomName,
            lastActivity: r.lastActivity || '',
          })), null, 2),
        }],
      };
    }
  );

  server.tool(
    'find_room',
    '채팅방 이름으로 검색합니다. 부분 이름이나 키워드로 정확한 방 이름을 찾을 때 사용하세요.',
    { query: z.string().describe('검색할 채팅방 이름 또는 키워드') },
    async ({ query }) => {
      const driver = createMacAutomationDriver();
      const rooms = await driver.listChatRooms(100);
      const match = fuzzyMatchRoom(query, rooms);

      if (match) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ found: true, roomName: match.roomName, lastActivity: match.lastActivity || '' }, null, 2),
          }],
        };
      }

      const q = query.toLowerCase();
      const candidates = rooms
        .filter((r) => r.roomName.toLowerCase().includes(q))
        .slice(0, 5)
        .map((r) => r.roomName);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ found: false, query, candidates }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'send_message',
    '카카오톡 채팅방에 메시지를 전송합니다. 방 이름이 불확실하면 find_room으로 먼저 확인하세요.',
    {
      room_name: z.string().describe('전송할 채팅방 이름 (정확한 이름)'),
      message: z.string().describe('전송할 메시지'),
      file_path: z.string().optional().describe('첨부할 파일 경로 (선택사항)'),
    },
    async ({ room_name, message, file_path }) => {
      const storeDir = path.join(os.homedir(), '.kakaotalk-cli');
      const logs = [];
      const engine = createEngine({
        storeDir,
        log: (msg) => logs.push(msg),
        onProgress: () => {},
      });

      await engine.sendNow({
        roomNames: [room_name],
        message: message || '',
        filePath: file_path || '',
        fileFirst: false,
      });

      const success = logs.some((r) => r.includes('발송 성공'));
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success, roomName: room_name, message, log: logs }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'analyze_room',
    '채팅방의 최근 메시지를 읽고 분석합니다. sender/body/timestamp가 구조화된 messages 배열을 반환합니다.',
    {
      room_name: z.string().describe('분석할 채팅방 이름'),
      limit: z.number().optional().describe('읽을 메시지 수 (기본값: 80, 최대 400)'),
    },
    async ({ room_name, limit }) => {
      const driver = createMacAutomationDriver();
      const n = Math.min(400, Math.max(1, Number(limit) || 80));

      const crawlResult = n > 80
        ? await driver.crawlRoomHistory(room_name, {
            targetRows: n,
            pageSize: Math.min(32, Math.max(18, Math.floor(n / 6))),
            maxScrolls: Math.min(80, Math.max(16, Math.ceil(n / 4))),
          })
        : { rows: await driver.readRoomMessages(room_name, n), crawl: null };

      const analysis = buildMessageAnalysis(crawlResult.rows, null);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            roomName: room_name,
            collectedRows: crawlResult.rows.length,
            messages: analysis.messages.map((m) => ({
              sender: m.sender,
              body: m.body,
              timestamp: m.timestamp,
              isHighlight: m.isHighlight,
              score: m.score,
            })),
            linkCount: analysis.linkRows.length,
            contactCount: analysis.contactRows.length,
          }, null, 2),
        }],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
