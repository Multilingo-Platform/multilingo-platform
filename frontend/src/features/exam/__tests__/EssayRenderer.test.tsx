import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EssayRenderer from '../components/renderers/EssayRenderer';

describe('EssayRenderer Word Count & Warning', () => {
  it('shows neutral status when essay is empty', () => {
    render(<EssayRenderer value="" onChange={vi.fn()} questionText="Task 1" minWords={150} />);
    const counter = screen.getByTestId('essay-word-count');
    expect(counter).toHaveAttribute('data-status', 'empty');
    expect(counter).toHaveTextContent('0 / 150 từ');
  });

  it('shows warning alert when word count is below minimum threshold (Task 1: 150)', () => {
    render(<EssayRenderer value="This is a short essay." onChange={vi.fn()} questionText="Task 1" minWords={150} />);
    const counter = screen.getByTestId('essay-word-count');
    expect(counter).toHaveAttribute('data-status', 'warning');
    expect(counter).toHaveTextContent('5 / 150 từ');
    expect(counter).toHaveTextContent('Chưa đủ số từ tối thiểu');
  });

  it('shows success badge when word count meets or exceeds threshold', () => {
    const essay = Array(150).fill('word').join(' ');
    render(<EssayRenderer value={essay} onChange={vi.fn()} questionText="Task 1" minWords={150} />);
    const counter = screen.getByTestId('essay-word-count');
    expect(counter).toHaveAttribute('data-status', 'success');
    expect(counter).toHaveTextContent('150 từ');
    expect(counter).toHaveTextContent('Đạt yêu cầu');
  });

  it('supports Task 2 threshold with 250 words minimum', () => {
    const essay200 = Array(200).fill('sample').join(' ');
    render(<EssayRenderer value={essay200} onChange={vi.fn()} questionText="Task 2" minWords={250} />);
    const counter = screen.getByTestId('essay-word-count');
    expect(counter).toHaveAttribute('data-status', 'warning');
    expect(counter).toHaveTextContent('200 / 250 từ');
  });

  it('invokes onChange when user types into textarea', () => {
    const onChange = vi.fn();
    render(<EssayRenderer value="" onChange={onChange} questionText="Task 1" minWords={150} />);
    const textarea = screen.getByPlaceholderText(/Viết bài tự luận/i);
    fireEvent.change(textarea, { target: { value: 'New text' } });
    expect(onChange).toHaveBeenCalledWith('New text');
  });
});
