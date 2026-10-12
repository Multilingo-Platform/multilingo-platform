import type { PracticeSessionSnapshotDto } from '../types/vocab.types';

/**
 * Tiện ích lưu trữ tiến độ phiên luyện tập trắc nghiệm vào LocalStorage.
 * Đảm bảo khôi phục tức thời khi reload trang (F5) hoặc rớt mạng.
 */

export interface SavedQuizProgress {
  sessionToken: string;
  currentIndex: number;
  answers: Record<number, { selectedOption: string; timeSpentSeconds: number }>;
  elapsedSeconds: number;
  lastUpdated: number;
}

export interface ActiveQuizSessionState {
  deckId: number;
  session: PracticeSessionSnapshotDto;
  currentIndex: number;
  selectedAnswers: Record<
    number,
    { selectedOptionId: string; isCorrect: boolean; timeSpentSeconds: number }
  >;
  totalElapsedTime: number;
  lastUpdated: number;
}

const STORAGE_PREFIX = 'multilingo_quiz_progress_';
const ACTIVE_SESSION_PREFIX = 'multilingo_quiz_active_session_deck_';

export const quizSessionStore = {
  /**
   * Lưu toàn bộ trạng thái phiên làm bài trắc nghiệm đang hoạt động theo bộ thẻ (Deck).
   */
  saveActiveSession: (deckId: number, state: ActiveQuizSessionState): void => {
    try {
      localStorage.setItem(ACTIVE_SESSION_PREFIX + deckId, JSON.stringify(state));
    } catch (e) {
      console.warn('Không thể lưu phiên quiz active vào LocalStorage:', e);
    }
  },

  /**
   * Đọc lại phiên làm bài đang hoạt động. Tự động kiểm tra thời hạn (expiresAt trên snapshot và idle 30 phút).
   */
  getActiveSession: (deckId: number): ActiveQuizSessionState | null => {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_PREFIX + deckId);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ActiveQuizSessionState;
      if (!parsed || !parsed.session) return null;

      const expiresAt = new Date(parsed.session.expiresAt).getTime();
      const now = Date.now();
      if (!isNaN(expiresAt) && now >= expiresAt) {
        localStorage.removeItem(ACTIVE_SESSION_PREFIX + deckId);
        return null;
      }
      if (now - parsed.lastUpdated > 30 * 60 * 1000) {
        localStorage.removeItem(ACTIVE_SESSION_PREFIX + deckId);
        return null;
      }

      return parsed;
    } catch (e) {
      console.warn('Không thể đọc phiên quiz active từ LocalStorage:', e);
      return null;
    }
  },

  /**
   * Xóa phiên làm bài đang hoạt động khi đã nộp thành công hoặc thoát hẳn.
   */
  clearActiveSession: (deckId: number): void => {
    try {
      localStorage.removeItem(ACTIVE_SESSION_PREFIX + deckId);
    } catch (e) {
      console.warn('Không thể xóa phiên quiz active khỏi LocalStorage:', e);
    }
  },

  saveProgress: (
    sessionToken: string,
    currentIndex: number,
    answers: Record<number, { selectedOption: string; timeSpentSeconds: number }>,
    elapsedSeconds: number
  ): void => {
    try {
      const data: SavedQuizProgress = {
        sessionToken,
        currentIndex,
        answers,
        elapsedSeconds,
        lastUpdated: Date.now(),
      };
      localStorage.setItem(STORAGE_PREFIX + sessionToken, JSON.stringify(data));
    } catch (e) {
      console.warn('Không thể lưu tiến độ quiz vào LocalStorage:', e);
    }
  },

  getProgress: (sessionToken: string): SavedQuizProgress | null => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + sessionToken);
      if (!raw) return null;
      return JSON.parse(raw) as SavedQuizProgress;
    } catch (e) {
      console.warn('Không thể đọc tiến độ quiz từ LocalStorage:', e);
      return null;
    }
  },

  clearProgress: (sessionToken: string): void => {
    try {
      localStorage.removeItem(STORAGE_PREFIX + sessionToken);
    } catch (e) {
      console.warn('Không thể xóa tiến độ quiz khỏi LocalStorage:', e);
    }
  },
};
