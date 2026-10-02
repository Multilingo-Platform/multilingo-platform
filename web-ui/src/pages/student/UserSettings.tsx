import React, { useState } from 'react';
import { User, Bell, Target, Globe, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const UserSettings = () => {
  const { i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="container slide-up">
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '2rem' }}>Cài đặt Tài khoản</h1>
      
      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Sidebar Settings */}
        <div style={{ width: '250px', flexShrink: 0 }}>
          <div className="ed-card" style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <button 
              className="flex-center" 
              style={{ justifyContent: 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem', background: activeTab === 'profile' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%' }}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} /> Hồ sơ cá nhân
            </button>
            <button 
              className="flex-center" 
              style={{ justifyContent: 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem', background: activeTab === 'target' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'target' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%' }}
              onClick={() => setActiveTab('target')}
            >
              <Target size={18} /> Mục tiêu học tập
            </button>
            <button 
              className="flex-center" 
              style={{ justifyContent: 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem', background: activeTab === 'preferences' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'preferences' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%' }}
              onClick={() => setActiveTab('preferences')}
            >
              <Globe size={18} /> Ngôn ngữ & Giao diện
            </button>
            <button 
              className="flex-center" 
              style={{ justifyContent: 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem', background: activeTab === 'notifications' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'notifications' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%' }}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={18} /> Thông báo
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1 }}>
          <div className="ed-card" style={{ padding: '2rem' }}>
            {activeTab === 'profile' && (
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>Hồ sơ cá nhân</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Họ và Tên</label>
                    <input type="text" className="input-field" defaultValue="John Doe" />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Email</label>
                    <input type="email" className="input-field" defaultValue="john.doe@example.com" disabled style={{ background: 'var(--bg-secondary)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Số điện thoại</label>
                    <input type="tel" className="input-field" defaultValue="0912 345 678" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'target' && (
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>Mục tiêu học tập</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Chứng chỉ đang ôn luyện</label>
                    <select className="input-field">
                      <option>IELTS Academic</option>
                      <option>IELTS General</option>
                      <option>TOEIC</option>
                      <option>Đánh giá Năng lực Tiếng Việt (VSTEP)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Band điểm mục tiêu</label>
                    <input type="text" className="input-field" defaultValue="7.0" style={{ width: '150px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Ngày thi dự kiến</label>
                    <input type="date" className="input-field" defaultValue="2026-12-15" style={{ width: '200px' }} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>Ngôn ngữ & Giao diện</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Ngôn ngữ Giao diện</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button className={`btn ${i18n.language === 'vi' ? 'btn-primary' : 'btn-outline'}`} onClick={() => i18n.changeLanguage('vi')}>Tiếng Việt</button>
                      <button className={`btn ${i18n.language === 'en' ? 'btn-primary' : 'btn-outline'}`} onClick={() => i18n.changeLanguage('en')}>English</button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Chế độ hiển thị (Gợi ý AI)</label>
                    <label className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked /> Hiển thị gợi ý sửa lỗi AI trong lúc làm bài
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>Cài đặt Thông báo</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label className="flex-center" style={{ justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Nhắc nhở ôn tập Flashcard (SRS)</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Nhận email khi có từ vựng đến hạn ôn tập</div>
                    </div>
                    <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px' }} />
                  </label>
                  <label className="flex-center" style={{ justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Thông báo Đề thi mới</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Cập nhật đề thi IELTS/TOEIC mới nhất</div>
                    </div>
                    <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px' }} />
                  </label>
                </div>
              </div>
            )}

            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
                <Save size={18} /> Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
