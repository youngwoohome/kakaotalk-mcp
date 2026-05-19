#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const roots = ['src', 'scripts', 'bin'];
const targets = [];

function walk(dirPath) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath);
      continue;
    }

    if (entry.name.endsWith('.js') || dirPath.endsWith(`${path.sep}bin`)) {
      targets.push(entryPath);
    }
  }
}

for (const root of roots) {
  walk(path.join(projectRoot, root));
}

for (const filePath of targets.sort()) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/^#!.*\n/, '');
  try {
    new vm.Script(source, { filename: path.relative(projectRoot, filePath) });
  } catch (error) {
    process.stderr.write(`${path.relative(projectRoot, filePath)}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
