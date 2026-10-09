import React, { useState, useEffect } from 'react';
import { Search, Filter, Play, Clock, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axiosClient from '../../../../core/api/axiosClient';

const CERTIFICATES = [
  { value: 'IELTS', labelKey: 'library.filters.cert.ielts', labelDefault: 'IELTS' },
  { value: 'TOEIC', labelKey: 'library.filters.cert.toeic', labelDefault: 'TOEIC' },
  { value: 'NLTV', labelKey: 'library.filters.cert.nltv', labelDefault: 'Năng Lực Tiếng Việt (NLTV)' }
];

const SKILLS_MAP: Record<string, any[]> = {
  'IELTS': [
    { value: 'LISTENING', labelKey: 'library.filters.skills.listening', labelDefault: 'Listening', parts: [
      { id: 'L1', label: 'Part 1' }, { id: 'L2', label: 'Part 2' }, { id: 'L3', label: 'Part 3' }, { id: 'L4', label: 'Part 4' }
    ]},
    { value: 'READING', labelKey: 'library.filters.skills.reading', labelDefault: 'Reading', parts: [
      { id: 'R1', label: 'Passage 1' }, { id: 'R2', label: 'Passage 2' }, { id: 'R3', label: 'Passage 3' }
    ]},
    { value: 'WRITING', labelKey: 'library.filters.skills.writing', labelDefault: 'Writing', parts: [
      { id: 'W1', label: 'Task 1' }, { id: 'W2', label: 'Task 2' }
    ]},
  ],
  'TOEIC': [
    { value: 'LISTENING', labelKey: 'library.filters.skills.listening', labelDefault: 'Listening', parts: [
      { id: 'P1', label: 'Part 1: Photographs' }, { id: 'P2', label: 'Part 2: Question-Response' }, { id: 'P3', label: 'Part 3: Conversations' }, { id: 'P4', label: 'Part 4: Talks' }
    ]},
    { value: 'READING', labelKey: 'library.filters.skills.reading', labelDefault: 'Reading', parts: [
      { id: 'P5', label: 'Part 5: Incomplete Sentences' }, { id: 'P6', label: 'Part 6: Text Completion' }, { id: 'P7', label: 'Part 7: Reading Comprehension' }
    ]},
    { value: 'WRITING', labelKey: 'library.filters.skills.writing', labelDefault: 'Writing', parts: [
      { id: 'TW_P1', label: 'Part 1: Write a Sentence' }, { id: 'TW_P2', label: 'Part 2: Respond to Request' }
    ]}
  ],
  'NLTV': [
    { value: 'LISTENING', labelKey: 'library.filters.skills.listening', labelDefault: 'Nghe hiểu', parts: [
      { id: 'NLTV_L', label: 'Kỹ năng Nghe' }
    ]},
    { value: 'READING', labelKey: 'library.filters.skills.reading', labelDefault: 'Đọc hiểu', parts: [
      { id: 'NLTV_R', label: 'Kỹ năng Đọc' }
    ]},
    { value: 'WRITING', labelKey: 'library.filters.skills.writing', labelDefault: 'Viết', parts: [
      { id: 'NLTV_W', label: 'Kỹ năng Viết' }
    ]}
  ]
};

const ExamLibrary = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCert, setSelectedCert] = useState<string>('');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [selectedPart, setSelectedPart] = useState<string>('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [sortParam, setSortParam] = useState('createdAt');

  const fetchExams = async (currentPage = page) => {
    try {
      setLoading(true);
      const params: any = { page: currentPage, size: 12, sort: sortParam };
      if (searchTerm) params.search = searchTerm;
      let typesToFetch: string[] = [];

      if (selectedCert) {
        if (selectedSkill) {
          const skillObj = SKILLS_MAP[selectedCert].find(s => s.value === selectedSkill);
          if (selectedPart) {
            if (selectedCert === 'TOEIC' && selectedSkill === 'WRITING') {
              typesToFetch = [selectedPart];
            } else if (selectedCert === 'NLTV') {
              typesToFetch = [selectedPart];
            } else {
              typesToFetch = [`${selectedCert}_${selectedPart}`];
            }
          } else {
            if (selectedCert === 'IELTS') {
              typesToFetch = [`IELTS_${selectedSkill}`, ...skillObj.parts.map((p: any) => `IELTS_${p.id}`)];
            } else if (selectedCert === 'TOEIC') {
              if (selectedSkill === 'WRITING') {
                typesToFetch = ['TOEIC_WRITING', 'TW_P1', 'TW_P2'];
              } else {
                typesToFetch = [`TOEIC_${selectedSkill}`, ...skillObj.parts.map((p: any) => `TOEIC_${p.id}`)];
              }
            } else if (selectedCert === 'NLTV') {
              typesToFetch = [`NLTV_${selectedSkill}`, ...skillObj.parts.map((p: any) => p.id)];
            }
          }
        } else {
          if (selectedCert === 'IELTS') {
            typesToFetch = ['IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS_LISTENING', 'IELTS_READING', 'IELTS_WRITING', 'IELTS_L1', 'IELTS_L2', 'IELTS_L3', 'IELTS_L4', 'IELTS_R1', 'IELTS_W1', 'IELTS_W2'];
          } else if (selectedCert === 'TOEIC') {
            typesToFetch = ['TOEIC_LR', 'TOEIC_SPEAKING', 'TOEIC_WRITING', 'TOEIC_LISTENING', 'TOEIC_READING', 'TOEIC_P1', 'TOEIC_P2', 'TOEIC_P3', 'TOEIC_P4', 'TOEIC_P5', 'TOEIC_P6', 'TOEIC_P7', 'TW_P1', 'TW_P2'];
          } else if (selectedCert === 'NLTV') {
            typesToFetch = ['NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_LISTENING', 'NLTV_READING', 'NLTV_WRITING', 'NLTV_L', 'NLTV_R', 'NLTV_W'];
          }
        }
      }

      if (typesToFetch.length > 0) {
        params.types = typesToFetch.join(',');
      }

      const res = await axiosClient.get<any, any>('/v1/student/exams', { params });
      if (res.success && res.data) {
        setExams(res.data.items || []);
        setTotalPages(res.data.totalPages || 0);
        setTotalElements(res.data.totalElements || 0);
      }
    } catch (err) {
      console.error('Failed to fetch library exams', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams(0);
  }, [selectedCert, selectedSkill, selectedPart, sortParam]);

  const handleApplyFilter = () => {
    setPage(0);
    fetchExams(0);
  };

  const handleCertChange = (cert: string) => {
    setSelectedCert(cert);
    setSelectedSkill('');
    setSelectedPart('');
  };

  const handleSkillChange = (skill: string) => {
    setSelectedSkill(skill);
    setSelectedPart('');
  };


  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '3rem' }}>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #ea580c 100%)',
        padding: '3rem 0',
        color: 'white',
        marginBottom: '2rem'
      }}>
        <div className="container">
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>{t('library.hero.title', 'Thư viện Đề thi')}</h1>
          <p style={{ fontSize: '1.125rem', opacity: 0.9, maxWidth: '600px' }}>{t('library.hero.subtitle', 'Hàng ngàn đề thi chuẩn hóa IELTS, TOEIC và Năng Lực Tiếng Việt (NLTV). Luyện tập ngay hôm nay để đạt mục tiêu của bạn.')}</p>
        </div>
      </div>

      <div className="container" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        {/* Left Sidebar Filter */}
        <aside style={{ width: '280px', flexShrink: 0, position: 'sticky', top: '2rem' }}>
          <div className="ed-card" style={{ padding: '1.5rem', borderTop: '4px solid var(--primary)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Filter size={20} color="var(--primary)" /> {t('library.filters.title', 'Lọc Đề Thi')}
            </h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>{t('library.filters.search', 'TÌM KIẾM')}</label>
              <div style={{ position: 'relative' }}>
                <input type="text" className="input-field" placeholder={t('library.filters.searchPlaceholder', 'Nhập tên đề thi...')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleApplyFilter()} style={{ paddingLeft: '1rem', paddingRight: '3rem', borderRadius: 'var(--radius-full)' }} />
                <button 
                  onClick={handleApplyFilter}
                  style={{ position: 'absolute', top: '50%', right: '6px', transform: 'translateY(-50%)', background: 'var(--primary)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <Search size={16} color="white" />
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                {t('library.filters.cert_title', '1. CHỌN CHỨNG CHỈ')}
              </label>
              <select className="input-field" value={selectedCert} onChange={(e) => handleCertChange(e.target.value)} style={{ borderRadius: 'var(--radius-md)', width: '100%', padding: '0.75rem' }}>
                 <option value="">{t('library.filters.all', 'Tất cả chứng chỉ')}</option>
                 {CERTIFICATES.map(c => (
                   <option key={c.value} value={c.value}>{t(c.labelKey, c.labelDefault)}</option>
                 ))}
              </select>
            </div>

            {selectedCert && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                  {t('library.filters.skill_title', '2. CHỌN KỸ NĂNG')}
                </label>
                <select className="input-field" value={selectedSkill} onChange={(e) => handleSkillChange(e.target.value)} style={{ borderRadius: 'var(--radius-md)', width: '100%', padding: '0.75rem' }}>
                   <option value="">{t('library.filters.all_skills', 'Tất cả kỹ năng (Full Test & Parts)')}</option>
                   {SKILLS_MAP[selectedCert].map(s => (
                     <option key={s.value} value={s.value}>{t(s.labelKey, s.labelDefault)}</option>
                   ))}
                </select>
              </div>
            )}

            {selectedCert && selectedSkill && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                  {t('library.filters.part_title', '3. CHỌN PHẦN THI (PART)')}
                </label>
                <select className="input-field" value={selectedPart} onChange={(e) => setSelectedPart(e.target.value)} style={{ borderRadius: 'var(--radius-md)', width: '100%', padding: '0.75rem' }}>
                   <option value="">{t('library.filters.all_parts', 'Tất cả phần thi')}</option>
                   {SKILLS_MAP[selectedCert].find(s => s.value === selectedSkill)?.parts.map((p: any) => (
                     <option key={p.id} value={p.id}>{p.label}</option>
                   ))}
                </select>
              </div>
            )}

            <button className="btn btn-outline" onClick={() => {
              setSearchTerm('');
              setSelectedCert('');
              setSelectedSkill('');
              setSelectedPart('');
              setPage(0);
            }} style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', borderRadius: 'var(--radius-full)', color: 'var(--text-secondary)', borderColor: 'var(--border-light)' }}>
              {t('library.filters.clear', 'Xoá bộ lọc')}
            </button>
          </div>
        </aside>

        {/* Right Main Grid */}
        <main style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {t('library.results.showing', 'Hiển thị')} <strong>{totalElements}</strong> {t('library.results.results', 'kết quả')}
            </div>
            <select className="input-field" value={sortParam} onChange={e => setSortParam(e.target.value)} style={{ width: 'auto', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}>
              <option value="createdAt">{t('library.sort.newest', 'Mới nhất')}</option>
              <option value="popular">{t('library.sort.popular', 'Được thi nhiều nhất')}</option>
            </select>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>{t('library.status.loading', 'Đang tải đề thi...')}</div>
          ) : exams.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>{t('library.status.empty', 'Không tìm thấy đề thi nào phù hợp.')}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {exams.map((exam) => {
                const isIelts = exam.type.startsWith('IELTS');
                const isToeic = exam.type.startsWith('TOEIC');
                const displayType = isIelts ? 'IELTS' : isToeic ? 'TOEIC' : 'NLTV';
                
                return (
                  <div
                    key={exam.id}
                className="ed-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: hoveredId === exam.id ? 'translateY(-8px)' : 'none',
                  boxShadow: hoveredId === exam.id ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  border: '1px solid var(--border-light)'
                }}
                onMouseEnter={() => setHoveredId(exam.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => navigate(`/student/exam/${exam.id}`)}
              >
                {/* Card Thumbnail */}
                <div style={{
                  height: '160px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: exam.thumbnailUrl ? `url(${exam.thumbnailUrl}) center/cover no-repeat` : (exam.type.startsWith('IELTS') ? 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)' : exam.type.startsWith('TOEIC') ? 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)')
                }}>
                  {!exam.thumbnailUrl && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Cg/%3E%3C/svg%3E")' }}></div>}
                  {!exam.thumbnailUrl && <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', letterSpacing: '2px', zIndex: 1, textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{displayType}</h2>}
                  <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1 }}>
                    <span style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', color: 'white', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.3)' }}>{exam.level}</span>
                  </div>

                  {/* Play Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: hoveredId === exam.id ? 1 : 0,
                    transition: 'opacity 0.2s',
                    zIndex: 2
                  }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                      <Play size={24} fill="white" style={{ marginLeft: '4px' }} />
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>{exam.title}</h3>

                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                    {exam.tags.map(tag => (
                      <span key={tag} style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: '4px' }}>{tag}</span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                    <div className="flex-center" style={{ gap: '0.35rem', fontWeight: 500 }}><Clock size={15} color="var(--text-muted)" /> {exam.durationMinutes} {t('library.card.minutes', 'phút')}</div>
                    <div className="flex-center" style={{ gap: '0.35rem', fontWeight: 500 }}><BookOpen size={15} color="var(--text-muted)" /> {exam.joins || 0} {t('library.card.attempts', 'lượt thi')}</div>
                  </div>
                </div>
              </div>
            );
          })}
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                  <button 
                    disabled={page === 0}
                    onClick={() => { setPage(p => p - 1); fetchExams(page - 1); }}
                    className="btn btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}>
                    {t('library.pagination.prev', 'Trang trước')}
                  </button>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {t('library.pagination.page', 'Trang')} {page + 1} / {totalPages}
                  </span>
                  <button 
                    disabled={page >= totalPages - 1}
                    onClick={() => { setPage(p => p + 1); fetchExams(page + 1); }}
                    className="btn btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}>
                    {t('library.pagination.next', 'Trang sau')}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ExamLibrary;
