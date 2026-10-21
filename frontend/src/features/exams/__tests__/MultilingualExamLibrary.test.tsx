import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import ExamLibrary from '../pages/student/ExamLibrary';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn() } }));

describe('multilingual exam library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axiosClient.get).mockResolvedValue({ success: true, data: {
      items: [{ id: 9, type: 'LANGUAGE_PRACTICE', title: '日本語 読解', level: 'ja', tags: [], durationMinutes: 20, joins: 0 }],
      totalPages: 1, totalElements: 1,
    } } as any);
  });

  it('filters by source language and does not classify generic language practice as NLTV', async () => {
    render(<MemoryRouter><ExamLibrary /></MemoryRouter>);
    await screen.findByText('日本語 読解');
    const languageFilter = screen.getByRole('combobox', { name: /ngôn ngữ đề/i });
    fireEvent.change(languageFilter, { target: { value: 'ja' } });

    await waitFor(() => expect(axiosClient.get).toHaveBeenLastCalledWith('/v1/student/exams',
      expect.objectContaining({ params: expect.objectContaining({ examLanguage: 'ja' }) })));
    expect(screen.getByText('LANGUAGE')).toBeInTheDocument();
    expect(screen.queryByText('NLTV')).not.toBeInTheDocument();
  });

  it('includes the official NLTV exam type when filtering the NLTV library', async () => {
    render(<MemoryRouter><ExamLibrary /></MemoryRouter>);
    await screen.findByText('日本語 読解');
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'NLTV' } });

    await waitFor(() => expect(axiosClient.get).toHaveBeenLastCalledWith('/v1/student/exams',
      expect.objectContaining({ params: expect.objectContaining({ types: expect.stringContaining('NLTV') }) })));
  });
});
