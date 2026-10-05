import { useNavigate } from 'react-router-dom';
import ExamBuilder from './ExamBuilder';

const ExamBuilderPage = () => {
  const navigate = useNavigate();

  const handleSave = (jsonStruct: string) => {
    console.log("Saving exam JSON:", jsonStruct);
    alert("Đã lưu đề thi thành công!");
    navigate('/admin/exams');
  };

  const handleCancel = () => {
    navigate('/admin/exams');
  };

  return (
    <div className="slide-up">
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Tạo Đề thi Mới</h1>
        <button className="btn btn-outline" onClick={handleCancel}>
          Trở về Danh sách
        </button>
      </div>
      
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

      <ExamBuilder onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
};

export default ExamBuilderPage;
