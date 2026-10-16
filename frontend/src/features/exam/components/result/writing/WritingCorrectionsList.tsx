import React from 'react';
import type { WritingCorrection } from '../../../types/api.types';

export interface WritingCorrectionsListProps {
  corrections: WritingCorrection[];
  className?: string;
}

export const WritingCorrectionsList: React.FC<WritingCorrectionsListProps> = ({
  corrections,
  className = '',
}) => {
  if (!corrections || corrections.length === 0) {
    return (
      <div className={`p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground italic ${className}`}>
        Không có lỗi cần sửa đổi hoặc chưa có gợi ý chỉnh sửa.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-semibold text-foreground">
        Chi tiết các điểm cần sửa đổi ({corrections.length})
      </h4>
      <ol className="space-y-3" role="list">
        {corrections.map((item, index) => {
          const isDeletion = !item.replacement || item.replacement.length === 0;

          return (
            <li
              key={index}
              className="rounded-lg border bg-card p-3.5 shadow-sm space-y-1.5 transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                    {index + 1}
                  </span>
                  {isDeletion ? (
                    <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/60 dark:text-red-300">
                      (Xóa đoạn này)
                    </span>
                  ) : (
                    <div className="text-sm font-medium text-foreground min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                      <span>Thay bằng: </span>
                      <span
                        data-testid="correction-replacement"
                        className="font-semibold text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                      >
                        "{item.replacement}"
                      </span>
                    </div>
                  )}
                </div>

                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  Vị trí: {item.start} - {item.end}
                </span>
              </div>

              <p className="text-xs md:text-sm text-muted-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere] pl-7">
                {item.explanation}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
