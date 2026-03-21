'use strict';

const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');

const { createEngine } = require('../runtime/create-engine');
const { createMacAutomationDriver } = require('../macos/automation-driver');
const { LocalStore } = require('../storage/local-store');
const { extractFocusKeywords, buildMessageAnalysis } = require('../analysis/message-analysis');

let mainWindow = null;
let store = null;
let engine = null;
let driver = null;
let scheduledLoopPromise = null;

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'room';
}

function getStoreDir() {
  return path.join(app.getPath('userData'), 'data');
}

function getCheckpointDir() {
  return path.join(getStoreDir(), 'crawl-checkpoints');
}

function getStore() {
  if (!store) {
    store = new LocalStore({ storeDir: getStoreDir() });
  }
  return store;
}

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(channel, payload);
}

function getDriver() {
  if (!driver) {
    driver = createMacAutomationDriver();
  }

  return driver;
}

function getEngine() {
  if (!engine) {
    engine = createEngine({
      store: getStore(),
      driver: getDriver(),
      log: (message) => {
        sendToRenderer('engine:log', {
          createdAt: new Date().toISOString(),
          message,
        });
      },
      onProgress: (progress) => {
        sendToRenderer('engine:progress', progress);
      },
    });
  }

  return engine;
}

async function saveAnalysisCheckpoint(fileName, payload) {
  const checkpointDir = getCheckpointDir();
  const checkpointPath = path.join(checkpointDir, fileName);
  await fs.mkdir(checkpointDir, { recursive: true });
  await fs.writeFile(checkpointPath, JSON.stringify(payload, null, 2));
  return checkpointPath;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#e6dccf',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function refocusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.show();
  mainWindow.moveTop();

  try {
    app.focus({ steal: true });
  } catch {
    app.focus();
  }

  mainWindow.focus();

  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.setAlwaysOnTop(false);
  }, 800);
}

