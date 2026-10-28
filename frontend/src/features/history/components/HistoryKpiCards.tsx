import React from 'react';
import { BookOpen, Target, Clock, Flame } from 'lucide-react';
import type { HistoryStatsResponse } from '../types/history.types';

interface HistoryKpiCardsProps {
  stats: HistoryStatsResponse | null;
  loading: boolean;
}

export const HistoryKpiCards: React.FC<HistoryKpiCardsProps> = ({ stats, loading }) => {
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} giờ`;
  };

  const renderAttemptsSubtext = (s: HistoryStatsResponse | null) => {
    if (!s || s.totalAttempts === 0) return 'Chưa có lượt thi';
    const parts: string[] = [];
    if (s.completedAttempts > 0) parts.push(`${s.completedAttempts} hoàn thành`);
    if (s.inProgressAttempts > 0) parts.push(`${s.inProgressAttempts} dở dang`);
    if (s.failedAttempts && s.failedAttempts > 0) parts.push(`${s.failedAttempts} lỗi chấm`);
    const others = s.totalAttempts - s.completedAttempts - s.inProgressAttempts - (s.failedAttempts || 0);
    if (others > 0) parts.push(`${others} khác`);
    return parts.length > 0 ? parts.join(' • ') : `${s.totalAttempts} bài`;
  };

  const cards = [
    {
      title: 'Tổng bài đã làm',
      value: stats ? stats.totalAttempts : 0,
      subtext: renderAttemptsSubtext(stats),
      icon: <BookOpen size={28} />,
      gradient: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
    },
    {
      title: 'Điểm trung bình',
      value: stats && stats.averageScore !== null ? stats.averageScore : '—',
      subtext: stats && stats.highestScore !== null ? `Cao nhất: ${stats.highestScore}` : 'Chưa có điểm',
      icon: <Target size={28} />,
      gradient: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
    },
    {
      title: 'Thời gian rèn luyện',
      value: stats ? formatTime(stats.totalPracticeMinutes) : '0 phút',
      subtext: stats ? `${stats.targetAchievedCount} lần đạt mục tiêu` : 'Tích lũy thời gian thi',
      icon: <Clock size={28} />,
      gradient: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    },
    {
      title: 'Chuỗi ngày học',
      value: stats ? `${stats.currentStreak} ngày` : '0 ngày',
      subtext: stats && stats.currentStreak > 0 ? 'Duy trì phong độ tuyệt vời! 🔥' : 'Luyện tập mỗi ngày',
      icon: <Flame size={28} />,
      gradient: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
    },
  ];

  return (
    <div className="history-kpi-grid">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="history-kpi-card"
          style={{ background: card.gradient }}
        >
          <div className="history-kpi-watermark-icon">
            {card.icon}
          </div>
          <div className="history-kpi-content">
            <span className="history-kpi-title">{card.title}</span>
            <div className="history-kpi-value">
              {loading ? <span className="history-kpi-skeleton" /> : card.value}
            </div>
            <span className="history-kpi-subtext">{card.subtext}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
