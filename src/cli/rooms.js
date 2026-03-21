'use strict';

const { createMacAutomationDriver } = require('../macos/automation-driver');

function parseArgs(argv) {
  const result = {
    limit: 50,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') {
      result.json = true;
      continue;
    }
    if (token === '--limit') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('--limit 뒤에 숫자가 필요합니다.');
      }
      result.limit = Math.max(1, Number(next) || 50);
      index += 1;
    }
  }

  return result;
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

function sortRoomsByActivity(rooms) {
  return [...rooms].sort((left, right) => {
    const leftDate = parseLastActivity(left.lastActivity);
    const rightDate = parseLastActivity(right.lastActivity);
    const leftTime = leftDate ? leftDate.getTime() : -1;
    const rightTime = rightDate ? rightDate.getTime() : -1;

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return String(left.roomName || '').localeCompare(String(right.roomName || ''), 'ko');
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const driver = createMacAutomationDriver();
  const rooms = await driver.listChatRooms(options.limit);
  const sortedRooms = sortRoomsByActivity(rooms).map((room, index) => ({
    index: index + 1,
    roomName: room.roomName,
    lastActivity: room.lastActivity || '',
  }));

  if (options.json) {
    process.stdout.write(`${JSON.stringify(sortedRooms, null, 2)}\n`);
    return;
  }

  process.stdout.write(`채팅방 ${sortedRooms.length}개\n\n`);
  for (const room of sortedRooms) {
    process.stdout.write(`${room.index}. ${room.roomName} :: ${room.lastActivity || '-'}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
