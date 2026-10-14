import React from 'react';
import { Flag, Check } from 'lucide-react';

export interface TestQuestionPaletteProps {
  totalQuestions: number;
  currentQuestionNumber: number;
  answersMap: Record<number, { selectedKey: string | null; flagged: boolean }>;
  onSelectQuestion: (questionNumber: number) => void;
  className?: string;
}

export const TestQuestionPalette: React.FC<TestQuestionPaletteProps> = ({
  totalQuestions,
  currentQuestionNumber,
  answersMap,
  onSelectQuestion,
  className = '',
}) => {
  // Thống kê số lượng câu hỏi theo trạng thái
  let answeredCount = 0;
  let flaggedCount = 0;

  for (let i = 1; i <= totalQuestions; i++) {
    const item = answersMap[i];
    if (item?.selectedKey) {
      answeredCount++;
    }
    if (item?.flagged) {
      flaggedCount++;
    }
  }

  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className={`bg-white rounded-md border border-slate-200 p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Tiêu đề & Thống kê */}
      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100">
        <h3 className="text-base font-bold text-slate-900">
          Danh sách câu hỏi
        </h3>
        <span className="text-sm font-medium text-slate-600">
          <strong className="text-amber-600 font-bold">{answeredCount}</strong>/{totalQuestions} đã làm
        </span>
      </div>

      {/* Chú giải trạng thái */}
      <div className="flex flex-wrap items-center gap-3.5 text-sm text-slate-700 mb-4 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span>Đang chọn</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span>Đã làm</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block" />
          <span>Gắn cờ</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
          <span>Chưa làm</span>
        </div>
      </div>

      {/* Lưới các ô câu hỏi */}
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: totalQuestions }, (_, index) => {
          const qNum = index + 1;
          const isCurrent = qNum === currentQuestionNumber;
          const ansItem = answersMap[qNum];
          const isAnswered = !!ansItem?.selectedKey;
          const isFlagged = !!ansItem?.flagged;

          let btnStyle =
            'relative h-9 rounded font-bold text-sm flex items-center justify-center transition-colors cursor-pointer select-none';

          if (isCurrent) {
            btnStyle += ' bg-amber-500 text-white shadow-2xs ring-2 ring-amber-300 ring-offset-1';
          } else if (isFlagged && isAnswered) {
            btnStyle += ' bg-amber-50 text-amber-900 border border-amber-400 hover:bg-amber-100';
          } else if (isFlagged) {
            btnStyle += ' bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100';
          } else if (isAnswered) {
            btnStyle += ' bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100';
          } else {
            btnStyle += ' bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100';
          }

          return (
            <button
              key={qNum}
              type="button"
              onClick={() => onSelectQuestion(qNum)}
              className={btnStyle}
              title={`Câu ${qNum}${isAnswered ? ' (Đã làm)' : ''}${isFlagged ? ' (Đã gắn cờ)' : ''}`}
            >
              <span>{qNum}</span>

              {isFlagged && (
                <Flag
                  className={`absolute top-0.5 right-0.5 w-2 h-2 ${
                    isCurrent ? 'text-amber-200 fill-amber-200' : 'text-amber-600 fill-amber-600'
                  }`}
                />
              )}

              {isAnswered && !isCurrent && !isFlagged && (
                <Check className="absolute bottom-0.5 right-0.5 w-2 h-2 text-emerald-600" />
              )}
            </button>
          );
        })}
      </div>

      {/* Thông tin phụ trợ */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 text-center text-sm text-slate-600 font-medium">
        {unansweredCount === 0 ? (
          <span className="text-emerald-600 font-semibold">Đã chọn đáp án tất cả câu hỏi!</span>
        ) : (
          <span>Còn {unansweredCount} câu chưa chọn</span>
        )}
      </div>
    </div>
  );
};
