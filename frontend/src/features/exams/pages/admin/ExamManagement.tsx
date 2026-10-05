import { Plus, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ExamManagement = () => {
  const exams = [
    { id: 'cam-18-1', title: 'Cambridge IELTS 18 - Test 1', parts: 4, questions: 40, status: 'Active' },
    { id: 'cam-18-2', title: 'Cambridge IELTS 18 - Test 2', parts: 4, questions: 40, status: 'Active' },
    { id: 'toeic-2023', title: 'TOEIC ETS 2023', parts: 7, questions: 200, status: 'Draft' },
  ];

  const navigate = useNavigate();

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Quản lý Đề thi (Trực quan)</h1>
        <button className="btn btn-primary" onClick={() => navigate('/admin/exams/create')}>
          <Plus size={18} /> Tạo Đề thi Mới
        </button>
      </div>

      <div className="ed-card">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-dark)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Mã Đề thi</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Tên Đề thi</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Cấu trúc</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Trạng thái</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {exams.map(exam => (
              <tr key={exam.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{exam.id.toUpperCase()}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ fontWeight: 500 }}>{exam.title}</div>
                </td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{exam.parts} phần / {exam.questions} câu</div>
                </td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span className={`badge ${exam.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>{exam.status}</span>
                </td>
                <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                  <div className="flex-center" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ padding: '0.4rem', border: 'none' }}><Edit size={18} color="var(--primary)" /></button>
                    <button className="btn btn-outline" style={{ padding: '0.4rem', border: 'none' }}><Trash2 size={18} color="var(--danger)" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExamManagement;
