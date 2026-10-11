import { useEffect } from 'react';

export type KeyHandler = (e: KeyboardEvent) => void;

export interface KeyboardShortcutsMap {
  [key: string]: KeyHandler;
}

/**
 * Custom Hook lắng nghe phím tắt bàn phím.
 * Tự động bỏ qua khi người dùng đang nhập liệu trong input, textarea hoặc select.
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcutsMap,
  enabled: boolean = true
): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Bỏ qua nếu đang gõ trong input, textarea hoặc contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key;
      const code = e.code;

      if (shortcuts[key]) {
        shortcuts[key](e);
      } else if (shortcuts[code]) {
        shortcuts[code](e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled]);
};
