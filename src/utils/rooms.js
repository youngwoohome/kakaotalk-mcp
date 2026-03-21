'use strict';

function normalizeRoomNames(roomNameValue) {
  if (Array.isArray(roomNameValue)) {
    return roomNameValue.map((name) => String(name).trim()).filter(Boolean);
  }

  if (typeof roomNameValue !== 'string') {
    return [];
  }

  if (roomNameValue.startsWith('[') && roomNameValue.endsWith(']')) {
    try {
      return normalizeRoomNames(JSON.parse(roomNameValue));
    } catch {
      return [roomNameValue.trim()].filter(Boolean);
    }
  }

  if (roomNameValue.includes('\n')) {
    return roomNameValue.split('\n').map((name) => name.trim()).filter(Boolean);
  }

  return [roomNameValue.trim()].filter(Boolean);
}

module.exports = {
  normalizeRoomNames,
};
