import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ExamBuilderPage from '../pages/admin/ExamBuilderPage';
import axiosClient from '../../../core/api/axiosClient';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));

describe('builder canonical persistence boundary', () => {
  it('loads, edits, saves once and reloads the same IDs, context, key, explanation and media', async () => {
    let stored = {
      title: 'ETS fixture', type: 'TOEIC_LR', examLanguage: 'en', published: false,
      sections: [{ skillType: 'READING', durationMinutes: 75, parts: [{ partNumber: 5, contentData: {
        part_title: 'Part 5: Sentences', instruction: 'Read', import_source_sha256: 'a'.repeat(64),
        question_groups: [{ group_id: 'g-stable', instruction: '', content_html: '<p>Đoạn đọc</p>',
          questions: [{ question_id: 'q_101', type: 'SINGLE_CHOICE', question_text: 'Question 101',
            options: [{ id: 'A', text: 'First' }, { id: 'B', text: 'Second' }, { id: 'C', text: 'Third' }, { id: 'D', text: 'Fourth' }],
            correct_answer: 'B', explanation: 'Old explanation', media: { type: 'image', url: 'https://cdn.example.com/q.png' },
          }] }],
      } }] }],
    };
    vi.mocked(axiosClient.get).mockImplementation(async () => ({ success: true, data: structuredClone(stored) }) as any);
    vi.mocked(axiosClient.put).mockImplementation(async (_url, payload) => {
      stored = structuredClone(payload as typeof stored);
      return { success: true } as any;
    });
    render(<MemoryRouter initialEntries={['/admin/exams/42']}>
      <Routes>
        <Route path="/admin/exams/:id" element={<ExamBuilderPage />} />
        <Route path="/admin/exams" element={<Link to="/admin/exams/42">Mở lại</Link>} />
      </Routes>
    </MemoryRouter>);
    await screen.findByDisplayValue('ETS fixture');
    fireEvent.change(await screen.findByDisplayValue('Second'), { target: { value: 'Second edited' } });
    fireEvent.click(screen.getAllByTitle('Chọn làm đáp án đúng')[2]);
    fireEvent.change(screen.getByDisplayValue('Old explanation'), { target: { value: 'Giải thích cập nhật' } });
    const save = screen.getByRole('button', { name: /lưu đề thi/i });
    fireEvent.click(save); fireEvent.click(save);
    await screen.findByRole('link', { name: 'Mở lại' });
    expect(axiosClient.put).toHaveBeenCalledTimes(1);
    const part = stored.sections[0].parts[0];
    expect(part.partNumber).toBe(5);
    expect(stored.sections[0].skillType).toBe('READING');
    expect(stored.published).toBe(false);
    expect(part.contentData.import_source_sha256).toBe('a'.repeat(64));
    const group = part.contentData.question_groups[0];
    expect(group.group_id).toBe('g-stable');
    expect(group.content_html).toBe('<p>Đoạn đọc</p>');
    expect(group.questions[0]).toMatchObject({ question_id: 'q_101', type: 'SINGLE_CHOICE', correct_answer: 'C',
      explanation: 'Giải thích cập nhật', media: { type: 'image', url: 'https://cdn.example.com/q.png' } });
    expect(group.questions[0]).not.toHaveProperty('metadata');
    fireEvent.click(screen.getByRole('link', { name: 'Mở lại' }));
    await waitFor(() => expect(screen.getByDisplayValue('Second edited')).toBeInTheDocument());
    expect(screen.getAllByTitle('Chọn làm đáp án đúng')[2]).toBeChecked();
    expect(screen.getByDisplayValue('Giải thích cập nhật')).toBeInTheDocument();
  });
});
