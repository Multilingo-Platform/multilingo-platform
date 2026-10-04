import { useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';
import ExamStartPage from './features/exam/pages/ExamStartPage';
import WorkspacePage from './features/exam/pages/WorkspacePage';
import ExamResultPage from './features/exam/pages/ExamResultPage';

// --- MEMBER 2 PAGES & LAYOUTS ---
import UserLayout from './layouts/UserLayout';
import AdminLayout from './layouts/AdminLayout';
import OnboardingPage from './pages/student/OnboardingPage';
import ExamLibrary from './pages/student/ExamLibrary';
import TestHistory from './pages/student/TestHistory';
import ExamManagement from './pages/admin/ExamManagement';
import ExamBuilderPage from './pages/admin/ExamBuilderPage';

function HomePage() {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'IELTS' | 'TOEIC' | 'VSTEP'>('ALL');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', color: '#111827', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky Top Header */}
      <header style={{
        borderBottom: '1px solid #e5e7eb',
        padding: '0.875rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #d97706, #b45309)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '1.25rem', boxShadow: '0 2px 6px rgba(217,119,6,0.3)',
          }}>
            🎓
          </div>
          <div>
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: '1.25rem',
              color: '#111827',
              letterSpacing: '-0.02em',
            }}>
              Multilingo
            </span>
            <span style={{
              marginLeft: '0.5rem',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#d97706',
              backgroundColor: '#fffbeb',
              padding: '2px 8px',
              borderRadius: '9999px',
              border: '1px solid #fde68a',
            }}>
              CBT Platform
            </span>
          </div>
        </div>

        {/* Student Utilities & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Notification Bell */}
          <div style={{
            position: 'relative',
            cursor: 'pointer',
            padding: '0.45rem',
            borderRadius: '50%',
            backgroundColor: '#f3f4f6',
            color: '#4b5563',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            🔔
            <span style={{
              position: 'absolute', top: '1px', right: '1px',
              width: '7px', height: '7px', borderRadius: '50%',
              backgroundColor: '#ef4444',
            }} />
          </div>

          {/* Streak Badge */}
          <div className="badge-orange" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
            🔥 5 ngày Streak
          </div>

          {/* User Profile */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.25rem 0.625rem 0.25rem 0.35rem',
            borderRadius: '9999px', background: '#f3f4f6', border: '1px solid #e5e7eb',
          }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%',
              backgroundColor: '#ca8a04', color: '#fff',
              fontSize: '0.75rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              MA
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
              Nguyễn Minh Anh
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1120px', margin: '0 auto', padding: '3rem 1.5rem', flex: 1, width: '100%' }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.35rem 0.875rem', borderRadius: '9999px',
            backgroundColor: '#fffbeb', border: '1px solid #fde68a',
            color: '#b45309', fontSize: '0.8rem', fontWeight: 700,
            marginBottom: '1.25rem', letterSpacing: '0.02em',
          }}>
            ⚡ NỀN TẢNG THI THỬ CBT CHUẨN QUỐC TẾ &amp; AI TUTOR
          </div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 'clamp(2.25rem, 5vw, 3.25rem)',
            lineHeight: 1.2,
            marginBottom: '1.25rem',
            color: '#111827',
            letterSpacing: '-0.02em',
          }}>
            Luyện thi chứng chỉ quốc tế<br />
            <span style={{
              background: 'linear-gradient(135deg, #d97706, #ca8a04)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              thông minh &amp; hiệu quả
            </span>
          </h1>
          <p style={{ color: '#4b5563', fontSize: '1.125rem', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
            Hệ thống thi thử IELTS, TOEIC với phòng thi CBT chia đôi màn hình chuẩn thi thật, tự động lưu bài (Autosave), tra cứu từ vựng thông minh và chấm điểm AI chi tiết.
          </p>

          {/* Metric Stats */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.5rem', color: '#d97706' }}>45,000+</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Lượt thi thử hoàn thành</div>
            </div>
            <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.5rem', color: '#10b981' }}>98.4%</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Đạt mục tiêu kỳ thi</div>
            </div>
            <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.5rem', color: '#b45309' }}>0.2s</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Phản hồi tra từ AI</div>
            </div>
          </div>
        </div>

        {/* Dual Primary CTAs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '3.5rem' }}>
          {/* Card 1: Mock Test */}
          <Link to="/exams/1/start?mode=MOCK_TEST&scope=FULL_EXAM" style={{
            display: 'flex', flexDirection: 'column', gap: '1rem',
            padding: '2rem',
            borderRadius: '1.25rem',
            background: 'linear-gradient(135deg, #d97706, #b45309)',
            textDecoration: 'none',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(217,119,6,0.25)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-3px)';
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 12px 28px rgba(217,119,6,0.35)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 24px rgba(217,119,6,0.25)';
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '2.5rem' }}>⏱️</div>
              <span style={{
                background: 'rgba(255,255,255,0.2)', padding: '4px 10px',
                borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
              }}>
                Bấm giờ chuẩn 60 phút
              </span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.375rem' }}>
                Thi thử Mock Test (IELTS)
              </div>
              <div style={{ color: '#fef3c7', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Mô phỏng 100% phòng thi CBT, đồng hồ đếm ngược nghiêm ngặt, tự động nộp bài khi hết giờ và xuất báo cáo điểm số.
              </div>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.95rem' }}>
              Bắt đầu làm bài thi →
            </div>
          </Link>

          {/* Card 2: Practice Mode */}
          <Link to="/exams/1/start?mode=PRACTICE&scope=FULL_EXAM" style={{
            display: 'flex', flexDirection: 'column', gap: '1rem',
            padding: '2rem',
            borderRadius: '1.25rem',
            background: 'linear-gradient(135deg, #059669, #047857)',
            textDecoration: 'none',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(5,150,105,0.25)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-3px)';
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 12px 28px rgba(5,150,105,0.35)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 24px rgba(5,150,105,0.25)';
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '2.5rem' }}>📖</div>
              <span style={{
                background: 'rgba(255,255,255,0.2)', padding: '4px 10px',
                borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
              }}>
                Tự do tra từ &amp; xem giải thích
              </span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.375rem' }}>
                Luyện tập Practice Mode
              </div>
              <div style={{ color: '#d1fae5', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Không giới hạn thời gian làm bài, dừng và tiếp tục linh hoạt, hỗ trợ tra từ điển ngữ cảnh AI ngay trong bài đọc.
              </div>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.95rem' }}>
              Bắt đầu luyện tập →
            </div>
          </Link>
        </div>

        {/* 3 Value Proposition Cards */}
        <div style={{ marginBottom: '4rem' }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.35rem',
            color: '#111827', textAlign: 'center', marginBottom: '1.75rem',
          }}>
            Trải nghiệm thi thử vượt trội tại Multilingo
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            <div className="ed-card" style={{ padding: '1.75rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🖥️</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', color: '#111827', marginBottom: '0.5rem' }}>
                Phòng thi CBT chuẩn quốc tế
              </h3>
              <p style={{ color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Giao diện chia đôi màn hình Split-pane mô phỏng chuẩn phòng thi IDP/BC. Bảng Question Palette chuyển câu tức thì.
              </p>
              <div style={{ marginTop: '1rem', color: '#d97706', fontSize: '0.75rem', fontWeight: 700 }}>
                ⚡ Tự động lưu bài (Autosave)
              </div>
            </div>

            <div className="ed-card" style={{ padding: '1.75rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎯</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', color: '#111827', marginBottom: '0.5rem' }}>
                Chẩn đoán năng lực &amp; Chấm điểm AI
              </h3>
              <p style={{ color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Báo cáo phân tích 4 trục kỹ năng, tự động phát hiện bẫy lỗi sai (distractors) và đề xuất lộ trình ôn tập bám sát thực tế.
              </p>
              <div style={{ marginTop: '1rem', color: '#10b981', fontSize: '0.75rem', fontWeight: 700 }}>
                📊 Radar Matrix + Dẫn chứng bài đọc
              </div>
            </div>

            <div className="ed-card" style={{ padding: '1.75rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', color: '#111827', marginBottom: '0.5rem' }}>
                Sổ tay Từ vựng &amp; Flashcard SRS
              </h3>
              <p style={{ color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Bôi đen từ khó trong bài đọc để tra cứu phát âm IPA, ngữ nghĩa tiếng Việt và tự động lưu vào Flashcard ôn tập ngắt quãng 3D.
              </p>
              <div style={{ marginTop: '1rem', color: '#ca8a04', fontSize: '0.75rem', fontWeight: 700 }}>
                🧠 Spaced Repetition System
              </div>
            </div>
          </div>
        </div>

        {/* Exam Library Section */}
        <div style={{ marginBottom: '3.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.35rem', color: '#111827', marginBottom: '0.25rem' }}>
                📚 Thư viện đề thi tuyển chọn
              </h2>
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Ngân hàng đề thi chuẩn hóa Cambridge, ETS và Khung 6 bậc VSTEP
              </p>
            </div>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', background: '#f3f4f6', padding: '4px', borderRadius: '10px' }}>
              {(['ALL', 'IELTS', 'TOEIC', 'VSTEP'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedFilter(tab)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedFilter === tab ? '#ffffff' : 'transparent',
                    color: selectedFilter === tab ? '#d97706' : '#6b7280',
                    boxShadow: selectedFilter === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab === 'ALL' ? 'Tất cả' : tab}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            <div className="ed-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span className="badge-orange">IELTS 60 Phút</span>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Mới nhất</span>
              </div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: '#111827', marginBottom: '0.5rem' }}>
                IELTS Academic Reading - Cam 19 Test 01
              </h4>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1.25rem', flex: 1 }}>
                40 câu hỏi • 3 Passages • 12,450 thí sinh đã thi
              </p>
              <Link to="/exams/1/start?mode=MOCK_TEST&scope=FULL_EXAM" className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center', width: '100%' }}>
                Vào thi ngay →
              </Link>
            </div>

            <div className="ed-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span className="badge-orange">IELTS Practice</span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>General</span>
              </div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: '#111827', marginBottom: '0.5rem' }}>
                IELTS General Reading - Practice 02
              </h4>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1.25rem', flex: 1 }}>
                40 câu hỏi • 3 Sections • 8,120 thí sinh đã thi
              </p>
              <Link to="/exams/2/start?mode=PRACTICE&scope=FULL_EXAM" className="btn-outline" style={{ textDecoration: 'none', textAlign: 'center', width: '100%' }}>
                Luyện tập ngay →
              </Link>
            </div>

            <div className="ed-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '9999px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                  TOEIC 75 Phút
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>ETS Format</span>
              </div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: '#111827', marginBottom: '0.5rem' }}>
                TOEIC Reading Full Test 05
              </h4>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1.25rem', flex: 1 }}>
                100 câu hỏi • Part 5, 6, 7 • 19,300 thí sinh
              </p>
              <Link to="/exams/1/start?mode=PRACTICE&scope=SINGLE_SKILL" className="btn-outline" style={{ textDecoration: 'none', textAlign: 'center', width: '100%' }}>
                Luyện tập ngay →
              </Link>
            </div>

            <div className="ed-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ backgroundColor: '#fdf4ff', color: '#a855f7', border: '1px solid #f5d0fe', borderRadius: '9999px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                  VSTEP 60 Phút
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>B1 - C1</span>
              </div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: '#111827', marginBottom: '0.5rem' }}>
                VSTEP B2 Đọc hiểu - Đề số 03
              </h4>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1.25rem', flex: 1 }}>
                40 câu hỏi • 4 Passages • 5,600 thí sinh
              </p>
              <Link to="/exams/1/start?mode=PRACTICE&scope=FULL_EXAM" className="btn-outline" style={{ textDecoration: 'none', textAlign: 'center', width: '100%' }}>
                Luyện tập ngay →
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Student Activities */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          border: '1px solid #e5e7eb',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.05rem', color: '#111827', margin: 0 }}>
                📊 Hoạt động &amp; Lịch sử luyện thi gần đây
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '4px 0 0 0' }}>
                Theo dõi tiến độ làm bài và các báo cáo phân tích năng lực của bạn
              </p>
            </div>
            <Link to="/attempts/94/result" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d97706', textDecoration: 'none' }}>
              Xem tất cả kết quả →
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Card 1: Completed Test */}
            <Link
              to="/attempts/94/result"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderRadius: '0.75rem',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#ecfdf5';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = '#a7f3d0';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#f9fafb';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = '#e5e7eb';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  backgroundColor: '#ecfdf5', color: '#059669',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.15rem', fontWeight: 800,
                }}>
                  6.5
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                    IELTS Academic Reading - Cam 19
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                    Hoàn thành 04/10 • 32/40 câu đúng (80%)
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700,
                padding: '3px 8px', borderRadius: '9999px',
                backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0',
              }}>
                HOÀN THÀNH
              </span>
            </Link>

            {/* Card 2: In-Progress Practice */}
            <Link
              to="/attempts/18"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderRadius: '0.75rem',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#fffbeb';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = '#fde68a';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#f9fafb';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = '#e5e7eb';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  backgroundColor: '#fffbeb', color: '#d97706',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem',
                }}>
                  📖
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                    IELTS General Reading - Practice 02
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                    Chế độ luyện tập • Tự do tra từ AI
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700,
                padding: '3px 8px', borderRadius: '9999px',
                backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a',
              }}>
                ĐANG LUYỆN TẬP
              </span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        padding: '1.5rem',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.8rem',
      }}>
        © 2026 Multilingo Platform • Hệ thống khảo thí trực tuyến &amp; Chấm điểm AI
      </footer>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* --- DEV / PORTAL ROUTES --- */}
      <Route path="/portal" element={<HomePage />} />
      <Route path="/dev" element={<HomePage />} />

      {/* --- CHÍNH THỨC: MEMBER 2 ROUTES --- */}
      <Route path="/" element={<Navigate to="/onboarding" replace />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* Màn hình Student */}
      <Route path="/student" element={<UserLayout />}>
        <Route path="library" element={<ExamLibrary />} />
        <Route path="history" element={<TestHistory />} />
        <Route path="dashboard" element={<div className="container"><h1 style={{fontSize: '2rem', marginTop: '2rem'}}>Tính năng của Thành viên 5 (Dashboard)</h1></div>} />
        <Route path="flashcards" element={<div className="container"><h1 style={{fontSize: '2rem', marginTop: '2rem'}}>Tính năng của Thành viên 5 (Flashcards)</h1></div>} />
        <Route path="settings" element={<div className="container"><h1 style={{fontSize: '2rem', marginTop: '2rem'}}>Tính năng của Thành viên 1 (Settings)</h1></div>} />
      </Route>

      {/* Màn hình Admin */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="" element={<Navigate to="/admin/exams" replace />} />
        <Route path="exams" element={<ExamManagement />} />
        <Route path="exams/create" element={<ExamBuilderPage />} />
        <Route path="dashboard" element={<div className="container"><h1 style={{fontSize: '2rem', marginTop: '2rem'}}>Tính năng Admin Dashboard</h1></div>} />
        <Route path="users" element={<div className="container"><h1 style={{fontSize: '2rem', marginTop: '2rem'}}>Tính năng Quản lý Người dùng</h1></div>} />
      </Route>

      {/* --- CBT EXAM ROUTES --- */}
      <Route path="/exams/:examId/start" element={<ExamStartPage />} />
      <Route path="/student/exam/:examId" element={<ExamStartPage />} />
      <Route path="/attempts/:attemptId" element={<WorkspacePage />} />
      <Route path="/attempts/:attemptId/result" element={<ExamResultPage />} />
    </Routes>
  );
}

export default App;
