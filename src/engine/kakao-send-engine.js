'use strict';

const { DAY_NAMES } = require('../constants');
const { normalizeRoomNames } = require('../utils/rooms');
const { toCurrentTimeString, toTodayString } = require('../utils/time');

class KakaoSendEngine {
  constructor(deps) {
    this.driver = deps.driver;
    this.delay = deps.delay;
    this.randomDelay = deps.randomDelay;
    this.fetchSendList = deps.fetchSendList;
    this.postHistory = deps.postHistory;
    this.disableOneTimeRow = deps.disableOneTimeRow;
    this.log = deps.log || (() => {});
    this.onProgress = deps.onProgress || (() => {});

    this.messageQueue = [];
    this.isProcessing = false;
    this.isRunning = false;
    this.sentKeys = new Set();
    this.batchCounter = 0;
    this.batchResults = {};
    this.sendStats = {
      success: 0,
      fail: 0,
      total: 0,
      current: 0,
    };
  }

  addHistory(message) {
    this.log(message);
  }

  async withTimeout(label, task, timeoutMs) {
    let timer = null;

    try {
      return await Promise.race([
        Promise.resolve().then(task),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`${label} 시간 초과`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  updateProgress() {
    this.onProgress({
      ...this.sendStats,
      percent: this.sendStats.total > 0
        ? Math.round((this.sendStats.current / this.sendStats.total) * 100)
        : 0,
    });
  }

  stop() {
    this.addHistory('예약 발송을 중단합니다.');
    this.isRunning = false;
    this.isProcessing = false;
    this.messageQueue.length = 0;
    this.sentKeys.clear();
  }

  async verifyReady() {
    const status = await this.driver.getEnvironmentStatus();

    if (!status.supported) {
      throw new Error('macOS 전용 빌드입니다.');
    }

    if (!status.appInstalled) {
      throw new Error('KakaoTalk.app 이 설치되어 있지 않습니다.');
    }

    if (!status.accessibilityGranted) {
      throw new Error('Codex 또는 앱에 손쉬운 사용 권한이 필요합니다. 시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용에서 허용해주세요.');
    }

    await this.driver.ensureKakaoTalkRunning();
  }

  buildBatch(items, meta) {
    const batchId = ++this.batchCounter;
    this.batchResults[batchId] = {
      rooms: [],
      results: [],
      total: items.length,
      sendType: meta.sendType,
      message: meta.message,
      filePath: meta.filePath,
      rowSeq: meta.rowSeq || null,
      isRepeat: meta.isRepeat || 'Y',
      completedDate: meta.completedDate || null,
    };
    return batchId;
  }

  trackBatchResult(item, result) {
    if (!item.batchId || !this.batchResults[item.batchId]) {
      return;
    }

    const batch = this.batchResults[item.batchId];
    batch.rooms.push(item.roomName);
    batch.results.push(result);

    if (batch.rooms.length < batch.total) {
      return;
    }

    const failCount = batch.results.filter((value) => value === 'fail').length;
    const historyResult = failCount === 0
      ? 'success'
      : failCount === batch.total
        ? 'fail'
        : 'partial';

    this.postHistory({
      sendType: batch.sendType,
      roomName: batch.rooms.join(', '),
      sendMessage: batch.message,
      filePath: batch.filePath,
      result: historyResult,
    }).catch((error) => {
      this.addHistory(`발송 이력 저장 실패: ${error.message}`);
    });

    if (batch.isRepeat === 'N' && batch.rowSeq) {
      this.disableOneTimeRow({
        seq: batch.rowSeq,
        completedDate: batch.completedDate,
      }).catch((error) => {
        this.addHistory(`1회성 발송 비활성화 실패: ${error.message}`);
      });
    }

    delete this.batchResults[item.batchId];
  }

  async sendMessage(roomName, message, filePath, fileFirst = true) {
    try {
      if (!this.isRunning) {
        return 'fail';
      }

      this.sendStats.current += 1;
      this.updateProgress();
      this.addHistory(`[${this.sendStats.current}/${this.sendStats.total}] [${roomName}] 발송 시작`);

      await this.verifyReady();

      let roomOpened = false;
      try {
        roomOpened = await this.withTimeout(
          '열린 창 확인',
          () => this.driver.focusRoomByName(roomName),
          2500,
        );
      } catch (error) {
        this.addHistory(`[${roomName}] 열린 창 확인 실패: ${error.message}`);
      }

      if (!roomOpened) {
        this.addHistory(`[${roomName}] 열린 창이 없어 채팅 목록에서 열기를 시도합니다.`);
        try {
          roomOpened = await this.withTimeout(
            '채팅 목록 열기',
            () => this.driver.openRoomByNameFromList(roomName, 20),
            7000,
          );
        } catch (error) {
          this.addHistory(`[${roomName}] 채팅 목록 열기 실패: ${error.message}`);
        }
      }

      if (!roomOpened) {
        this.addHistory(`[${roomName}] 채팅 목록에서 못 찾아 검색으로 열기를 시도합니다.`);
        try {
          roomOpened = await this.withTimeout(
            '검색 열기',
            () => this.driver.searchAndOpenRoomByName(roomName),
            7000,
          );
        } catch (error) {
          this.addHistory(`[${roomName}] 검색 열기 실패: ${error.message}`);
        }
      }

      if (!roomOpened) {
        this.addHistory(`[${roomName}] 채팅방 열기 실패`);
        this.sendStats.fail += 1;
        this.updateProgress();
        return 'fail';
      }

      const contentDelaySec = 1.8;
      if (fileFirst && filePath) {
        await this.driver.sendFile(filePath);
        if (message) {
          await this.randomDelay(contentDelaySec - 0.4, contentDelaySec + 0.4);
          await this.driver.sendText(message);
        }
      } else {
        if (message) {
          await this.driver.sendText(message);
        }
        if (filePath) {
          if (message) {
            await this.randomDelay(contentDelaySec - 0.4, contentDelaySec + 0.4);
          }
          await this.driver.sendFile(filePath);
        }
      }

      this.sendStats.success += 1;
      this.updateProgress();
      this.addHistory(`[${roomName}] 발송 성공`);
      return 'success';
    } catch (error) {
      this.sendStats.fail += 1;
      this.updateProgress();
      this.addHistory(`[${roomName}] 오류: ${error.message}`);
      return 'fail';
    }
  }

  async sendToTargets(targets, { message, filePath, fileFirst }) {
    if (!Array.isArray(targets) || targets.length === 0) {
      throw new Error('선택된 채팅방이 없습니다.');
    }

    if ((!message || !message.trim()) && !filePath) {
      throw new Error('메시지 또는 파일 중 하나는 입력해야 합니다.');
    }

    await this.verifyReady();

    const batchId = this.buildBatch(targets, {
      sendType: 'instant',
      message,
      filePath,
      isRepeat: 'Y',
    });

    for (const target of targets) {
      this.messageQueue.push({
        roomName: target.roomName,
        message,
        filePath,
        fileFirst: fileFirst === 'Y' || fileFirst === true,
        target,
        batchId,
      });
    }

    this.sendStats = {
      success: 0,
      fail: 0,
      total: this.sendStats.total + targets.length,
      current: this.sendStats.current,
    };
    this.updateProgress();
    this.addHistory(`선택 발송 ${targets.length}건이 큐에 추가되었습니다.`);

    if (!this.isRunning) {
      this.isRunning = true;
      this.isProcessing = true;

      while (this.messageQueue.length > 0 && this.isRunning) {
        const item = this.messageQueue.shift();
        let result = 'fail';

        try {
          const opened = await this.driver.openRoomFromList(item.target);
          if (opened) {
            result = await this.sendMessage(
              item.roomName,
              item.message,
              item.filePath,
              item.fileFirst
            );
          } else {
            this.sendStats.current += 1;
            this.sendStats.fail += 1;
            this.updateProgress();
            this.addHistory(`[${item.roomName}] 채팅 목록에서 해당 방을 다시 찾지 못했습니다.`);
          }
        } catch (error) {
          this.sendStats.current += 1;
          this.sendStats.fail += 1;
          this.updateProgress();
          this.addHistory(`[${item.roomName}] 채팅 목록 열기 오류: ${error.message}`);
        }

        this.trackBatchResult(item, result);
        if (this.messageQueue.length > 0 && this.isRunning) {
          await this.randomDelay(1.2, 2.0);
        }
      }

      this.isProcessing = false;
      this.isRunning = false;
      this.addHistory(`선택 발송 완료. 성공: ${this.sendStats.success}, 실패: ${this.sendStats.fail}`);
    }
  }

  async processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0 && this.isRunning) {
      const item = this.messageQueue.shift();
      const result = await this.sendMessage(
        item.roomName,
        item.message,
        item.filePath,
        item.fileFirst
      );
      this.trackBatchResult(item, result);

      if (this.messageQueue.length > 0 && this.isRunning) {
        await this.randomDelay(1.4, 2.4);
      }
    }

    this.isProcessing = false;
  }

  async queueScheduledRows(rows, now = new Date()) {
    const currentTime = toCurrentTimeString(now);
    const currentDay = DAY_NAMES[now.getDay()];
    const today = toTodayString(now);

    for (const row of rows) {
      if (row.enabled_yn === 'N') {
        continue;
      }

      if (row.is_repeat === 'N') {
        const rowDates = row.send_date ? row.send_date.split(',').map((value) => value.trim()) : [];
        if (!rowDates.includes(today)) {
          continue;
        }
      }

      if (row.is_repeat !== 'N' && !row.days.includes(currentDay)) {
        continue;
      }

      const sendTimes = row.send_time.split(',').map((value) => value.trim());
      if (!sendTimes.includes(currentTime)) {
        continue;
      }

      const sentKey = `${row.seq}_${currentDay}_${currentTime}`;
      if (this.sentKeys.has(sentKey)) {
        continue;
      }
      this.sentKeys.add(sentKey);

      const rooms = normalizeRoomNames(row.room_name);
      if (rooms.length === 0) {
        continue;
      }

      this.sendStats.total += rooms.length;
      this.updateProgress();

      const batchId = this.buildBatch(rooms, {
        sendType: 'scheduled',
        message: row.send_message,
        filePath: row.file_path,
        rowSeq: row.seq,
        isRepeat: row.is_repeat,
        completedDate: today,
      });

      for (const roomName of rooms) {
        this.messageQueue.push({
          roomName,
          message: row.send_message,
          filePath: row.file_path,
          fileFirst: row.file_first,
          rowSeq: row.seq,
          isRepeat: row.is_repeat,
          batchId,
        });
        this.addHistory(`예약 메시지가 큐에 추가되었습니다: ${roomName}`);
      }
    }
  }

  async runScheduledLoop() {
    if (this.isRunning) {
      this.addHistory('예약 발송이 이미 실행 중입니다.');
      return;
    }

    await this.verifyReady();

    this.isRunning = true;
    this.sentKeys.clear();
    this.sendStats = { success: 0, fail: 0, total: 0, current: 0 };
    this.updateProgress();
    this.addHistory('예약 발송을 시작합니다.');

    while (this.isRunning) {
      const now = new Date();

      try {
        const rows = await this.fetchSendList();
        await this.queueScheduledRows(rows, now);
      } catch (error) {
        this.addHistory(`발송 목록 조회 실패: ${error.message}`);
      }

      if (now.getMinutes() === 0) {
        this.sentKeys.clear();
      }

      await this.processQueue();

      const nextMinute = new Date();
      nextMinute.setMinutes(nextMinute.getMinutes() + 1);
      nextMinute.setSeconds(0);
      nextMinute.setMilliseconds(0);

      let remainingSeconds = (nextMinute - new Date()) / 1000;
      while (remainingSeconds > 0 && this.isRunning) {
        await this.delay(1);
        remainingSeconds -= 1;
      }
    }

    this.addHistory('예약 발송이 중단되었습니다.');
  }

  async sendNow({ roomNames, message, filePath, fileFirst }) {
    const rooms = normalizeRoomNames(roomNames);
    if (rooms.length === 0) {
      throw new Error('채팅방 이름을 입력해주세요.');
    }
    if ((!message || !message.trim()) && !filePath) {
      throw new Error('메시지 또는 파일 중 하나는 입력해야 합니다.');
    }

    await this.verifyReady();

    const batchId = this.buildBatch(rooms, {
      sendType: 'instant',
      message,
      filePath,
      isRepeat: 'Y',
    });

    for (const roomName of rooms) {
      this.messageQueue.push({
        roomName,
        message,
        filePath,
        fileFirst: fileFirst === 'Y' || fileFirst === true,
        batchId,
      });
    }

    this.sendStats = {
      success: 0,
      fail: 0,
      total: this.sendStats.total + rooms.length,
      current: this.sendStats.current,
    };
    this.updateProgress();
    this.addHistory(`즉시발송 ${rooms.length}건이 큐에 추가되었습니다.`);

    if (!this.isRunning) {
      this.isRunning = true;
      await this.processQueue();
      this.isRunning = false;
      this.addHistory(`즉시발송 완료. 성공: ${this.sendStats.success}, 실패: ${this.sendStats.fail}`);
    } else {
      await this.processQueue();
    }
  }

  async detectOpenRooms({ currentRoomName = '' } = {}) {
    await this.verifyReady();
    const rooms = await this.driver.listOpenRooms();
    if (rooms.length === 0) {
      return {
        rooms: [],
        message: '현재 열린 KakaoTalk 채팅방 창이 없습니다. 먼저 대화창을 열어주세요.',
      };
    }

    const mergedRoomName = currentRoomName
      ? `${currentRoomName}\n${rooms.join('\n')}`
      : rooms.join('\n');

    return {
      rooms,
      mergedRoomName,
    };
  }
}

module.exports = {
  KakaoSendEngine,
};
