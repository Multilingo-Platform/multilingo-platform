import React from 'react';
import { BookOpen, Target, Clock, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HistoryStatsResponse } from '../types/history.types';

interface HistoryKpiCardsProps {
  stats: HistoryStatsResponse | null;
  loading: boolean;
  activeCert?: string;
}

export const HistoryKpiCards: React.FC<HistoryKpiCardsProps> = ({ stats, loading, activeCert }) => {
  const { t } = useTranslation();

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} giờ`;
  };

  const renderAttemptsSubtext = (s: HistoryStatsResponse | null) => {
    if (!s || s.totalAttempts === 0) return t('history.kpi.no_attempts', 'Chưa có lượt thi');
    const parts: string[] = [];
    if (s.completedAttempts > 0) parts.push(t('history.kpi.completed', { count: s.completedAttempts, defaultValue: `${s.completedAttempts} hoàn thành` }));
    if (s.inProgressAttempts > 0) parts.push(t('history.kpi.in_progress', { count: s.inProgressAttempts, defaultValue: `${s.inProgressAttempts} dở dang` }));
    if (s.failedAttempts && s.failedAttempts > 0) parts.push(t('history.kpi.failed', { count: s.failedAttempts, defaultValue: `${s.failedAttempts} lỗi chấm` }));
    const others = s.totalAttempts - s.completedAttempts - s.inProgressAttempts - (s.failedAttempts || 0);
    if (others > 0) parts.push(t('history.kpi.others', { count: others, defaultValue: `${others} khác` }));
    return parts.length > 0 ? parts.join(' • ') : t('history.kpi.tests_unit', { count: s.totalAttempts, defaultValue: `${s.totalAttempts} bài` });
  };

  const renderAverageScoreInfo = (s: HistoryStatsResponse | null, cert?: string) => {
    if (!s) {
      return {
        value: '—',
        subtext: t('history.kpi.no_score', 'Chưa có điểm'),
      };
    }

    const byType = s.averageScoresByType || {};
    const typeKeys = Object.keys(byType);

    // If specific cert tab is active (and not 'ALL')
    if (cert && cert !== 'ALL') {
      const certScore = byType[cert];
      if (certScore === undefined) return { value: '—', subtext: t('history.kpi.no_score_scale', 'Chưa có điểm theo thang chứng chỉ này') };
      let label = `${certScore}`;
      let scale = '';
      if (cert.startsWith('IELTS')) {
        label = `Band ${certScore}`;
        scale = 'Thang 9.0';
      } else if (cert === 'TOEIC_WRITING') {
        label = `${Math.round(certScore)} / 200`;
        scale = 'Thang 200';
      } else if (cert.startsWith('TOEIC')) {
        label = `${Math.round(certScore)} đ`;
        scale = 'Thang 990';
      } else if (cert.startsWith('NLTV')) {
        label = `Bậc ${certScore}`;
        scale = 'Thang 10';
      }
      return {
        value: label,
        subtext: scale + (s.highestScore !== null ? ` • Cao nhất: ${s.highestScore}` : ''),
      };
    }

    // If 'ALL' is selected, show per-certificate values without averaging their scales.
    if (typeKeys.length === 1) {
      const singleType = typeKeys[0];
      const singleScore = byType[singleType];
      let label = `${singleScore}`;
      if (singleType.startsWith('IELTS')) label = `Band ${singleScore}`;
      else if (singleType === 'TOEIC_WRITING') label = `${Math.round(singleScore)} / 200`;
      else if (singleType.startsWith('TOEIC')) label = `${Math.round(singleScore)} đ`;
      else if (singleType.startsWith('NLTV')) label = `Bậc ${singleScore}`;
      return {
        value: label,
        subtext: `${singleType} • Cao nhất: ${s.highestScore ?? singleScore}`,
      };
    }

    if (typeKeys.length > 1) {
      const breakdown = typeKeys.map(k => {
        const sc = byType[k];
        if (k === 'IELTS') return `IELTS: Band ${sc}`;
        if (k === 'TOEIC_LR') return `TOEIC L&R: ${Math.round(sc)}đ`;
        if (k === 'TOEIC_WRITING') return `TOEIC Writing: ${Math.round(sc)}/200`;
        if (k.startsWith('TOEIC')) return `${k}: ${Math.round(sc)}đ`;
        if (k === 'NLTV') return `NLTV: Bậc ${sc}`;
        return `${k}: ${sc}`;
      }).join(' • ');

      return {
        value: '—',
        subtext: breakdown,
      };
    }

    if (s.averageScore === null) return { value: '—', subtext: t('history.kpi.no_score', 'Chưa có điểm phù hợp') };
    return {
      value: `${s.averageScore} raw`,
      subtext: t('history.kpi.raw_score', 'Điểm raw'),
    };
  };

  const avgInfo = renderAverageScoreInfo(stats, activeCert);

  const cards = [
    {
      title: t('history.kpi.total_attempts', 'Tổng bài đã làm'),
      value: stats ? stats.totalAttempts : 0,
      subtext: renderAttemptsSubtext(stats),
      icon: <BookOpen size={28} />,
      gradient: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
    },
    {
      title: t('history.kpi.average_score', 'Điểm trung bình'),
      value: avgInfo.value,
      subtext: avgInfo.subtext,
      icon: <Target size={28} />,
      gradient: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
    },
    {
      title: t('history.kpi.practice_time', 'Thời gian rèn luyện'),
      value: stats ? formatTime(stats.totalPracticeMinutes) : '0 phút',
      subtext: stats
        ? t('history.kpi.target_achieved_count', { count: stats.targetAchievedCount, defaultValue: `${stats.targetAchievedCount} lần đạt mục tiêu` })
        : t('history.kpi.accumulated_time', 'Tích lũy thời gian thi'),
      icon: <Clock size={28} />,
      gradient: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    },
    {
      title: t('history.kpi.study_streak', 'Chuỗi ngày học'),
      value: stats ? `${stats.currentStreak} ngày` : '0 ngày',
      subtext: stats && stats.currentStreak > 0
        ? t('history.kpi.streak_active', 'Duy trì phong độ tuyệt vời! 🔥')
        : t('history.kpi.streak_zero', 'Luyện tập mỗi ngày'),
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
