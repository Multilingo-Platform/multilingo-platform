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

  it('saves a Single Skill NLTV exam with its correct skill section and canonical part numbers', async () => {
    vi.mocked(axiosClient.post).mockClear();
    vi.mocked(axiosClient.post).mockResolvedValue({ success: true } as any);

    render(<MemoryRouter initialEntries={['/admin/exams/new']}><Routes>
      <Route path="/admin/exams/new" element={<ExamBuilderPage />} />
      <Route path="/admin/exams" element={<div>Saved</div>} />
    </Routes></MemoryRouter>);

    fireEvent.click(screen.getByText('2. Tạo 1 Kỹ năng'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'NLTV_READING' } });
    fireEvent.click(screen.getByRole('button', { name: /thêm kỹ năng này/i }));
    fireEvent.click(screen.getByRole('button', { name: /lưu đề thi/i }));

    await screen.findByText('Saved', {}, { timeout: 10000 });
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(axiosClient.post).mock.calls[0][1] as any;
    expect(payload).toMatchObject({
      type: 'NLTV_READING',
      examLanguage: 'vi',
      published: false,
    });
    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0].skillType).toBe('READING');
    expect(payload.sections[0].parts.map((p: any) => p.partNumber)).toEqual([5, 6]);
  }, 20000);
});
