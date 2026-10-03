import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Headphones, PenTool, Award, ShieldCheck, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedLevel, setSelectedLevel] = useState('toeic_300');
  const [selectedTarget, setSelectedTarget] = useState('target_600');

  return (
    <div style={{ background: '#f8fafc', paddingBottom: '3.5rem' }}>
      
      {/* Hero Section - Clean & Conventional Education Style */}
      <section style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '2.5rem 0 2rem' }}>
        <div className="container" style={{ maxWidth: '1000px', textAlign: 'center' }}>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef3c7', border: '1px solid #fde68a', padding: '3px 10px', borderRadius: 4, fontSize: '0.8rem', color: '#92400e', fontWeight: 600, marginBottom: '0.75rem' }}>
            <span>NỀN TẢNG LUYỆN THI CHỨNG CHỈ TIẾNG ANH CHUẨN QUỐC TẾ</span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', margin: '0 0 0.6rem', lineHeight: 1.35 }}>
            Luyện Thi TOEIC & IELTS Online Chuẩn Format Đề Thi Thật
          </h1>

          <p style={{ fontSize: '0.92rem', color: '#4b5563', maxWidth: '650px', margin: '0 auto 1.5rem', lineHeight: 1.55 }}>
            Ngân hàng hơn 200+ bộ đề thi có giải thích chi tiết, chấm chữa bài Writing/Speaking tự động và hệ thống ghi nhớ từ vựng SRS thông minh.
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <button 
              onClick={() => navigate('/auth')}
              style={{
                background: '#f59e0b',
                color: '#111827',
                border: '1px solid #d97706',
                borderRadius: 5,
                padding: '0.65rem 1.4rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#eab308'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f59e0b'}
            >
              LÀM BÀI TEST ĐẦU VÀO MIỄN PHÍ <ArrowRight size={15} />
            </button>
            
            <button 
              onClick={() => navigate('/student/library')}
              style={{
                background: '#ffffff',
                color: '#374151',
                border: '1px solid #cbd5e1',
                borderRadius: 5,
                padding: '0.65rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
            >
              Xem Thư Viện Đề Thi
            </button>
            
            <button 
              onClick={() => navigate('/prototype-map')}
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: 5,
                padding: '0.65rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Sơ Đồ 27 Màn Hình Prototype
            </button>
          </div>

          {/* Simple Statistics Grid - Rectangular */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', textAlign: 'left' }}>
            {[
              { val: '15,000+', lbl: 'Câu hỏi chuẩn hóa', sub: 'Theo cấu trúc đề thi thật ETS & Cam' },
              { val: '98.4%', lbl: 'Học viên đạt mục tiêu', sub: 'Tăng ít nhất 1.0 Band sau 3 tháng' },
              { val: '< 3 giây', lbl: 'AI phản hồi chấm điểm', sub: 'Giải thích chi tiết ngữ pháp & từ vựng' },
              { val: '24/7', lbl: 'Học tập mọi lúc mọi nơi', sub: 'Đồng bộ tiến độ trên mọi thiết bị' },
            ].map((stat, idx) => (
              <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '3px solid #f59e0b', borderRadius: 5, padding: '0.75rem 1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{stat.val}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>{stat.lbl}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{stat.sub}</div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Target Level Selector - Inspired by Zenlish */}
      <section style={{ padding: '2rem 0' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1.75rem 2rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                Lộ Trình Luyện Thi Theo Đúng Trình Độ Nền Của Bạn
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 4 }}>
                Chọn trình độ hiện tại và mục tiêu điểm số mong muốn để nhận đề xuất phù hợp
              </p>
            </div>

            {/* Step 1: Current Level */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                1. Hãy chọn trình độ hiện tại của bạn:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
                {[
                  { id: 'toeic_loss', title: 'TOEIC: 1 - 295', desc: 'Mất gốc / Chưa vững ngữ pháp' },
                  { id: 'toeic_300', title: 'TOEIC: 300 - 595', desc: 'Có kiến thức căn bản' },
                  { id: 'toeic_600', title: 'TOEIC: 600 - 650', desc: 'Nắm chắc kiến thức nền' },
                ].map(item => (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedLevel(item.id)}
                    style={{
                      border: selectedLevel === item.id ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                      background: selectedLevel === item.id ? '#fffbeb' : '#ffffff',
                      borderRadius: 5,
                      padding: '0.75rem 0.95rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827' }}>{item.title}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2: Target Goal */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                2. Chọn mục tiêu điểm số bạn muốn chinh phục:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
                {[
                  { id: 'target_500', title: 'TOEIC 550+', desc: 'Đạt chuẩn tốt nghiệp Đại học' },
                  { id: 'target_600', title: 'TOEIC 650 - 750+', desc: 'Ứng tuyển doanh nghiệp lớn' },
                  { id: 'target_800', title: 'TOEIC 800 - 900+', desc: 'Giao tiếp & làm việc quốc tế' },
                ].map(item => (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedTarget(item.id)}
                    style={{
                      border: selectedTarget === item.id ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                      background: selectedTarget === item.id ? '#fffbeb' : '#ffffff',
                      borderRadius: 5,
                      padding: '0.75rem 0.95rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827' }}>{item.title}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button - Yellow CTA */}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => navigate('/auth')}
                style={{
                  background: '#f59e0b',
                  color: '#111827',
                  border: '1px solid #d97706',
                  borderRadius: 5,
                  padding: '0.75rem 2rem',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#eab308'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f59e0b'}
              >
                Xác Định Trình Độ Và Nhận Lộ Trình Miễn Phí
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* Feature Sections - Clear rectangular boxes */}
      <section style={{ padding: '0 0 1rem' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {[
              {
                title: 'Luyện Đề Nghe (Listening)',
                desc: 'Đầy đủ Audio chuẩn bản xứ, kèm transcript chi tiết và tính năng tra cứu từ vựng trực tiếp khi click vào văn bản.',
                tag: 'Listening',
                path: '/student/exam/1/listening'
              },
              {
                title: 'Chấm Chữa Bài Viết (Writing)',
                desc: 'Chấm điểm 4 tiêu chí chuẩn IELTS với đề xuất sửa lỗi ngữ pháp, cải thiện vốn từ và viết lại đoạn văn tự nhiên.',
                tag: 'Writing AI',
                path: '/student/exam/1/writing'
              },
              {
                title: 'Sổ Tay Từ Vựng SRS',
                desc: 'Áp dụng phương pháp lặp lại ngắt quãng SuperMemo SM-2, nhắc nhở ôn tập đúng thời điểm vàng sắp quên.',
                tag: 'Flashcards',
                path: '/student/flashcards'
              },
            ].map((card, i) => (
              <div 
                key={i}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 7px', borderRadius: 4 }}>{card.tag}</span>
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: '0 0 0.4rem' }}>{card.title}</h3>
                  <p style={{ color: '#4b5563', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>{card.desc}</p>
                </div>
                <div style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  <button 
                    onClick={() => navigate(card.path)}
                    style={{ background: 'none', border: 'none', color: '#d97706', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    Xem chi tiết <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

    </div>
  );
};

export default LandingPage;
