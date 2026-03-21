'use strict';

const state = {
  history: [],
  chatRooms: [],
  selectedChatIds: new Set(),
  recentOnly: false,
  chatRoomLimit: 20,
  bottomTab: 'history',
};

const elements = {};

function queryElements() {
  elements.logList = document.getElementById('log-list');
  elements.historyBody = document.getElementById('history-body');
  elements.chatListBody = document.getElementById('chat-list-body');
  elements.chatListCaption = document.getElementById('chat-list-caption');
  elements.recentOnlyToggle = document.getElementById('recent-only-toggle');
  elements.selectedRoomList = document.getElementById('selected-room-list');

  elements.form = document.getElementById('send-form');
  elements.roomName = document.getElementById('room-name');
  elements.sendMessage = document.getElementById('send-message');
  elements.filePath = document.getElementById('file-path');
  elements.fileFirst = document.getElementById('file-first');

  elements.pickFileButton = document.getElementById('pick-file-btn');
  elements.loadChatListButton = document.getElementById('load-chat-list-btn');
  elements.loadMoreChatButton = document.getElementById('load-more-chat-btn');
  elements.sendButton = document.getElementById('send-btn');
  elements.syncSelectedButton = document.getElementById('sync-selected-btn');
  elements.clearHistoryButton = document.getElementById('clear-history-btn');
  elements.historyTabButton = document.getElementById('history-tab-btn');
  elements.logsTabButton = document.getElementById('logs-tab-btn');
  elements.historyTabPanel = document.getElementById('history-tab-panel');
  elements.logsTabPanel = document.getElementById('logs-tab-panel');
  elements.historyActions = document.getElementById('history-actions');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function appendLog(message, createdAt = new Date().toISOString()) {
  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `
    <span class="log-time">${escapeHtml(new Date(createdAt).toLocaleString())}</span>
    <div>${escapeHtml(message)}</div>
  `;
  elements.logList.prepend(item);

  while (elements.logList.children.length > 120) {
    elements.logList.removeChild(elements.logList.lastChild);
  }
}

function collectSendPayload() {
  return {
    roomNames: elements.roomName.value
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean),
    message: elements.sendMessage.value,
    filePath: elements.filePath.value.trim(),
    fileFirst: elements.fileFirst.checked,
  };
}

function validateSendPayload(payload) {
  if (!payload.roomNames.length) {
    throw new Error('채팅방 이름을 입력하거나 목록에서 선택해주세요.');
  }

  if (!payload.message.trim() && !payload.filePath) {
    throw new Error('메시지 또는 파일 중 하나는 입력해야 합니다.');
  }
}

function resetForm() {
  elements.form.reset();
  elements.fileFirst.checked = true;
}

function renderHistory() {
  if (state.history.length === 0) {
    elements.historyBody.innerHTML = '<tr><td colspan="5" class="empty">발송 이력이 없습니다.</td></tr>';
    return;
  }

  elements.historyBody.innerHTML = state.history.map((entry) => `
    <tr>
      <td>${escapeHtml(new Date(entry.createdAt).toLocaleString())}</td>
      <td>${escapeHtml(entry.result || '-')}</td>
      <td>${escapeHtml(entry.roomName || '-')}</td>
      <td>${escapeHtml(entry.sendMessage || '-')}</td>
      <td>${escapeHtml(entry.filePath || '-')}</td>
    </tr>
  `).join('');
}

function renderBottomTab() {
  const historyActive = state.bottomTab === 'history';
  elements.historyTabButton.classList.toggle('active', historyActive);
  elements.logsTabButton.classList.toggle('active', !historyActive);
  elements.historyTabButton.setAttribute('aria-selected', historyActive ? 'true' : 'false');
  elements.logsTabButton.setAttribute('aria-selected', historyActive ? 'false' : 'true');
  elements.historyTabPanel.classList.toggle('active', historyActive);
  elements.logsTabPanel.classList.toggle('active', !historyActive);
  elements.historyTabPanel.hidden = !historyActive;
  elements.logsTabPanel.hidden = historyActive;
  elements.historyActions.hidden = !historyActive;
}

