import { useState } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  Download, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileSpreadsheet,
  Settings2,
  X
} from 'lucide-react';

interface Transaction {
  id: string;
  orderCode: string;
  userName: string;
  userEmail: string;
  planName: string;
  amount: string;
  paymentMethod: string;
  timestamp: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
}

const TRANSACTIONS: Transaction[] = [
  { id: 'TXN-901', orderCode: 'ORDER-ML-9821', userName: 'John Doe', userEmail: 'john.doe@example.com', planName: 'Gói VIP 1 Năm', amount: '1.188.000đ', paymentMethod: 'VNPAY QR', timestamp: '03/10/2026 13:45', status: 'SUCCESS' },
  { id: 'TXN-902', orderCode: 'ORDER-ML-9820', userName: 'Nguyen Van A', userEmail: 'nguyenvana@gmail.com', planName: 'Gói Bứt Phá 6 Tháng', amount: '894.000đ', paymentMethod: 'VNPAY ATM', timestamp: '03/10/2026 12:10', status: 'SUCCESS' },
  { id: 'TXN-903', orderCode: 'ORDER-ML-9819', userName: 'Tran Thi Mai', userEmail: 'maitt@yahoo.com', planName: 'Gói VIP 1 Năm', amount: '1.188.000đ', paymentMethod: 'VNPAY Visa', timestamp: '03/10/2026 10:05', status: 'PENDING' },
  { id: 'TXN-904', orderCode: 'ORDER-ML-9818', userName: 'Le Hoang Nam', userEmail: 'namle@outlook.com', planName: 'Gói Bứt Phá 6 Tháng', amount: '894.000đ', paymentMethod: 'VNPAY QR', timestamp: '02/10/2026 21:30', status: 'FAILED' },
  { id: 'TXN-905', orderCode: 'ORDER-ML-9817', userName: 'Do Thi Hoa', userEmail: 'hoado@gmail.com', planName: 'Gói VIP 1 Năm', amount: '1.188.000đ', paymentMethod: 'VNPAY QR', timestamp: '02/10/2026 18:22', status: 'SUCCESS' },
];

