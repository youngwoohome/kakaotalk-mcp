'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function on(channel, handler) {
  const subscription = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, subscription);
  return () => ipcRenderer.removeListener(channel, subscription);
}

contextBridge.exposeInMainWorld('kakaoAuto', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  listSendRows: () => ipcRenderer.invoke('store:list-send-rows'),
  saveSendRow: (row) => ipcRenderer.invoke('store:save-send-row', row),
  deleteSendRows: (seqList) => ipcRenderer.invoke('store:delete-send-rows', seqList),
  toggleSendRow: (seq) => ipcRenderer.invoke('store:toggle-send-row', seq),
  resetSendRows: () => ipcRenderer.invoke('store:reset-send-rows'),
  listHistory: () => ipcRenderer.invoke('store:list-history'),
  clearHistory: () => ipcRenderer.invoke('store:clear-history'),
  pickFile: () => ipcRenderer.invoke('dialog:pick-file'),
  listChatRooms: (limit) => ipcRenderer.invoke('driver:list-chat-rooms', limit),
  analyzeRoom: (payload) => ipcRenderer.invoke('driver:analyze-room', payload),
  detectOpenRooms: (currentRoomName) => ipcRenderer.invoke('engine:detect-open-rooms', currentRoomName),
  sendNow: (payload) => ipcRenderer.invoke('engine:send-now', payload),
  sendToSelectedChats: (payload) => ipcRenderer.invoke('engine:send-to-selected-chats', payload),
  startScheduled: () => ipcRenderer.invoke('engine:start-scheduled'),
  stopScheduled: () => ipcRenderer.invoke('engine:stop-scheduled'),
  onLog: (handler) => on('engine:log', handler),
  onProgress: (handler) => on('engine:progress', handler),
  onAnalysisProgress: (handler) => on('analysis:progress', handler),
  onRunning: (handler) => on('engine:running', handler),
  onError: (handler) => on('engine:error', handler),
});
