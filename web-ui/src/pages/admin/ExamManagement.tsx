import React, { useState } from 'react';
import { Plus, UploadCloud, Edit, Trash2 } from 'lucide-react';
import ExamBuilder from './ExamBuilder';
import { ExamImportModal } from './ExamImportModal';

const ExamManagement = () => {
  const [exams, setExams] = useState([
    { id: 'cam-18-1', title: 'Cambridge IELTS 18 - Test 1', parts: 4, questions: 40, status: 'Active' },
    { id: 'cam-18-2', title: 'Cambridge IELTS 18 - Test 2', parts: 4, questions: 40, status: 'Active' },
    { id: 'toeic-2023', title: 'TOEIC ETS 2023', parts: 7, questions: 200, status: 'Draft' },
  ]);

  const [showUpload, setShowUpload] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const handleSaveExam = (jsonStruct: string) => {
    console.log("Cấu trúc JSONB chuẩn bị gửi xuống DB:", jsonStruct);
    alert("Đã tạo JSON thành công! Hãy bật Console để xem cấu trúc thật.");
    setShowUpload(false);
  };

  const handleImportSuccess = (examTitle: string) => {
    const newExam = {
      id: `imported-${Date.now().toString().slice(-4)}`,
      title: examTitle,
      parts: 4,
      questions: 40,
      status: 'Active'
    };
    setExams([newExam, ...exams]);
    alert(`Đã nạp thành công bộ đề "${examTitle}" vào hệ thống!`);
  };

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="badge badge-orange">UC14.1 - UC14.4 (CMS ĐỀ THI)</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4 }}>Quản lý Đề thi Đa cấp</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}>
            <UploadCloud size={18} /> Import từ File (Excel/JSON)
          </button>
          <button className="btn btn-primary" onClick={() => setShowUpload(!showUpload)}>
            <Plus size={18} /> Tạo Đề thi Mới (JSONB)
          </button>
        </div>
      </div>

      <ExamImportModal 
        isOpen={showImport} 
        onClose={() => setShowImport(false)} 
        onSuccess={handleImportSuccess} 
      />

      {showUpload && (
        <div className="slide-up" style={{ marginBottom: '2rem' }}>
          <div className="ed-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Thông tin cơ bản</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Mã đề thi (Exam Code)</label>
                <input type="text" className="input-field" placeholder="VD: IELTS-CAM-19-TEST-1" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Tiêu đề</label>
                <input type="text" className="input-field" placeholder="Cambridge IELTS 19 - Test 1" />
              </div>
            </div>
          </div>

          <ExamBuilder onSave={handleSaveExam} onCancel={() => setShowUpload(false)} />
        </div>
      )}

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
