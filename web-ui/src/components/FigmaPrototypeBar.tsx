import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Laptop, 
  Map, 
  Layers, 
  ChevronDown, 
  ExternalLink, 
  Minimize2, 
  Maximize2,
  Sparkles
} from 'lucide-react';

export type DeviceMode = 'desktop' | 'laptop' | 'tablet' | 'mobile';

interface ScreenItem {
  id: string;
  name: string;
  path: string;
  uc: string;
  role: 'Guest' | 'Student' | 'Admin' | 'Core';
  badge?: string;
}

export const SYSTEM_SCREENS: Record<string, ScreenItem[]> = {
  '🌐 Khách & Xác thực (TV1)': [
    { id: 'landing', name: 'Trang chủ Landing Page', path: '/', uc: 'UC01', role: 'Guest' },
    { id: 'auth', name: 'Đăng nhập / Đăng ký', path: '/auth', uc: 'UC01/03', role: 'Guest' },
    { id: 'forgot-pwd', name: 'Quên & Đặt lại mật khẩu (OTP)', path: '/forgot-password', uc: 'UC01.1', role: 'Guest', badge: 'Mới' },
    { id: 'onboarding', name: 'Onboarding Thiết lập mục tiêu', path: '/onboarding', uc: 'UC05', role: 'Student' },
  ],
  '🎓 Học viên - Luyện thi & AI (TV2 & TV3)': [
    { id: 'dashboard', name: 'Bảng điều khiển & Chuỗi Streak', path: '/student/dashboard', uc: 'UC13', role: 'Student' },
    { id: 'history', name: 'Lịch sử làm bài thi', path: '/student/history', uc: 'UC13', role: 'Student' },
    { id: 'library', name: 'Thư viện Đề thi & Gợi ý Band', path: '/student/library', uc: 'UC07/07.1', role: 'Student' },
    { id: 'exam-reading', name: 'Phòng thi IELTS Reading', path: '/student/exam/cam-18-1', uc: 'UC08', role: 'Student' },
    { id: 'exam-listening', name: 'Phòng luyện Listening (Audio Player)', path: '/student/exam/cam-18-1/listening', uc: 'UC08', role: 'Student', badge: 'Mới' },
    { id: 'exam-writing', name: 'Phòng luyện Writing (AI Hints)', path: '/student/exam/cam-18-1/writing', uc: 'UC08.4', role: 'Student', badge: 'Mới' },
    { id: 'exam-result', name: 'Kết quả bài thi & AI Diff-View', path: '/student/exam/cam-18-1/result', uc: 'UC10/10.2', role: 'Student', badge: 'Mới' },
  ],
  '📚 Học viên - Từ vựng & Năng lực (TV5)': [
    { id: 'dictionary', name: 'Từ điển Ngữ cảnh Đa ngôn ngữ', path: '/student/dictionary', uc: 'UC11/11.1', role: 'Student', badge: 'Mới' },
    { id: 'flashcards', name: 'Sổ tay Danh mục Bộ thẻ', path: '/student/flashcards', uc: 'UC12', role: 'Student' },
    { id: 'deck-detail', name: 'Chi tiết Bộ thẻ & Quản lý từ', path: '/student/flashcards/deck/cam-18', uc: 'UC12.1/12.6', role: 'Student', badge: 'Mới' },
    { id: 'flashcards-srs', name: 'Ôn tập Flashcard SRS (Lật thẻ 3D)', path: '/student/flashcards/deck/cam-18/srs', uc: 'UC12.2', role: 'Student', badge: 'Mới' },
    { id: 'vocab-learn', name: 'Học từ vựng Trắc nghiệm phản hồi tức thì', path: '/student/flashcards/deck/cam-18/learn', uc: 'UC12.3', role: 'Student', badge: 'Mới' },
    { id: 'vocab-test', name: 'Kiểm tra từ vựng Tính giờ (Test Mode)', path: '/student/flashcards/deck/cam-18/test', uc: 'UC12.4', role: 'Student', badge: 'Mới' },
    { id: 'vocab-match', name: 'Trò chơi Ghép thẻ Tốc độ (Speed Match)', path: '/student/flashcards/deck/cam-18/match', uc: 'UC12.5', role: 'Student', badge: 'Mới' },
    { id: 'analytics', name: 'Báo cáo Radar & Vùng trũng điểm', path: '/student/analytics', uc: 'UC13.1', role: 'Student', badge: 'Mới' },
    { id: 'settings', name: 'Hồ sơ cá nhân & Đổi mật khẩu', path: '/student/settings', uc: 'UC04', role: 'Student' },
  ],
  '💳 Gói cước & Thanh toán (TV1)': [
    { id: 'pricing', name: 'Bảng giá VIP & Cổng VNPAY QR', path: '/student/pricing', uc: 'UC06', role: 'Student', badge: 'Mới' },
    { id: 'payment-success', name: 'Biên lai Thanh toán Thành công', path: '/student/payment-success', uc: 'UC06', role: 'Student', badge: 'Mới' },
  ],
  '🛡️ Quản trị viên - Admin Portal (TV4 & TV2)': [
    { id: 'admin-dashboard', name: 'Tổng quan Vận hành & DAU/MAU', path: '/admin/dashboard', uc: 'UC16', role: 'Admin' },
    { id: 'admin-users', name: 'Quản lý Người dùng & Tracking', path: '/admin/users', uc: 'UC15', role: 'Admin' },
    { id: 'admin-exams', name: 'Ngân hàng Đề thi & CMS Đa cấp', path: '/admin/exams', uc: 'UC14.1', role: 'Admin' },
    { id: 'admin-import', name: 'Import Đề thi từ Excel/JSON', path: '/admin/exams/import', uc: 'UC14.4', role: 'Admin', badge: 'Mới' },
    { id: 'admin-audit', name: 'Nhật ký Kiểm toán & Chống gian lận', path: '/admin/audit', uc: 'UC15.4', role: 'Admin', badge: 'Mới' },
    { id: 'admin-billing', name: 'Đối soát Giao dịch VNPAY & Báo cáo', path: '/admin/billing', uc: 'UC16.2', role: 'Admin', badge: 'Mới' },
    { id: 'admin-settings', name: 'Cấu hình Quota AI & Phân quyền', path: '/admin/settings', uc: 'UC15.2', role: 'Admin', badge: 'Mới' },
  ],
};

