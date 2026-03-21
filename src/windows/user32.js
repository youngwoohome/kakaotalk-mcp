'use strict';

const ffi = require('@breush/ffi-napi');
const iconv = require('iconv-lite');

const { KEYEVENTF_KEYUP, VK, WINDOW_CLASSES, WM } = require('../constants');

function createUser32Bindings() {
  if (process.platform !== 'win32') {
    throw new Error('user32 바인딩은 Windows에서만 실행할 수 있습니다.');
  }

  const user32 = ffi.Library('user32', {
    keybd_event: ['void', ['int', 'int', 'uint', 'ulonglong']],
    FindWindowA: ['longlong', ['pointer', 'pointer']],
    FindWindowExA: ['longlong', ['longlong', 'longlong', 'pointer', 'pointer']],
    SendMessageA: ['longlong', ['longlong', 'uint', 'longlong', 'pointer']],
    SendMessageW: ['longlong', ['longlong', 'uint', 'longlong', 'pointer']],
    PostMessageA: ['bool', ['longlong', 'uint', 'longlong', 'longlong']],
    SetForegroundWindow: ['bool', ['longlong']],
    GetForegroundWindow: ['longlong', []],
    GetWindowTextA: ['int', ['longlong', 'pointer', 'int']],
    GetClassNameA: ['int', ['longlong', 'pointer', 'int']],
    EnumWindows: ['bool', ['pointer', 'int32']],
    IsWindowVisible: ['bool', ['longlong']],
    GetWindowTextW: ['int', ['longlong', 'pointer', 'int']],
    GetWindowTextLengthW: ['int', ['longlong']],
  });

  function encodeCp949(value) {
    return value === null ? null : iconv.encode(value, 'cp949');
  }

  function FindWindowA(className, windowName) {
    return user32.FindWindowA(encodeCp949(className), encodeCp949(windowName));
  }

  function FindWindowExA(hwndParent, hwndChild, className, windowName) {
    return user32.FindWindowExA(
      hwndParent,
      hwndChild,
      encodeCp949(className),
      encodeCp949(windowName)
    );
  }

  function SendMessageW(hwnd, msg, wParam, lParam) {
    let buffer = lParam;

    if (typeof lParam === 'string') {
      buffer = Buffer.from(`${lParam}\0`, 'ucs2');
    } else if (lParam === null) {
      buffer = null;
    }

    return user32.SendMessageW(hwnd, msg, wParam, buffer);
  }

  function PostMessageA(hwnd, msg, wParam, lParam) {
    return user32.PostMessageA(hwnd, msg, wParam, lParam);
  }

  function SetForegroundWindow(hwnd) {
    return user32.SetForegroundWindow(hwnd);
  }

  function keybd_event(virtualKey, scanCode, flags, extraInfo) {
    return user32.keybd_event(virtualKey, scanCode, flags, extraInfo);
  }

  function sendKey(hwnd, key) {
    PostMessageA(hwnd, WM.KEYDOWN, key, 0);
    PostMessageA(hwnd, WM.KEYUP, key, 0);
  }

  function getOpenChatWindows() {
    const rooms = [];
    const callback = ffi.Callback('int32', ['longlong', 'int32'], (hwnd) => {
      try {
        const classNameBuffer = Buffer.alloc(256);
        user32.GetClassNameA(hwnd, classNameBuffer, 256);
        const className = classNameBuffer.toString('utf8').replace(/\0/g, '');

        if (className !== WINDOW_CLASSES.kakaoMain) {
          return 1;
        }

        const titleLength = user32.GetWindowTextLengthW(hwnd);
        if (titleLength <= 0) {
          return 1;
        }

        const titleBuffer = Buffer.alloc((titleLength + 1) * 2);
        user32.GetWindowTextW(hwnd, titleBuffer, titleLength + 1);
        const title = titleBuffer.toString('ucs2').replace(/\0/g, '');

        if (title && title !== '카카오톡' && title !== 'KakaoTalk') {
          rooms.push(title);
        }
      } catch {
        return 1;
      }

      return 1;
    });

    user32.EnumWindows(callback, 0);
    return rooms;
  }

  function pasteWithKeyboard() {
    keybd_event(VK.CONTROL, 0, 0, 0);
    keybd_event(VK.V, 0, 0, 0);
    keybd_event(VK.V, 0, KEYEVENTF_KEYUP, 0);
    keybd_event(VK.CONTROL, 0, KEYEVENTF_KEYUP, 0);
  }

  return {
    FindWindowA,
    FindWindowExA,
    SendMessageW,
    SetForegroundWindow,
    GetForegroundWindow: user32.GetForegroundWindow,
    keybd_event,
    sendKey,
    pasteWithKeyboard,
    getOpenChatWindows,
  };
}

module.exports = {
  createUser32Bindings,
};
