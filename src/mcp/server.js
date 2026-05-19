'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { createMacAutomationDriver } = require('../macos/automation-driver');
const { buildMessageAnalysis } = require('../analysis/message-analysis');
const { createEngine } = require('../runtime/create-engine');

const MAX_MCP_MESSAGE_LENGTH = 2000;
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const SEND_ANNOTATIONS = {
  title: 'Send KakaoTalk message',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

function textResult(payload) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(payload, null, 2),
    }],
  };
}

function parseListEnv(value) {
  return String(value || '')
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getAllowedRooms() {
  return parseListEnv(process.env.KAKAOTALK_MCP_ALLOWED_ROOMS);
}

function isUnconfirmedSendAllowed() {
  return process.env.KAKAOTALK_MCP_ALLOW_UNCONFIRMED_SEND === '1';
}

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

function findRoomCandidates(query, rooms) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    return [];
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  return rooms
    .filter((r) => {
      const rLower = r.roomName.toLowerCase();
      return rLower.includes(q) || tokens.every((t) => rLower.includes(t));
    })
    .slice(0, 5)
    .map((r) => r.roomName);
}

function resolveAttachmentPath(filePath) {
  const normalized = String(filePath || '').trim();
  if (!normalized) {
    return '';
  }

  const resolved = path.resolve(normalized);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Attachment file not found: ${resolved}`);
  }

  return resolved;
}

async function requireSendConfirmation(server, preview) {
  if (isUnconfirmedSendAllowed()) {
    return {
      confirmed: true,
      bypassed: true,
      reason: 'KAKAOTALK_MCP_ALLOW_UNCONFIRMED_SEND=1',
    };
  }

  const capabilities = server.server.getClientCapabilities();
  if (!capabilities?.elicitation) {
    return {
      confirmed: false,
      unavailable: true,
      reason: 'MCP client does not advertise elicitation support.',
    };
  }

  const prompt = [
    'Send this KakaoTalk message?',
    '',
    `Room: ${preview.roomName}`,
    `Message: ${preview.message || '(empty)'}`,
    preview.filePath ? `File: ${preview.filePath}` : '',
    '',
    'Approve only if the room and message are exactly correct.',
  ].filter((line) => line !== '').join('\n');

  try {
    const result = await server.server.elicitInput({
      mode: 'form',
      message: prompt,
      requestedSchema: {
        type: 'object',
        properties: {
          confirm: {
            type: 'boolean',
            title: 'Send message',
            description: 'Confirm that this KakaoTalk message should be sent.',
            default: false,
          },
        },
        required: ['confirm'],
      },
    });

    return {
      confirmed: result.action === 'accept' && result.content?.confirm === true,
      action: result.action,
    };
  } catch (error) {
    return {
      confirmed: false,
      unavailable: true,
      reason: error.message,
    };
  }
}

async function main() {
  const server = new McpServer({ name: 'kakaotalk', version: '1.0.0' });

  server.tool(
    'list_rooms',
    '카카오톡 채팅방 목록을 가져옵니다. 최근 활동 순으로 정렬됩니다.',
    { limit: z.number().optional().describe('가져올 채팅방 수 (기본값: 50)') },
    READ_ONLY_ANNOTATIONS,
    async ({ limit }) => {
      const driver = createMacAutomationDriver();
      const n = Math.min(400, Math.max(1, Number(limit) || 50));
      const rooms = await driver.listChatRooms(n);
      return textResult(rooms.map((r) => ({
        roomName: r.roomName,
        lastActivity: r.lastActivity || '',
      })));
    }
  );

  server.tool(
    'find_room',
    '채팅방 이름으로 검색합니다. 부분 이름이나 키워드로 정확한 방 이름을 찾을 때 사용하세요.',
    { query: z.string().describe('검색할 채팅방 이름 또는 키워드') },
    READ_ONLY_ANNOTATIONS,
    async ({ query }) => {
      const driver = createMacAutomationDriver();
      const rooms = await driver.listChatRooms(100);
      const match = fuzzyMatchRoom(query, rooms);

      if (match) {
        return textResult({ found: true, roomName: match.roomName, lastActivity: match.lastActivity || '' });
      }

      return textResult({ found: false, query, candidates: findRoomCandidates(query, rooms) });
    }
  );

  server.tool(
    'send_message',
    '카카오톡 채팅방에 메시지를 전송합니다. 정확히 일치하는 방 이름만 허용하며, 실제 발송 전 사용자 확인 UI가 필요합니다.',
    {
      room_name: z.string().describe('전송할 채팅방 이름 (정확한 이름)'),
      message: z.string().describe('전송할 메시지'),
      file_path: z.string().optional().describe('첨부할 파일 경로 (선택사항)'),
    },
    SEND_ANNOTATIONS,
    async ({ room_name, message, file_path }) => {
      const roomName = String(room_name || '').trim();
      const sendMessage = String(message || '');
      const allowedRooms = getAllowedRooms();

      if (!roomName) {
        return textResult({ success: false, error: 'room_name is required.' });
      }

      if (sendMessage.length > MAX_MCP_MESSAGE_LENGTH) {
        return textResult({
          success: false,
          error: `Message is too long for MCP send_message. Max length is ${MAX_MCP_MESSAGE_LENGTH} characters.`,
        });
      }

      if (!sendMessage.trim() && !String(file_path || '').trim()) {
        return textResult({ success: false, error: 'message or file_path is required.' });
      }

      if (allowedRooms.length > 0 && !allowedRooms.includes(roomName)) {
        return textResult({
          success: false,
          error: 'Room is not allowed by KAKAOTALK_MCP_ALLOWED_ROOMS.',
          roomName,
          allowedRooms,
        });
      }

      let resolvedFilePath = '';
      try {
        resolvedFilePath = resolveAttachmentPath(file_path);
      } catch (error) {
        return textResult({ success: false, error: error.message });
      }

      const driver = createMacAutomationDriver();
      const rooms = await driver.listChatRooms(400);
      const exactRoom = rooms.find((r) => r.roomName === roomName);
      if (!exactRoom) {
        return textResult({
          success: false,
          error: 'Room name must exactly match an existing KakaoTalk room. Use find_room first.',
          roomName,
          candidates: findRoomCandidates(roomName, rooms),
        });
      }

      const confirmation = await requireSendConfirmation(server, {
        roomName,
        message: sendMessage,
        filePath: resolvedFilePath,
      });

      if (!confirmation.confirmed) {
        return textResult({
          success: false,
          cancelled: true,
          error: confirmation.unavailable
            ? 'This MCP client does not support elicitation, so send_message refused to send. Use kakaotalk-cli instant, or set KAKAOTALK_MCP_ALLOW_UNCONFIRMED_SEND=1 to bypass this server-side confirmation gate.'
            : 'User did not confirm the KakaoTalk send.',
          reason: confirmation.reason || confirmation.action || 'declined',
          preview: {
            roomName,
            message: sendMessage,
            filePath: resolvedFilePath,
          },
        });
      }

      const storeDir = path.join(os.homedir(), '.kakaotalk-cli');
      const logs = [];
      const engine = createEngine({
        storeDir,
        log: (msg) => logs.push(msg),
        onProgress: () => {},
      });

      await engine.sendNow({
        roomNames: [roomName],
        message: sendMessage,
        filePath: resolvedFilePath,
        fileFirst: false,
      });

      const success = logs.some((r) => r.includes('발송 성공'));
      return textResult({
        success,
        roomName,
        message: sendMessage,
        filePath: resolvedFilePath,
        confirmationBypassed: confirmation.bypassed || false,
        log: logs,
      });
    }
  );

  server.tool(
    'analyze_room',
    '채팅방의 최근 메시지를 읽고 분석합니다. sender/body/timestamp가 구조화된 messages 배열을 반환합니다.',
    {
      room_name: z.string().describe('분석할 채팅방 이름'),
      limit: z.number().optional().describe('읽을 메시지 수 (기본값: 80, 최대 400)'),
    },
    READ_ONLY_ANNOTATIONS,
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

      return textResult({
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
      });
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
