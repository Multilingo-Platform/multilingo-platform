import { useState } from 'react';
import { 
  Settings, 
  Sparkles, 
  ShieldCheck, 
  Cpu, 
  Save, 
  CheckCircle2, 
  Sliders, 
  Lock, 
  Mail, 
  Server
} from 'lucide-react';

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState<'quota' | 'rbac' | 'general'>('quota');

  // Quota config state
  const [freeWritingQuota, setFreeWritingQuota] = useState(3);
  const [freeSpeakingQuota, setFreeSpeakingQuota] = useState(2);
  const [vipQuotaUnlimited, setVipQuotaUnlimited] = useState(true);

  // RBAC Matrix State
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({
    'EXAM_CREATE_EDIT': { ADMIN: true, TEACHER: true, MODERATOR: false, STUDENT: false },
    'EXAM_DELETE': { ADMIN: true, TEACHER: false, MODERATOR: false, STUDENT: false },
    'USER_MANAGEMENT': { ADMIN: true, TEACHER: false, MODERATOR: true, STUDENT: false },
    'AUDIT_LOGS_VIEW': { ADMIN: true, TEACHER: false, MODERATOR: false, STUDENT: false },
    'BILLING_PRICING': { ADMIN: true, TEACHER: false, MODERATOR: false, STUDENT: false },
    'AI_GRADING_ACCESS': { ADMIN: true, TEACHER: true, MODERATOR: true, STUDENT: true },
  });

  const togglePermission = (permKey: string, role: string) => {
    setPermissions(prev => ({
      ...prev,
      [permKey]: {
        ...prev[permKey],
        [role]: !prev[permKey][role]
      }
    }));
  };

  const handleSaveSettings = () => {
    alert('Đã lưu cấu hình hệ thống thành công và áp dụng cho toàn bộ các phiên làm việc hiện tại.');
  };

  return (
    <div className="slide-up">
      
      {/* Page Title */}
      <div className="flex-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-orange">UC15.2 / UC15.3 - SYSTEM CONFIG & RBAC</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            Cấu Hình Hệ Thống & Hạn Mức Quota AI
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Thiết lập hạn mức gọi Gemini 2.5 Flash API và ma trận phân quyền người dùng Role-Based Access Control.
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleSaveSettings} style={{ gap: 6, fontSize: '0.9rem' }}>
          <Save size={16} /> Lưu Thay Đổi Cấu Hình
        </button>
      </div>

      {/* Soft Segmented Pill Tabs */}
      <div style={{ display: 'inline-flex', background: 'var(--bg-tertiary)', padding: '5px', borderRadius: 'var(--radius-pill)', gap: 4, marginBottom: '2rem', border: '1px solid var(--border-light)' }}>
        <button
          onClick={() => setActiveTab('quota')}
          style={{
            padding: '0.6rem 1.3rem',
            border: 'none',
            background: activeTab === 'quota' ? 'white' : 'transparent',
            fontWeight: activeTab === 'quota' ? 700 : 600,
            fontSize: '0.88rem',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
            color: activeTab === 'quota' ? 'var(--primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'quota' ? 'var(--shadow-sm)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease'
          }}
        >
          <Cpu size={17} />
          <span>Hạn Mức Quota AI Gemini (UC15.3)</span>
        </button>

        <button
          onClick={() => setActiveTab('rbac')}
          style={{
            padding: '0.6rem 1.3rem',
            border: 'none',
            background: activeTab === 'rbac' ? 'white' : 'transparent',
            fontWeight: activeTab === 'rbac' ? 700 : 600,
            fontSize: '0.88rem',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
            color: activeTab === 'rbac' ? 'var(--primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'rbac' ? 'var(--shadow-sm)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease'
          }}
        >
          <ShieldCheck size={17} />
          <span>Ma Trận Phân Quyền RBAC (UC15.2)</span>
        </button>

        <button
          onClick={() => setActiveTab('general')}
          style={{
            padding: '0.6rem 1.3rem',
            border: 'none',
            background: activeTab === 'general' ? 'white' : 'transparent',
            fontWeight: activeTab === 'general' ? 700 : 600,
            fontSize: '0.88rem',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
            color: activeTab === 'general' ? 'var(--primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'general' ? 'var(--shadow-sm)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease'
          }}
        >
          <Settings size={17} />
          <span>Cài Đặt Chung</span>
        </button>
      </div>

      {/* TAB 1: AI QUOTA SETTINGS */}
      {activeTab === 'quota' && (
        <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* API Health Banner */}
          <div className="ed-card" style={{ padding: '1.6rem 2rem', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderRadius: 'var(--radius-xl)', boxShadow: '0 12px 30px rgba(30, 27, 75, 0.25)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px var(--primary-glow)' }}>
                <Sparkles size={24} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>Google Gemini 2.5 Flash API Status</div>
                <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Model ID: <code>gemini-2.5-flash-preview-0925</code> • Region: <code>us-central1</code></div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block' }}>Thời gian phản hồi (Latency)</span>
                <strong style={{ fontSize: '1rem', color: '#86efac' }}>240 ms</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block' }}>Token tiêu thụ tháng</span>
                <strong style={{ fontSize: '1rem', color: '#fbbf24' }}>1.45M / 5.0M Tokens</strong>
              </div>
              <span className="badge badge-green">🟢 ĐANG HOẠT ĐỘNG TỐT</span>
            </div>
          </div>

          {/* Quota Allocations Card */}
          <div className="ed-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              Phân Phối Lượt Sử Dụng AI Theo Nhóm Tài Khoản
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              
              {/* Free User Limits */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: 14, border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  <span className="badge badge-gray">TÀI KHOẢN MIỄN PHÍ</span>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <div className="flex-between" style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: '0.88rem', fontWeight: 600 }}>Lượt chấm Writing / tuần:</label>
                    <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{freeWritingQuota} lượt</strong>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={freeWritingQuota} 
                    onChange={(e) => setFreeWritingQuota(Number(e.target.value))} 
                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                  />
                </div>

                <div>
                  <div className="flex-between" style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: '0.88rem', fontWeight: 600 }}>Lượt chấm Speaking / tuần:</label>
                    <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{freeSpeakingQuota} lượt</strong>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="5" 
                    value={freeSpeakingQuota} 
                    onChange={(e) => setFreeSpeakingQuota(Number(e.target.value))} 
                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                  />
                </div>
              </div>

              {/* VIP User Limits */}
              <div style={{ background: '#fffbeb', padding: '1.5rem', borderRadius: 14, border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '1.05rem', color: '#92400e', marginBottom: '1rem' }}>
                  <span className="badge badge-orange">TÀI KHOẢN VIP (PREMIUM)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
                  <input 
                    type="checkbox" 
                    id="vip-unlimited" 
                    checked={vipQuotaUnlimited} 
                    onChange={(e) => setVipQuotaUnlimited(e.target.checked)} 
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="vip-unlimited" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#78350f', cursor: 'pointer' }}>
                    Không Giới Hạn Lượt Gọi AI (Unlimited)
                  </label>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: 1.6 }}>
                  Học viên VIP được quyền gọi Gemini AI chấm chi tiết bài viết, nhận xét câu từ và gợi ý dàn ý bài thi không giới hạn trong suốt thời hạn gói.
                </p>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* TAB 2: RBAC MATRIX */}
      {activeTab === 'rbac' && (
        <div className="slide-up">
          <div className="ed-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-dark)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700 }}>Quyền Hạn Hệ Thống (Permissions)</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, textAlign: 'center' }}>Admin</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, textAlign: 'center' }}>Giáo Viên</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, textAlign: 'center' }}>Kiểm Duyệt Viên</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, textAlign: 'center' }}>Học Viên</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'EXAM_CREATE_EDIT', label: 'Tạo và Chỉnh sửa Đề thi (CMS)' },
                  { key: 'EXAM_DELETE', label: 'Xóa Đề thi khỏi Ngân hàng' },
                  { key: 'USER_MANAGEMENT', label: 'Khóa / Mở khóa Tài khoản Người dùng' },
                  { key: 'AUDIT_LOGS_VIEW', label: 'Xem Nhật ký Kiểm toán & Rollback' },
                  { key: 'BILLING_PRICING', label: 'Xem Doanh thu & Cấu hình Gói cước VIP' },
                  { key: 'AI_GRADING_ACCESS', label: 'Sử dụng Không gian Luyện thi & AI Gemini' },
                ].map(p => (
                  <tr key={p.key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div>{p.label}</div>
                      <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.key}</code>
                    </td>

                    {['ADMIN', 'TEACHER', 'MODERATOR', 'STUDENT'].map(role => {
                      const isChecked = permissions[p.key]?.[role] || false;
                      return (
                        <td key={role} style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(p.key, role)}
                            disabled={role === 'ADMIN' && p.key === 'AUDIT_LOGS_VIEW'}
                            style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GENERAL CONFIG */}
      {activeTab === 'general' && (
        <div className="slide-up">
          <div className="ed-card" style={{ padding: '2rem', maxWidth: 700 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem' }}>Thông Tin Nền Tảng</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Tên Hệ Thống</label>
                <input type="text" className="input-field" defaultValue="Nền tảng Thi thử Multilingo Platform" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Email Gửi OTP & Thông Báo Hệ Thống</label>
                <input type="email" className="input-field" defaultValue="noreply@multilingo.edu.vn" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Cổng Thanh Toán Mặc Định</label>
                <select className="input-field">
                  <option>VNPAY Gateway (Sandbox / Production)</option>
                  <option>MOMO Business Gateway</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SystemSettings;
