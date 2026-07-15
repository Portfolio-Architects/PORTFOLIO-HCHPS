'use client';

// Chrome 등 최신 브라우저 및 iframe 내에서 unload 이벤트 등록 시 Permissions Policy Violation 경고가 발생하는 현상을 우회합니다.
// 서드파티 라이브러리(y-partykit, partysocket 등)가 내부적으로 사용하는 unload 이벤트를 pagehide로 자동 매핑합니다.
if (typeof window !== 'undefined') {
  try {
    const rawAdd = window.addEventListener;
    window.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) {
      if (type === 'unload') {
        return rawAdd.call(window, 'pagehide', listener, options);
      }
      return rawAdd.call(window, type, listener, options);
    };

    const rawRemove = window.removeEventListener;
    window.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ) {
      if (type === 'unload') {
        return rawRemove.call(window, 'pagehide', listener, options);
      }
      return rawRemove.call(window, type, listener, options);
    };
  } catch (e) {
    console.warn('[Unload Bypass] Failed to patch addEventListener', e);
  }
}
