import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';
import { billingApi } from '../api/billingApi';
import { authApi } from '../../auth/api/authApi';
import { updateUser } from '../../auth/store/authSlice';
import { 
  Crown, 
  Receipt, 
  Sparkles, 
  Calendar, 
  CreditCard, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft,
  Clock,
  Building
} from 'lucide-react';

export const PurchaseHistoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const [page, setPage] = useState<number>(0);
  const pageSize = 20;

  // Luôn làm mới thông tin User để hiển thị hạn VIP và trạng thái mới nhất
  const { data: myInfoRes } = useQuery({
    queryKey: ['myInfo'],
    queryFn: authApi.getMyInfo,
  });

  useEffect(() => {
    if (myInfoRes?.data) {
      dispatch(updateUser(myInfoRes.data));
    }
  }, [myInfoRes, dispatch]);

  const currentUser = myInfoRes?.data || user;

  const { data: responseData, isLoading, isError, refetch } = useQuery({
    queryKey: ['myPurchaseHistory', page],
    queryFn: () => billingApi.getPurchaseHistory(page, pageSize),
    staleTime: 30000,
  });

  const pageData = responseData?.data;
  const historyList = pageData?.items || [];
  const totalElements = pageData?.totalElements || 0;
  const totalPages = pageData?.totalPages || 0;

  const formatVND = (price: number) => {
    return new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '---';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const isVip = currentUser?.subscriptionTier === 'PREMIUM';

  return (
    <div className="min-h-screen bg-slate-50/60 py-6 sm:py-10 px-3.5 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Navigation / Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <button
              onClick={() => navigate('/student/dashboard')}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
            >
              <ArrowLeft size={16} />
              {t('billing.back_dashboard')}
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {t('billing.history_title')}
            </h1>
            <p className="text-slate-500 mt-1 text-xs sm:text-base">
              {t('billing.history_desc')}
            </p>
          </div>

          <button
            onClick={() => navigate('/student/premium')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-sm shadow-md shadow-orange-500/20 transition-all hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98] w-full sm:w-auto"
          >
            <Sparkles size={18} />
            {t('billing.upgrade_btn')}
          </button>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-6 sm:mb-8">
          {/* Card 1: Current Tier */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex items-start gap-3.5 sm:gap-4">
            <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${isVip ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
              <Crown size={22} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t('billing.current_plan')}
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 truncate">
                {isVip ? 'PREMIUM VIP' : 'FREE TIER'}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
                <Calendar size={13} className="shrink-0" />
                <span>{t('billing.expires_at')}:</span>
                <span className="font-semibold text-slate-700">
                  {isVip && currentUser?.premiumExpiresAt 
                    ? formatDate(currentUser.premiumExpiresAt) 
                    : isVip 
                      ? (i18n.language === 'en' ? 'Lifetime' : 'Vĩnh viễn') 
                      : t('billing.no_expiry')}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Purchased */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex items-start gap-3.5 sm:gap-4">
            <div className="p-2.5 sm:p-3 rounded-xl bg-orange-100 text-orange-600 shrink-0">
              <Receipt size={22} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t('billing.total_packages')}
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                {t('billing.packages_count', { count: totalElements })}
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                {t('billing.verified_transactions')}
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
              <p className="text-sm font-medium">{t('auth.loading')}</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <p className="text-rose-600 font-semibold mb-2">Đã có lỗi xảy ra khi tải lịch sử mua gói.</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-medium transition-colors"
              >
                Thử lại
              </button>
            </div>
          ) : historyList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
                <CreditCard size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                {t('billing.empty_title')}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mb-6">
                {t('billing.empty_desc')}
              </p>
              <button
                onClick={() => navigate('/student/premium')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                <Sparkles size={16} />
                {t('billing.upgrade_btn')}
              </button>
            </div>
          ) : (
            <>
              {/* 1. Mobile Cards View (Hiện trên mobile < 768px, không bị co kéo) */}
              <div className="divide-y divide-slate-100 md:hidden">
                {historyList.map((item) => (
                  <div key={item.id} className="p-4 space-y-3">
                    {/* Top Row: Tên gói & Trạng thái */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0"></span>
                          <span className="truncate">{item.planName}</span>
                        </div>
                        <div className="text-xs font-semibold text-orange-600 bg-orange-50 inline-block px-2 py-0.5 rounded-md mt-1">
                          {item.durationDays ? t('billing.duration_days', { days: item.durationDays }) : 'Gói dịch vụ'}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                        <CheckCircle2 size={13} />
                        {t('billing.status_success')}
                      </span>
                    </div>

                    {/* Middle Row: Số tiền nổi bật */}
                    <div className="flex items-center justify-between bg-slate-50/80 rounded-xl px-3.5 py-2.5">
                      <span className="text-xs text-slate-500 font-medium">{t('billing.amount')}</span>
                      <span className="text-base font-extrabold text-slate-900">{formatVND(item.amount)}</span>
                    </div>

                    {/* Bottom Details: Mã GD & Thời gian */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-0.5">
                      <div>
                        <span className="text-slate-400 block text-[11px] mb-0.5">{t('billing.order_id')}</span>
                        <span className="font-mono text-slate-800 font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {item.vnpTxnRef}
                        </span>
                        {item.vnpTransactionNo && (
                          <div className="text-slate-400 text-[10px] font-mono mt-0.5">
                            No: {item.vnpTransactionNo}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[11px] mb-0.5">{t('billing.paid_date')}</span>
                        <span className="text-slate-700 font-medium block">
                          {formatDate(item.paidAt || item.createdAt)}
                        </span>
                        <div className="text-slate-400 text-[11px] flex items-center justify-end gap-1 mt-0.5">
                          <Building size={12} />
                          <span>{item.bankCode || 'VNPAY'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 2. Desktop Table View (Hiện trên màn hình >= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-4 px-6">{t('billing.plan_name')}</th>
                      <th className="py-4 px-6">{t('billing.order_id')}</th>
                      <th className="py-4 px-6">{t('billing.amount')}</th>
                      <th className="py-4 px-6">{t('billing.bank')}</th>
                      <th className="py-4 px-6">{t('billing.paid_date')}</th>
                      <th className="py-4 px-6 text-center">{t('billing.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {historyList.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                            {item.planName}
                          </div>
                          <div className="text-xs text-slate-400 font-medium mt-0.5">
                            {item.durationDays ? t('billing.duration_days', { days: item.durationDays }) : 'Gói dịch vụ'}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                            {item.vnpTxnRef}
                          </span>
                          {item.vnpTransactionNo && (
                            <div className="text-xs text-slate-400 mt-1 font-mono">
                              No: {item.vnpTransactionNo}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          {formatVND(item.amount)}
                        </td>
                        <td className="py-4 px-6 text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Building size={14} className="text-slate-400" />
                            {item.bankCode || 'VNPAY'}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-500 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Clock size={13} className="text-slate-400" />
                            {formatDate(item.paidAt || item.createdAt)}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={13} />
                            {t('billing.status_success')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50/60 border-t border-slate-200/80">
                  <div className="text-xs text-slate-500 font-medium">
                    {t('billing.page_info', { current: page + 1, total: totalPages })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                      disabled={page === 0}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronLeft size={14} />
                      {t('billing.page_prev')}
                    </button>
                    <button
                      onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                      disabled={page >= totalPages - 1 || pageData?.last}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      {t('billing.page_next')}
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseHistoryPage;
