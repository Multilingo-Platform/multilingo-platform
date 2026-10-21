import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import ExamBuilderPage from '../pages/admin/ExamBuilderPage';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));

describe('language-practice builder', () => {
  it('round-trips source language and explicit skill/duration through the canonical save request', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ success: true, data: {
      title: '日本語 読解', type: 'LANGUAGE_PRACTICE', examLanguage: 'ja-JP', published: false,
      sections: [{ skillType: 'READING', durationMinutes: 35, parts: [{ partNumber: 1, contentData: {
        part_title: '第一課', instruction: '読む', question_groups: [{ group_id: 'g1', instruction: '', content_html: '', questions: [] }],
      } }] }],
    } } as any);
    vi.mocked(axiosClient.put).mockResolvedValue({ success: true } as any);

    render(<MemoryRouter initialEntries={['/admin/exams/8']}><Routes>
      <Route path="/admin/exams/:id" element={<ExamBuilderPage />} />
      <Route path="/admin/exams" element={<div>Saved</div>} />
    </Routes></MemoryRouter>);

    await screen.findByDisplayValue('日本語 読解');
    expect(screen.getByRole('combobox', { name: 'Kỹ năng Part 1' })).toHaveValue('READING');
    expect(screen.getByRole('spinbutton', { name: 'Thời lượng Part 1' })).toHaveValue(35);
    fireEvent.click(screen.getByRole('button', { name: /lưu nháp/i }));
    await screen.findByText('Saved');

    const payload = vi.mocked(axiosClient.put).mock.calls[0][1] as any;
    expect(payload).toMatchObject({ type: 'LANGUAGE_PRACTICE', examLanguage: 'ja-JP', published: false,
      sections: [{ skillType: 'READING', durationMinutes: 35, parts: [{ partNumber: 1 }] }] });
    expect(payload.sections[0].parts[0].contentData.question_groups[0].group_id).toBe('g1');
    await waitFor(() => expect(axiosClient.put).toHaveBeenCalledTimes(1));
  });
});