interface FigmaPrototypeBarProps {
  deviceMode: DeviceMode;
  onDeviceChange: (mode: DeviceMode) => void;
}

export const FigmaPrototypeBar = ({ deviceMode, onDeviceChange }: FigmaPrototypeBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Tìm màn hình hiện tại
  let currentScreen: ScreenItem | undefined;
  for (const group of Object.values(SYSTEM_SCREENS)) {
    const match = group.find(item => item.path === location.pathname);
    if (match) {
      currentScreen = match;
      break;
    }
  }

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.proto-dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  if (isMinimized) {
    return (
      <button 
        className="figma-proto-pill"
        onClick={() => setIsMinimized(false)}
        title="Mở thanh công cụ Prototype Figma"
      >
        <Sparkles size={16} />
        <span>Figma Prototype</span>
        <Maximize2 size={14} style={{ marginLeft: 4 }} />
      </button>
    );
  }

  return (
    <div className="figma-proto-bar slide-up">
      {/* Figma Logo / Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
        <div style={{ 
          width: 22, 
          height: 22, 
          borderRadius: 6, 
          background: 'linear-gradient(135deg, #f24e1e 0%, #a259ff 50%, #1abcfe 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontWeight: 900, 
          fontSize: '0.7rem' 
        }}>
          F
        </div>
        <span style={{ fontWeight: 700, letterSpacing: '0.5px', color: '#f3f4f6' }}>Prototype</span>
      </div>

      {/* Screen Selector Dropdown */}
      <div className="proto-dropdown-container" style={{ position: 'relative' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '20px',
            color: 'white',
            padding: '6px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.85rem',
            fontWeight: 600,
            maxWidth: 240,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          <Layers size={14} color="#f59e0b" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentScreen ? currentScreen.name : 'Chọn màn hình (27)'}
          </span>
          <ChevronDown size={14} />
        </button>

        {isDropdownOpen && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 12,
            width: 360,
            maxHeight: 460,
            overflowY: 'auto',
            background: '#111827',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            padding: 8,
            zIndex: 100000,
            color: '#e5e7eb'
          }}>
            <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              DANH MỤC 27 MÀN HÌNH HỆ THỐNG
            </div>
            {Object.entries(SYSTEM_SCREENS).map(([groupTitle, screens]) => (
              <div key={groupTitle} style={{ marginTop: 8 }}>
                <div style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
                  {groupTitle}
                </div>
                {screens.map(screen => {
                  const isActive = location.pathname === screen.path;
                  return (
                    <div
                      key={screen.id}
                      onClick={() => {
                        navigate(screen.path);
                        setIsDropdownOpen(false);
                      }}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: isActive ? 'rgba(217, 119, 6, 0.3)' : 'transparent',
                        color: isActive ? '#fef3c7' : '#d1d5db',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isActive ? 'rgba(217, 119, 6, 0.4)' : 'rgba(255,255,255,0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isActive ? 'rgba(217, 119, 6, 0.3)' : 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.7rem', padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                          {screen.uc}
                        </span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{screen.name}</span>
                      </div>
                      {screen.badge && (
                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 10, background: '#10b981', color: 'white', fontWeight: 700 }}>
                          {screen.badge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Screen Flow Map Link */}
      <button
        onClick={() => navigate('/prototype-map')}
        title="Xem Sơ đồ luồng màn hình toàn cảnh"
        style={{
          background: location.pathname === '/prototype-map' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '20px',
          color: 'white',
          padding: '6px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.85rem',
          fontWeight: 600
        }}
      >
        <Map size={14} />
        <span>Sơ đồ Luồng</span>
      </button>

      {/* Device Viewport Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 3, gap: 2 }}>
        <button
          onClick={() => onDeviceChange('desktop')}
          title="Toàn màn hình Desktop (100%)"
          style={{
            background: deviceMode === 'desktop' ? 'var(--primary)' : 'transparent',
            border: 'none',
            color: 'white',
            borderRadius: 16,
            padding: '5px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Monitor size={14} />
        </button>
        <button
          onClick={() => onDeviceChange('laptop')}
          title="Laptop (1280px)"
          style={{
            background: deviceMode === 'laptop' ? 'var(--primary)' : 'transparent',
            border: 'none',
            color: 'white',
            borderRadius: 16,
            padding: '5px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Laptop size={14} />
        </button>
        <button
          onClick={() => onDeviceChange('tablet')}
          title="Tablet (768px)"
          style={{
            background: deviceMode === 'tablet' ? 'var(--primary)' : 'transparent',
            border: 'none',
            color: 'white',
            borderRadius: 16,
            padding: '5px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Tablet size={14} />
        </button>
        <button
          onClick={() => onDeviceChange('mobile')}
          title="Mobile (390px)"
          style={{
            background: deviceMode === 'mobile' ? 'var(--primary)' : 'transparent',
            border: 'none',
            color: 'white',
            borderRadius: 16,
            padding: '5px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Smartphone size={14} />
        </button>
      </div>

      {/* Minimize Button */}
      <button
        onClick={() => setIsMinimized(true)}
        title="Thu nhỏ thanh prototype"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#9ca3af',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <Minimize2 size={16} />
      </button>
    </div>
  );
};
