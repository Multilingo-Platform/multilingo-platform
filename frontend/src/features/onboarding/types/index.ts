export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export type TargetCertificate = 
  | 'IELTS_ACADEMIC' 
  | 'TOEIC_LR' 
  | 'TOEIC_WRITING' 
  | 'NLTV';

export type LearnerLevel = 
  | 'BEGINNER' 
  | 'ELEMENTARY' 
  | 'INTERMEDIATE' 
  | 'ADVANCED';

export interface OnboardingData {
  nativeLanguage: string;
  targetLanguage: string;
  targetCertificate: TargetCertificate;
  targetScore: number;
  dailyMinutes?: number;
  currentLevel?: LearnerLevel;
}

export interface OnboardingRequest {
  nativeLanguage: string;
  targetLanguage: string;
  targetCertificate: TargetCertificate;
  targetScore: number;
  dailyMinutes?: number;
  currentLevel?: LearnerLevel;
}

export interface OnboardingResponse {
  userId: number;
  nativeLanguage: string;
  targetLanguage: string;
  targetCertificate: string;
  targetScore: number;
  dailyMinutes: number;
  currentLevel: string;
  hasCompletedOnboarding: boolean;
  suggestedExamType: string;
}

export interface OnboardingStatusResponse {
  hasCompletedOnboarding: boolean;
  nativeLanguage?: string;
  targetLanguage?: string;
  targetCertificate?: string;
  targetScore?: number;
  dailyMinutes?: number;
  currentLevel?: string;
}
