import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Download, Crown, Sparkles, Library } from 'lucide-react';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const transactionId = state.transactionId || 'VNPAY89218204';
  const planName = state.planName || 'Gói VIP Trọn Gói (1 Năm)';
  const amount = state.amount || '1.188.000đ';
  const date = state.date || new Date().toLocaleDateString('vi-VN');

  return (
    <div className="flex-center slide-up" style={{ minHeight: 'calc(100vh - 70px)', padding: '3rem 1.5rem', background: 'var(--bg-primary)' }}>
      <div className="ed-card" style={{ width: '100%', maxWidth: 580, padding: '3rem 2.5rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
        
        {/* Animated Badge Icon */}
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 0 0 10px rgba(16, 185, 129, 0.1)' }}>
          <CheckCircle2 size={48} />
        </div>

        <span className="badge badge-green" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>
          GIAO DỊCH THÀNH CÔNG • VNPAY
        </span>

        <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Chúc Mừng Bạn Đã Lên Hạng VIP!
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          Giao dịch thanh toán qua cổng VNPAY đã được ghi nhận. Toàn bộ tính năng cao cấp và kho đề thi đã được kích hoạt trên tài khoản của bạn.
        </p>

        {/* Electronic Receipt Card */}
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: '1.6rem', marginBottom: '2rem', textAlign: 'left', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px dashed rgba(99, 102, 241, 0.25)' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>BIÊN LAI ĐIỆN TỬ</span>
            <span style={{ fontSize: '0.82rem', color: '#005baa', fontWeight: 700, background: '#e0f2fe', padding: '3px 8px', borderRadius: 4 }}>VNPAY IPN VERIFIED</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.9rem' }}>
            <div className="flex-between">
              <span style={{ color: 'var(--text-secondary)' }}>Mã Giao Dịch:</span>
              <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{transactionId}</strong>
            </div>
            <div className="flex-between">
              <span style={{ color: 'var(--text-secondary)' }}>Gói Cước Đăng Ký:</span>
              <strong style={{ color: 'var(--primary)' }}>{planName}</strong>
            </div>
            <div className="flex-between">
              <span style={{ color: 'var(--text-secondary)' }}>Số Tiền Thanh Toán:</span>
              <strong style={{ color: 'var(--emerald)', fontSize: '1.2rem', fontFamily: 'Outfit, sans-serif' }}>{amount}</strong>
            </div>
            <div className="flex-between">
              <span style={{ color: 'var(--text-secondary)' }}>Ngày Thực Hiện:</span>
              <span>{date}</span>
            </div>
            <div className="flex-between">
              <span style={{ color: 'var(--text-secondary)' }}>Trạng Thái Tài Khoản:</span>
              <span className="badge badge-orange flex-center" style={{ gap: 4 }}>
                <Crown size={13} /> PREMIUM (365 ngày)
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/student/library')}
            style={{ flex: 1, padding: '0.95rem', fontSize: '1rem', borderRadius: 'var(--radius-pill)' }}
          >
            <Library size={18} /> Khám Phá Kho Đề VIP
          </button>
          
          <button 
            className="btn btn-outline"
            onClick={() => navigate('/student/dashboard')}
            style={{ padding: '0.95rem 1.5rem', borderRadius: 'var(--radius-pill)', background: 'white' }}
          >
            Về Dashboard
          </button>
        </div>

      </div>
    </div>
  );
};

export default PaymentSuccess;
