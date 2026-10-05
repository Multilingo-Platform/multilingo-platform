import { render, screen } from '@testing-library/react';
import { ExplanationBox } from '../ExplanationBox';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

describe('ExplanationBox', () => {
  it('should render sanitized HTML and style classes', () => {
    render(<ExplanationBox htmlContent="<b>Lý do chọn A</b><script>alert(1)</script>" />);
    const box = screen.getByTestId('explanation-box');

    expect(box).toBeInTheDocument();
    expect(box).toHaveTextContent('Lý do chọn A');
    expect(box.innerHTML).not.toContain('<script>');
  });

  it('renders default message when htmlContent is empty or null', () => {
    render(<ExplanationBox htmlContent="" />);
    const box = screen.getByTestId('explanation-box');
    expect(box).toHaveTextContent('Không có giải thích chi tiết cho câu hỏi này.');
  });
});
