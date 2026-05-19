'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { randomUUID } = require('crypto');
const { promisify } = require('util');

const { setClipboardText } = require('../runtime/clipboard');
const { delay } = require('../runtime/delay');
const { runNativeHelper } = require('./native-helper');
const { runOsaScript } = require('./osascript');

const execFileAsync = promisify(execFile);

const APP_NAME = 'KakaoTalk';
const APP_BUNDLE_PATH = '/Applications/KakaoTalk.app';
const MAIN_WINDOW_NAME = 'KakaoTalk';

function escapeAppleScriptString(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"');
}

function normalizeListOutput(value) {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry !== APP_NAME);
}

function isLikelyDateOrTimePart(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }

  return (
    /^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(text) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text) ||
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/i.test(text) ||
    /^(오전|오후)\s*\d{1,2}:\d{2}$/.test(text) ||
    /^(today|yesterday)$/i.test(text)
  );
}

function isUnreadCountPart(value) {
  const text = String(value || '').trim();
  return /^\d+$/.test(text);
}

function buildChatLabel(parts) {
  const cleanParts = [];

  for (const part of parts) {
    if (String(part).trim() === 'missing value') {
      continue;
    }

    if (isUnreadCountPart(part) || isLikelyDateOrTimePart(part)) {
      break;
    }

    cleanParts.push(String(part).trim());
  }

  if (cleanParts.length === 0) {
    return String(parts[0] || '').trim();
  }

  return cleanParts.join(', ').replace(/,\s*,/g, ', ').trim();
}

function extractLastActivityLabel(parts) {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = String(parts[index] || '').trim();
    if (!part || part === 'missing value') {
      continue;
    }

    if (isLikelyDateOrTimePart(part)) {
      return part;
    }

  }

  return '';
}

