'use strict';

const { createEngine } = require('../runtime/create-engine');
const {
  createConsoleLogger,
  createConsoleProgress,
  getStoreDir,
} = require('./common');

async function main() {
  const engine = createEngine({
    storeDir: getStoreDir(),
    log: createConsoleLogger('scheduled'),
    onProgress: createConsoleProgress('scheduled-progress'),
  });

  const stop = () => {
    engine.stop();
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await engine.runScheduledLoop();
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
