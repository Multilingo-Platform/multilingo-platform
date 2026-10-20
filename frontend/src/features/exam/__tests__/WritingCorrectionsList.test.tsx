import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WritingCorrectionsList } from '../components/result/writing/WritingCorrectionsList';
import type { WritingCorrection } from '../types/api.types';

describe('WritingCorrectionsList component', () => {
  const sampleCorrections: WritingCorrection[] = [
    {
      start: 10,
      end: 15,
      replacement: 'crucial',
      explanation: 'Use more formal vocabulary instead of "good".',
    },
    {
      start: 25,
      end: 30,
      replacement: '',
      explanation: 'Redundant word; should be removed for conciseness.',
    },
  ];

  it('renders ordered list with 1-based index, positions, replacement, and explanations', () => {
    render(<WritingCorrectionsList corrections={sampleCorrections} />);

    // Renders list role
    expect(screen.getByRole('list')).toBeInTheDocument();

    // Renders 2 listitems
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    // First item
    expect(items[0]).toHaveTextContent('1');
    expect(items[0]).toHaveTextContent('crucial');
    expect(items[0]).toHaveTextContent('Use more formal vocabulary instead of "good".');
    expect(items[0]).toHaveTextContent('10 - 15');

    // Second item (deletion)
    expect(items[1]).toHaveTextContent('2');
    expect(items[1]).toHaveTextContent(/xóa/i);
    expect(items[1]).toHaveTextContent('Redundant word; should be removed for conciseness.');
    expect(items[1]).toHaveTextContent('25 - 30');
  });

  it('renders empty fallback when corrections array is empty', () => {
    render(<WritingCorrectionsList corrections={[]} />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText(/không có lỗi cần sửa đổi/i)).toBeInTheDocument();
  });

  it('TC_21_15: renders HTML-like content safely as text without DOM execution', () => {
    const maliciousCorrections: WritingCorrection[] = [
      {
        start: 0,
        end: 5,
        replacement: '<img src=x onerror=alert(1)>',
        explanation: 'Avoid using <b>raw tags</b> in writing.',
      },
    ];

    render(<WritingCorrectionsList corrections={maliciousCorrections} />);

    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('b')).toBeNull();
    expect(
      screen.getByText((content) => content.includes('<img src=x onerror=alert(1)>'))
    ).toBeInTheDocument();
    expect(screen.getByText('Avoid using <b>raw tags</b> in writing.')).toBeInTheDocument();
  });

  it('TC_21_10: preserves emoji surrogate pairs, CRLF and combining marks in corrections', () => {
    const unicodeCorrections: WritingCorrection[] = [
      {
        start: 42,
        end: 45,
        replacement: '🔬 scientists\r\nand cafe\u0301 🌍',
        explanation: 'Detailed research explanation:\r\n- Step 1: 🔬 observe\r\n- Step 2: 🌍 cooperate',
      },
    ];

    render(<WritingCorrectionsList corrections={unicodeCorrections} />);

    const item = screen.getByRole('listitem');
    expect(item.textContent).toContain('🔬 scientists');
    expect(item.textContent).toContain('🌍');
    expect(item.textContent).toContain('cafe\u0301');
  });

  it('TC_21_03_R1: replacement preserves whitespace and newlines with whitespace-pre-wrap', () => {
    const rawReplacement = 'one  two\nthree\tfour';
    const corrections: WritingCorrection[] = [
      {
        start: 0,
        end: 10,
        replacement: rawReplacement,
        explanation: 'Format spacing.',
      },
    ];

    render(<WritingCorrectionsList corrections={corrections} />);

    const item = screen.getByRole('listitem');
    expect(item.textContent).toContain(rawReplacement);

    const replacementSpan = screen.getByTestId('correction-replacement');
    expect(replacementSpan.textContent).toBe(`"${rawReplacement}"`);
    expect(replacementSpan.className).toContain('whitespace-pre-wrap');
    expect(replacementSpan.className).toContain('break-words');
    expect(replacementSpan.className).toContain('[overflow-wrap:anywhere]');
  });

  it('TC_21_03_R1: long replacement tokens wrap safely with min-w-0 and break-words without breaking flex reflow', () => {
    const longReplacement = 'a'.repeat(2000);
    const corrections: WritingCorrection[] = [
      {
        start: 0,
        end: 5,
        replacement: longReplacement,
        explanation: 'Extremely long replacement token.',
      },
    ];

    render(<WritingCorrectionsList corrections={corrections} />);

    const replacementSpan = screen.getByTestId('correction-replacement');
    expect(replacementSpan.textContent).toBe(`"${longReplacement}"`);
    expect(replacementSpan.className).toContain('break-words');
    expect(replacementSpan.className).toContain('[overflow-wrap:anywhere]');

    // Parent container must have min-w-0 to allow flexbox shrinking
    const parentContainer = replacementSpan.parentElement;
    expect(parentContainer?.className).toContain('min-w-0');
  });
});

