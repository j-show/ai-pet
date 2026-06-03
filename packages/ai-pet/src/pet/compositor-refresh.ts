import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { REFRESH_MIN_INTERVAL_MS } from '../constants/compositor';

let windowFocused = document.hasFocus();
let refreshPending = false;
let lastRefreshAt = 0;
let onFocusRepaint: (() => void) | null = null;

/** Register a callback to repaint the current animation when the window becomes key again. */
export const setFocusRepaintHandler = (handler: (() => void) | null) => {
  onFocusRepaint = handler;
};

let compositorListenersReady = false;

/** Track window focus and request native compositor refresh while unfocused. */
export const initCompositorRefresh = async () => {
  if (compositorListenersReady) {
    return;
  }
  compositorListenersReady = true;

  const appWindow = getCurrentWindow();

  await appWindow.listen('tauri://blur', () => {
    windowFocused = false;
  });

  await appWindow.listen('tauri://focus', () => {
    windowFocused = true;
    onFocusRepaint?.();
  });

  window.addEventListener('focus', () => {
    windowFocused = true;
    onFocusRepaint?.();
  });

  window.addEventListener('blur', () => {
    windowFocused = false;
  });
};

export const isWindowFocused = () => windowFocused;

/** Ask macOS to flush stale transparent-window layers after canvas updates. */
export const requestTransparentRepaint = () => {
  if (windowFocused) return;

  const now = performance.now();
  if (refreshPending || now - lastRefreshAt < REFRESH_MIN_INTERVAL_MS) return;

  refreshPending = true;
  queueMicrotask(() => {
    refreshPending = false;
    lastRefreshAt = performance.now();
    void invoke('invalidate_transparent_window').catch(error => {
      console.warn('invalidate_transparent_window failed:', error);
    });
  });
};
