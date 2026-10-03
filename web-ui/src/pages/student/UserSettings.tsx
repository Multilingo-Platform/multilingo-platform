import React, { useState } from 'react';
import { User, Bell, Target, Globe, Save, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const UserSettings = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.25rem 1rem 4rem' }}>
      
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#64748b', marginBottom: '1rem' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/dashboard')}>Trang chủ</span>
        <ChevronRight size={14} />
        <span style={{ color: '#0f172a', fontWeight: 600 }}>Cài đặt tài khoản & Mục tiêu</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111827', margin: 0 }}>
          Cài Đặt Tài Khoản & Tùy Chọn Học Tập
        </h1>
        <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: '3px 0 0' }}>
          Quản lý thông tin cá nhân, định hướng chứng chỉ mục tiêu và tùy chỉnh nhắc nhở SRS.
        </p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Sidebar Settings Navigation */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          {[
            { id: 'profile', label: 'Hồ sơ cá nhân', icon: User },
            { id: 'target', label: 'Mục tiêu học tập', icon: Target },
            { id: 'preferences', label: 'Ngôn ngữ & Giao diện', icon: Globe },
            { id: 'notifications', label: 'Cài đặt thông báo', icon: Bell }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem', 
                  padding: '0.65rem 0.85rem', 
                  background: isActive ? '#fffbeb' : 'transparent', 
                  color: isActive ? '#92400e' : '#475569', 
                  border: 'none', 
                  borderLeft: isActive ? '3px solid #f59e0b' : '3px solid transparent',
                  borderRadius: 4, 
                  fontWeight: isActive ? 600 : 500, 
                  cursor: 'pointer', 
                  textAlign: 'left', 
                  width: '100%',
                  fontSize: '0.84rem',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} color={isActive ? '#d97706' : '#64748b'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          
          {activeTab === 'profile' && (
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: '0 0 1.15rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
                Hồ Sơ Cá Nhân
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Họ và Tên</label>
                  <input 
                    type="text" 
                    defaultValue="Sơn Nguyễn" 
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Email Đăng Nhập</label>
                  <input 
                    type="email" 
                    defaultValue="son.nguyen@example.com" 
                    disabled 
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: '0.85rem', background: '#f8fafc', color: '#64748b', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Số điện thoại liên hệ</label>
                  <input 
                    type="tel" 
                    defaultValue="0987 654 321" 
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'target' && (
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: '0 0 1.15rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
                Mục Tiêu Học Tập & Luyện Thi
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '480px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Chứng chỉ đang ôn luyện</label>
                  <select style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: '0.85rem', outline: 'none', background: '#ffffff' }}>
                    <option>IELTS Academic</option>
                    <option>IELTS General Training</option>
                    <option>TOEIC Listening & Reading</option>
                    <option>Đánh giá Năng lực Tiếng Anh VSTEP (B1-C1)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Band điểm mục tiêu</label>
                  <input 
                    type="text" 
                    defaultValue="7.5" 
                    style={{ width: '140px', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Ngày thi dự kiến</label>
                  <input 
                    type="date" 
                    defaultValue="2026-12-15" 
                    style={{ width: '180px', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: '0 0 1.15rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
                Ngôn Ngữ & Giao Diện
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Ngôn ngữ hiển thị hệ thống</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      style={{ 
                        padding: '0.45rem 1rem', 
                        borderRadius: 4, 
                        border: i18n.language === 'vi' ? '1px solid #d97706' : '1px solid #cbd5e1', 
                        background: i18n.language === 'vi' ? '#f59e0b' : '#ffffff', 
                        color: i18n.language === 'vi' ? '#111827' : '#475569', 
                        fontWeight: 600, 
                        fontSize: '0.84rem', 
                        cursor: 'pointer' 
                      }} 
                      onClick={() => i18n.changeLanguage('vi')}
                    >
                      Tiếng Việt
                    </button>
                    <button 
                      style={{ 
                        padding: '0.45rem 1rem', 
                        borderRadius: 4, 
                        border: i18n.language === 'en' ? '1px solid #d97706' : '1px solid #cbd5e1', 
                        background: i18n.language === 'en' ? '#f59e0b' : '#ffffff', 
                        color: i18n.language === 'en' ? '#111827' : '#475569', 
                        fontWeight: 600, 
                        fontSize: '0.84rem', 
                        cursor: 'pointer' 
                      }} 
                      onClick={() => i18n.changeLanguage('en')}
                    >
                      English
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 600, fontSize: '0.82rem', color: '#374151' }}>Trợ lý thông minh (AI Hints)</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#334155' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: '#f59e0b', width: 16, height: 16 }} /> 
                    <span>Hiển thị gợi ý sửa lỗi AI trong lúc làm bài thi Writing & Speaking</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: '0 0 1.15rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
                Cài Đặt Thông Báo & Nhắc Nhở
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', border: '1px solid #e2e8f0', borderRadius: 5, background: '#f8fafc', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827', marginBottom: 2 }}>Nhắc nhở ôn tập Flashcard (SRS)</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Nhận thông báo khi có từ vựng đến hạn khoảng nhớ vàng trong ngày</div>
                  </div>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#f59e0b', width: 16, height: 16 }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', border: '1px solid #e2e8f0', borderRadius: 5, background: '#f8fafc', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827', marginBottom: 2 }}>Thông báo Đề thi & Bộ câu hỏi mới</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Cập nhật các đề thi IELTS Cam 19, ETS mới nhất vào thư viện</div>
                  </div>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#f59e0b', width: 16, height: 16 }} />
                </label>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {savedSuccess ? (
              <span style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>
                ✓ Đã lưu cài đặt thành công!
              </span>
            ) : <span />}
            <button 
              onClick={handleSave}
              style={{ 
                padding: '0.5rem 1.35rem', 
                background: '#f59e0b', 
                border: '1px solid #d97706', 
                borderRadius: 5, 
                color: '#111827', 
                fontWeight: 600, 
                fontSize: '0.85rem', 
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Save size={16} /> Lưu Thay Đổi
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};

export default UserSettings;
