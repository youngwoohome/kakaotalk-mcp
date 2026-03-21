'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function loadJsonArg(index = 2) {
  const target = process.argv[index];
  if (!target) {
    throw new Error('JSON 파일 경로를 인자로 전달해야 합니다.');
  }

  const absolutePath = path.resolve(process.cwd(), target);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function getStoreDir() {
  return process.env.STORE_DIR
    ? path.resolve(process.cwd(), process.env.STORE_DIR)
    : path.resolve(__dirname, '../../data');
}

function createConsoleLogger(prefix = 'engine') {
  return (message) => {
    const now = new Date().toISOString();
    process.stdout.write(`[${now}] [${prefix}] ${message}\n`);
  };
}

function createConsoleProgress(prefix = 'progress') {
  return (progress) => {
    process.stdout.write(
      `[${prefix}] ${progress.current}/${progress.total} success=${progress.success} fail=${progress.fail} percent=${progress.percent}\n`
    );
  };
}

module.exports = {
  loadJsonArg,
  getStoreDir,
  createConsoleLogger,
  createConsoleProgress,
};
