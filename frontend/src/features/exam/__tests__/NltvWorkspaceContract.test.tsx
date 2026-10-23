import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import QuestionRenderer from '../components/renderers/QuestionRenderer';
import { WritingPromptContent } from '../components/workspace/WritingPromptContent';
import type { Question, QuestionGroup } from '../types/exam.types';

const group: QuestionGroup = {
  group_id: 'nltv-p7-g1',
  instruction: 'Đọc đoạn văn và điền từ thích hợp vào các chỗ trống từ 1 đến 10. Các từ để chọn: thắng cảnh, đặc biệt, bảo tồn, hình thành, lớn nhất, đền, cùng, du khách, tham quan, làng cổ.',
  context_html: 'Với diện tích hơn 500 ha, hồ Tây là hồ tự nhiên (1) ____ của thành phố Hà Nội. (2) ____',
  shared_audio: null,
  shared_media: null,
  questions: [],
};

const questions: Question[] = Array.from({ length: 10 }, (_, index) => ({
  question_id: `q_${String(index + 1).padStart(3, '0')}`,
  question_number: index + 1,
  question_text: `Chỗ trống (${index + 1})`,
  type: 'FILL_IN_THE_BLANK',
  options: [],
  media: null,
}));

describe('NLTV Part 7 workspace contract', () => {
  it('shows the word bank and passage without audio, with ten labeled answer inputs', () => {
    const { container } = render(
      <>
        <WritingPromptContent
          partTitle="Kỹ năng Viết - Phần 1"
          partInstruction="Chọn từ phù hợp trong danh sách và điền vào chỗ trống trong đoạn văn."
          groups={[group]}
        />
        <div>
          {questions.map(question => (
            <QuestionRenderer
              key={question.question_id}
              question={question}
              partId={7}
              currentAnswer={null}
              onChange={() => undefined}
            />
          ))}
        </div>
      </>,
    );

    expect(screen.getByText(/Các từ để chọn: thắng cảnh/)).toBeInTheDocument();
    expect(screen.getByText(/hồ Tây là hồ tự nhiên \(1\) ____/)).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(10);
    for (let number = 1; number <= 10; number += 1) {
      expect(screen.getByRole('textbox', { name: `Chỗ trống (${number})` })).toBeInTheDocument();
    }
    expect(container.querySelector('audio')).not.toBeInTheDocument();
  });
});
