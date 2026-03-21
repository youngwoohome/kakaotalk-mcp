'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

let clipboardModulePromise = null;

async function getClipboardModule() {
  if (!clipboardModulePromise) {
    clipboardModulePromise = import('clipboardy');
  }

  const module = await clipboardModulePromise;
  return module.default || module;
}

async function setClipboardText(text) {
  const value = String(text ?? '');

  if (process.platform === 'darwin') {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await new Promise((resolve, reject) => {
          const child = execFile('pbcopy', (error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
          child.stdin.end(value);
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        const { stdout } = await execFileAsync('pbpaste');
        if (stdout === value) {
          return true;
        }
      } catch {
        // Retry.
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  const clipboardy = await getClipboardModule();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await clipboardy.write(value);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const current = await clipboardy.read();
      if (current === value) {
        return true;
      }
    } catch {
      // Retry with a short backoff to mimic the original app behaviour.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

async function getClipboardText() {
  if (process.platform === 'darwin') {
    const { stdout } = await execFileAsync('pbpaste');
    return stdout;
  }

  const clipboardy = await getClipboardModule();
  return clipboardy.read();
}

module.exports = {
  setClipboardText,
  getClipboardText,
};
