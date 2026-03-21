'use strict';

const fs = require('fs/promises');
const path = require('path');

class LocalStore {
  constructor(options = {}) {
    this.storeDir = options.storeDir || path.resolve(process.cwd(), 'data');
    this.sendListPath = options.sendListPath || path.join(this.storeDir, 'send-list.json');
    this.historyPath = options.historyPath || path.join(this.storeDir, 'send-history.json');
  }

  async ensureFiles() {
    await fs.mkdir(this.storeDir, { recursive: true });
    await this.ensureJsonFile(this.sendListPath, []);
    await this.ensureJsonFile(this.historyPath, []);
  }

  async ensureJsonFile(filePath, fallbackValue) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(fallbackValue, null, 2));
    }
  }

  async readJson(filePath, fallbackValue) {
    await this.ensureFiles();

    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return fallbackValue;
    }
  }

  async writeJson(filePath, value) {
    await this.ensureFiles();
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
  }

  async fetchSendList() {
    const rows = await this.readJson(this.sendListPath, []);
    return Array.isArray(rows) ? rows.sort((a, b) => Number(a.seq) - Number(b.seq)) : [];
  }

  async saveSendList(rows) {
    await this.writeJson(this.sendListPath, Array.isArray(rows) ? rows : []);
  }

  normalizeRow(row, existingRow = null) {
    const roomNames = Array.isArray(row.room_name)
      ? row.room_name
      : String(row.room_name || '')
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean);

    const days = Array.isArray(row.days)
      ? row.days
      : String(row.days || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    const sendDates = Array.isArray(row.send_date)
      ? row.send_date.join(',')
      : String(row.send_date || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .join(',');

    const sendTime = Array.isArray(row.send_time)
      ? row.send_time.join(',')
      : String(row.send_time || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .join(',');

    return {
      seq: row.seq || existingRow?.seq || Date.now(),
      enabled_yn: row.enabled_yn === 'N' ? 'N' : 'Y',
      is_repeat: row.is_repeat === 'N' ? 'N' : 'Y',
      days,
      send_date: sendDates,
      send_time: sendTime,
      room_name: roomNames,
      send_message: String(row.send_message || ''),
      file_path: String(row.file_path || ''),
      file_first: row.file_first === false || row.file_first === 'N' ? false : true,
      createdAt: existingRow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completed_date: row.completed_date || existingRow?.completed_date || '',
    };
  }

  async upsertSendRow(row) {
    const rows = await this.fetchSendList();
    const index = rows.findIndex((current) => String(current.seq) === String(row.seq));
    const existingRow = index >= 0 ? rows[index] : null;
    const nextRow = this.normalizeRow(row, existingRow);

    if (index >= 0) {
      rows[index] = nextRow;
    } else {
      rows.push(nextRow);
    }

    await this.saveSendList(rows);
    return nextRow;
  }

  async deleteSendRows(seqList) {
    const targets = new Set((seqList || []).map((value) => String(value)));
    const rows = await this.fetchSendList();
    const nextRows = rows.filter((row) => !targets.has(String(row.seq)));
    await this.saveSendList(nextRows);
    return {
      ok: true,
      deletedCount: rows.length - nextRows.length,
    };
  }

  async toggleSendRow(seq) {
    const rows = await this.fetchSendList();
    const nextRows = rows.map((row) => {
      if (String(row.seq) !== String(seq)) {
        return row;
      }

      return {
        ...row,
        enabled_yn: row.enabled_yn === 'Y' ? 'N' : 'Y',
        updatedAt: new Date().toISOString(),
      };
    });

    await this.saveSendList(nextRows);
    return nextRows.find((row) => String(row.seq) === String(seq)) || null;
  }

  async resetSendList() {
    await this.saveSendList([]);
    return {
      ok: true,
    };
  }

  async postHistory(payload) {
    const history = await this.readJson(this.historyPath, []);
    const entry = {
      seq: Date.now(),
      createdAt: new Date().toISOString(),
      ...payload,
    };
    history.unshift(entry);
    await this.writeJson(this.historyPath, history);
    return entry;
  }

  async listHistory() {
    const history = await this.readJson(this.historyPath, []);
    return Array.isArray(history) ? history : [];
  }

  async clearHistory() {
    await this.writeJson(this.historyPath, []);
    return {
      ok: true,
    };
  }

  async disableOneTimeRow(payload) {
    const rows = await this.readJson(this.sendListPath, []);
    const nextRows = rows.map((row) => {
      if (String(row.seq) !== String(payload.seq)) {
        return row;
      }

      return {
        ...row,
        enabled_yn: 'N',
        completed_date: payload.completedDate || new Date().toISOString().slice(0, 10),
      };
    });

    await this.writeJson(this.sendListPath, nextRows);
    return {
      ok: true,
      seq: payload.seq,
    };
  }
}

module.exports = {
  LocalStore,
};
