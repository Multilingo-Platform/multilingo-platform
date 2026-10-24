import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { normalizeExamType } from '../pages/admin/ExamBuilder';
import ExamBuilderPage from '../pages/admin/ExamBuilderPage';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));

describe('NLTV admin import identity', () => {
  it('preserves the canonical NLTV type while retaining legacy aliases', () => {
    expect(normalizeExamType('NLTV')).toBe('NLTV');
    expect(normalizeExamType('NLTV_B1_C1')).toBe('NLTV');
    expect(normalizeExamType('NLTV_A1_A2')).toBe('NLTV');
  });

  it('saves the Full NLTV wizard draft with its canonical type', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ success: true } as any);

    render(<MemoryRouter initialEntries={['/admin/exams/new']}><Routes>
      <Route path="/admin/exams/new" element={<ExamBuilderPage />} />
      <Route path="/admin/exams" element={<div>Saved</div>} />
    </Routes></MemoryRouter>);

    fireEvent.click(screen.getByText('1. Tạo Full Đề'));
    fireEvent.click(screen.getByRole('button', { name: 'Full NLTV' }));
    fireEvent.click(screen.getByRole('button', { name: /lưu đề thi/i }));

    await screen.findByText('Saved', {}, { timeout: 10000 });
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect(vi.mocked(axiosClient.post).mock.calls[0][1]).toMatchObject({
      type: 'NLTV',
      examLanguage: 'vi',
      published: false,
      sections: expect.arrayContaining([
        expect.objectContaining({ skillType: 'LISTENING' }),
        expect.objectContaining({ skillType: 'READING' }),
        expect.objectContaining({ skillType: 'WRITING' }),
      ]),
    });
  }, 20000);
});
