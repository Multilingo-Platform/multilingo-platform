import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, KeyRound, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timer, setTimer] = useState(60);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [error, setError] = useState('');

  // Countdown timer for OTP
  useEffect(() => {
    let interval: any;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    } else if (timer === 0) {
      setIsTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timer]);

  // Handle OTP digit input
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setError('');
    setStep(2);
    setTimer(60);
    setIsTimerActive(true);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length < 6) {
      setError('Vui lòng nhập đủ 6 chữ số của mã OTP.');
      return;
    }
    setError('');
    setStep(3);
  };

  // Password strength calculation
  const getPasswordStrength = () => {
    if (!newPassword) return { score: 0, text: 'Chưa nhập', color: '#9ca3af' };
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;

    if (score <= 1) return { score: 1, text: 'Yếu', color: '#ef4444' };
    if (score === 2) return { score: 2, text: 'Trung bình', color: '#f59e0b' };
    if (score === 3) return { score: 3, text: 'Mạnh', color: '#3b82f6' };
    return { score: 4, text: 'Rất an toàn', color: '#10b981' };
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }
    setError('');
    setStep(4);
  };

  const strength = getPasswordStrength();

  return (
    <div className="flex-center slide-up" style={{ minHeight: 'calc(100vh - 70px)', padding: '2rem 1.5rem', background: 'var(--bg-primary)' }}>
      <div className="ed-card" style={{ width: '100%', maxWidth: '520px', padding: '2.5rem', background: 'var(--bg-secondary)' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <button 
            className="btn btn-outline" 
            onClick={() => step > 1 && step < 4 ? setStep((step - 1) as any) : navigate('/auth')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'var(--primary-light)', color: 'var(--primary)' }}>
            UC01.1 - AUTH
          </span>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '2rem' }}>
          {[1, 2, 3].map(s => (
            <div 
              key={s} 
              style={{ 
                flex: 1, 
                height: 4, 
                borderRadius: 2, 
                background: step >= s ? 'var(--primary)' : 'var(--border-light)',
                transition: 'background 0.3s ease'
              }} 
            />
          ))}
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        {/* STEP 1: Enter Email */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="slide-up">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Mail size={28} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Quên Mật Khẩu?</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '0.5rem' }}>
                Nhập địa chỉ email đăng ký tài khoản của bạn để nhận mã xác thực OTP 6 chữ số.
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Email của bạn</label>
              <input 
                type="email" 
                className="input-field" 
                placeholder="name@example.com" 
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}>
              Gửi Mã Xác Thực OTP
            </button>
          </form>
        )}

        {/* STEP 2: Verify OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="slide-up">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <KeyRound size={28} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Xác Thực Mã OTP</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '0.5rem' }}>
                Mã 6 chữ số đã được gửi tới <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1.75rem' }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  style={{
                    width: 48,
                    height: 56,
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-dark)',
                    background: 'var(--bg-secondary)',
                    outline: 'none',
                    color: 'var(--text-primary)'
                  }}
                />
              ))}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', marginBottom: '1.25rem' }}>
              Xác Nhận Mã OTP
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {isTimerActive ? (
                <span>Gửi lại mã sau: <strong style={{ color: 'var(--primary)' }}>{timer}s</strong></span>
              ) : (
                <button 
                  type="button" 
                  onClick={() => { setTimer(60); setIsTimerActive(true); }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <RefreshCw size={14} /> Gửi lại mã OTP ngay
                </button>
              )}
            </div>
          </form>
        )}

        {/* STEP 3: Reset Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="slide-up">
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <ShieldCheck size={28} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Tạo Mật Khẩu Mới</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '0.5rem' }}>
                Hãy chọn một mật khẩu mạnh để bảo vệ tài khoản học tập của bạn.
              </p>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Mật khẩu mới</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Tối thiểu 6 ký tự" 
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                required 
              />
              {/* Password strength meter */}
              {newPassword && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4].map(s => (
                      <div 
                        key={s} 
                        style={{ 
                          flex: 1, 
                          height: 4, 
                          borderRadius: 2, 
                          background: s <= strength.score ? strength.color : 'var(--border-light)' 
                        }} 
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: strength.color }}>
                    Độ an toàn: {strength.text}
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Xác nhận mật khẩu mới</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Nhập lại mật khẩu mới" 
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}>
              Cập Nhật Mật Khẩu Mới
            </button>
          </form>
        )}

        {/* STEP 4: Success */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }} className="slide-up">
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <CheckCircle2 size={36} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Đổi Mật Khẩu Thành Công!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Mật khẩu tài khoản của bạn đã được cập nhật an toàn trong cơ sở dữ liệu. Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('/auth')}
              style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}
            >
              Đăng Nhập Ngay
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ForgotPassword;
