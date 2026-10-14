import { useState, useRef, useEffect, useCallback } from 'react';
import { vocabTestApi } from '../api/vocabTestApi';
import type { VocabTestAnswerItem } from '../types/vocabTest.types';

export interface UseVocabTestProgressOptions {
  testToken: string;
  initialVersion: number;
  initialAnswers?: VocabTestAnswerItem[];
  isReadOnly?: boolean;
  onConflict?: (serverAnswers: VocabTestAnswerItem[], serverVersion: number) => void;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useVocabTestProgress({
  testToken,
  initialVersion,
  initialAnswers = [],
  isReadOnly = false,
  onConflict,
}: UseVocabTestProgressOptions) {
  // Chuyển mảng câu trả lời ban đầu sang Record dạng dictionary để truy cập O(1)
  const [answersMap, setAnswersMap] = useState<Record<number, { selectedKey: string | null; flagged: boolean }>>(() => {
    const map: Record<number, { selectedKey: string | null; flagged: boolean }> = {};
    initialAnswers.forEach((ans) => {
      map[ans.questionNumber] = {
        selectedKey: ans.selectedKey ?? null,
        flagged: !!ans.flagged,
      };
    });
    return map;
  });

  const [confirmedVersion, setConfirmedVersion] = useState<number>(initialVersion);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Refs quản lý hàng đợi autosave single-flight
  const confirmedVersionRef = useRef<number>(initialVersion);
  confirmedVersionRef.current = confirmedVersion;

  const answersMapRef = useRef(answersMap);
  answersMapRef.current = answersMap;

  const isSavingRef = useRef<boolean>(false);
  const hasPendingChangesRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef<string>(JSON.stringify(initialAnswers));

  // Hàm chuyển đổi Map thành mảng VocabTestAnswerItem chuẩn
  const getAnswersArray = useCallback((): VocabTestAnswerItem[] => {
    return Object.entries(answersMapRef.current).map(([numStr, val]) => ({
      questionNumber: Number(numStr),
      selectedKey: val.selectedKey,
      flagged: val.flagged,
    }));
  }, []);

  // Thực hiện gọi API lưu tiến độ (đảm bảo single-flight: chỉ 1 request tại một thời điểm)
  const performSave = useCallback(async (): Promise<boolean> => {
    if (isReadOnly || !testToken) return true;

    const currentAnswers = getAnswersArray();
    const currentSnapshot = JSON.stringify(currentAnswers);

    // Bỏ qua nếu dữ liệu không hề thay đổi so với lần lưu trước
    if (currentSnapshot === lastSavedSnapshotRef.current) {
      setSaveStatus('saved');
      return true;
    }

    // Nếu đang có một request in-flight, đánh dấu có thay đổi đang chờ để chạy tiếp sau
    if (isSavingRef.current) {
      hasPendingChangesRef.current = true;
      return false;
    }

    isSavingRef.current = true;
    hasPendingChangesRef.current = false;
    setSaveStatus('saving');

    try {
      const response = await vocabTestApi.saveProgress(
        testToken,
        confirmedVersionRef.current,
        currentAnswers
      );

      const newVersion = response.progressVersion;
      setConfirmedVersion(newVersion);
      confirmedVersionRef.current = newVersion;
      lastSavedSnapshotRef.current = currentSnapshot;
      setLastSavedAt(new Date());
      setSaveStatus('saved');
      isSavingRef.current = false;

      // Nếu trong lúc chờ server phản hồi có thay đổi mới phát sinh, lưu tiếp lần nữa
      if (hasPendingChangesRef.current) {
        hasPendingChangesRef.current = false;
        performSave();
      }

      return true;
    } catch (err: unknown) {
      isSavingRef.current = false;
      const errorObj = err as { response?: { status?: number; data?: unknown } };

      // Xử lý 409 Conflict: Tiến độ trên server đã bị ghi đè bởi thiết bị/tab khác
      if (errorObj?.response?.status === 409) {
        setSaveStatus('error');
        try {
          const res = await vocabTestApi.resumeTest(testToken);
          setConfirmedVersion(res.progressVersion);
          confirmedVersionRef.current = res.progressVersion;

          const updatedMap: Record<number, { selectedKey: string | null; flagged: boolean }> = {};
          res.savedAnswers.forEach((ans) => {
            updatedMap[ans.questionNumber] = {
              selectedKey: ans.selectedKey ?? null,
              flagged: !!ans.flagged,
            };
          });
          setAnswersMap(updatedMap);
          lastSavedSnapshotRef.current = JSON.stringify(res.savedAnswers);

          if (onConflict) {
            onConflict(res.savedAnswers, res.progressVersion);
          }
        } catch {
          // Bỏ qua lỗi resume nếu mạng lỗi
        }
        return false;
      }

      setSaveStatus('error');
      return false;
    }
  }, [testToken, isReadOnly, getAnswersArray, onConflict]);

  // Kích hoạt debounce autosave khi người dùng tương tác
  const triggerDebouncedSave = useCallback(() => {
    if (isReadOnly) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, 1500); // 1.5s debounce sau thao tác cuối
  }, [isReadOnly, performSave]);

  // Hành động chọn đáp án cho 1 câu hỏi
  const selectAnswer = useCallback(
    (questionNumber: number, optionKey: string) => {
      if (isReadOnly) return;

      setAnswersMap((prev) => {
        const currentVal = prev[questionNumber];
        // Cho phép toggle bỏ chọn nếu click lại chính đáp án đó
        const nextKey = currentVal?.selectedKey === optionKey ? null : optionKey;
        return {
          ...prev,
          [questionNumber]: {
            selectedKey: nextKey,
            flagged: currentVal ? currentVal.flagged : false,
          },
        };
      });

      triggerDebouncedSave();
    },
    [isReadOnly, triggerDebouncedSave]
  );

  // Hành động gắn/bỏ cờ xem lại cho 1 câu hỏi
  const toggleFlag = useCallback(
    (questionNumber: number) => {
      if (isReadOnly) return;

      setAnswersMap((prev) => {
        const currentVal = prev[questionNumber];
        return {
          ...prev,
          [questionNumber]: {
            selectedKey: currentVal?.selectedKey ?? null,
            flagged: !currentVal?.flagged,
          },
        };
      });

      triggerDebouncedSave();
    },
    [isReadOnly, triggerDebouncedSave]
  );

  // Autosave định kỳ mỗi 30 giây để đảm bảo tiến độ luôn được lưu
  useEffect(() => {
    if (isReadOnly || !testToken) return;

    const interval = setInterval(() => {
      performSave();
    }, 30000);

    return () => clearInterval(interval);
  }, [isReadOnly, testToken, performSave]);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    answersMap,
    confirmedVersion,
    saveStatus,
    lastSavedAt,
    selectAnswer,
    toggleFlag,
    flushSave: performSave,
    getAnswersArray,
  };
}