function parseLastActivity(value) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  const now = new Date();

  if (/^today$/i.test(text)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  if (/^yesterday$/i.test(text)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  }

  if (/^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(text)) {
    const parts = text.match(/^(\d{1,2}):(\d{2})(?:\s?([AP]M))?$/i);
    if (!parts) {
      return null;
    }

    let hours = Number(parts[1]);
    const minutes = Number(parts[2]);
    const ampm = parts[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) {
      hours += 12;
    }
    if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }

    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  }

  if (/^(오전|오후)\s*\d{1,2}:\d{2}$/.test(text)) {
    const parts = text.match(/^(오전|오후)\s*(\d{1,2}):(\d{2})$/);
    if (!parts) {
      return null;
    }

    let hours = Number(parts[2]);
    const minutes = Number(parts[3]);
    if (parts[1] === '오후' && hours < 12) {
      hours += 12;
    }
    if (parts[1] === '오전' && hours === 12) {
      hours = 0;
    }

    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) {
    const [monthText, dayText, yearText] = text.split('/');
    let year = Number(yearText);
    if (year < 100) {
      year += 2000;
    }
    return new Date(year, Number(monthText) - 1, Number(dayText), 0, 0, 0, 0);
  }

  const monthMatch = text.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i);
  if (monthMatch) {
    const monthNames = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    const monthIndex = monthNames[monthMatch[1].toLowerCase()];
    const day = Number(monthMatch[2]);
    let year = now.getFullYear();
    const candidate = new Date(year, monthIndex, day, 0, 0, 0, 0);
    if (candidate > now) {
      year -= 1;
    }
    return new Date(year, monthIndex, day, 0, 0, 0, 0);
  }

  return null;
}

function isRecentRoom(room) {
  if (!state.recentOnly) {
    return true;
  }

  const parsedDate = parseLastActivity(room.lastActivity);
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  const threshold = Date.now() - (30 * 24 * 60 * 60 * 1000);
  return parsedDate.getTime() >= threshold;
}

function getVisibleChatRooms() {
  return state.chatRooms.filter((room) => isRecentRoom(room));
}

function getSelectedRooms() {
  return getVisibleChatRooms().filter((room) => state.selectedChatIds.has(room.id));
}

function renderSelectedRooms() {
  const selectedRooms = getSelectedRooms();

  if (selectedRooms.length === 0) {
    elements.selectedRoomList.innerHTML = '<div class="selected-room-item"><p>오른쪽 채팅방 목록에서 선택하면 여기에 표시됩니다.</p></div>';
    return;
  }

  elements.selectedRoomList.innerHTML = selectedRooms.map((room, index) => `
    <div class="selected-room-item">
      <strong>${index + 1}. ${escapeHtml(room.roomName)}</strong>
      <p>최근 활동: ${escapeHtml(room.lastActivity || '-')}</p>
    </div>
  `).join('');
}

function renderChatRooms() {
  const visibleRooms = getVisibleChatRooms();
  elements.chatListCaption.textContent = `메인 채팅 목록 상단 ${state.chatRooms.length}개를 읽어 표시`;

  if (visibleRooms.length === 0) {
    elements.chatListBody.innerHTML = '<tr><td colspan="3" class="empty">표시할 채팅방이 없습니다.</td></tr>';
    return;
  }

  elements.chatListBody.innerHTML = visibleRooms.map((room) => `
    <tr>
      <td>
        <input type="checkbox" data-chat-id="${escapeHtml(room.id)}" ${state.selectedChatIds.has(room.id) ? 'checked' : ''}>
      </td>
      <td>${escapeHtml(room.roomName)}</td>
      <td class="muted">${escapeHtml(room.lastActivity || '-')}</td>
    </tr>
  `).join('');
  renderSelectedRooms();
}

async function refreshHistory() {
  state.history = await window.kakaoAuto.listHistory();
  renderHistory();
}

async function refreshAll() {
  const appState = await window.kakaoAuto.getState();
  if (!appState.driverStatus?.supported) {
    appendLog('이 빌드는 macOS 전용입니다.');
  } else if (!appState.driverStatus?.appInstalled) {
    appendLog('KakaoTalk.app 이 /Applications 에 설치되어 있어야 합니다.');
  } else if (!appState.driverStatus?.accessibilityGranted) {
    appendLog('손쉬운 사용 권한이 필요합니다. 시스템 설정에서 터미널 또는 앱을 허용하세요.');
  }
  renderSelectedRooms();
  await refreshHistory();
}

async function loadChatRoomsWithLimit(limit) {
  const originalLabel = elements.loadChatListButton.textContent;
  elements.loadChatListButton.disabled = true;
  elements.loadMoreChatButton.disabled = true;
  elements.loadChatListButton.textContent = '불러오는 중...';
  appendLog(`카카오톡 채팅방 목록 상단 ${limit}개를 읽는 중입니다.`);

  try {
    const previousSelections = new Set(state.selectedChatIds);
    const rooms = await window.kakaoAuto.listChatRooms(limit);
    state.chatRooms = rooms;
    state.selectedChatIds = new Set(
      rooms
        .filter((room) => previousSelections.has(room.id))
        .map((room) => room.id)
    );
    renderChatRooms();
    renderSelectedRooms();
    appendLog(`카카오톡 채팅방 ${rooms.length}개를 불러왔습니다.`);
  } catch (error) {
    appendLog(`채팅방 불러오기 실패: ${error.message}`);
    window.alert(error.message);
  } finally {
    elements.loadChatListButton.disabled = false;
    elements.loadMoreChatButton.disabled = false;
    elements.loadChatListButton.textContent = originalLabel;
  }
}

