import React from 'react';
import HtmlContent from '../content/HtmlContent';

interface Props {
  htmlContent?: string | null;
}

export const ExplanationBox: React.FC<Props> = ({ htmlContent }) => {
  if (!htmlContent || !htmlContent.trim()) {
    return (
      <div
        data-testid="explanation-box"
        className="mt-4 p-4 bg-[#FFFBEB] border border-[#F59E0B] rounded-md text-sm text-[#0F172A]"
      >
        <div className="font-semibold mb-1 text-[#F59E0B] flex items-center gap-1">
          <span>💡</span>
          <span>Giải thích chi tiết:</span>
        </div>
        <div className="text-gray-500 italic">Không có giải thích chi tiết cho câu hỏi này.</div>
      </div>
    );
  }

  return (
    <div
      data-testid="explanation-box"
      className="mt-4 p-4 bg-[#FFFBEB] border border-[#F59E0B] rounded-md text-sm text-[#0F172A]"
    >
      <div className="font-semibold mb-2 text-[#F59E0B] flex items-center gap-1">
        <span>💡</span>
        <span>Giải thích chi tiết:</span>
      </div>
      <HtmlContent html={htmlContent} className="prose max-w-none text-[#0F172A]" />
    </div>
  );
};