function createMacAutomationDriver(options = {}) {
  const config = {
    chatTabKey: '2',
    searchKey: 'f',
    attachKey: 'u',
    appName: APP_NAME,
    ...options.config,
  };
  let activeRoomName = '';

  async function ensureKakaoTalkRunning() {
    if (!fs.existsSync(APP_BUNDLE_PATH)) {
      throw new Error('KakaoTalk.app 이 설치되어 있지 않습니다.');
    }

    await execFileAsync('open', ['-a', APP_BUNDLE_PATH]);
    await delay(0.6);
  }

  async function focusMainWindow() {
    await ensureKakaoTalkRunning();
    await runOsaScript([
      `tell application "${config.appName}" to activate`,
      'delay 0.2',
      'tell application "System Events"',
      `tell process "${config.appName}"`,
      'set frontmost to true',
      `keystroke "${config.chatTabKey}" using {command down}`,
      'delay 0.3',
      'repeat with w in windows',
      `if (name of w as text) is "${MAIN_WINDOW_NAME}" then`,
      'try',
      'perform action "AXRaise" of w',
      'end try',
      'exit repeat',
      'end if',
      'end repeat',
      'end tell',
      'end tell',
    ], { timeoutMs: 2200 });
  }

  async function getEnvironmentStatus() {
    const appInstalled = fs.existsSync(APP_BUNDLE_PATH);
    if (process.platform !== 'darwin') {
      return {
        supported: false,
        appInstalled,
        accessibilityGranted: false,
        appRunning: false,
      };
    }

    let accessibilityGranted = false;
    let appRunning = false;

    try {
      const runningOutput = await runOsaScript([
        'tell application "System Events"',
        `set processNames to name of every process`,
        'end tell',
        'return processNames as text',
      ], { timeoutMs: 1500 });
      appRunning = runningOutput.includes(config.appName);
    } catch {
      appRunning = false;
    }

    try {
      await runOsaScript([
        'tell application "System Events"',
        `tell process "${config.appName}"`,
        'get count of windows',
        'end tell',
        'end tell',
      ], { timeoutMs: 1500 });
      accessibilityGranted = true;
    } catch (error) {
      accessibilityGranted = !String(error.message).includes('assistive access')
        && !String(error.message).includes('not allowed')
        && !String(error.message).includes('개인정보');
    }

    return {
      supported: true,
      appInstalled,
      accessibilityGranted,
      appRunning,
    };
  }

  async function listOpenRooms() {
    const output = await runOsaScript([
      'tell application "System Events"',
      `tell process "${config.appName}"`,
      'set windowNames to {}',
      'repeat with w in windows',
      'set windowName to name of w as text',
      'if windowName is not "" and windowName is not "KakaoTalk" then set end of windowNames to windowName',
      'end repeat',
      'end tell',
      'end tell',
      'set AppleScript\'s text item delimiters to linefeed',
      'return windowNames as text',
    ], { timeoutMs: 1800 });

    return normalizeListOutput(output);
  }

  async function listChatRooms(limit = 400) {
    try {
      await ensureKakaoTalkRunning();
      const output = await runNativeHelper(['list-rooms', String(Math.max(1, Number(limit) || 20))], {
        timeoutMs: 3000 + (Math.max(1, Number(limit) || 20) * 200),
      });
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to AppleScript fallback.
    }

    await focusMainWindow();

    const output = await runOsaScript([
      'set outputLines to {}',
      'tell application "System Events"',
      `tell process "${config.appName}"`,
      'tell window 1',
      'set listContainer to missing value',
      'repeat with s from 1 to count of scroll areas',
      'try',
      'if (count of tables of scroll area s) > 0 then',
      'set listContainer to table 1 of scroll area s',
      'exit repeat',
      'end if',
      'end try',
      'end repeat',
      'if listContainer is missing value then',
      'repeat with s from 1 to count of scroll areas',
      'try',
      'if (count of outlines of scroll area s) > 0 then',
      'set listContainer to outline 1 of scroll area s',
      'exit repeat',
      'end if',
      'end try',
      'end repeat',
      'end if',
      'if listContainer is missing value then error "채팅 목록 컨테이너를 찾지 못했습니다."',
      'tell listContainer',
      'set rowCount to count of rows',
      `set maxRows to ${Math.max(1, Number(limit) || 400)}`,
      'if rowCount > maxRows then set rowCount to maxRows',
      'repeat with i from 1 to rowCount',
      'set rowValues to value of every UI element of UI element 1 of row i',
      'set cleanParts to {}',
      'repeat with v in rowValues',
      'if v is not missing value then',
      'set textValue to (v as text)',
      'if textValue is not "missing value" and textValue is not "" then set end of cleanParts to textValue',
      'end if',
      'end repeat',
      'set AppleScript\'s text item delimiters to tab',
      'set end of outputLines to ((i as text) & tab & (cleanParts as text))',
      'end repeat',
      'end tell',
      'end tell',
      'end tell',
      'end tell',
      'set AppleScript\'s text item delimiters to linefeed',
      'return outputLines as text',
    ], { timeoutMs: 3000 + (Math.max(1, Number(limit) || 20) * 300) });

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [rowIndexText, ...partsList] = line.split('\t');
        const parts = partsList
          .map((part) => part.trim())
          .filter(Boolean);
        const roomName = buildChatLabel(parts);

        return {
          id: parts.join('||') || roomName,
          rowIndex: Number(rowIndexText),
          roomName,
          lastActivity: extractLastActivityLabel(parts),
          rawParts: parts,
        };
      })
      .filter((item) => item.roomName && item.roomName !== MAIN_WINDOW_NAME);
  }

  async function focusRoomByName(roomName) {
    const escapedRoomName = escapeAppleScriptString(roomName);
    const output = await runOsaScript([
      'tell application "System Events"',
      `tell process "${config.appName}"`,
      'repeat with w in windows',
      `if (name of w as text) is "${escapedRoomName}" then`,
      'set frontmost to true',
      'try',
      'perform action "AXRaise" of w',
      'end try',
      'return "1"',
      'end if',
      'end repeat',
      'end tell',
      'end tell',
      'return "0"',
    ], { timeoutMs: 1800 });

    if (output === '1') {
      activeRoomName = String(roomName || '').trim();
      await delay(0.35);
      return true;
    }

    return false;
  }

  async function searchAndOpenRoomByName(roomName) {
    await ensureKakaoTalkRunning();
    const clipboardReady = await setClipboardText(roomName);
    if (!clipboardReady) {
      throw new Error('클립보드에 채팅방 이름을 복사하지 못했습니다.');
    }

    await runOsaScript([
      `tell application "${config.appName}" to activate`,
      'delay 0.4',
      'tell application "System Events"',
      `tell process "${config.appName}"`,
      'set frontmost to true',
      `keystroke "${config.chatTabKey}" using {command down}`,
      'delay 0.2',
      `keystroke "${config.searchKey}" using {command down}`,
      'delay 0.4',
      'keystroke "a" using {command down}',
      'delay 0.1',
      'keystroke "v" using {command down}',
      'delay 0.3',
      'key code 36',
      'delay 0.8',
      'key code 36',
      'end tell',
      'end tell',
    ], { timeoutMs: 5000 });

    await delay(0.8);
    const openRooms = await listOpenRooms();
    const matched = openRooms.some((entry) => entry === roomName || entry.includes(roomName));
    if (matched) {
      activeRoomName = String(roomName || '').trim();
    }
    return matched;
  }

  async function openRoomFromList(target) {
    try {
      await ensureKakaoTalkRunning();
      const output = await runNativeHelper(['open-room', target.roomName, '20'], {
        timeoutMs: 4500,
      });
      if (output === '1') {
        activeRoomName = String(target.roomName || '').trim();
        await delay(0.4);
        return true;
      }
    } catch {
      // Fall through to AppleScript fallback.
    }

    await focusMainWindow();
    const rows = await listChatRooms();

    const targetRow = rows.find((row) => row.id === target.id)
      || rows.find((row) => row.roomName === target.roomName);

    if (!targetRow) {
      return false;
    }

    await runOsaScript([
      `tell application "${config.appName}" to activate`,
      'delay 0.2',
      'tell application "System Events"',
      `tell process "${config.appName}"`,
      'tell window 1',
      'set listContainer to missing value',
      'repeat with s from 1 to count of scroll areas',
      'try',
      'if (count of tables of scroll area s) > 0 then',
      'set listContainer to table 1 of scroll area s',
      'exit repeat',
      'end if',
      'end try',
      'end repeat',
      'if listContainer is missing value then',
      'repeat with s from 1 to count of scroll areas',
      'try',
      'if (count of outlines of scroll area s) > 0 then',
      'set listContainer to outline 1 of scroll area s',
      'exit repeat',
      'end if',
      'end try',
      'end repeat',
      'end if',
      'if listContainer is missing value then error "채팅 목록 컨테이너를 찾지 못했습니다."',
      'tell listContainer',
      `set selected of row ${targetRow.rowIndex} to true`,
      'delay 0.2',
      'end tell',
      'end tell',
      'keystroke return',
      'end tell',
      'end tell',
    ], { timeoutMs: 4500 });

    await delay(0.8);
    const openRooms = await listOpenRooms();
    const matched = openRooms.some((entry) => entry === target.roomName || entry.includes(target.roomName));
    if (matched) {
      activeRoomName = String(target.roomName || '').trim();
    }
    return matched;
  }

  async function openRoomByNameFromList(roomName, limit = 120) {
    const normalizedTarget = String(roomName || '').trim();
    if (!normalizedTarget) {
      return false;
    }

    try {
      await ensureKakaoTalkRunning();
      const output = await runNativeHelper(['open-room', normalizedTarget, String(Math.max(1, Number(limit) || 20))], {
        timeoutMs: 4500,
      });
      if (output === '1') {
        activeRoomName = normalizedTarget;
        return true;
      }
    } catch {
      // Fall through to JS/AppleScript fallback.
    }

    const rows = await listChatRooms(limit);
    const target = rows.find((row) => row.roomName === normalizedTarget)
      || rows.find((row) => row.roomName.includes(normalizedTarget))
      || rows.find((row) => normalizedTarget.includes(row.roomName));

    if (!target) {
      return false;
    }

    return openRoomFromList(target);
  }

  async function sendText(message) {
    try {
      const output = await runNativeHelper(['send-text', message], { timeoutMs: 2500 });
      if (output === '1') {
        await delay(0.7);
        return;
      }
    } catch {
      // Fall through to AppleScript fallback.
    }

    const clipboardReady = await setClipboardText(message);
    if (!clipboardReady) {
      throw new Error('클립보드에 메시지를 복사하지 못했습니다.');
    }
    await runOsaScript([
      `tell application "${config.appName}" to activate`,
      'delay 0.2',
      'tell application "System Events"',
      `tell process "${config.appName}"`,
      'set frontmost to true',
      'keystroke "v" using {command down}',
      'delay 0.15',
      'key code 36',
      'end tell',
      'end tell',
    ], { timeoutMs: 2500 });
    await delay(0.7);
  }

  async function hasOpenFileSheet() {
    const output = await runOsaScript([
      'tell application "System Events"',
      `tell process "${config.appName}"`,
      'if not (exists window 1) then return "0"',
      'if (count of sheets of window 1) > 0 then return "1"',
      'return "0"',
      'end tell',
      'end tell',
    ], { timeoutMs: 1800 });

    return output === '1';
  }

  async function waitForFileSheet(expectedOpen, timeoutMs = 3000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const open = await hasOpenFileSheet();
      if (open === expectedOpen) {
        return true;
      }
      await delay(0.15);
    }
    return false;
  }

  function stageUploadCopy(filePath) {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error('홈 디렉터리를 찾지 못했습니다.');
    }

    const downloadsDir = path.join(homeDir, 'Downloads');
    if (!fs.existsSync(downloadsDir)) {
      throw new Error('Downloads 폴더를 찾지 못했습니다.');
    }

    const parsedPath = path.parse(filePath);
    const safeBaseName = (parsedPath.name || 'upload')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim() || 'upload';
    const extension = parsedPath.ext || '';
    const shortToken = randomUUID().slice(0, 8);
    const stagedPath = path.join(downloadsDir, `${safeBaseName}_${Date.now()}_${shortToken}${extension}`);
    fs.copyFileSync(filePath, stagedPath);
    return stagedPath;
  }

  async function sendFile(filePath) {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`첨부할 파일을 찾지 못했습니다: ${resolvedPath}`);
    }
    if (!activeRoomName) {
      throw new Error('활성 채팅방을 확인하지 못해 파일 첨부를 진행할 수 없습니다.');
    }

    const stagedPath = stageUploadCopy(resolvedPath);

    try {
      await runNativeHelper(['press-top-child', activeRoomName, '13'], { timeoutMs: 2500 });

      const sheetOpened = await waitForFileSheet(true, 2500);
      if (!sheetOpened) {
        throw new Error('파일 선택 창을 열지 못했습니다.');
      }

      await runOsaScript([
        `tell application "${config.appName}" to activate`,
        'delay 0.2',
        'tell application "System Events"',
        `tell process "${config.appName}"`,
        'tell outline 1 of scroll area 1 of splitter group 1 of splitter group 1 of sheet 1 of window 1',
        'set selected of row 2 to true',
        'delay 0.25',
        'end tell',
        'if not (enabled of button "Open" of sheet 1 of window 1) then error "업로드 파일 행 선택에 실패했습니다."',
        'click button "Open" of sheet 1 of window 1',
        'delay 0.8',
        'key code 36',
        'end tell',
        'end tell',
      ], { timeoutMs: 5000 });

      await delay(1.5);
    } finally {
      try {
        await delay(0.5);
        fs.unlinkSync(stagedPath);
      } catch {
        // Ignore cleanup failures.
      }
    }
  }

  async function listWindowTitles() {
    const output = await runNativeHelper(['list-windows'], { timeoutMs: 4000 });
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [];
  }

  async function getRoomState(roomName) {
    const normalizedTarget = String(roomName || '').trim();
    if (!normalizedTarget) {
      throw new Error('방 이름이 비어 있습니다.');
    }
    const output = await runNativeHelper(['room-state', normalizedTarget], { timeoutMs: 4000 });
    return JSON.parse(output);
  }

  async function readRoomMessages(roomName, limit = 80, mode = 'tail', options = {}) {
    const normalizedTarget = String(roomName || '').trim();
    if (!normalizedTarget) {
      throw new Error('방 이름이 비어 있습니다.');
    }

    if (!options.skipOpen) {
      const opened = await openRoomByNameFromList(normalizedTarget, Math.max(40, Number(limit) || 80));
      if (!opened) {
        throw new Error('채팅방 열기에 실패했습니다.');
      }
      await delay(0.6);
    }
    const output = await runNativeHelper(
      ['read-room-messages', normalizedTarget, String(Math.max(1, Number(limit) || 80)), mode],
      { timeoutMs: Math.min(12000, 2500 + (Math.max(1, Number(limit) || 80) * 80)) }
    );
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [];
  }

  async function scrollRoom(roomName, direction = 'up') {
    const normalizedTarget = String(roomName || '').trim();
    if (!normalizedTarget) {
      throw new Error('방 이름이 비어 있습니다.');
    }
    const output = await runNativeHelper(['scroll-room', normalizedTarget, direction], { timeoutMs: 4000 });
    return output === '1';
  }

  function normalizeRowKey(row) {
    return (Array.isArray(row) ? row : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .join(' || ');
  }

  async function crawlRoomHistory(roomName, options = {}) {
    const normalizedTarget = String(roomName || '').trim();
    if (!normalizedTarget) {
      throw new Error('방 이름이 비어 있습니다.');
    }

    const targetRows = Math.max(1, Number(options.targetRows) || 300);
    const pageSize = Math.max(10, Number(options.pageSize) || 40);
    const maxScrolls = Math.max(1, Number(options.maxScrolls) || 40);
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const onCheckpoint = typeof options.onCheckpoint === 'function' ? options.onCheckpoint : null;

    const opened = await openRoomByNameFromList(normalizedTarget, Math.max(40, targetRows));
    if (!opened) {
      throw new Error('채팅방 열기에 실패했습니다.');
    }

    await delay(0.8);

    const windowTitles = await listWindowTitles();
    const activeTitle = windowTitles.find((title) => title === normalizedTarget)
      || windowTitles.find((title) => title.includes(normalizedTarget))
      || windowTitles.find((title) => normalizedTarget.includes(title))
      || normalizedTarget;

    const collected = [];
    const seen = new Set();
    let stagnantRounds = 0;
    let firstRound = true;
    let lastSignature = '';
    let stopReason = 'unknown';
    let lastProgressPayload = null;

    for (let i = 0; i < 12; i += 1) {
      const state = await getRoomState(activeTitle);
      if (Number(state.scrollValue) >= 0.99) {
        break;
      }
      const movedDown = await scrollRoom(activeTitle, 'down');
      if (!movedDown) {
        break;
      }
      await delay(0.25);
    }

    for (let round = 0; round < maxScrolls && collected.length < targetRows; round += 1) {
      const rows = await readRoomMessages(
        activeTitle,
        pageSize,
        firstRound ? 'tail' : 'head',
        { skipOpen: true }
      );
      let addedThisRound = 0;

      for (const row of rows) {
        const key = normalizeRowKey(row);
        if (!key || seen.has(key)) {
          continue;
        }
        seen.add(key);
        collected.push(row);
        addedThisRound += 1;
      }

      const state = await getRoomState(activeTitle);
      const signature = JSON.stringify({
        rowCount: state.rowCount,
        scrollValue: Number(state.scrollValue || 0).toFixed(3),
        head: rows.slice(0, 3).map((row) => normalizeRowKey(row)),
      });

      if (signature === lastSignature && addedThisRound === 0) {
        stagnantRounds += 1;
      } else {
        stagnantRounds = 0;
      }
      lastSignature = signature;

      const progressPayload = {
        roomName: activeTitle,
        round: round + 1,
        maxScrolls,
        collectedCount: collected.length,
        uniqueCount: seen.size,
        targetRows,
        pageSize,
        scrollValue: Number(state.scrollValue || 0),
        rowCount: Number(state.rowCount || 0),
        addedThisRound,
        mode: firstRound ? 'tail' : 'head',
        stagnantRounds,
      };
      lastProgressPayload = progressPayload;

      if (onProgress) {
        await onProgress(progressPayload);
      }

      if (onCheckpoint) {
        await onCheckpoint({
          ...progressPayload,
          stopReason: null,
          rows: collected.slice(),
        });
      }

      if (collected.length >= targetRows) {
        stopReason = 'target_reached';
        break;
      }

      if (Number(state.scrollValue) <= 0.001 && addedThisRound === 0) {
        stopReason = 'top_reached_no_new_rows';
        break;
      }

      if (stagnantRounds >= 6) {
        stopReason = 'stagnant_viewport';
        break;
      }

      const moved = await scrollRoom(activeTitle, 'up');
      if (!moved) {
        stopReason = 'scroll_blocked';
        break;
      }
      firstRound = false;
      await delay(0.55);
    }

    if (collected.length < targetRows && stopReason === 'unknown') {
      stopReason = 'max_scrolls_reached';
    }

    return {
      roomName: activeTitle,
      rows: collected.slice(0, targetRows),
      crawl: {
        stopReason,
        targetRows,
        pageSize,
        maxScrolls,
        collectedCount: collected.length,
        uniqueCount: seen.size,
        roundsCompleted: Number(lastProgressPayload?.round || 0),
        lastProgress: lastProgressPayload,
      },
    };
  }

  return {
    getEnvironmentStatus,
    ensureKakaoTalkRunning,
    focusMainWindow,
    listChatRooms,
    listOpenRooms,
    listWindowTitles,
    getRoomState,
    focusRoomByName,
    openRoomFromList,
    openRoomByNameFromList,
    searchAndOpenRoomByName,
    readRoomMessages,
    scrollRoom,
    crawlRoomHistory,
    sendText,
    sendFile,
  };
}

module.exports = {
  createMacAutomationDriver,
};