async function loadChatRooms() {
  return loadChatRoomsWithLimit(state.chatRoomLimit);
}

async function handleLoadMoreChatRooms() {
  state.chatRoomLimit += 20;
  await loadChatRoomsWithLimit(state.chatRoomLimit);
}

async function handleSend() {
  try {
    const payload = collectSendPayload();
    const selectedTargets = getSelectedRooms();
    if ((!payload.message || !payload.message.trim()) && !payload.filePath) {
      throw new Error('메시지 또는 파일 중 하나는 입력해야 합니다.');
    }

    if (selectedTargets.length > 0) {
      await window.kakaoAuto.sendToSelectedChats({
        targets: selectedTargets,
        message: payload.message,
        filePath: payload.filePath,
        fileFirst: payload.fileFirst,
      });
      appendLog(`선택한 채팅방 ${selectedTargets.length}곳에 발송을 시도했습니다.`);
    } else {
      validateSendPayload(payload);
      await window.kakaoAuto.sendNow(payload);
      appendLog(`입력된 방 ${payload.roomNames.length}곳에 발송을 시도했습니다.`);
    }

    await refreshHistory();
  } catch (error) {
    appendLog(error.message);
    window.alert(error.message);
  }
}

function handleChatRoomSelectionChange(event) {
  const target = event.target.closest('input[data-chat-id]');
  if (!target) {
    return;
  }

  const chatId = target.dataset.chatId;
  if (target.checked) {
    state.selectedChatIds.add(chatId);
  } else {
    state.selectedChatIds.delete(chatId);
  }
  renderSelectedRooms();
}

function syncSelectedRoomsToInput() {
  const selectedRooms = getSelectedRooms().map((room) => room.roomName);
  elements.roomName.value = selectedRooms.join('\n');
  appendLog(`${selectedRooms.length}개 채팅방을 입력칸에 반영했습니다.`);
}

function handleRecentOnlyToggle(event) {
  state.recentOnly = Boolean(event.target.checked);
  renderChatRooms();
  renderSelectedRooms();
  appendLog(state.recentOnly
    ? '최근 30일 이내 채팅방만 표시합니다.'
    : '전체 채팅방을 다시 표시합니다.');
}

async function handlePickFile() {
  const filePath = await window.kakaoAuto.pickFile();
  if (filePath) {
    elements.filePath.value = filePath;
  }
}

async function bindActions() {
  elements.form.addEventListener('submit', (event) => event.preventDefault());
  elements.sendButton.addEventListener('click', handleSend);
  elements.loadChatListButton.addEventListener('click', loadChatRooms);
  elements.loadMoreChatButton.addEventListener('click', handleLoadMoreChatRooms);
  elements.syncSelectedButton.addEventListener('click', syncSelectedRoomsToInput);
  elements.pickFileButton.addEventListener('click', handlePickFile);
  elements.historyTabButton.addEventListener('click', () => {
    state.bottomTab = 'history';
    renderBottomTab();
  });
  elements.logsTabButton.addEventListener('click', () => {
    state.bottomTab = 'logs';
    renderBottomTab();
  });
  elements.clearHistoryButton.addEventListener('click', async () => {
    if (!window.confirm('발송 이력을 모두 비울까요?')) {
      return;
    }

    await window.kakaoAuto.clearHistory();
    appendLog('발송 이력을 비웠습니다.');
    await refreshHistory();
  });
  elements.chatListBody.addEventListener('change', handleChatRoomSelectionChange);
  elements.recentOnlyToggle.addEventListener('change', handleRecentOnlyToggle);

  window.kakaoAuto.onLog((entry) => {
    appendLog(entry.message, entry.createdAt);
    refreshHistory().catch(() => {});
  });

  window.kakaoAuto.onError((payload) => {
    appendLog(`오류: ${payload.message}`);
    window.alert(payload.message);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  queryElements();
  resetForm();
  renderBottomTab();
  await bindActions();
  await refreshAll();
  appendLog('macOS GUI가 준비되었습니다.');
  appendLog('채팅방 불러오기를 누르면 상단 20개부터 읽어옵니다.');
});
