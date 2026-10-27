export interface UserProfileSummary {
  id: number;
  fullName: string | null;
  avatarUrl: string | null;
  targetLanguage: string | null;
}

export interface StreakStats {
  currentStreak: number;
  highestStreak: number;
  totalLearningMinutes: number;
  totalXp: number;
  isStudiedToday: boolean;
  lastStudyDate: string | null;
}

export interface ExamStats {
  totalExamsTaken: number;
  averageScore: number;
  latestExamTitle: string | null;
  latestExamScore: number | null;
  latestExamDate: string | null;
}

export interface VocabStats {
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  masteryRate: number;
  dueTodayCount: number;
}

export interface HeatmapDataPoint {
  date: string;
  learningMinutes: number;
  flashcardsReviewed: number;
  practiceQuestions: number;
  xpEarned: number;
  level: number; // 0 to 4
}

export interface ActivityHeatmap {
  year: number;
  totalActiveDays: number;
  longestStreak: number;
  dataPoints: HeatmapDataPoint[];
}

export interface DailyChartPoint {
  date: string;
  label: string;
  learningMinutes: number;
  questionsAnswered: number;
}

export interface ProgressChart {
  timeRange: 'THIS_WEEK' | 'THIS_MONTH' | 'ALL' | string;
  dataPoints: DailyChartPoint[];
}

export interface SuggestedAction {
  type: 'PLACEMENT_TEST' | 'VOCAB_REVIEW' | 'EXAM_PRACTICE' | string;
  title: string;
  description: string;
  badge: string;
  actionUrl: string;
  buttonText: string;
}

export interface RecentExamScore {
  attemptId: number;
  examTitle: string;
  score: number | null;
  maxScore: number;
  percentage: number | null;
  completedAt: string | null;
}

export interface GoalProgress {
  targetCertificate: string;
  targetScore: number;
  recentAverageScore: number | null;
  progressPercent: number;
  recentExamCount: number;
  recentScores: RecentExamScore[];
}

export interface StudentDashboardData {
  isNewUser: boolean;
  userProfile: UserProfileSummary;
  streak: StreakStats;
  examStats: ExamStats;
  vocabStats: VocabStats;
  activityHeatmap: ActivityHeatmap;
  progressChart: ProgressChart;
  suggestedActions: SuggestedAction[];
  goalProgress?: GoalProgress | null;
}
