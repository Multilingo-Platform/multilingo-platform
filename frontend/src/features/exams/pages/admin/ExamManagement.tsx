import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search, Filter, BookOpen, CheckCircle, FileText, BarChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ExamManagement = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const exams = [
    { id: 'cam-18-1', title: 'Cambridge IELTS 18 - Test 1', type: 'IELTS', parts: 4, questions: 40, status: 'Active', joins: 1240, lastEdited: '2026-10-02' },
    { id: 'cam-18-2', title: 'Cambridge IELTS 18 - Test 2', type: 'IELTS', parts: 4, questions: 40, status: 'Active', joins: 890, lastEdited: '2026-10-01' },
    { id: 'toeic-2023', title: 'TOEIC ETS 2023 - Test 1', type: 'TOEIC', parts: 7, questions: 200, status: 'Active', joins: 3450, lastEdited: '2026-09-28' },
    { id: 'vstep-b1-1', title: 'NLTV B1 - Đề thi thử số 1', type: 'NLTV', parts: 3, questions: 35, status: 'Draft', joins: 0, lastEdited: '2026-10-04' },
    { id: 'cam-18-4', title: 'Cambridge IELTS 18 - Test 4', type: 'IELTS', parts: 4, questions: 40, status: 'Draft', joins: 0, lastEdited: '2026-10-04' },
  ];

  const stats = [
    { label: 'Tổng số đề thi', value: exams.length, icon: <BookOpen size={24} />, color: 'var(--primary)' },
    { label: 'Đang hoạt động', value: exams.filter(e => e.status === 'Active').length, icon: <CheckCircle size={24} />, color: 'var(--success)' },
    { label: 'Bản nháp', value: exams.filter(e => e.status === 'Draft').length, icon: <FileText size={24} />, color: 'var(--warning)' },
    { label: 'Tổng lượt thi', value: exams.reduce((acc, curr) => acc + curr.joins, 0), icon: <BarChart size={24} />, color: '#8b5cf6' },
  ];

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Quản lý Đề thi</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Biên soạn, xuất bản và quản lý tất cả các đề thi trên hệ thống.</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/admin/exams/create')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-full)', boxShadow: '0 4px 6px -1px rgba(234, 88, 12, 0.2)' }}
        >
          <Plus size={20} /> Tạo Đề thi Mới
        </button>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {stats.map((stat, idx) => (
          <div key={idx} className="ed-card flex-center" style={{ padding: '1.5rem', justifyContent: 'flex-start', gap: '1.25rem', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{stat.value}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="ed-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-md)' }}>
        
        {/* Toolbar */}
        <div className="flex-between" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo mã, tên đề thi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.6rem 1rem 0.6rem 2.5rem', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-light)',
                outline: 'none',
                fontSize: '0.95rem'
              }}
            />
          </div>
          <div className="flex-center" style={{ gap: '0.75rem' }}>
            <select className="input-field" style={{ width: 'auto', padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)' }}>
              <option value="">Tất cả chứng chỉ</option>
              <option value="IELTS">IELTS</option>
              <option value="TOEIC">TOEIC</option>
              <option value="NLTV">NLTV</option>
            </select>
            <button className="btn btn-outline flex-center" style={{ gap: '0.5rem', padding: '0.6rem 1rem' }}>
              <Filter size={18} /> Lọc thêm
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-light)' }}>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>MÃ ĐỀ THI</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>TÊN ĐỀ THI</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>CẤU TRÚC</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>LƯỢT THI</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>TRẠNG THÁI</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam, idx) => (
                <tr key={exam.id} style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)', transition: 'background-color 0.2s' }} className="hover-bg-tertiary">
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.95rem' }}>{exam.id.toUpperCase()}</div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{exam.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cập nhật: {exam.lastEdited} • Loại: {exam.type}</div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div className="flex-center" style={{ gap: '0.75rem', justifyContent: 'flex-start' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{exam.parts} phần</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{exam.questions} câu</span>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exam.joins.toLocaleString('vi-VN')}</div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span className="flex-center" style={{ 
                      display: 'inline-flex',
                      gap: '0.35rem',
                      padding: '0.25rem 0.75rem', 
                      borderRadius: 'var(--radius-full)', 
                      fontSize: '0.75rem', 
                      fontWeight: 700,
                      backgroundColor: exam.status === 'Active' ? 'var(--success-light)' : 'var(--warning-light)',
                      color: exam.status === 'Active' ? 'var(--success-dark)' : 'var(--warning-dark)',
                      border: `1px solid ${exam.status === 'Active' ? 'var(--success)' : 'var(--warning)'}`
                    }}>
                      {exam.status === 'Active' ? <CheckCircle size={14} /> : <FileText size={14} />} 
                      {exam.status === 'Active' ? 'Xuất bản' : 'Bản nháp'}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                    <div className="flex-center" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.5rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-md)' }} title="Chỉnh sửa">
                        <Edit size={18} />
                      </button>
                      <button className="btn" style={{ padding: '0.5rem', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: 'var(--radius-md)' }} title="Xóa">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {exams.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Không tìm thấy đề thi nào.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamManagement;
