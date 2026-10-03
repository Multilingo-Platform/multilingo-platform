import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Check, 
  Sparkles, 
  Crown, 
  ShieldCheck, 
  CreditCard, 
  QrCode, 
  Clock, 
  ArrowRight,
  AlertCircle,
  X,
  Zap,
  ChevronRight
} from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  badge?: string;
  pricePerMonth: string;
  totalPrice: string;
  originalPrice?: string;
  duration: string;
  features: string[];
  isPopular?: boolean;
}

const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Tài Khoản Miễn Phí',
    pricePerMonth: '0đ',
    totalPrice: '0đ / vĩnh viễn',
    duration: 'Không thời hạn',
    features: [
      'Truy cập 15 đề thi thử cơ bản',
      'Tối đa 3 lượt AI chấm Writing / tuần',
      'Sổ tay lưu tối đa 50 từ vựng Flashcard',
      'Xem đáp án trắc nghiệm chuẩn',
    ]
  },
  {
    id: 'pro-6m',
    name: 'Gói Bứt Phá (6 Tháng)',
    pricePerMonth: '149.000đ',
    totalPrice: '894.000đ',
    originalPrice: '1.200.000đ',
    duration: 'Thời hạn 180 ngày',
    features: [
      'Mở khóa toàn bộ hơn 200+ bộ đề IELTS & TOEIC',
      '20 lượt AI chấm Writing & Speaking / tuần',
      'Không giới hạn số lượng từ vựng Flashcard',
      'Báo cáo phân tích biểu đồ Radar cá nhân',
      'Xem giải thích chi tiết và audio transcript'
    ]
  },
  {
    id: 'vip-1y',
    name: 'Gói VIP Trọn Gói (1 Năm)',
    badge: 'TIẾT KIỆM 45% - PHỔ BIẾN NHẤT',
    pricePerMonth: '99.000đ',
    totalPrice: '1.188.000đ',
    originalPrice: '2.160.000đ',
    duration: 'Thời hạn 365 ngày',
    isPopular: true,
    features: [
      'Tất cả đặc quyền của Gói Bứt Phá',
      '⚡ KHÔNG GIỚI HẠN lượt AI chấm bài Writing & Speaking',
      'Trợ lý Gemini gợi ý dàn ý thời gian thực',
      'Phát hiện gian lận an toàn và ưu tiên hỗ trợ 24/7',
      'Tải xuống không giới hạn file PDF & Audio đề thi',
      'Cam kết nâng tối thiểu 0.5 - 1.0 Band điểm'
    ]
  }
];

