import React from 'react';

interface QuestionItem {
  id: number;
  content?: string;
  [key: string]: any;
}

interface Props {
  questions: QuestionItem[];
  isCorrectFlags: Record<string, boolean>;
  userAnswers: Record<string, any>;
  selectedQuestionId?: number | null;
  onSelectQuestion?: (questionId: number) => void;
}

export const ReviewPalette: React.FC<Props> = ({
  questions,
  isCorrectFlags,
  userAnswers,
  selectedQuestionId,
  onSelectQuestion,
}) => {
  let correctCount = 0;
  let incorrectCount = 0;
  let blankCount = 0;

  questions.forEach((q) => {
    const key = q.id.toString();
    const hasAnswer = userAnswers && userAnswers[key] !== undefined && userAnswers[key] !== null && userAnswers[key] !== '';
    if (!hasAnswer) {
      blankCount++;
    } else if (isCorrectFlags && isCorrectFlags[key] === true) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-base font-bold text-[#0F172A] mb-3">Bảng câu hỏi</h3>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-2 text-xs mb-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#16A34A]" />
          <span className="text-gray-700">{correctCount} Đúng</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#DC2626]" />
          <span className="text-gray-700">{incorrectCount} Sai</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-200" />
          <span className="text-gray-500">{blankCount} Chưa làm</span>
        </div>
      </div>

      {/* Grid of question buttons */}
      <div className="grid grid-cols-5 gap-2 max-h-[420px] overflow-y-auto p-1">
        {questions.map((q, idx) => {
          const key = q.id.toString();
          const hasAnswer = userAnswers && userAnswers[key] !== undefined && userAnswers[key] !== null && userAnswers[key] !== '';
          const isCorrect = isCorrectFlags && isCorrectFlags[key] === true;

          let colorClasses = 'bg-gray-200 text-gray-700 hover:bg-gray-300';
          if (hasAnswer) {
            colorClasses = isCorrect
              ? 'bg-[#16A34A] text-white hover:bg-green-700'
              : 'bg-[#DC2626] text-white hover:bg-red-700';
          }

          const isSelected = selectedQuestionId === q.id;
          const ringClass = isSelected ? 'ring-2 ring-offset-2 ring-[#0F172A]' : '';

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelectQuestion?.(q.id)}
              className={`h-9 rounded-md text-sm font-semibold transition-colors flex items-center justify-center cursor-pointer ${colorClasses} ${ringClass}`}
              title={`Câu ${idx + 1}`}
            >
              {q.id}
            </button>
          );
        })}
      </div>
    </div>
  );
};
