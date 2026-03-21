'use strict';

const { execFile } = require('child_process');

function runOsaScript(lines, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = Number(options.timeoutMs) || 0;
    const args = [];
    for (const line of lines) {
      args.push('-e', line);
    }

    let settled = false;
    const child = execFile('osascript', args, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (settled) {
        return;
      }

      settled = true;
      if (error) {
        const message = stderr?.trim() || stdout?.trim() || error.message;
        reject(new Error(message));
        return;
      }

      resolve((stdout || '').trim());
    });

    if (timeoutMs > 0) {
      setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        child.kill('SIGKILL');
        reject(new Error(`osascript 시간 초과 (${timeoutMs}ms)`));
      }, timeoutMs);
    }
  });
}

module.exports = {
  runOsaScript,
};
