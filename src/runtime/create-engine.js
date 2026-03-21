'use strict';

const { KakaoSendEngine } = require('../engine/kakao-send-engine');
const { delay, randomDelay } = require('./delay');
const { LocalStore } = require('../storage/local-store');
const { createMacAutomationDriver } = require('../macos/automation-driver');

function createEngine(options = {}) {
  const store = options.store || new LocalStore({
    storeDir: options.storeDir,
    sendListPath: options.sendListPath,
    historyPath: options.historyPath,
  });

  const driver = options.driver || createMacAutomationDriver({
    config: options.driverConfig,
  });

  return new KakaoSendEngine({
    driver,
    delay,
    randomDelay,
    fetchSendList: () => store.fetchSendList(),
    postHistory: (payload) => store.postHistory(payload),
    disableOneTimeRow: (payload) => store.disableOneTimeRow(payload),
    log: options.log,
    onProgress: options.onProgress,
  });
}

module.exports = {
  createEngine,
};
