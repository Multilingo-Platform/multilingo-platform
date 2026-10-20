import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WritingDiffView } from '../components/result/writing/WritingDiffView';
import type { WritingDiffSegment } from '../types/api.types';

describe('WritingDiffView component', () => {
  const sampleDiff: WritingDiffSegment[] = [
    { type: 'EQUAL', text: 'Climate change is a ' },
    { type: 'DELETE', text: 'big' },
    { type: 'INSERT', text: 'pressing global' },
    { type: 'EQUAL', text: ' challenge.' },
  ];

  const originalText = 'Climate change is a big challenge.';
  const correctedEssay = 'Climate change is a pressing global challenge.';

  it('TC_21_01: defaults to "So sánh" mode and renders diff segments with del and ins', () => {
    render(
      <WritingDiffView
        originalText={originalText}
        correctedEssay={correctedEssay}
        diff={sampleDiff}
      />
    );

    const compareBtn = screen.getByRole('button', { name: /so sánh/i });
    const originalBtn = screen.getByRole('button', { name: /bài gốc/i });
    const correctedBtn = screen.getByRole('button', { name: /bản sửa/i });

    expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    expect(originalBtn).toHaveAttribute('aria-pressed', 'false');
    expect(correctedBtn).toHaveAttribute('aria-pressed', 'false');

    // del for DELETE
    const delElement = screen.getByText('big');
    expect(delElement.tagName.toLowerCase()).toBe('del');

    // ins for INSERT
    const insElement = screen.getByText('pressing global');
    expect(insElement.tagName.toLowerCase()).toBe('ins');

    // Legend present for accessibility (not color-only)
    expect(screen.getByText(/phần cần loại bỏ/i)).toBeInTheDocument();
    expect(screen.getByText(/phần sửa đổi \/ bổ sung/i)).toBeInTheDocument();
  });

  it('switches to "Bài gốc" mode when clicking "Bài gốc" button', () => {
    render(
      <WritingDiffView
        originalText={originalText}
        correctedEssay={correctedEssay}
        diff={sampleDiff}
      />
    );

    const originalBtn = screen.getByRole('button', { name: /bài gốc/i });
    fireEvent.click(originalBtn);

    expect(originalBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /so sánh/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    // Shows original text
    expect(screen.getByText(originalText)).toBeInTheDocument();
    // Does not show inserted text
    expect(screen.queryByText('pressing global')).not.toBeInTheDocument();
  });

  it('switches to "Bản sửa" mode when clicking "Bản sửa" button', () => {
    render(
      <WritingDiffView
        originalText={originalText}
        correctedEssay={correctedEssay}
        diff={sampleDiff}
      />
    );

    const correctedBtn = screen.getByRole('button', { name: /bản sửa/i });
    fireEvent.click(correctedBtn);

    expect(correctedBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /so sánh/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    // Shows corrected essay
    expect(screen.getByText(correctedEssay)).toBeInTheDocument();
    // Does not show deleted text
    expect(screen.queryByText('big')).not.toBeInTheDocument();
  });

  it('TC_21_10: preserves CRLF, emoji surrogate pairs, combining marks and whitespace in all modes', () => {
    const complexOriginal = 'Line 1: 🔬 Scientists\r\nLine 2: cafe\u0301 🌍';
    const complexCorrected = 'Line 1: 🔬 Dedicated scientists\r\nLine 2: cafe\u0301 🌍';
    const complexDiff: WritingDiffSegment[] = [
      { type: 'EQUAL', text: 'Line 1: 🔬 ' },
      { type: 'INSERT', text: 'Dedicated ' },
      { type: 'EQUAL', text: 'scientists\r\nLine 2: cafe\u0301 🌍' },
    ];

    render(
      <WritingDiffView
        originalText={complexOriginal}
        correctedEssay={complexCorrected}
        diff={complexDiff}
      />
    );

    // Compare mode
    expect(
      screen.getByText((_, element) => element?.tagName.toLowerCase() === 'span' && element?.textContent?.includes('scientists') && element?.textContent?.includes('🌍'))
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.tagName.toLowerCase() === 'ins' && element?.textContent === 'Dedicated ')
    ).toBeInTheDocument();

    const essayRegion = screen.getByRole('region', { name: /nội dung bài luận/i });

    // Switch to original
    fireEvent.click(screen.getByRole('button', { name: /bài gốc/i }));
    expect(essayRegion.textContent).toBe(complexOriginal);

    // Switch to corrected
    fireEvent.click(screen.getByRole('button', { name: /bản sửa/i }));
    expect(essayRegion.textContent).toBe(complexCorrected);
  });

  it('TC_21_15: renders HTML-like content safely as text without script execution', () => {
    const maliciousOriginal = '<script>window.pwned=true</script> & <b>bold</b>';
    const maliciousCorrected = '<script>window.pwned=true</script> & <strong>strong</strong>';
    const maliciousDiff: WritingDiffSegment[] = [
      { type: 'EQUAL', text: '<script>window.pwned=true</script> & ' },
      { type: 'DELETE', text: '<b>bold</b>' },
      { type: 'INSERT', text: '<strong>strong</strong>' },
    ];

    render(
      <WritingDiffView
        originalText={maliciousOriginal}
        correctedEssay={maliciousCorrected}
        diff={maliciousDiff}
      />
    );

    // Ensure raw text tags are rendered as text content, not parsed into DOM elements
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('<b>bold</b>').tagName.toLowerCase()).toBe('del');
    expect(screen.getByText('<strong>strong</strong>').tagName.toLowerCase()).toBe('ins');
    expect((window as any).pwned).toBeUndefined();
  });

  it('handles empty diff gracefully', () => {
    render(
      <WritingDiffView
        originalText=""
        correctedEssay=""
        diff={[]}
      />
    );

    expect(screen.getByText(/không có nội dung/i)).toBeInTheDocument();
  });

  it('TC_21_03_R2: maintains non-color visual markers (underline for ins, line-through for del) in diff and legend', () => {
    render(
      <WritingDiffView
        originalText={originalText}
        correctedEssay={correctedEssay}
        diff={sampleDiff}
      />
    );

    // ins in diff segment must have underline and not no-underline
    const insElement = screen.getByText('pressing global');
    expect(insElement.className).toContain('underline');
    expect(insElement.className).not.toContain('no-underline');

    // del in diff segment must have line-through
    const delElement = screen.getByText('big');
    expect(delElement.className).toContain('line-through');

    // ins in legend must have underline and not no-underline
    const legendIns = screen.getByText('Nội dung thêm');
    expect(legendIns.className).toContain('underline');
    expect(legendIns.className).not.toContain('no-underline');

    // del in legend must have line-through
    const legendDel = screen.getByText('Nội dung xóa');
    expect(legendDel.className).toContain('line-through');
  });

  it('TC_21_03_R2: supports keyboard interaction (Enter / Space) to switch viewing modes', () => {
    render(
      <WritingDiffView
        originalText={originalText}
        correctedEssay={correctedEssay}
        diff={sampleDiff}
      />
    );

    const originalBtn = screen.getByRole('button', { name: /bài gốc/i });
    const correctedBtn = screen.getByRole('button', { name: /bản sửa/i });
    const compareBtn = screen.getByRole('button', { name: /so sánh/i });

    // Focus and press Enter on "Bài gốc"
    originalBtn.focus();
    fireEvent.keyDown(originalBtn, { key: 'Enter', code: 'Enter' });
    fireEvent.click(originalBtn);
    expect(originalBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(originalText)).toBeInTheDocument();

    // Focus and press Space on "Bản sửa"
    correctedBtn.focus();
    fireEvent.keyDown(correctedBtn, { key: ' ', code: 'Space' });
    fireEvent.click(correctedBtn);
    expect(correctedBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(correctedEssay)).toBeInTheDocument();

    // Focus and press Enter on "So sánh"
    compareBtn.focus();
    fireEvent.keyDown(compareBtn, { key: 'Enter', code: 'Enter' });
    fireEvent.click(compareBtn);
    expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('pressing global')).toBeInTheDocument();
  });

  it('TC_21_03_R3: preserves whitespace-only essay across all three viewing modes without falling back to placeholder', () => {
    const whitespaceText = ' \r\n\t  ';
    const whitespaceDiff: WritingDiffSegment[] = [
      { type: 'EQUAL', text: whitespaceText },
    ];

    render(
      <WritingDiffView
        originalText={whitespaceText}
        correctedEssay={whitespaceText}
        diff={whitespaceDiff}
      />
    );

    const region = screen.getByRole('region', { name: /nội dung bài luận/i });
    const originalBtn = screen.getByRole('button', { name: /bài gốc/i });
    const correctedBtn = screen.getByRole('button', { name: /bản sửa/i });
    const compareBtn = screen.getByRole('button', { name: /so sánh/i });

    // 1. Compare mode: renders exact whitespace text
    expect(region.textContent).toBe(whitespaceText);
    expect(screen.queryByText(/không có nội dung/i)).not.toBeInTheDocument();

    // 2. Original mode: renders exact whitespace text, not placeholder
    fireEvent.click(originalBtn);
    expect(region.textContent).toBe(whitespaceText);
    expect(screen.queryByText(/không có nội dung/i)).not.toBeInTheDocument();

    // 3. Corrected mode: renders exact whitespace text, not placeholder
    fireEvent.click(correctedBtn);
    expect(region.textContent).toBe(whitespaceText);
    expect(screen.queryByText(/không có nội dung/i)).not.toBeInTheDocument();

    // Switch back to compare mode
    fireEvent.click(compareBtn);
    expect(region.textContent).toBe(whitespaceText);
  });
});

