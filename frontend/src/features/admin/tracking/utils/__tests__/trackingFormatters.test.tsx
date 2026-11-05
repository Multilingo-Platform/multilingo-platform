import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  formatAttemptStatusBadge,
  formatAttemptScore,
  getAttemptScoreText,
  formatTestModeBadge,
  formatDuration,
} from '../trackingFormatters';

describe('trackingFormatters', () => {
  describe('formatAttemptStatusBadge', () => {
    it('renders "Lỗi chấm điểm" badge with icon for GRADING_FAILED', () => {
      render(<div>{formatAttemptStatusBadge('GRADING_FAILED')}</div>);
      expect(screen.getByText('Lỗi chấm điểm')).toBeInTheDocument();
    });

    it('renders "Đã hoàn thành" badge for COMPLETED', () => {
      render(<div>{formatAttemptStatusBadge('COMPLETED')}</div>);
      expect(screen.getByText('Đã hoàn thành')).toBeInTheDocument();
    });

    it('renders "Đang làm bài" badge for IN_PROGRESS', () => {
      render(<div>{formatAttemptStatusBadge('IN_PROGRESS')}</div>);
      expect(screen.getByText('Đang làm bài')).toBeInTheDocument();
    });

    it('renders "Quá hạn / Hết giờ" badge for EXPIRED', () => {
      render(<div>{formatAttemptStatusBadge('EXPIRED')}</div>);
      expect(screen.getByText('Quá hạn / Hết giờ')).toBeInTheDocument();
    });

    it('renders "Đã nộp bài" badge for SUBMITTED', () => {
      render(<div>{formatAttemptStatusBadge('SUBMITTED')}</div>);
      expect(screen.getByText('Đã nộp bài')).toBeInTheDocument();
    });

    it('renders "AI đang chấm" badge for AI_GRADING', () => {
      render(<div>{formatAttemptStatusBadge('AI_GRADING')}</div>);
      expect(screen.getByText('AI đang chấm')).toBeInTheDocument();
    });

    it('renders "Chờ chấm AI" badge for AI_GRADING_QUEUED', () => {
      render(<div>{formatAttemptStatusBadge('AI_GRADING_QUEUED')}</div>);
      expect(screen.getByText('Chờ chấm AI')).toBeInTheDocument();
    });

    it('renders fallback badge for unknown status', () => {
      render(<div>{formatAttemptStatusBadge('UNKNOWN_STATUS')}</div>);
      expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
    });
  });

  describe('getAttemptScoreText and formatAttemptScore', () => {
    it('formats RAW_OBJECTIVE and LEGACY_RAW as "{score} câu đúng"', () => {
      expect(getAttemptScoreText(3, 'RAW_OBJECTIVE', 'NLTV')).toBe('3 câu đúng');
      expect(getAttemptScoreText(2, 'raw_objective', 'TOEIC')).toBe('2 câu đúng');
      expect(getAttemptScoreText(15, 'LEGACY_RAW', null)).toBe('15 câu đúng');

      render(<div>{formatAttemptScore(3, 'RAW_OBJECTIVE', 'NLTV')}</div>);
      expect(screen.getByText('3 câu đúng')).toBeInTheDocument();
    });

    it('formats IELTS scores as "Band {score}"', () => {
      expect(getAttemptScoreText(7.5, 'IELTS_BAND', 'IELTS')).toBe('Band 7.5');
      expect(getAttemptScoreText(6.0, null, 'IELTS_READING')).toBe('Band 6');
      expect(getAttemptScoreText(8.0, 'BAND', null)).toBe('Band 8');
    });

    it('formats TOEIC scores as "{score} điểm"', () => {
      expect(getAttemptScoreText(850, 'TOEIC_SCALED', 'TOEIC')).toBe('850 điểm');
      expect(getAttemptScoreText(750, null, 'TOEIC_FULL')).toBe('750 điểm');
    });

    it('formats general score units properly', () => {
      expect(getAttemptScoreText(9.5, 'Điểm', 'NLTV')).toBe('9.5 điểm');
      expect(getAttemptScoreText(20, 'câu', 'PRACTICE')).toBe('20 câu');
      expect(getAttemptScoreText(8, null, null)).toBe('8 đ');
    });

    it('handles null or undefined scores', () => {
      expect(getAttemptScoreText(null)).toBe('Chưa có');
      expect(getAttemptScoreText(undefined)).toBe('Chưa có');

      render(<div>{formatAttemptScore(null)}</div>);
      expect(screen.getByText('Chưa nộp / Chưa có')).toBeInTheDocument();
    });
  });

  describe('formatTestModeBadge', () => {
    it('renders "Thi thử" for MOCK_TEST', () => {
      render(<div>{formatTestModeBadge('MOCK_TEST')}</div>);
      expect(screen.getByText('Thi thử')).toBeInTheDocument();
    });

    it('renders "Luyện tập" for PRACTICE', () => {
      render(<div>{formatTestModeBadge('PRACTICE')}</div>);
      expect(screen.getByText('Luyện tập')).toBeInTheDocument();
    });
  });

  describe('formatDuration', () => {
    it('formats duration in seconds to Vietnamese text', () => {
      expect(formatDuration(0)).toBe('0 giây');
      expect(formatDuration(45)).toBe('45 giây');
      expect(formatDuration(120)).toBe('2 phút');
      expect(formatDuration(125)).toBe('2 phút 5 giây');
      expect(formatDuration(3600)).toBe('60 phút');
      expect(formatDuration(3665)).toBe('61 phút 5 giây');
    });
  });
});

