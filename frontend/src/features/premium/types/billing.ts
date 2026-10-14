export interface PurchaseHistoryItem {
  id: number;
  userId: number;
  planId: number;
  planCode: string;
  planName: string;
  durationDays: number;
  vnpTxnRef: string;
  vnpTransactionNo?: string;
  amount: number;
  bankCode?: string;
  paymentMethod: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED';
  paidAt?: string;
  createdAt: string;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
