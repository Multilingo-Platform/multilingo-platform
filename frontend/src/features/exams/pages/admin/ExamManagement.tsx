import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Filter, BookOpen, CheckCircle, FileText, BarChart, FileSpreadsheet, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../../../core/api/axiosClient';
import Swal from 'sweetalert2';

const ExamManagement = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get<any, any>('/v1/admin/exams');
      if (res.success && res.data) {
        setExams(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch exams', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter]);

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Bạn có chắc chắn?',
      text: "Đề thi này sẽ bị xóa vĩnh viễn và không thể khôi phục!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--danger)',
      cancelButtonColor: 'var(--text-muted)',
      confirmButtonText: 'Đồng ý xóa',
      cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await axiosClient.delete<any, any>(`/v1/admin/exams/${id}`);
      if (res.success) {
        Swal.fire({ title: 'Đã xóa!', text: 'Đề thi đã được xóa thành công.', icon: 'success', timer: 1500, showConfirmButton: false });
        fetchExams();
      } else {
        Swal.fire('Lỗi', res.message, 'error');
      }
    } catch (err: any) {
      Swal.fire('Lỗi', err.message, 'error');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const actionText = newStatus ? 'xuất bản' : 'chuyển về bản nháp';
    
    const result = await Swal.fire({
      title: 'Xác nhận thay đổi',
      text: `Bạn có chắc chắn muốn ${actionText} đề thi này?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy'
    });
    
    if (!result.isConfirmed) return;

    try {
      const res = await axiosClient.patch<any, any>(`/v1/admin/exams/${id}/status?isPublished=${newStatus}`);
      if (res.success) {
        Swal.fire({
          title: 'Thành công',
          text: `Đã đổi sang ${newStatus ? 'Đã xuất bản' : 'Bản nháp'}`,
          icon: 'success',
          toast: true,
          position: 'bottom-end',
          showConfirmButton: false,
          timer: 2000
        });
        setExams(exams.map(e => e.id === id ? { ...e, isPublished: newStatus } : e));
      } else {
        Swal.fire('Lỗi', res.message, 'error');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      Swal.fire('Lỗi', msg, 'error');
    }
  };

  const formatDetailedExamType = (type: string) => {
    switch (type) {
      case 'IELTS_ACADEMIC': return 'Full IELTS Academic';
      case 'IELTS_LISTENING': return 'IELTS Listening';
      case 'IELTS_READING': return 'IELTS Reading';
      case 'IELTS_WRITING': return 'IELTS Writing';
      case 'TOEIC_LISTENING_READING':
      case 'TOEIC_LR':
      case 'TOEIC': return 'Full TOEIC L&R';
      case 'TOEIC_LISTENING': return 'TOEIC Listening';
      case 'TOEIC_READING': return 'TOEIC Reading';
      case 'TOEIC_WRITING': return 'TOEIC Writing';
      case 'NLTV': return 'Full NLTV (Năng Lực Tiếng Việt)';
      case 'NLTV_LISTENING': return 'NLTV Nghe';
      case 'NLTV_READING': return 'NLTV Đọc';
      case 'NLTV_WRITING': return 'NLTV Viết';
      case 'IELTS_GENERAL': return 'Full IELTS General';
      case 'IELTS_L1': return 'IELTS Listening Part 1';
      case 'IELTS_L2': return 'IELTS Listening Part 2';
      case 'IELTS_L3': return 'IELTS Listening Part 3';
      case 'IELTS_L4': return 'IELTS Listening Part 4';
      case 'IELTS_R1': return 'IELTS Reading Passage 1';
      case 'IELTS_R2': return 'IELTS Reading Passage 2';
      case 'IELTS_R3': return 'IELTS Reading Passage 3';
      case 'IELTS_W1': return 'IELTS Writing Task 1';
      case 'IELTS_W2': return 'IELTS Writing Task 2';
      case 'TOEIC_P1': return 'TOEIC Listening Part 1';
      case 'TOEIC_P2': return 'TOEIC Listening Part 2';
      case 'TOEIC_P3': return 'TOEIC Listening Part 3';
      case 'TOEIC_P4': return 'TOEIC Listening Part 4';
      case 'TOEIC_P5': return 'TOEIC Reading Part 5';
      case 'TOEIC_P6': return 'TOEIC Reading Part 6';
      case 'TOEIC_P7': return 'TOEIC Reading Part 7';
      case 'TW':
      case 'TOEIC_W':
      case 'TOEIC_WRITING': return 'TOEIC Writing';
      case 'TOEIC_W1':
      case 'TW_P1': return 'TOEIC Writing Part 1';
      case 'TOEIC_W2':
      case 'TW_P2': return 'TOEIC Writing Part 2';
      case 'TOEIC_W3':
      case 'TW_P3': return 'TOEIC Writing Part 3';
      case 'NLTV_L': return 'NLTV Nghe';
      case 'NLTV_R': return 'NLTV Đọc';
      case 'NLTV_W': return 'NLTV Viết';
      case 'NLTV_L1': return 'NLTV Nghe - Phần 1';
      case 'NLTV_L2': return 'NLTV Nghe - Phần 2';
      case 'NLTV_L3': return 'NLTV Nghe - Phần 3';
      case 'NLTV_L4': return 'NLTV Nghe - Phần 4';
      case 'NLTV_R1': return 'NLTV Đọc - Phần 1';
      case 'NLTV_R2': return 'NLTV Đọc - Phần 2';
      case 'NLTV_W1': return 'NLTV Viết - Phần 1 (Chính tả)';
      case 'NLTV_W2': return 'NLTV Viết - Phần 2 (Thư/Email)';
      case 'NLTV_W3': return 'NLTV Viết - Phần 3 (Bài luận)';
      default: return type ? type.replace(/_/g, ' ') : '';
    }
  };

  const formatDateTime = (dateStr?: string | Date) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const getEffectiveExamType = (e: { type?: string; title?: string; parts?: number; questions?: number }): string => {
    const rawType = e.type || '';
    if (rawType === 'NLTV' || rawType === 'NLTV_A1_A2' || rawType === 'NLTV_B1_C1') {
      const titleLower = (e.title || '').toLowerCase();
      if (titleLower.includes('kỹ năng đọc') || titleLower.includes('đọc hiểu') || titleLower.includes('reading') || (e.parts === 2 && e.questions === 40)) {
        return 'NLTV_READING';
      }
      if (titleLower.includes('kỹ năng nghe') || titleLower.includes('nghe hiểu') || titleLower.includes('listening') || (e.parts === 4 && e.questions === 55)) {
        return 'NLTV_LISTENING';
      }
      if (titleLower.includes('kỹ năng viết') || titleLower.includes('viết') || titleLower.includes('writing') || (e.parts === 3 && e.questions === 12)) {
        return 'NLTV_WRITING';
      }
      if (e.parts !== undefined && e.parts > 0 && e.parts < 9) {
        if (titleLower.includes('đọc')) return 'NLTV_READING';
        if (titleLower.includes('nghe')) return 'NLTV_LISTENING';
        if (titleLower.includes('viết')) return 'NLTV_WRITING';
      }
      return rawType;
    }
    return rawType;
  };

  const filteredExams = exams.filter(e => {
    const effectiveType = getEffectiveExamType(e);
    const matchSearch = e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === '' || 
      (typeFilter === 'IELTS_ALL' && effectiveType?.startsWith('IELTS')) ||
      (typeFilter === 'IELTS_ACADEMIC' && (effectiveType === 'IELTS_ACADEMIC' || effectiveType === 'IELTS')) ||
      (typeFilter === 'IELTS_LISTENING' && effectiveType?.startsWith('IELTS_L')) ||
      (typeFilter === 'IELTS_READING' && effectiveType?.startsWith('IELTS_R')) ||
      (typeFilter === 'IELTS_WRITING' && effectiveType?.startsWith('IELTS_W')) ||
      (typeFilter === 'TOEIC_ALL' && (effectiveType?.startsWith('TOEIC') || effectiveType?.startsWith('TW'))) ||
      ((typeFilter === 'TOEIC_LR' || typeFilter === 'TOEIC_LISTENING_READING') && (effectiveType === 'TOEIC_LR' || effectiveType === 'TOEIC' || effectiveType === 'TOEIC_LISTENING_READING')) ||
      (typeFilter === 'TOEIC_LISTENING' && (effectiveType === 'TOEIC_LISTENING' || ['TOEIC_P1','TOEIC_P2','TOEIC_P3','TOEIC_P4'].some(p => effectiveType?.startsWith(p)))) ||
      (typeFilter === 'TOEIC_READING' && (effectiveType === 'TOEIC_READING' || ['TOEIC_P5','TOEIC_P6','TOEIC_P7'].some(p => effectiveType?.startsWith(p)))) ||
      (typeFilter === 'TOEIC_WRITING' && (
        effectiveType === 'TOEIC_WRITING' ||
        effectiveType === 'TOEIC_W' ||
        effectiveType === 'TW' ||
        effectiveType?.startsWith('TOEIC_WRITING') ||
        effectiveType?.startsWith('TOEIC_W') ||
        effectiveType?.startsWith('TW')
      )) ||
      (typeFilter === 'NLTV_ALL' && effectiveType?.startsWith('NLTV')) || 
      (typeFilter === 'NLTV' && (effectiveType === 'NLTV' || effectiveType === 'NLTV_A1_A2' || effectiveType === 'NLTV_B1_C1') && (e.parts === undefined || e.parts === 0 || e.parts === 9)) ||
      (typeFilter === 'NLTV_LISTENING' && (effectiveType?.startsWith('NLTV_L') || effectiveType === 'NLTV_LISTENING')) ||
      (typeFilter === 'NLTV_READING' && (effectiveType?.startsWith('NLTV_R') || effectiveType === 'NLTV_READING')) ||
      (typeFilter === 'NLTV_WRITING' && (effectiveType?.startsWith('NLTV_W') || effectiveType === 'NLTV_WRITING')) ||
      effectiveType === typeFilter;
    const matchStatus = statusFilter === '' || (statusFilter === 'PUBLISHED' ? e.isPublished : !e.isPublished);
    return matchSearch && matchType && matchStatus;
  });

  const totalElements = filteredExams.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalElements);
  const paginatedExams = filteredExams.slice(startIndex, endIndex);

  const getPageNumbers = (current: number, total: number) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  const stats = [
    { label: 'Tổng số đề thi', value: exams.length, icon: <BookOpen size={24} />, color: 'var(--primary)' },
    { label: 'Đang hoạt động', value: exams.filter(e => e.isPublished).length, icon: <CheckCircle size={24} />, color: 'var(--success)' },
    { label: 'Bản nháp', value: exams.filter(e => !e.isPublished).length, icon: <FileText size={24} />, color: 'var(--warning)' },
    { label: 'Tổng lượt thi', value: exams.reduce((acc, curr) => acc + (curr.joins || 0), 0), icon: <BarChart size={24} />, color: '#8b5cf6' },
  ];

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Quản lý Đề thi</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Biên soạn, xuất bản và quản lý tất cả các đề thi trên hệ thống.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/admin/exams/create')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-full)', boxShadow: '0 4px 6px -1px rgba(234, 88, 12, 0.2)' }}
          >
            <Plus size={20} /> Tạo Đề thi Mới
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {stats.map((stat, idx) => (
          <div key={idx} className="ed-card flex-center" style={{ padding: '1.25rem', justifyContent: 'flex-start', gap: '1rem', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color, flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{stat.value}</div>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="ed-card" style={{ padding: '0', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

        {/* Toolbar */}
        <div className="flex-between" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-secondary)', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px', minWidth: '200px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã, tên đề thi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.875rem 0.55rem 2.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                outline: 'none',
                fontSize: '0.9rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field" 
              style={{ width: 'auto', padding: '0.55rem 0.875rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
              <option value="">Mọi đề thi</option>
              
              <optgroup label="IELTS">
                <option value="IELTS_ALL">IELTS</option>
                <option value="IELTS_ACADEMIC">Full IELTS Academic</option>
                <option value="IELTS_LISTENING">IELTS Listening</option>
                <option value="IELTS_READING">IELTS Reading</option>
                <option value="IELTS_WRITING">IELTS Writing</option>
              </optgroup>

              <optgroup label="TOEIC">
                <option value="TOEIC_ALL">TOEIC</option>
                <option value="TOEIC_LR">Full TOEIC L&R</option>
                <option value="TOEIC_LISTENING">TOEIC Listening</option>
                <option value="TOEIC_READING">TOEIC Reading</option>
                <option value="TOEIC_WRITING">TOEIC Writing</option>
              </optgroup>

              <optgroup label="Năng Lực Tiếng Việt (NLTV)">
                <option value="NLTV_ALL">NLTV</option>
                <option value="NLTV">Full NLTV</option>
                <option value="NLTV_LISTENING">NLTV Nghe</option>
                <option value="NLTV_READING">NLTV Đọc</option>
                <option value="NLTV_WRITING">NLTV Viết</option>
              </optgroup>
            </select>
            
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field" 
              style={{ width: 'auto', padding: '0.55rem 0.875rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
              <option value="">Tất cả trạng thái</option>
              <option value="PUBLISHED">Đã xuất bản</option>
              <option value="DRAFT">Bản nháp</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Đang tải dữ liệu...</div>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-light)' }}>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', width: '130px', whiteSpace: 'nowrap' }}>MÃ ĐỀ THI</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', minWidth: '220px' }}>TÊN ĐỀ THI</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', width: '160px', whiteSpace: 'nowrap' }}>LOẠI ĐỀ THI</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', width: '85px', whiteSpace: 'nowrap' }}>LƯỢT THI</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', width: '115px', whiteSpace: 'nowrap' }}>TRẠNG THÁI</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', width: '120px', whiteSpace: 'nowrap' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {paginatedExams.map((exam, idx) => (
                <tr key={exam.id} style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)', transition: 'background-color 0.2s' }} className="hover-bg-tertiary">
                  <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}>{exam.code?.toUpperCase()}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', minWidth: '220px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem', fontSize: '0.925rem', lineHeight: 1.35 }}>{exam.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={exam.updatedAt ? new Date(exam.updatedAt).toLocaleString('vi-VN') : ''}>
                      Cập nhật: {formatDateTime(exam.updatedAt)} • {exam.parts} phần • {exam.questions} câu
                    </div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-dark)', background: 'var(--primary-light)', padding: '0.3rem 0.65rem', borderRadius: '4px', display: 'inline-block' }}>
                      {formatDetailedExamType(getEffectiveExamType(exam))}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{(exam.joins || 0).toLocaleString('vi-VN')}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span 
                      className="flex-center" 
                      style={{
                        display: 'inline-flex',
                        gap: '0.3rem',
                        padding: '0.25rem 0.65rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: exam.isPublished ? 'var(--success-light)' : 'var(--warning-light)',
                        color: exam.isPublished ? 'var(--success-dark)' : 'var(--warning-dark)',
                        border: `1px solid ${exam.isPublished ? 'var(--success)' : 'var(--warning)'}`
                      }}
                    >
                      {exam.isPublished ? <CheckCircle size={13} /> : <FileText size={13} />}
                      {exam.isPublished ? 'Xuất bản' : 'Bản nháp'}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div className="flex-center" style={{ justifyContent: 'center', gap: '0.4rem' }}>
                      <button 
                        onClick={() => handleToggleStatus(exam.id, exam.isPublished)} 
                        className="btn" 
                        style={{ padding: '0.45rem', backgroundColor: exam.isPublished ? 'var(--warning-light)' : 'var(--success-light)', color: exam.isPublished ? 'var(--warning)' : 'var(--success)', border: 'none', borderRadius: 'var(--radius-md)' }} 
                        title={exam.isPublished ? "Chuyển về bản nháp" : "Xuất bản"}
                      >
                        {exam.isPublished ? <FileText size={16} /> : <CheckCircle size={16} />}
                      </button>
                      <button onClick={() => navigate('/admin/exams/edit/' + exam.id)} className="btn" style={{ padding: '0.45rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-md)' }} title="Chỉnh sửa">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(exam.id)} className="btn" style={{ padding: '0.45rem', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: 'var(--radius-md)' }} title="Xóa">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}

          {!loading && filteredExams.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Không tìm thấy đề thi nào phù hợp với bộ lọc.
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        {!loading && filteredExams.length > 0 && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)'
            }}
          >
            {/* Left: Range and Total Summary */}
            <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              <span>
                Hiển thị <strong>{totalElements > 0 ? startIndex + 1 : 0} - {endIndex}</strong> trên tổng số <strong>{totalElements}</strong> đề thi
              </span>
            </div>

            {/* Right: Page Size Selector & Pagination Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Số đề/trang:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    height: '32px',
                    padding: '0 0.6rem',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'white',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                    width: 'auto'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={validPage === 1}
                    className="btn"
                    style={{
                      height: '32px',
                      padding: '0 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'white',
                      color: validPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: validPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: validPage === 1 ? 0.4 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Trang đầu"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={validPage === 1}
                    className="btn"
                    style={{
                      height: '32px',
                      padding: '0 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'white',
                      color: validPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: validPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: validPage === 1 ? 0.4 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Trang trước"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {getPageNumbers(validPage, totalPages).map((p, idx) =>
                    typeof p === 'number' ? (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className="btn"
                        style={{
                          minWidth: '32px',
                          height: '32px',
                          padding: '0 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          border: p === validPage ? 'none' : '1px solid var(--border-light)',
                          backgroundColor: p === validPage ? 'var(--primary)' : 'white',
                          color: p === validPage ? '#fff' : 'var(--text-primary)',
                          fontWeight: p === validPage ? 700 : 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={idx} style={{ padding: '0 0.25rem', color: 'var(--text-muted)' }}>
                        ...
                      </span>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={validPage === totalPages}
                    className="btn"
                    style={{
                      height: '32px',
                      padding: '0 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'white',
                      color: validPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: validPage === totalPages ? 'not-allowed' : 'pointer',
                      opacity: validPage === totalPages ? 0.4 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Trang sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={validPage === totalPages}
                    className="btn"
                    style={{
                      height: '32px',
                      padding: '0 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'white',
                      color: validPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: validPage === totalPages ? 'not-allowed' : 'pointer',
                      opacity: validPage === totalPages ? 0.4 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Trang cuối"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamManagement;
