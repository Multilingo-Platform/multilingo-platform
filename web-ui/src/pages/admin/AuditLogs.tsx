import { useState } from 'react';
import { 
  ShieldAlert, 
  RotateCcw, 
  Search, 
  Filter, 
  Eye, 
  AlertTriangle, 
  UserX, 
  CheckCircle2, 
  Clock, 
  X,
  Code
} from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  adminName: string;
  action: 'DELETE_EXAM' | 'UPDATE_USER' | 'UPDATE_ROLE' | 'CONFIG_QUOTA';
  entityId: string;
  entityType: string;
  ipAddress: string;
  device: string;
  snapshot: any;
}

const SAMPLE_LOGS: AuditLog[] = [
  {
    id: 'LOG-9812',
    timestamp: '03/10/2026 13:42:10',
    adminName: 'Son Nguyen (SuperAdmin)',
    action: 'DELETE_EXAM',
    entityId: 'cam-18-test-4',
    entityType: 'Exam',
    ipAddress: '113.190.234.12 (Hanoi, VN)',
    device: 'Chrome 124 / Windows 11',
    snapshot: {
      examId: 'cam-18-test-4',
      title: 'Cambridge IELTS 18 - Academic Test 4',
      sections: 4,
      totalQuestions: 40,
      deletedAt: '2026-10-03T06:42:10Z',
      parts: [
        { partNumber: 1, title: 'Accommodation Request' },
        { partNumber: 2, title: 'Forest Conservation Project' }
      ]
    }
  },
  {
    id: 'LOG-9811',
    timestamp: '03/10/2026 11:15:32',
    adminName: 'Thanh Xuan (Content Lead)',
    action: 'UPDATE_ROLE',
    entityId: 'USER-1049 (trung.nd@gmail.com)',
    entityType: 'User',
    ipAddress: '14.238.102.88 (Da Nang, VN)',
    device: 'Safari / macOS Sonoma',
    snapshot: {
      userId: 1049,
      oldRole: 'STUDENT',
      newRole: 'TEACHER',
      permissionsAdded: ['EXAM_CREATE', 'EXAM_EDIT']
    }
  },
  {
    id: 'LOG-9810',
    timestamp: '02/10/2026 19:05:44',
    adminName: 'Son Nguyen (SuperAdmin)',
    action: 'CONFIG_QUOTA',
    entityId: 'GLOBAL_AI_QUOTA',
    entityType: 'SystemConfig',
    ipAddress: '113.190.234.12 (Hanoi, VN)',
    device: 'Chrome 124 / Windows 11',
    snapshot: {
      oldLimitFree: 2,
      newLimitFree: 3,
      oldLimitVip: 'UNLIMITED',
      newLimitVip: 'UNLIMITED'
    }
  },
  {
    id: 'LOG-9809',
    timestamp: '02/10/2026 15:30:19',
    adminName: 'System Security Watchdog',
    action: 'UPDATE_USER',
    entityId: 'USER-882 (attacker_01@temp.org)',
    entityType: 'User',
    ipAddress: '45.134.22.90 (Frankfurt, DE)',
    device: 'Headless Chrome / Linux',
    snapshot: {
      userId: 882,
      reason: 'SQL Injection brute force detected',
      isActive: false
    }
  }
];

interface FraudAlert {
  id: string;
  userName: string;
  email: string;
  plan: string;
  ip1: string;
  ip2: string;
  lastActive: string;
  severity: 'HIGH' | 'MEDIUM';
}

const FRAUD_ALERTS: FraudAlert[] = [
  {
    id: 'FRAUD-01',
    userName: 'David Nguyen',
    email: 'david.nguyen@example.com',
    plan: 'PREMIUM VIP',
    ip1: '113.190.234.12 (Hà Nội, VN)',
    ip2: '14.238.102.88 (Hồ Chí Minh, VN)',
    lastActive: '5 phút trước',
    severity: 'HIGH'
  },
  {
    id: 'FRAUD-02',
    userName: 'Elena Rostova',
    email: 'elena.rostova@gmail.com',
    plan: 'PREMIUM VIP',
    ip1: '171.244.18.99 (Đà Nẵng, VN)',
    ip2: '92.204.14.33 (Tokyo, JP)',
    lastActive: '12 phút trước',
    severity: 'HIGH'
  }
];

