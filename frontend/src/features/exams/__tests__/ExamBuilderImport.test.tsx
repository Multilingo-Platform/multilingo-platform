import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExamBuilder from '../pages/admin/ExamBuilder';
import axiosClient from '../../../core/api/axiosClient';
import ExcelJS from 'exceljs';

vi.mock('../../../core/api/axiosClient', () => ({ default: { post: vi.fn() } }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));

describe('server-backed Excel import', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses the backend preview for IELTS instead of the legacy client parser', async () => {
    const workbook = new ExcelJS.Workbook();
    const info = workbook.addWorksheet('Thông Tin Đề Thi');
    info.addRow(['Tên đề thi', 'IELTS legacy']);
    info.addRow(['Mã loại chứng chỉ', 'IELTS_ACADEMIC']);
    vi.mocked(axiosClient.post).mockResolvedValue({ success: true, data: {
      request: { title: 'IELTS canonical', type: 'IELTS_ACADEMIC', examLanguage: 'en', published: false,
        sections: [{ skillType: 'READING', durationMinutes: 60, parts: [{ partNumber: 5, contentData: {
          part_title: 'Reading Passage 1', instruction: 'Read', question_groups: [{ group_id: 'g1', instruction: '', content_html: '<p>Passage</p>',
            questions: [{ question_id: 'r_001', type: 'TRUE_FALSE_NOT_GIVEN', question_number: 1, question_text: 'Statement',
              options: null, correct_answer: 'TRUE', explanation: null }] }],
        } }] }] },
      issues: [], counts: { parts: 1, groups: 1, questions: 1 }, sourceSha256: 'b'.repeat(64), canPublish: false,
    } } as any);
    const bytes = await workbook.xlsx.writeBuffer();
    const file = new File([bytes], 'IELTS.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes });
    const onSave = vi.fn();
    const { container } = render(<ExamBuilder initialData={null} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: /lưu nháp/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(JSON.parse(onSave.mock.calls[0][0]).exam_type).toBe('IELTS_ACADEMIC');
    expect(axiosClient.post).toHaveBeenCalledWith('/v1/admin/exams/import/preview', expect.any(FormData), expect.any(Object));
    expect(JSON.parse(onSave.mock.calls[0][0]).parts[0].question_groups[0].questions[0].question_id).toBe('r_001');
  });
  it('shows located content issues and saves the imported exam as a draft', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ success: true, data: {
      request: { title: 'ETS draft', type: 'TOEIC_LR', examLanguage: 'en', published: false,
        sections: [{ skillType: 'READING', durationMinutes: 75, parts: [{ partNumber: 5, contentData: {
          part_title: 'Part 5', instruction: 'Read', question_groups: [{ group_id: 'g1', instruction: '', content_html: '',
            questions: [{ question_id: 'q_101', type: 'SINGLE_CHOICE', question_text: 'Question 101',
              options: [{ id: 'A', text: 'First' }, { id: 'B', text: 'Second' }], correct_answer: 'B', explanation: 'Needs review' }] }],
        } }] }] },
      issues: [{ code: 'OPTIONS_INVALID', sheet: 'Exam Template', cell: 'K102', questionId: 'q_101', message: 'Cần kiểm tra lựa chọn.' }],
      counts: { parts: 1, groups: 1, questions: 1 }, sourceSha256: 'a'.repeat(64), canPublish: false,
    } });
    const onSave = vi.fn();
    const { container } = render(<ExamBuilder initialData={null} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['bytes'], 'ETS.xlsx')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('K102');
    expect(screen.getByRole('alert')).toHaveTextContent('q_101');
    fireEvent.click(screen.getByRole('button', { name: /lưu nháp/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(JSON.parse(onSave.mock.calls[0][0]).is_published).toBe(false);
  });
  it('announces failed uploads without replacing existing editor data', async () => {
    vi.mocked(axiosClient.post).mockRejectedValue(new Error('secret backend payload'));
    const { container } = render(<ExamBuilder initialData={null} onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['bytes'], 'bad.xlsx')] } });
    expect(await screen.findByRole('alert')).not.toHaveTextContent('secret backend payload');
  });
  it('does not treat a blank certificate code as permission to use legacy import', async () => {
    const workbook = new ExcelJS.Workbook();
    const info = workbook.addWorksheet('Thông Tin Đề Thi');
    info.addRow(['Mã loại chứng chỉ', '']);
    const sheet = workbook.addWorksheet('Exam Template');
    sheet.addRow(['Phần (Part)', 'Hướng dẫn chung (Phần)', 'Nhóm (Group)', 'Loại câu hỏi (Type)', 'Hướng dẫn riêng (Nhóm)', 'Nội dung nhóm (Văn bản đọc/nghe)', 'Câu hỏi (Question Text)']);
    sheet.addRow(['Part 5: Sentences', 'Read', 'Group 1', 'MULTIPLE_CHOICE', '', '', 'Question 101']);
    const bytes = await workbook.xlsx.writeBuffer();
    const file = new File([bytes], 'TOEIC.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes });
    vi.mocked(axiosClient.post).mockRejectedValue(new Error('Invalid file'));
    const { container } = render(<ExamBuilder onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(axiosClient.post).toHaveBeenCalledWith('/v1/admin/exams/import/preview', expect.any(FormData), expect.any(Object)));
    expect(screen.queryByRole('button', { name: /lưu nháp/i })).not.toBeInTheDocument();
  });
});