function setupIpcHandlers() {
  ipcMain.handle('app:get-state', async () => {
    const status = await getDriver().getEnvironmentStatus();
    return {
      running: Boolean(engine && engine.isRunning),
      storeDir: getStoreDir(),
      platform: process.platform,
      driverStatus: status,
    };
  });

  ipcMain.handle('store:list-send-rows', async () => getStore().fetchSendList());
  ipcMain.handle('store:save-send-row', async (_event, row) => getStore().upsertSendRow(row));
  ipcMain.handle('store:delete-send-rows', async (_event, seqList) => getStore().deleteSendRows(seqList));
  ipcMain.handle('store:toggle-send-row', async (_event, seq) => getStore().toggleSendRow(seq));
  ipcMain.handle('store:reset-send-rows', async () => getStore().resetSendList());
  ipcMain.handle('store:list-history', async () => getStore().listHistory());
  ipcMain.handle('store:clear-history', async () => getStore().clearHistory());

  ipcMain.handle('dialog:pick-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return '';
    }

    return result.filePaths[0];
  });

  ipcMain.handle('engine:detect-open-rooms', async (_event, currentRoomName) => {
    return getEngine().detectOpenRooms({ currentRoomName });
  });

  ipcMain.handle('driver:list-chat-rooms', async (_event, limit) => {
    const rooms = await getDriver().listChatRooms(limit);
    refocusMainWindow();
    return rooms;
  });

  ipcMain.handle('driver:analyze-room', async (_event, payload) => {
    const roomName = String(payload?.roomName || '').trim();
    const limit = Math.min(400, Math.max(1, Number(payload?.limit) || 100));
    const focusText = String(payload?.focusText || '').trim() || '중요한 내용 자동 선별';
    if (!roomName) {
      throw new Error('분석할 채팅방 이름이 비어 있습니다.');
    }

    const focus = {
      text: focusText,
      keywords: extractFocusKeywords(focusText),
    };

    const fileName = `${slugify(roomName)}-gui-analysis.json`;
    let latestCheckpoint = null;
    let checkpointPath = '';

    try {
      const result = limit > 80
        ? await getDriver().crawlRoomHistory(roomName, {
          targetRows: limit,
          pageSize: Math.min(32, Math.max(18, Math.floor(limit / 6))),
          maxScrolls: Math.min(80, Math.max(16, Math.ceil(limit / 4))),
          onProgress: async (progress) => {
            sendToRenderer('analysis:progress', {
              roomName,
              limit,
              focusText,
              ...progress,
            });
          },
          onCheckpoint: async (checkpoint) => {
            latestCheckpoint = {
              roomName,
              requestedRows: limit,
              focus,
              updatedAt: new Date().toISOString(),
              completed: false,
              rows: checkpoint.rows,
              crawl: {
                stopReason: checkpoint.stopReason,
                round: checkpoint.round,
                maxScrolls: checkpoint.maxScrolls,
                collectedCount: checkpoint.collectedCount,
                uniqueCount: checkpoint.uniqueCount,
                targetRows: checkpoint.targetRows,
                pageSize: checkpoint.pageSize,
                scrollValue: checkpoint.scrollValue,
                rowCount: checkpoint.rowCount,
                addedThisRound: checkpoint.addedThisRound,
                mode: checkpoint.mode,
                stagnantRounds: checkpoint.stagnantRounds,
              },
            };
            checkpointPath = await saveAnalysisCheckpoint(fileName, latestCheckpoint);
          },
        })
        : { rows: await getDriver().readRoomMessages(roomName, limit), crawl: null };

      const analysis = buildMessageAnalysis(result.rows, focus);
      const finalPayload = {
        roomName,
        requestedRows: limit,
        focus,
        updatedAt: new Date().toISOString(),
        completed: true,
        rows: result.rows,
        crawl: result.crawl,
        analysis: {
          totalRows: analysis.totalRows,
          linkRows: analysis.linkRows.length,
          contactRows: analysis.contactRows.length,
          highlights: analysis.highlights,
          rawTail: analysis.rawRows.slice(-20),
        },
      };
      checkpointPath = await saveAnalysisCheckpoint(fileName, finalPayload);
      sendToRenderer('analysis:progress', {
        roomName,
        limit,
        focusText,
        done: true,
        checkpointPath,
      });
      refocusMainWindow();
      return {
        roomName,
        limit,
        focusText,
        checkpointPath,
        rows: result.rows,
        crawl: result.crawl,
        analysis,
      };
    } catch (error) {
      if (latestCheckpoint) {
        checkpointPath = await saveAnalysisCheckpoint(fileName, {
          ...latestCheckpoint,
          updatedAt: new Date().toISOString(),
          completed: false,
          error: error.message,
        });
      }
      sendToRenderer('analysis:progress', {
        roomName,
        limit,
        focusText,
        done: true,
        error: error.message,
        checkpointPath,
      });
      refocusMainWindow();
      throw error;
    }
  });

  ipcMain.handle('engine:send-now', async (_event, payload) => {
    return getEngine().sendNow(payload);
  });

  ipcMain.handle('engine:send-to-selected-chats', async (_event, payload) => {
    return getEngine().sendToTargets(payload.targets, {
      message: payload.message,
      filePath: payload.filePath,
      fileFirst: payload.fileFirst,
    });
  });

  ipcMain.handle('engine:start-scheduled', async () => {
    if (scheduledLoopPromise) {
      return { ok: true, alreadyRunning: true };
    }

    const currentEngine = getEngine();
    sendToRenderer('engine:running', { running: true });

    scheduledLoopPromise = currentEngine.runScheduledLoop()
      .catch((error) => {
        sendToRenderer('engine:error', {
          message: error.message,
        });
      })
      .finally(() => {
        scheduledLoopPromise = null;
        sendToRenderer('engine:running', { running: false });
      });

    return { ok: true, alreadyRunning: false };
  });

  ipcMain.handle('engine:stop-scheduled', async () => {
    getEngine().stop();
    sendToRenderer('engine:running', { running: false });
    return { ok: true };
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
