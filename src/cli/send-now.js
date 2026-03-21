'use strict';

const { createEngine } = require('../runtime/create-engine');
const {
  createConsoleLogger,
  createConsoleProgress,
  getStoreDir,
  loadJsonArg,
} = require('./common');

async function main() {
  const payload = loadJsonArg();
  const engine = createEngine({
    storeDir: getStoreDir(),
    log: createConsoleLogger('instant'),
    onProgress: createConsoleProgress('instant-progress'),
  });

  await engine.sendNow(payload);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
