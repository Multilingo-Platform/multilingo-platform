import { useNavigate } from 'react-router-dom';
import { SYSTEM_SCREENS } from '../../components/FigmaPrototypeBar';
import { ArrowRight, Layers, ExternalLink, Sparkles, Shield, GraduationCap, CreditCard, Globe } from 'lucide-react';

const ScreenFlowMap = () => {
  const navigate = useNavigate();

  const getGroupIcon = (title: string) => {
    if (title.includes('Khách')) return <Globe size={20} color="#3b82f6" />;
    if (title.includes('Luyện thi')) return <GraduationCap size={20} color="#d97706" />;
    if (title.includes('Từ vựng')) return <Layers size={20} color="#10b981" />;
    if (title.includes('Gói cước')) return <CreditCard size={20} color="#8b5cf6" />;
    return <Shield size={20} color="#ef4444" />;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', padding: '3rem 2rem 6rem' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'rgba(217, 119, 6, 0.2)', border: '1px solid rgba(217, 119, 6, 0.4)', borderRadius: 20, color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <Sparkles size={14} /> FIGMA BLUEPRINT & INTERACTIVE PROTOTYPE
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#ffffff' }}>
              Sơ Đồ Luồng Màn Hình Toàn Hệ Thống (27 Giao Diện)
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: 850, marginTop: '0.5rem', lineHeight: 1.6 }}>
              Bản vẽ tương tác kiến trúc giao diện Multilingo Platform. Bấm vào bất kỳ màn hình nào để xem giao diện trực quan và trải nghiệm các tính năng như file thiết kế Figma thực thụ.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/student/dashboard')}
              style={{ padding: '0.85rem 1.5rem', fontSize: '1rem', borderRadius: 10 }}
            >
              Vào Không Gian Học Viên <ArrowRight size={18} />
            </button>
            <button 
              className="btn btn-outline"
              onClick={() => navigate('/admin/dashboard')}
              style={{ padding: '0.85rem 1.5rem', fontSize: '1rem', borderRadius: 10, borderColor: '#475569', color: '#cbd5e1' }}
            >
              Vào Admin Portal
            </button>
          </div>
        </div>

        {/* User Journeys Diagram Flow */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '2rem', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={20} color="#f59e0b" /> Trục Hành Trình Trải Nghiệm (Core User Flows)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: 12, borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>Luồng 1: Tiếp cận & Đăng ký</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>Landing Page ➔ Auth (Email/Google) ➔ Onboarding Mục tiêu (Target Band) ➔ Vào Dashboard</div>
            </div>
            <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: 12, borderLeft: '4px solid #d97706' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>Luồng 2: Luyện thi & AI Chấm</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>Thư viện Đề thi ➔ Thi Reading / Luyện Listening / Writing + AI Hints ➔ Xem Kết quả & Diff-View</div>
            </div>
            <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: 12, borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>Luồng 3: Từ vựng SRS & Radar</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>Bôi đen tra từ trong bài đọc ➔ Lưu Flashcard ➔ Phiên ôn tập Lật thẻ 3D (SM-2) ➔ Báo cáo Radar</div>
            </div>
            <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: 12, borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase' }}>Luồng 4: Gói cước & VNPAY</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>Xem Bảng giá VIP ➔ Quét mã VNPAY QR 15p ➔ Nâng hạng PREMIUM ➔ Biên lai điện tử</div>
            </div>
          </div>
        </div>

        {/* Grouped Screens Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {Object.entries(SYSTEM_SCREENS).map(([groupTitle, screens]) => (
            <div key={groupTitle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid #334155' }}>
                {getGroupIcon(groupTitle)}
                <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f1f5f9' }}>{groupTitle}</h3>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', background: '#1e293b', padding: '2px 8px', borderRadius: 10 }}>
                  {screens.length} màn hình
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {screens.map(screen => (
                  <div
                    key={screen.id}
                    onClick={() => navigate(screen.path)}
                    style={{
                      background: '#1e293b',
                      borderRadius: 14,
                      border: '1px solid #334155',
                      padding: '1.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 160
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.borderColor = '#d97706';
                      e.currentTarget.style.boxShadow = '0 12px 24px -10px rgba(217, 119, 6, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '#334155';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#0f172a', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                          {screen.uc}
                        </span>
                        {screen.badge ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: '#10b981', color: 'white' }}>
                            {screen.badge}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{screen.role}</span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
                        {screen.name}
                      </h4>
                      <code style={{ fontSize: '0.8rem', color: '#cbd5e1', background: '#0f172a', padding: '3px 6px', borderRadius: 4, display: 'inline-block' }}>
                        {screen.path}
                      </code>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, color: '#fbbf24', fontSize: '0.85rem', fontWeight: 600, marginTop: '1.25rem' }}>
                      <span>Mở xem giao diện</span>
                      <ExternalLink size={14} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScreenFlowMap;
