export interface SubscriptionPlan {
  id: number;
  code: string;
  name: string;
  price: number;
  durationDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanRequest {
  code: string;
  name: string;
  price: number;
  durationDays: number;
}
