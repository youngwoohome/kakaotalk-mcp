'use strict';

function delay(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function randomDelay(minSec, maxSec) {
  const delaySec = Math.round((Math.random() * (maxSec - minSec) + minSec) * 10) / 10;
  return delay(Math.max(0, delaySec));
}

module.exports = {
  delay,
  randomDelay,
};
