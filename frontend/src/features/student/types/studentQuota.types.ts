export interface StudentQuotaItem {
  featureCode: string;
  featureName: string;
  usedCount: number;
  maxLimit: number;
  remaining: number;
  tier: 'FREE' | 'VIP' | string;
  resetDate: string;
}