const PricingCheckout = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>(PLANS[2]);
  const [showVnPayModal, setShowVnPayModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'atm' | 'visa'>('qr');
  const [timer, setTimer] = useState(900); // 15:00 minutes

  // Countdown timer for VNPAY checkout
  useEffect(() => {
    let interval: any;
    if (showVnPayModal && timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [showVnPayModal, timer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOpenCheckout = (plan: PricingPlan) => {
    if (plan.id === 'free') {
      alert('Bạn đang sử dụng gói Miễn Phí của hệ thống.');
      return;
    }
    setSelectedPlan(plan);
    setTimer(900);
    setShowVnPayModal(true);
  };

  const handleSimulateSuccess = () => {
    setShowVnPayModal(false);
    navigate('/student/payment-success', {
      state: {
        planName: selectedPlan.name,
        amount: selectedPlan.totalPrice,
        transactionId: `VNPAY${Math.floor(10000000 + Math.random() * 90000000)}`,
        date: new Date().toLocaleDateString('vi-VN')
      }
    });
  };

  const handleSimulateFail = () => {
    alert('Giao dịch bị từ chối bởi Ngân hàng phát hành (Mã lỗi VNPAY: 07 - Giao dịch bị nghi ngờ gian lận). Hãy thử lại hoặc dùng phương thức khác.');
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.25rem 1rem 4rem' }}>
      
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#64748b', marginBottom: '1rem' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/dashboard')}>Trang chủ</span>
        <ChevronRight size={14} />
        <span style={{ color: '#0f172a', fontWeight: 600 }}>Nâng cấp tài khoản VIP</span>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 2.25rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, padding: '3px 8px', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          GÓI HỌC VIÊN VIP & CỔNG THANH TOÁN VNPAY
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#111827', margin: '0 0 0.5rem' }}>
          Nâng Cấp VIP - Bứt Phá Điểm Số Ngoại Ngữ
        </h1>
        <p style={{ color: '#4b5563', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
          Mở khóa không giới hạn sức mạnh AI chấm bài Writing & Speaking, toàn bộ đề thi IELTS / TOEIC bản quyền và trải nghiệm học tập không giới hạn.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', alignItems: 'stretch' }}>
        {PLANS.map(plan => (
          <div
            key={plan.id}
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              borderRadius: 6,
              border: plan.isPopular ? '2px solid #f59e0b' : '1px solid #e2e8f0',
              background: plan.isPopular ? '#fffbeb' : '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            {plan.badge && (
              <div style={{
                position: 'absolute',
                top: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#f59e0b',
                color: '#111827',
                padding: '2px 10px',
                borderRadius: 4,
                fontSize: '0.72rem',
                fontWeight: 700,
                border: '1px solid #d97706',
                whiteSpace: 'nowrap'
              }}>
                ⭐ {plan.badge}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.25rem' }}>
                {plan.isPopular && <Crown size={17} color="#d97706" />}
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                  {plan.name}
                </h3>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{plan.duration}</span>

              {/* Price section */}
              <div style={{ margin: '0.85rem 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: '1.65rem', fontWeight: 700, color: '#111827' }}>
                    {plan.pricePerMonth}
                  </span>
                  {plan.id !== 'free' && <span style={{ fontSize: '0.82rem', color: '#64748b' }}>/ tháng</span>}
                </div>
                {plan.originalPrice && (
                  <div style={{ fontSize: '0.78rem', color: '#94a3af', textDecoration: 'line-through', marginTop: 1 }}>
                    Giá niêm yết: {plan.originalPrice}
                  </div>
                )}
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#d97706', marginTop: 3 }}>
                  Tổng cộng: {plan.totalPrice}
                </div>
              </div>

              {/* Feature List */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Đặc quyền bao gồm:
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plan.features.map((feat, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: '0.82rem', color: '#334155', lineHeight: 1.4 }}>
                      <Check size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={() => handleOpenCheckout(plan)}
              style={{
                width: '100%',
                padding: '0.55rem',
                fontSize: '0.86rem',
                borderRadius: 5,
                fontWeight: 600,
                cursor: 'pointer',
                background: plan.isPopular ? '#f59e0b' : '#ffffff',
                color: plan.isPopular ? '#111827' : '#334155',
                border: plan.isPopular ? '1px solid #d97706' : '1px solid #cbd5e1',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (plan.isPopular) e.currentTarget.style.background = '#eab308';
                else e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                if (plan.isPopular) e.currentTarget.style.background = '#f59e0b';
                else e.currentTarget.style.background = '#ffffff';
              }}
            >
              {plan.id === 'free' ? 'Đang Sử Dụng' : 'Nâng Cấp Qua VNPAY'}
            </button>
          </div>
        ))}
      </div>

      {/* Trust & Guarantee Banner */}
      <div style={{ marginTop: '2.5rem', padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={24} color="#16a34a" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>Thanh Toán An Toàn 100%</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Chứng chỉ bảo mật SSL & Cổng VNPAY quốc gia</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={24} color="#d97706" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>Kích Hoạt Tức Thì</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Tài khoản tự động nâng cấp sau 5 giây thanh toán</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={24} color="#f59e0b" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>Hỗ Trợ 24/7</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Đội ngũ giáo viên và kỹ thuật giải đáp mọi thắc mắc</div>
          </div>
        </div>
      </div>

      {/* VNPAY CHECKOUT SIMULATOR MODAL */}
      {showVnPayModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: 500, background: '#ffffff', borderRadius: 6, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', border: '1px solid #cbd5e1' }}>
            
            {/* Modal Header */}
            <div style={{ background: '#005baa', color: 'white', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.5px' }}>VNPAY</span>
                <span style={{ fontSize: '0.82rem', opacity: 0.9 }}>| Cổng Thanh Toán Trực Tuyến</span>
              </div>
              <button 
                onClick={() => setShowVnPayModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem' }}>
              
              {/* Order Info */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Đơn hàng: {selectedPlan.name}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827' }}>{selectedPlan.totalPrice}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.74rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> Thời gian còn lại
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#dc2626' }}>{formatTimer(timer)}</div>
                </div>
              </div>

              {/* Payment Methods Tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', background: '#f1f5f9', padding: 3, borderRadius: 5 }}>
                {[
                  { key: 'qr', label: 'Quét Mã VietQR', icon: <QrCode size={14} /> },
                  { key: 'atm', label: 'Thẻ ATM Nội Địa', icon: <CreditCard size={14} /> },
                  { key: 'visa', label: 'Thẻ Visa/Master', icon: <CreditCard size={14} /> },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setPaymentMethod(m.key as any)}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: 4,
                      border: 'none',
                      background: paymentMethod === m.key ? '#ffffff' : 'transparent',
                      color: paymentMethod === m.key ? '#005baa' : '#475569',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      boxShadow: paymentMethod === m.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              {/* QR Code Tab View */}
              {paymentMethod === 'qr' && (
                <div style={{ textAlign: 'center', padding: '0.25rem 0' }}>
                  <div style={{ 
                    width: 170, 
                    height: 170, 
                    margin: '0 auto 0.75rem', 
                    border: '2px solid #005baa', 
                    borderRadius: 6, 
                    padding: 6, 
                    background: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <QrCode size={140} color="#0f172a" />
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 2 }}>
                    Mở ứng dụng Ngân hàng bất kỳ (Vietcombank, MB, Techcombank...) để quét mã
                  </p>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Nội dung CK: <strong style={{ color: '#005baa' }}>ML {Date.now().toString().slice(-6)}</strong>
                  </span>
                </div>
              )}

              {/* ATM / Card View */}
              {paymentMethod !== 'qr' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '0.25rem 0' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 3, color: '#374151' }}>Số Thẻ / Tài khoản</label>
                    <input type="text" style={{ width: '100%', padding: '0.45rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: '0.85rem', outline: 'none' }} placeholder="9704 8888 •••• ••••" defaultValue="9704 1999 8888 1234" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.65rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 3, color: '#374151' }}>Tên Chủ Thẻ</label>
                      <input type="text" style={{ width: '100%', padding: '0.45rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: '0.85rem', outline: 'none' }} placeholder="NGUYEN VAN A" defaultValue="SON NGUYEN" />
                    </div>
                    <div style={{ width: 110 }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 3, color: '#374151' }}>Ngày Phát Hành</label>
                      <input type="text" style={{ width: '100%', padding: '0.45rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: '0.85rem', outline: 'none' }} placeholder="MM/YY" defaultValue="10/26" />
                    </div>
                  </div>
                </div>
              )}

              {/* Simulation Testing Buttons */}
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3af', textTransform: 'uppercase', textAlign: 'center' }}>
                  🛠️ Giả Lập Kết Quả IPN Webhook VNPAY:
                </span>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={handleSimulateSuccess}
                    style={{ flex: 1, background: '#16a34a', color: 'white', border: '1px solid #15803d', borderRadius: 5, padding: '0.55rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✓ Giả Lập Thành Công
                  </button>
                  <button 
                    onClick={handleSimulateFail}
                    style={{ background: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, padding: '0.55rem 0.85rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✕ Thử Báo Lỗi
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PricingCheckout;
