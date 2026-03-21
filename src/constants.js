'use strict';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const WINDOW_CLASSES = {
  kakaoMain: 'EVA_Window_Dblclk',
  kakaoChild: 'EVA_ChildWindow',
  kakaoList: 'EVA_Window',
  edit: 'Edit',
};

const VK = {
  RETURN: 0x0d,
  ESCAPE: 0x1b,
  T: 0x54,
  V: 0x56,
  CONTROL: 0x11,
};

const WM = {
  KEYDOWN: 0x0100,
  KEYUP: 0x0101,
  SETTEXT: 0x000c,
};

const KEYEVENTF_KEYUP = 0x0002;

module.exports = {
  DAY_NAMES,
  WINDOW_CLASSES,
  VK,
  WM,
  KEYEVENTF_KEYUP,
};
