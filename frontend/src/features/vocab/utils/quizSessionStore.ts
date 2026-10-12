/**
 * Tiện ích lưu trữ tiến độ phiên luyện tập trắc nghiệm vào LocalStorage / IndexedDB.
 * Đảm bảo khôi phục tức thời khi reload trang hoặc rớt mạng.
 */

export interface SavedQuizProgress {
  sessionToken: string;
  currentIndex: number;
  answers: Record<number, { selectedOption: string; timeSpentSeconds: number }>;
  elapsedSeconds: number;
  lastUpdated: number;
}

const STORAGE_PREFIX = 'multilingo_quiz_progress_';

export const quizSessionStore = {
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
