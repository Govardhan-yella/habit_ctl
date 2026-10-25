/**
 * Bridge between web app and native iOS app (WKWebView)
 */

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        habitctl?: {
          postMessage: (message: any) => void;
        };
      };
    };
  }
}

export function isNativeApp(): boolean {
  return !!(window.webkit?.messageHandlers?.habitctl);
}

export function nativeHaptic(style: 'light' | 'medium' | 'heavy' | 'rigid' = 'medium') {
  if (!isNativeApp()) return;
  try {
    window.webkit!.messageHandlers!.habitctl!.postMessage({
      action: 'haptic',
      style,
    });
  } catch {}
}

export function nativeNotify(title: string, body: string) {
  if (!isNativeApp()) return;
  try {
    window.webkit!.messageHandlers!.habitctl!.postMessage({
      action: 'notify',
      title,
      body,
    });
  } catch {}
}

export function nativeSuccess() {
  if (!isNativeApp()) return;
  try {
    window.webkit!.messageHandlers!.habitctl!.postMessage({
      action: 'success',
    });
  } catch {}
}

export function nativeError() {
  if (!isNativeApp()) return;
  try {
    window.webkit!.messageHandlers!.habitctl!.postMessage({
      action: 'error',
    });
  } catch {}
}
