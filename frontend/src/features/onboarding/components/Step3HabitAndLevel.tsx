import React from 'react';
import { Sprout, BookOpen, Rocket, Flame, Clock, Zap, TrendingUp, Trophy } from 'lucide-react';
import type { LearnerLevel } from '../types';

interface Step3HabitAndLevelProps {
  currentLevel: LearnerLevel;
  dailyMinutes: number;
  onLevelChange: (level: LearnerLevel) => void;
  onMinutesChange: (minutes: number) => void;
}

interface LevelOption {
  id: LearnerLevel;
  title: string;
  sub: string;
  badge?: string;
  desc: string;
  icon: React.ReactNode;
}

const LEVELS: LevelOption[] = [
  {
    id: 'BEGINNER',
    title: 'Mới bắt đầu',
    sub: 'A1 - A2',
    desc: 'Mất gốc hoặc mới tiếp cận, cần xây dựng lại phát âm và từ vựng căn bản.',
    icon: <Sprout size={22} />,
  },
  {
    id: 'ELEMENTARY',
    title: 'Sơ cấp',
    sub: 'B1',
    desc: 'Nắm ngữ pháp cơ bản, hiểu câu đơn nhưng phản xạ và vốn từ còn hạn chế.',
    icon: <BookOpen size={22} />,
  },
  {
    id: 'INTERMEDIATE',
    title: 'Trung cấp',
    sub: 'B2',
    badge: 'Phổ biến',
    desc: 'Hiểu các bài đọc/nghe quen thuộc, sẵn sàng luyện đề bứt phá điểm số.',
    icon: <Rocket size={22} />,
  },
  {
    id: 'ADVANCED',
    title: 'Nâng cao',
    sub: 'C1 - C2',
    desc: 'Thành thạo tự nhiên, hướng tới điểm số xuất sắc và phản xạ học thuật chuyên sâu.',
    icon: <Flame size={22} />,
  },
];

interface HabitOption {
  minutes: number;
  label: string;
  desc: string;
  badge?: string;
  icon: React.ReactNode;
}

const HABITS: HabitOption[] = [
  {
    minutes: 15,
    label: '15 phút / ngày',
    desc: 'Nhẹ nhàng, duy trì chuỗi streak học tập bền bỉ.',
    icon: <Clock size={20} />,
  },
  {
    minutes: 30,
    label: '30 phút / ngày',
    badge: 'Hiệu quả nhất',
    desc: 'Tiến độ tối ưu, cân bằng hoàn hảo giữa học tập và công việc.',
    icon: <Zap size={20} />,
  },
  {
    minutes: 45,
    label: '45 phút / ngày',
    desc: 'Tập trung cao độ, chuẩn bị sẵn sàng cho kỳ thi sắp tới.',
    icon: <TrendingUp size={20} />,
  },
  {
    minutes: 60,
    label: '60 phút / ngày',
    desc: 'Bứt phá thần tốc, cam kết mục tiêu lớn trong thời gian ngắn nhất.',
    icon: <Trophy size={20} />,
  },
];

export const Step3HabitAndLevel: React.FC<Step3HabitAndLevelProps> = ({
  currentLevel,
  dailyMinutes,
  onLevelChange,
  onMinutesChange,
}) => {
  return (
    <div className="onboarding-step-content">
      <h2 className="onboarding-title">Trình độ & Thói quen học tập</h2>
      <p className="onboarding-subtitle">
        Hãy cho Multilingo biết xuất phát điểm và thời gian biểu của bạn để chúng tôi xây dựng nhịp độ học tập phù hợp nhất.
      </p>

      {/* 1. Trình độ hiện tại */}
      <div style={{ marginBottom: '2.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.85rem', fontWeight: 700, fontSize: '1rem', color: '#334155' }}>
          1. Trình độ tiếng hiện tại của bạn
        </label>
        <div className="onboarding-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {LEVELS.map((lvl) => {
            const isActive = currentLevel === lvl.id;
            return (
              <div
                key={lvl.id}
                className={`onboarding-option-card ${isActive ? 'active' : ''}`}
                onClick={() => onLevelChange(lvl.id)}
                style={{ textAlign: 'left', alignItems: 'flex-start', padding: '1.25rem' }}
              >
                {lvl.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(79, 70, 229, 0.1)',
                      color: '#4f46e5',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    {lvl.badge}
                  </span>
                )}
                <div className="onboarding-card-icon">{lvl.icon}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '0.25rem' }}>
                  <span className="onboarding-card-title">{lvl.title}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366f1' }}>({lvl.sub})</span>
                </div>
                <span className="onboarding-card-desc">{lvl.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Cam kết thời gian mỗi ngày */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.85rem' }}>
          <label style={{ fontWeight: 700, fontSize: '1rem', color: '#334155' }}>
            2. Bạn có thể dành bao nhiêu thời gian mỗi ngày?
          </label>
          <span style={{ color: '#4f46e5', fontWeight: 700, fontSize: '0.95rem' }}>
            {dailyMinutes} phút mỗi ngày
          </span>
        </div>

        <div className="onboarding-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {HABITS.map((habit) => {
            const isActive = dailyMinutes === habit.minutes;
            return (
              <div
                key={habit.minutes}
                className={`onboarding-option-card ${isActive ? 'active' : ''}`}
                onClick={() => onMinutesChange(habit.minutes)}
                style={{ textAlign: 'left', alignItems: 'flex-start', padding: '1.25rem' }}
              >
                {habit.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#059669',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    {habit.badge}
                  </span>
                )}
                <div className="onboarding-card-icon" style={{ background: isActive ? '#4f46e5' : '#f1f5f9', color: isActive ? '#ffffff' : '#475569' }}>
                  {habit.icon}
                </div>
                <span className="onboarding-card-title">{habit.label}</span>
                <span className="onboarding-card-desc">{habit.desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
