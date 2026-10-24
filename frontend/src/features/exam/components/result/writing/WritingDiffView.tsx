import { examMessage as em, useExamLocale } from '../../../i18n/examMessages';
import React, { useState } from 'react';
import type { WritingDiffSegment } from '../../../types/api.types';

export interface WritingDiffViewProps {
  originalText: string | null;
  correctedEssay: string | null;
  diff: WritingDiffSegment[];
  className?: string;
}

export const WritingDiffView: React.FC<WritingDiffViewProps> = ({
  originalText,
  correctedEssay,
  diff,
  className = '',
}) => {
  useExamLocale();
  const [mode, setMode] = useState<'compare' | 'original' | 'corrected'>('compare');

  const renderContent = () => {
    if (mode === 'original') {
      if (originalText === null || originalText === undefined || originalText.length === 0) {
        return <span className="text-muted-foreground italic">{em("Không có nội dung bài viết.")}</span>;
      }
      return <span>{originalText}</span>;
    }

    if (mode === 'corrected') {
      if (correctedEssay === null || correctedEssay === undefined || correctedEssay.length === 0) {
        return <span className="text-muted-foreground italic">{em("Không có nội dung bài viết.")}</span>;
      }
      return <span>{correctedEssay}</span>;
    }

    // Default: 'compare' mode
    if (!diff || diff.length === 0) {
      if (originalText !== null && originalText !== undefined && originalText.length > 0) {
        return <span>{originalText}</span>;
      }
      return <span className="text-muted-foreground italic">{em("Không có nội dung bài viết.")}</span>;
    }

    return (
      <>
        {diff.map((segment, index) => {
          if (segment.type === 'DELETE') {
            return (
              <del
                key={index}
                className="bg-red-100 text-red-800 line-through dark:bg-red-950/60 dark:text-red-300 rounded-sm px-0.5"
              >
                {segment.text}
              </del>
            );
          }
          if (segment.type === 'INSERT') {
            return (
              <ins
                key={index}
                className="bg-emerald-100 text-emerald-800 underline dark:bg-emerald-950/60 dark:text-emerald-300 rounded-sm px-0.5"
              >
                {segment.text}
              </ins>
            );
          }
          return <span key={index}>{segment.text}</span>;
        })}
      </>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-lg border bg-muted/50 p-1"
          role="group"
          aria-label={em("Chế độ hiển thị bài viết")}
        >
          <button
            type="button"
            onClick={() => setMode('compare')}
            aria-pressed={mode === 'compare'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'compare'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {em("So sánh")}</button>
          <button
            type="button"
            onClick={() => setMode('original')}
            aria-pressed={mode === 'original'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'original'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {em("Bài gốc")}</button>
          <button
            type="button"
            onClick={() => setMode('corrected')}
            aria-pressed={mode === 'corrected'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'corrected'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {em("Bản sửa")}</button>
        </div>

        {mode === 'compare' && (
          <div
            className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
            aria-label={em("Chú thích chế độ so sánh")}
          >
            <span className="inline-flex items-center gap-1.5">
              <del className="bg-red-100 text-red-800 line-through dark:bg-red-950/60 dark:text-red-300 px-1 py-0.5 rounded font-medium text-[11px]">
                {em("Nội dung xóa")}</del>
              <span>{em("Phần cần loại bỏ (chữ gạch ngang)")}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ins className="bg-emerald-100 text-emerald-800 underline dark:bg-emerald-950/60 dark:text-emerald-300 px-1 py-0.5 rounded font-medium text-[11px]">
                {em("Nội dung thêm")}</ins>
              <span>{em("Phần sửa đổi / bổ sung (chữ gạch chân)")}</span>
            </span>
          </div>
        )}
      </div>

      <div
        className="rounded-lg border bg-card p-4 text-card-foreground leading-relaxed text-sm md:text-base font-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
        tabIndex={0}
        role="region"
        aria-label={em("Nội dung bài luận")}
      >
        {renderContent()}
      </div>
    </div>
  );
};
