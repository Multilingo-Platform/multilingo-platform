export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// User Management Types
export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
  subscriptionTier: 'FREE' | 'VIP';
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  isFraudRisk: boolean;
}

export interface LoginHistoryItem {
  id: number;
  ipAddress: string;
  deviceInfo?: string;
  loginTime: string;
  status: string;
}

export interface AdminUserDetail extends AdminUser {
  nativeLanguage?: string;
  targetLanguage?: string;
  phone?: string;
  premiumExpiresAt?: string;
  totalExamsAttempted: number;
  averageExamScore?: number;
  totalLearningMinutes: number;
  currentStreak: number;
  totalXp: number;
  recentLoginHistory: LoginHistoryItem[];
}

export interface UpdateUserStatusPayload {
  isActive: boolean;
  reason?: string;
}

// Tracking Types
export interface UserTrackingItem {
  userId: number;
  email: string;
  fullName: string;
  subscriptionTier: string;
  totalAttempts: number;
  averageScore?: number;
  totalLearningMinutes: number;
  lastLoginIp?: string;
  lastLoginAt?: string;
}

export interface ExamTrackingItem {
  examId: number;
  title: string;
  code: string;
  totalAttempts: number;
  completedAttempts: number;
  completionRate: number;
  averageScore?: number;
}

export interface UserExamSummary {
  examId: number;
  examCode: string;
  examTitle: string;
  examType: string;
  attemptCount: number;
  highestScore?: number;
  latestScore?: number;
  latestAttemptAt?: string;
}

export interface UserAttemptDetail {
  attemptId: number;
  examId: number;
  examCode: string;
  examTitle: string;
  examType?: string;
  testMode?: string;
  testScope?: string;
  status?: string;
  startTime: string;
  endTime?: string;
  timeSpentSeconds?: number;
  overallScore?: number;
  scoreUnit?: string;
}

export interface UserExamTrackingDetail {
  userId: number;
  fullName: string;
  email: string;
  subscriptionTier: string;
  totalExamsAttempted: number;
  averageScore?: number;
  examSummaries: UserExamSummary[];
  attempts: UserAttemptDetail[];
}

export interface ExamAttemptUser {
  attemptId: number;
  userId: number;
  fullName: string;
  email: string;
  subscriptionTier: string;
  attemptNumber: number;
  examType?: string;
  testMode?: string;
  status?: string;
  startTime: string;
  endTime?: string;
  timeSpentSeconds?: number;
  overallScore?: number;
  scoreUnit?: string;
}

export interface ExamTrackingDetail {
  examId: number;
  code: string;
  title: string;
  type: string;
  durationMinutes?: number;
  totalAttempts: number;
  completedAttempts: number;
  completionRate: number;
  averageScore?: number;
  attempts: ExamAttemptUser[];
}

// Quota Types
export interface UserQuotaItem {
  id?: number;
  feature: 'AI_WRITING_HINTS' | 'AI_WRITING_GRADING' | 'DICTIONARY_LOOKUP' | string;
  tier: 'FREE' | 'VIP' | string;
  dailyLimit: number;
  resetCycle: string;
  updatedAt?: string;
}

export interface UpdateQuotaPayload {
  feature: string;
  tier: string;
  dailyLimit: number;
  resetCycle?: string;
}

// Audit Log Types
export interface AuditLogItem {
  id: number;
  userId?: number;
  userEmail?: string;
  userFullName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

// Dashboard Types
export interface DashboardStats {
  dau: number;
  mau: number;
  totalUsers: number;
  vipUsers: number;
  vipConversionRate: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalExamsAttempted: number;
  attemptsByStatus?: Record<string, number>;
}

export interface RevenueChartData {
  labels: string[];
  data: number[];
  totalPeriodRevenue: number;
}

// Transaction Types
export interface AdminTransaction {
  id: number;
  userId: number;
  userEmail?: string;
  planName: string;
  vnpTxnRef: string;
  vnpTransactionNo?: string;
  amount: number;
  bankCode?: string;
  paymentMethod: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED' | string;
  paidAt?: string;
  createdAt: string;
}
