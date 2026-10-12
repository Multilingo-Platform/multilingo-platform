import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ObjectiveResultSummary } from '../components/result/ObjectiveResultSummary';
import { WritingResultSummary } from '../components/result/WritingResultSummary';
import { normalizeAttemptResult } from '../api/resultContract';
import { attemptResultFixture } from './fixtures/attemptResult';

function summary() { return normalizeAttemptResult(attemptResultFixture(), 42).resultSummary!; }

describe('backend summary components', () => {
  it('shows raw score and backend accuracy rather than band or correct count', () => {
    render(<ObjectiveResultSummary objective={summary().objective} />);
    expect(screen.getByText('Điểm khách quan (raw)')).toBeInTheDocument();
    expect(screen.getAllByText('5,5')).toHaveLength(3);
    expect(screen.getAllByText('33,33%')).toHaveLength(3);
    const partTable = screen.getByRole('table', { name: 'Kết quả theo phần thi' });
    expect(within(partTable).getByRole('row', { name: /Phần đọc tiếng Việt/ })).toHaveTextContent('READING');
    expect(within(partTable).getByRole('columnheader', { name: 'Bỏ trống' })).toHaveAttribute('scope', 'col');
  });
  it('zero objective count is explanatory, not a zero-over-zero result', () => {
    const objective = { ...summary().objective, rawScore: 0, correct: 0, incorrect: 0, unanswered: 0, total: 0, accuracy: 0, bySkill: [], byPart: [] };
    render(<ObjectiveResultSummary objective={objective} />);
    expect(screen.getByText(/Không có câu khách quan/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('0/0')).not.toBeInTheDocument();
  });
  it.each([
    ['PENDING', 'Đang chờ chấm'], ['QUEUED', 'Đang chờ xử lý'],
    ['FAILED', 'Chấm Writing thất bại'], ['UNAVAILABLE', 'Chưa có kết quả chấm Writing'],
  ] as const)('shows Writing %s with null scores and backend word count', (status, label) => {
    const writing = summary().writing!;
    writing.status = status; writing.tasks[0].status = status;
    render(<WritingResultSummary writing={writing} />);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText('123')).toBeInTheDocument(); expect(screen.getByText('Chưa có điểm')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('keeps repeated question IDs in different parts and escapes labels', () => {
    const writing = summary().writing!;
    writing.tasks[0].label = '<img src=x onerror=alert(1)> Tiếng Việt';
    writing.tasks.push({ ...writing.tasks[0], partId: 21, label: 'Bài thứ hai' });
    const { container } = render(<WritingResultSummary writing={writing} />);
    expect(screen.getByText('<img src=x onerror=alert(1)> Tiếng Việt')).toBeInTheDocument();
    expect(screen.getByText('Bài thứ hai')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getAllByText(/Câu essay/)).toHaveLength(2);
  });
  it('does not create a Writing section when backend has none', () => {
    const { container } = render(<WritingResultSummary writing={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
