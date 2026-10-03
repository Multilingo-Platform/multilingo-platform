import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Target, 
  Clock, 
  ArrowLeft, 
  BarChart2, 
  MessageSquare, 
  Zap, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  Award,
  ChevronRight
} from 'lucide-react';

const ExamResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'writing' | 'mcq'>('writing');
  const [selectedError, setSelectedError] = useState<number | null>(null);

  // Error annotations for AI Diff-View
  const diffErrors = [
    {
      id: 1,
      original: 'overly self-centred',
      corrected: 'excessively egocentric',
      type: 'Lexical Choice',
      reason: 'Từ "self-centred" mang tính văn nói (informal). Trong văn cảnh học thuật IELTS Writing Task 2, "excessively egocentric" hoặc "preoccupied with personal interests" sẽ đạt điểm Lexical Resource Band 8.0+.'
    },
    {
      id: 2,
      original: 'underprivileged realities',
      corrected: 'socio-economic disparities',
      type: 'Academic Collocation',
      reason: 'Cụm từ "underprivileged realities" chưa thật sự tự nhiên (unnatural collocation). Nên thay bằng "socio-economic disparities" hoặc "societal inequalities".'
    },
    {
      id: 3,
      original: 'cleaning up initiatives',
      corrected: 'environmental rehabilitation campaigns',
      type: 'Vocabulary Sophistication',
      reason: 'Nâng cấp cụm từ để thể hiện vốn từ vựng phong phú và chuẩn xác theo chủ đề bảo vệ môi trường.'
    }
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.25rem 1rem 4rem' }}>
      
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#64748b', marginBottom: '1rem' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/dashboard')}>Trang chủ</span>
        <ChevronRight size={14} />
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/history')}>Lịch sử làm bài</span>
        <ChevronRight size={14} />
        <span style={{ color: '#0f172a', fontWeight: 600 }}>Chi tiết kết quả thi</span>
      </div>

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={() => navigate('/student/history')} 
            style={{ 
              padding: '0.5rem', 
              border: '1px solid #cbd5e1', 
              borderRadius: 5,
              background: '#ffffff',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 600, borderRadius: 4, padding: '2px 7px', fontSize: '0.75rem' }}>
                KẾT QUẢ THI
              </span>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                Báo Cáo Kết Quả Thi & Phân Tích: {id?.toUpperCase() || 'CAM-18-1'}
              </h1>
            </div>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Chấm điểm và phân tích tự động bằng Thuật toán So khớp & Trợ lý AI
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => navigate('/student/analytics')} 
            style={{ 
              borderRadius: 5, 
              fontSize: '0.85rem', 
              fontWeight: 600,
              padding: '0.5rem 1rem', 
              background: '#ffffff', 
              border: '1px solid #cbd5e1', 
              color: '#374151', 
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <BarChart2 size={16} /> Radar Năng Lực
          </button>
          <button 
            onClick={() => navigate(`/student/exam/${id || 'cam-18-1'}`)} 
            style={{ 
              borderRadius: 5, 
              fontSize: '0.85rem', 
              fontWeight: 600,
              padding: '0.5rem 1rem', 
              background: '#f59e0b', 
              border: '1px solid #d97706', 
              color: '#111827', 
              cursor: 'pointer' 
            }}
          >
            Làm Lại Đề Này
          </button>
        </div>
      </div>

      {/* Primary Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('writing')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            background: 'transparent',
            fontWeight: activeTab === 'writing' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'writing' ? '3px solid #f59e0b' : '3px solid transparent',
            color: activeTab === 'writing' ? '#111827' : '#64748b',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Sparkles size={16} color={activeTab === 'writing' ? '#d97706' : '#94a3af'} />
          <span>Đánh Giá AI Chấm Writing (Diff-View)</span>
          <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4, background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
            Band 7.0
          </span>
        </button>

        <button
          onClick={() => setActiveTab('mcq')}
          style={{
            padding: '0.65rem 1.25rem',
            border: 'none',
            background: 'transparent',
            fontWeight: activeTab === 'mcq' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'mcq' ? '3px solid #f59e0b' : '3px solid transparent',
            color: activeTab === 'mcq' ? '#111827' : '#64748b',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Target size={16} color={activeTab === 'mcq' ? '#d97706' : '#94a3af'} />
          <span>Tổng Quan Trắc Nghiệm (Reading / Listening)</span>
          <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
            Band 6.5
          </span>
        </button>
      </div>

      {/* TAB 1: AI WRITING EVALUATION & DIFF-VIEW */}
      {activeTab === 'writing' && (
        <div>
          
          {/* Top Score Banner for Writing */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            
            <div style={{ padding: '1.15rem 1.25rem', background: '#fffbeb', border: '1px solid #fde047', borderRadius: 6, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Overall Writing Band</span>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, lineHeight: 1.15, color: '#111827', margin: '4px 0' }}>7.0</div>
              <span style={{ fontSize: '0.75rem', color: '#78350f' }}>IELTS Academic Task 2</span>
            </div>

            <div style={{ padding: '1rem 1.15rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Task Achievement</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#d97706', margin: '3px 0' }}>7.0</div>
              <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45, margin: 0 }}>
                Trả lời đầy đủ các vế câu hỏi, lập luận rõ ràng và nhất quán.
              </p>
            </div>

            <div style={{ padding: '1rem 1.15rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Coherence & Cohesion</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#15803d', margin: '3px 0' }}>7.5</div>
              <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45, margin: 0 }}>
                Phân đoạn mạch lạc, liên kết câu tự nhiên bằng cohesive devices.
              </p>
            </div>

            <div style={{ padding: '1rem 1.15rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Lexical Resource</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#b45309', margin: '3px 0' }}>6.5</div>
              <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45, margin: 0 }}>
                Sử dụng từ vựng đa dạng nhưng còn một số chỗ chưa chuẩn văn cảnh.
              </p>
            </div>

            <div style={{ padding: '1rem 1.15rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Grammatical Accuracy</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#d97706', margin: '3px 0' }}>7.0</div>
              <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45, margin: 0 }}>
                Kiểm soát tốt cấu trúc câu phức, không mắc lỗi ngữ pháp cơ bản.
              </p>
            </div>
          </div>

          {/* Interactive Diff-View Container */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#d97706" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                  Giao Diện Interactive Diff-View (So Sánh Sửa Lỗi Chi Tiết)
                </h3>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Bấm vào các từ gạch đỏ để xem chi tiết phân tích của AI
              </span>
            </div>

            {/* Essay with clickable annotations */}
            <div style={{ 
              padding: '1.25rem 1.5rem', 
              background: '#f8fafc', 
              borderRadius: 5, 
              border: '1px solid #e2e8f0',
              fontSize: '0.98rem', 
              lineHeight: 1.85, 
              color: '#1e293b',
              fontFamily: 'inherit'
            }}>
              <p style={{ marginBottom: '1rem' }}>
                In contemporary society, whether volunteer work should be enforced as a compulsory obligation in high school curricula remains a subject of intense controversy. While some critics express concerns regarding academic overload, I firmly concur with the view that mandatory community service confers indispensable merits upon teenagers' holistic development and societal cohesion.
              </p>
              <p style={{ margin: 0 }}>
                Primarily, participation in unpaid community engagement nurtures a profound sense of civic responsibility and altruism. During their formative secondary education years, adolescents are susceptible to becoming{' '}
                <mark 
                  onClick={() => setSelectedError(1)}
                  style={{ 
                    background: '#fee2e2', 
                    color: '#b91c1c', 
                    padding: '2px 6px', 
                    borderRadius: 4, 
                    cursor: 'pointer', 
                    borderBottom: '2px dashed #ef4444',
                    fontWeight: 600
                  }}
                  title="Bấm để xem phân tích AI"
                >
                  overly self-centred
                </mark>{' '}
                due to mounting exam pressures. Engaging directly in charitable endeavors—such as aiding vulnerable elderly residents in nursing homes or assisting local{' '}
                <mark 
                  onClick={() => setSelectedError(3)}
                  style={{ 
                    background: '#fee2e2', 
                    color: '#b91c1c', 
                    padding: '2px 6px', 
                    borderRadius: 4, 
                    cursor: 'pointer', 
                    borderBottom: '2px dashed #ef4444',
                    fontWeight: 600
                  }}
                  title="Bấm để xem phân tích AI"
                >
                  cleaning up initiatives
                </mark>
                —allows students to witness{' '}
                <mark 
                  onClick={() => setSelectedError(2)}
                  style={{ 
                    background: '#fee2e2', 
                    color: '#b91c1c', 
                    padding: '2px 6px', 
                    borderRadius: 4, 
                    cursor: 'pointer', 
                    borderBottom: '2px dashed #ef4444',
                    fontWeight: 600
                  }}
                  title="Bấm để xem phân tích AI"
                >
                  underprivileged realities
                </mark>{' '}
                firsthand.
              </p>
            </div>

            {/* Error Detail Inspector Card */}
            {selectedError && (
              <div style={{ marginTop: '1.25rem', padding: '1.15rem', borderLeft: '4px solid #ef4444', background: '#fff5f5', borderRadius: 5, border: '1px solid #fecaca', borderLeftWidth: 4 }}>
                {(() => {
                  const err = diffErrors.find(e => e.id === selectedError);
                  if (!err) return null;
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fee2e2', color: '#b91c1c' }}>
                          Lỗi: {err.type}
                        </span>
                        <button 
                          onClick={() => setSelectedError(null)}
                          style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                        >
                          ✕ Đóng
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Văn bản gốc của bạn:</span>
                          <span style={{ fontSize: '0.95rem', color: '#b91c1c', textDecoration: 'line-through', fontWeight: 600 }}>{err.original}</span>
                        </div>
                        <ChevronRight size={16} color="#94a3af" />
                        <div>
                          <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Gợi ý sửa từ AI Gemini (Band 8.0+):</span>
                          <span style={{ fontSize: '0.98rem', color: '#15803d', fontWeight: 700 }}>{err.corrected}</span>
                        </div>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.55, margin: 0 }}>
                        <strong>Nhận xét chuyên sâu:</strong> {err.reason}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* AI Rewritten Masterpiece */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '4px solid #16a34a', borderRadius: 6, padding: '1.25rem 1.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.65rem' }}>
              <Award size={20} color="#15803d" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#166534', margin: 0 }}>
                Bản Viết Lại Band 8.5+ Từ Gemini AI (Model Essay)
              </h3>
            </div>
            <p style={{ fontSize: '0.92rem', lineHeight: 1.8, color: '#1e293b', fontStyle: 'italic', margin: 0 }}>
              "In contemporary educational discourse, whether unpaid volunteer service ought to be integrated as an obligatory component of secondary school curricula elicits divergent perspectives. Notwithstanding legitimate concerns regarding pupil workload, I firmly maintain that institutionalised civic engagement yields far-reaching advantages, fundamentally cultivating adolescents' socio-emotional maturity while reinforcing broader social cohesion..."
            </p>
          </div>

        </div>
      )}

      {/* TAB 2: OVERVIEW MCQ RESULT (Reading / Listening) */}
      {activeTab === 'mcq' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {/* Score Card */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde047', borderRadius: 6, padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: 4 }}>Band Score Đạt Được</span>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>6.5</div>
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.85rem', color: '#475569', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Target size={15} color="#d97706" /> <strong>32/40</strong> câu đúng</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={15} color="#d97706" /> <strong>54:12</strong> phút</div>
            </div>
          </div>

          {/* Breakdown Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1.25rem 1.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 0.85rem' }}>
              <BarChart2 size={17} color="#d97706" /> Phân Bố Đúng / Sai Theo Dạng Bài
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {[
                { type: 'Matching Headings', correct: 5, total: 5, pct: 100 },
                { type: 'Multiple Choice', correct: 8, total: 10, pct: 80 },
                { type: 'Summary Completion', correct: 7, total: 8, pct: 87 },
                { type: 'True / False / Not Given', correct: 4, total: 7, pct: 57 },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{item.type}</span>
                    <span style={{ color: '#64748b' }}>{item.correct}/{item.total} ({item.pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${item.pct}%`, height: '100%', background: item.pct > 70 ? '#16a34a' : '#f59e0b', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #f59e0b', borderRadius: 6, padding: '1.25rem 1.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 0.85rem' }}>
              <Zap size={17} color="#d97706" /> Nhận Xét Từ AI Trợ Lý
            </h3>
            <ul style={{ paddingLeft: '1.15rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', margin: 0, lineHeight: 1.55 }}>
              <li><strong>Điểm mạnh:</strong> Khả năng Skimming nắm ý chính cực kỳ chuẩn xác, làm bài Matching Headings với tốc độ rất nhanh.</li>
              <li><strong>Vùng trũng:</strong> Dạng câu hỏi True/False/Not Given thường bị nhầm lẫn giữa False (thông tin trái ngược) và Not Given (không đề cập).</li>
              <li><strong>Lời khuyên:</strong> Hệ thống đã tự động thêm 5 bài tập luyện True/False/Not Given vào danh sách bài tập đề xuất của bạn.</li>
            </ul>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExamResult;
