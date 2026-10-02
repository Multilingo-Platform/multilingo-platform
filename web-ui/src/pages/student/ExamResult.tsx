import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Target, Clock, ArrowLeft, BarChart2, MessageSquare, Zap } from 'lucide-react';

const ExamResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="container slide-up" style={{ padding: '2rem 0' }}>
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div className="flex-center" style={{ gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate('/student/dashboard')} style={{ padding: '0.5rem', border: 'none' }}><ArrowLeft size={20} /></button>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Phân tích Kết quả: {id?.toUpperCase()}</h1>
        </div>
        <button className="btn btn-primary" onClick={() => navigate(`/student/exam/${id}`)}>Xem lại bài chữa chi tiết</button>
      </div>

      <div className="dashboard-grid">
        {/* Score Overview */}
        <div className="ed-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: 'white' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, opacity: 0.9, marginBottom: '0.5rem' }}>Band Score Khuyến nghị</h3>
          <div style={{ fontSize: '4rem', fontWeight: 800 }}>6.5</div>
          <div className="flex-center" style={{ gap: '1.5rem', marginTop: '1rem', width: '100%' }}>
            <div className="flex-center" style={{ gap: '0.5rem' }}><Target size={18} /> 32/40 đúng</div>
            <div className="flex-center" style={{ gap: '0.5rem' }}><Clock size={18} /> 59:45 phút</div>
          </div>
        </div>

        {/* Radar Chart Placeholder */}
        <div className="ed-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={18} color="var(--primary)" /> Phân tích Kỹ năng (Radar)
          </h3>
          <div className="flex-center" style={{ height: '180px', border: '1px dashed var(--border-dark)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
            [Radar Chart Component]
            <br/>(Ngữ pháp, Từ vựng, Đọc hiểu, Logic)
          </div>
        </div>

        {/* AI Actionable Insights */}
        <div className="ed-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent)' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={18} color="var(--accent)" /> Nhận xét từ AI
          </h3>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <li><strong>Điểm mạnh:</strong> Bạn nắm rất tốt cấu trúc Matching Headings (Đạt 5/5 câu). Khả năng Skimming tốt.</li>
            <li><strong>Điểm yếu:</strong> Câu hỏi dạng True/False/Not Given thường bị nhầm lẫn giữa False và Not Given (Sai 3/7 câu).</li>
            <li><strong>Khuyến nghị:</strong> Cần ôn tập lại các từ vựng chỉ mức độ (always, often, completely) để tránh bẫy Not Given.</li>
          </ul>
        </div>
      </div>

      {/* AI Writing/Speaking Feedback Section (If applicable) */}
      <div className="ed-card" style={{ padding: '2rem', marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={24} color="var(--primary)" /> Đánh giá chi tiết (Writing/Speaking)
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Tiêu chí: Lexical Resource (Từ vựng) - <span style={{ color: 'var(--warning)' }}>Band 6.0</span></h4>
            <p style={{ color: 'var(--text-secondary)' }}>Bạn sử dụng vốn từ khá tốt nhưng lặp từ "important" quá nhiều (5 lần). AI gợi ý thay thế bằng: <strong>crucial, vital, paramount</strong>.</p>
          </div>
          
          <div style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Tiêu chí: Grammatical Range - <span style={{ color: 'var(--success)' }}>Band 7.0</span></h4>
            <p style={{ color: 'var(--text-secondary)' }}>Bạn đã sử dụng thành công câu điều kiện loại 2 và mệnh đề quan hệ rút gọn. Cố gắng duy trì phong độ này.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamResult;