const AuditLogs = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'fraud'>('audit');
  const [selectedSnapshot, setSelectedSnapshot] = useState<AuditLog | null>(null);
  const [fraudList, setFraudList] = useState<FraudAlert[]>(FRAUD_ALERTS);

  const handleRollback = () => {
    alert(`Đã khôi phục dữ liệu thành công cho thực thể: ${selectedSnapshot?.entityId}. Hệ thống đã đồng bộ lại cơ sở dữ liệu.`);
    setSelectedSnapshot(null);
  };

  const handleRevokeSession = (id: string) => {
    alert(`Đã thu hồi Refresh Token trên Redis. Thiết bị vi phạm đã bị buộc đăng xuất khỏi hệ thống.`);
    setFraudList(fraudList.filter(f => f.id !== id));
  };

  return (
    <div className="slide-up">
      
      {/* Page Title */}
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-orange">UC15.4 / A_TRACKING</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            Nhật Ký Kiểm Toán & Giám Sát An Ninh Hệ Thống
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Lưu vết toàn bộ thao tác nhạy cảm kèm bản chụp JSON và phát hiện hành vi chia sẻ tài khoản VIP trái phép.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid var(--border-light)', marginBottom: '1.75rem' }}>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'audit' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'audit' ? 'var(--primary)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Code size={18} />
          <span>Nhật Ký Kiểm Toán (Audit Logs & Rollback)</span>
        </button>

        <button
          onClick={() => setActiveTab('fraud')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'fraud' ? '3px solid #ef4444' : '3px solid transparent',
            color: activeTab === 'fraud' ? '#ef4444' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <AlertTriangle size={18} />
          <span>Cảnh Báo Gian Lận Đa IP (Fraud Detection)</span>
          {fraudList.length > 0 && (
            <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10, background: '#ef4444', color: 'white' }}>
              {fraudList.length} vi phạm
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="slide-up">
          <div className="ed-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-dark)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Mã Log & Thời Gian</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Người Thực Hiện</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Hành Động</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Đối Tượng Tác Động</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Địa Chỉ IP & Thiết Bị</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700, textAlign: 'right' }}>Bản Chụp JSON</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_LOGS.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{log.id}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.timestamp}</div>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>
                      {log.adminName}
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span className={log.action === 'DELETE_EXAM' ? 'badge badge-gray' : 'badge badge-orange'} style={{ color: log.action === 'DELETE_EXAM' ? '#dc2626' : undefined }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.entityId}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <div>{log.ipAddress}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{log.device}</div>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <button 
                        className="btn btn-outline"
                        onClick={() => setSelectedSnapshot(log)}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: 4 }}
                      >
                        <Eye size={14} /> Xem Snapshot
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FRAUD DETECTION */}
      {activeTab === 'fraud' && (
        <div className="slide-up">
          <div className="ed-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: '#fff5f5', borderLeft: '4px solid #ef4444' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
              Cơ Chế Giám Sát Chia Sẻ Tài Khoản VIP
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#7f1d1d', lineHeight: 1.6 }}>
              Hệ thống phát hiện các tài khoản VIP có đồng thời 2 phiên đăng nhập hoạt động tại 2 vị trí địa lý cách xa nhau bất thường trong cùng một khoảng thời gian. Admin có quyền hủy phiên từ xa để bảo vệ doanh thu bản quyền.
            </p>
          </div>

          <div className="ed-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-dark)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Học Viên VIP</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Thiết Bị 1 (IP Ban Đầu)</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Thiết Bị 2 (IP Phát Hiện Lạ)</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>Lần Cuối Truy Cập</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 700, textAlign: 'right' }}>Hành Động Can Thiệp</th>
                </tr>
              </thead>
              <tbody>
                {fraudList.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.userName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.email}</div>
                      <span className="badge badge-orange" style={{ marginTop: 4, display: 'inline-block' }}>{item.plan}</span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: '#166534', fontWeight: 600 }}>
                      {item.ip1}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: '#dc2626', fontWeight: 700 }}>
                      ⚠️ {item.ip2}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                      {item.lastActive}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <button 
                        className="btn"
                        onClick={() => handleRevokeSession(item.id)}
                        style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        <UserX size={15} /> Buộc Đăng Xuất Từ Xa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* JSON SNAPSHOT MODAL & ROLLBACK */}
      {selectedSnapshot && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1.5rem' }}>
          <div className="ed-card slide-up" style={{ width: '100%', maxWidth: 640, background: '#111827', color: 'white', borderRadius: 18, overflow: 'hidden' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f3f4f6' }}>
                  Bản Chụp Dữ Liệu Trước Khi Xóa (JSON Snapshot)
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{selectedSnapshot.id} • {selectedSnapshot.entityId}</span>
              </div>
              <button onClick={() => setSelectedSnapshot(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', maxHeight: 360, overflowY: 'auto' }}>
              <pre style={{ margin: 0, fontSize: '0.85rem', color: '#86efac', fontFamily: 'Consolas, monospace', lineHeight: 1.6 }}>
                {JSON.stringify(selectedSnapshot.snapshot, null, 2)}
              </pre>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a' }}>
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                Khôi phục sẽ đưa thực thể này về trạng thái nguyên bản trước thời điểm {selectedSnapshot.timestamp}.
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setSelectedSnapshot(null)} style={{ color: '#cbd5e1', borderColor: '#475569' }}>
                  Đóng
                </button>
                <button className="btn btn-primary" onClick={handleRollback} style={{ gap: 6 }}>
                  <RotateCcw size={16} /> Khôi Phục (Rollback)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AuditLogs;