const AdminBilling = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(TRANSACTIONS);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);

  const filteredTxns = transactions.filter(t => {
    const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
    const matchSearch = t.orderCode.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        t.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.userName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'SUCCESS': return <span className="badge badge-green flex-center" style={{ gap: 4 }}><CheckCircle2 size={12} /> Thành Công</span>;
      case 'PENDING': return <span className="badge badge-orange flex-center" style={{ gap: 4 }}><Clock size={12} /> Chờ Khớp Lệnh</span>;
      case 'FAILED': return <span className="badge badge-gray flex-center" style={{ gap: 4, color: '#dc2626' }}><AlertCircle size={12} /> Thất Bại</span>;
    }
  };

  return (
    <div className="slide-up">
      
      {/* Page Header */}
      <div className="flex-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-orange">UC16.1 / UC16.2 / UC16.3 - FINANCIAL BILLING</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            Quản Lý Doanh Thu & Đối Soát Giao Dịch VNPAY
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Giám sát dòng tiền, tra cứu đối soát Webhook IPN và xuất báo cáo tài chính kế toán.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-outline"
            onClick={() => setShowPlansModal(true)}
            style={{ fontSize: '0.88rem' }}
          >
            <Settings2 size={16} /> Bảng Giá Gói Cước
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={() => setShowExportModal(true)}
            style={{ fontSize: '0.88rem' }}
          >
            <Download size={16} /> Xuất Báo Cáo Excel
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="ed-card" style={{ padding: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Doanh Thu Tháng Này</span>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--emerald-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} color="var(--emerald)" />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>142.800.000đ</div>
          <span className="badge badge-green" style={{ marginTop: 6, fontSize: '0.75rem' }}>+18.4% so với tháng trước</span>
        </div>

        <div className="ed-card" style={{ padding: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>GD Thành Công</span>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={18} color="var(--primary)" />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>248 <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>đơn</span></div>
          <span className="badge badge-indigo" style={{ marginTop: 6, fontSize: '0.75rem' }}>Khớp lệnh: 96.2%</span>
        </div>

        <div className="ed-card" style={{ padding: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Chuyển Đổi Free ➔ VIP</span>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--sky-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="var(--sky)" />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>8.2%</div>
          <span className="badge badge-sky" style={{ marginTop: 6, fontSize: '0.75rem' }}>Mục tiêu quý: 10%</span>
        </div>

        <div className="ed-card" style={{ padding: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Giá Trị Đơn (AOV)</span>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--violet-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} color="var(--violet)" />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>575.000đ</div>
          <span className="badge badge-purple" style={{ marginTop: 6, fontSize: '0.75rem' }}>Ưa chuộng gói 1 năm</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="ed-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['ALL', 'SUCCESS', 'PENDING', 'FAILED'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`btn ${filterStatus === st ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', borderRadius: 'var(--radius-pill)' }}
            >
              {st === 'ALL' ? 'Tất cả' : st === 'SUCCESS' ? 'Thành công' : st === 'PENDING' ? 'Đang xử lý' : 'Thất bại'}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: 280 }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Tìm theo mã đơn, email, họ tên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 38, paddingRight: 12, paddingTop: '0.5rem', paddingBottom: '0.5rem', fontSize: '0.88rem', borderRadius: 'var(--radius-pill)' }}
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="ed-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Mã Đơn & GD VNPAY</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Học Viên</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Gói VIP Đăng Ký</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Số Tiền</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Cổng Thanh Toán</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Thời Gian</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 700, textAlign: 'right' }}>Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            {filteredTxns.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{t.orderCode}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.id}</div>
                </td>
                <td style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.userName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.userEmail}</div>
                </td>
                <td style={{ padding: '1rem 1.25rem' }}>
                  <span className="badge badge-gray">{t.planName}</span>
                </td>
                <td style={{ padding: '1rem 1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {t.amount}
                </td>
                <td style={{ padding: '1rem 1.25rem', color: '#005baa', fontWeight: 600 }}>
                  {t.paymentMethod}
                </td>
                <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  {t.timestamp}
                </td>
                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                  {getStatusBadge(t.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* EXPORT EXCEL MODAL */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1.5rem' }}>
          <div className="ed-card slide-up" style={{ width: '100%', maxWidth: 480, padding: '2rem', background: 'white' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={22} color="#15803d" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Xuất Báo Cáo Tài Chính VNPAY</h3>
              </div>
              <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Hệ thống sẽ tổng hợp <strong>{filteredTxns.length} giao dịch</strong> thành tệp Excel (.xlsx) chuẩn biểu mẫu báo cáo kế toán doanh nghiệp.
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Khoảng thời gian xuất</label>
              <select className="input-field">
                <option>Tháng 10 / 2026 (Tháng hiện tại)</option>
                <option>Quý 3 / 2026</option>
                <option>Từ trước đến nay</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowExportModal(false)}>Hủy</button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  alert('Đang tải xuống tệp: "Bao_Cao_Doanh_Thu_VNPAY_10_2026.xlsx"');
                  setShowExportModal(false);
                }}
                style={{ background: '#15803d', gap: 6 }}
              >
                <Download size={16} /> Tải File Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLANS CMS MODAL */}
      {showPlansModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1.5rem' }}>
          <div className="ed-card slide-up" style={{ width: '100%', maxWidth: 580, padding: '2rem', background: 'white' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Điều Chỉnh Bảng Giá Gói Cước VIP</h3>
              <button onClick={() => setShowPlansModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Gói Bứt Phá (6 Tháng)</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="text" className="input-field" defaultValue="894.000" style={{ flex: 1 }} />
                  <span style={{ alignSelf: 'center', fontWeight: 600 }}>VNĐ</span>
                </div>
              </div>

              <div style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Gói VIP Trọn Gói (1 Năm)</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="text" className="input-field" defaultValue="1.188.000" style={{ flex: 1 }} />
                  <span style={{ alignSelf: 'center', fontWeight: 600 }}>VNĐ</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowPlansModal(false)}>Hủy</button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  alert('Đã cập nhật bảng giá gói cước mới vào CSDL subscription_plans.');
                  setShowPlansModal(false);
                }}
              >
                Lưu Bảng Giá
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminBilling;
