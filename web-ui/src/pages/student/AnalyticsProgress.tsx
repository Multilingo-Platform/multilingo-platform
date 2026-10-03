import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, 
  TrendingUp, 
  Flame, 
  Clock, 
  Award, 
  Target, 
  ArrowRight, 
  Sparkles, 
  AlertTriangle,
  Calendar,
  BookOpen,
  ChevronRight
} from 'lucide-react';

const AnalyticsProgress = () => {
  const navigate = useNavigate();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30d' | '90d' | 'all'>('30d');

  // 6 Skills for Radar Chart
  const radarSkills = [
    { label: 'Reading Skimming', value: 85, angle: 0 },
    { label: 'Detail Listening', value: 75, angle: 60 },
    { label: 'Vocab Lexicon', value: 60, angle: 120 },
    { label: 'Grammar Accuracy', value: 82, angle: 180 },
    { label: 'Writing Cohesion', value: 70, angle: 240 },
    { label: 'Reading Scanning', value: 90, angle: 300 },
  ];

  // SVG Radar Calculations (Center: 160, 160; Max Radius: 105)
  const centerX = 160;
  const centerY = 160;
  const maxRadius = 105;

  const getCoordinates = (value: number, angleDegrees: number) => {
    const angleRad = (angleDegrees - 90) * (Math.PI / 180);
    const r = (value / 100) * maxRadius;
    const x = centerX + r * Math.cos(angleRad);
    const y = centerY + r * Math.sin(angleRad);
    return { x, y };
  };

  const polygonPoints = radarSkills
    .map(s => {
      const { x, y } = getCoordinates(s.value, s.angle);
      return `${x},${y}`;
    })
    .join(' ');

  // Activity Heatmap Simulated Data (12 weeks x 7 days)
  const heatmapData = Array.from({ length: 84 }).map((_, i) => {
    const rand = Math.sin(i * 0.5) * 10;
    if (rand > 6) return 3; // > 60 mins
    if (rand > 2) return 2; // 30-60 mins
    if (rand > -2) return 1; // 10-30 mins
    return 0; // 0 mins
  });

  const getHeatmapColor = (level: number) => {
    switch (level) {
      case 3: return '#15803d'; // Dark Green
      case 2: return '#22c55e'; // Med Green
      case 1: return '#86efac'; // Light Green
      default: return '#e2e8f0'; // Gray
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.25rem 1rem 4rem' }}>
      
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#64748b', marginBottom: '1rem' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/dashboard')}>Trang chủ</span>
        <ChevronRight size={14} />
        <span style={{ color: '#0f172a', fontWeight: 600 }}>Báo cáo năng lực & Radar phân tích</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 7px', fontSize: '0.75rem', fontWeight: 600 }}>
              BÁO CÁO NĂNG LỰC
            </span>
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111827', margin: 0 }}>
            Báo Cáo Năng Lực & Đề Xuất Lộ Trình Học Tập
          </h1>
          <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: '3px 0 0' }}>
            Phân tích biểu đồ Radar 6 trục năng lực và đề xuất bài luyện trọng tâm theo kết quả thi gần nhất.
          </p>
        </div>

        {/* Timeframe Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#ffffff', padding: 3, borderRadius: 5, border: '1px solid #cbd5e1' }}>
          {(['30d', '90d', 'all'] as const).map(tf => {
            const isActive = selectedTimeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                style={{
                  background: isActive ? '#f59e0b' : 'transparent',
                  color: isActive ? '#111827' : '#475569',
                  border: 'none',
                  borderRadius: 4,
                  padding: '5px 12px',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tf === '30d' ? '30 Ngày qua' : tf === '90d' ? '3 Tháng qua' : 'Toàn thời gian'}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1rem 1.15rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d97706', marginBottom: 4 }}>
            <Award size={18} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Band Score Dự Kiến</span>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#111827' }}>
            6.5 <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>+0.5</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Mục tiêu Target: Band 7.5</span>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde047', borderRadius: 6, padding: '1rem 1.15rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', marginBottom: 4 }}>
            <Flame size={18} fill="currentColor" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Chuỗi Ngày Chăm Chỉ</span>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#b45309' }}>
            5 <span style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 500 }}>ngày liên tục</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#78350f' }}>Kỷ lục cá nhân: 14 ngày</span>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1rem 1.15rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb', marginBottom: 4 }}>
            <Clock size={18} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Thời Lượng Ôn Luyện</span>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#111827' }}>
            24.5 <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>giờ</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Trung bình 45 phút / ngày</span>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1rem 1.15rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', marginBottom: 4 }}>
            <Target size={18} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Đề Thi Hoàn Thành</span>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#111827' }}>
            18 <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>bộ đề</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Tỷ lệ đúng TB: 76%</span>
        </div>
      </div>

      {/* Main Analysis: Radar Chart & Weak Point Action Plan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        
        {/* Radar Chart Card */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <BarChart2 size={18} color="#d97706" /> Biểu Đồ Radar Năng Lực 6 Trục
            </h3>
            <span style={{ fontSize: '0.75rem', padding: '2px 7px', borderRadius: 4, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 600 }}>
              Chuẩn IELTS & CEFR
            </span>
          </div>

          {/* SVG Radar */}
          <div style={{ position: 'relative', width: 320, height: 320 }}>
            <svg width="320" height="320" viewBox="0 0 320 320">
              {/* Background Concentric Grid Circles */}
              {[25, 50, 75, 100].map((level) => {
                const r = (level / 100) * maxRadius;
                return (
                  <circle
                    key={level}
                    cx={centerX}
                    cy={centerY}
                    r={r}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray={level === 100 ? 'none' : '4 4'}
                  />
                );
              })}

              {/* Axis lines */}
              {radarSkills.map((s, i) => {
                const { x, y } = getCoordinates(100, s.angle);
                return (
                  <line
                    key={i}
                    x1={centerX}
                    y1={centerY}
                    x2={x}
                    y2={y}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Data Polygon Fill */}
              <polygon
                points={polygonPoints}
                fill="rgba(245, 158, 11, 0.22)"
                stroke="#d97706"
                strokeWidth="2.5"
              />

              {/* Data Points */}
              {radarSkills.map((s, i) => {
                const { x, y } = getCoordinates(s.value, s.angle);
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                );
              })}

              {/* Skill Labels */}
              {radarSkills.map((s, i) => {
                const { x, y } = getCoordinates(125, s.angle);
                return (
                  <text
                    key={i}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="11"
                    fontWeight="600"
                    fill="#334155"
                  >
                    {s.label} ({s.value}%)
                  </text>
                );
              })}
            </svg>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: '#f59e0b' }} />
              <span>Năng lực thực tế của bạn</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, border: '1px dashed #94a3af' }} />
              <span>Khung chuẩn Band 7.5</span>
            </div>
          </div>
        </div>

        {/* AI Actionable Recommendations / Vùng Trũng Năng Lực */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1.5rem', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
            <div style={{ width: 34, height: 34, borderRadius: 5, background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                Phát Hiện Vùng Trũng Năng Lực
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#b91c1c', fontWeight: 600 }}>
                2 kỹ năng cần tập trung khắc phục ngay
              </span>
            </div>
          </div>

          {/* AI Observation Note */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde047', borderRadius: 5, padding: '1rem', marginBottom: '1.15rem', fontSize: '0.86rem', color: '#78350f', lineHeight: 1.6 }}>
            <strong>Phân tích AI Gemini:</strong> Điểm số của bạn bị kéo tụt nhiều nhất ở phần <strong>Từ vựng chuyên sâu (60%)</strong> và dạng bài <strong>True/False/Not Given trong Reading (57%)</strong>. Bạn có xu hướng suy diễn thông tin vượt ra ngoài đoạn văn gốc.
          </div>

          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.65rem', color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={15} color="#d97706" /> Lộ Trình Đề Xuất Khắc Phục (3 Bài Luyện)
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { title: 'Chuyên đề: Bẫy Từ Hạn Định trong True/False/Not Given', duration: '15 phút', count: '10 câu', tag: 'Reading' },
                { title: 'Bộ Thẻ 50 Collocations Học Thuật Band 7.5+ Chủ Đề Môi Trường', duration: '10 phút', count: '50 thẻ', tag: 'Vocab' },
                { title: 'Luyện Viết Thân Bài Task 2: Kỹ Thuật Triển Khai Ví Dụ Thuyết Phục', duration: '25 phút', count: '1 bài luận', tag: 'Writing' },
              ].map((task, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '0.75rem 0.95rem', 
                    background: '#f8fafc', 
                    borderRadius: 5,
                    border: '1px solid #e2e8f0',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{task.title}</div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⏱️ {task.duration}</span> • <span>📝 {task.count}</span> • 
                      <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 3, padding: '1px 5px', fontSize: '0.68rem', fontWeight: 600 }}>{task.tag}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/student/library')}
                    style={{ 
                      padding: '0.4rem 0.85rem', 
                      fontSize: '0.8rem', 
                      borderRadius: 5,
                      background: '#f59e0b',
                      color: '#111827',
                      border: '1px solid #d97706',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Luyện Ngay
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Learning Activity Heatmap (GitHub Style) */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1.25rem 1.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Calendar size={17} color="#d97706" /> Lịch Sử Hoạt Động Học Tập (Study Heatmap)
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Ghi nhận các phiên làm bài thi thử và thời lượng học từ vựng SRS theo ngày
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#64748b' }}>
            <span>Ít hơn</span>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#e2e8f0' }} />
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#86efac' }} />
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e' }} />
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#15803d' }} />
            <span>Nhiều hơn</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gridTemplateRows: 'repeat(7, 1fr)', gap: 5, width: 'max-content' }}>
            {heatmapData.map((level, i) => (
              <div
                key={i}
                title={`Ngày hoạt động: ${level * 25} phút học`}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  background: getHeatmapColor(level),
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default AnalyticsProgress;
