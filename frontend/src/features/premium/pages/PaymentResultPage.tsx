import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  Crown, 
  ArrowRight, 
  RotateCcw, 
  Home, 
  ShieldCheck, 
  Calendar, 
  CreditCard, 
  Receipt
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axiosClient from '../../../core/api/axiosClient';
import { useAppDispatch } from '../../../app/hooks';
import { updateUser } from '../../auth/store/authSlice';
import { authApi } from '../../auth/api/authApi';

interface PaymentResultData {
  status: 'SUCCESS' | 'CANCELLED' | 'FAILED' | 'INVALID_SIGNATURE';
  message: string;
  vnpTxnRef?: string;
  planName?: string;
  amount?: number;
  durationDays?: number;
  bankCode?: string;
  paymentTime?: string;
}

export const PaymentResultPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [result, setResult] = useState<PaymentResultData | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const queryParamsString = searchParams.toString();
        const response = await axiosClient.get(`/v1/billing/vnpay/payment-return?${queryParamsString}`);
        
        if (response?.data) {
          setResult(response.data);

          // Nếu thanh toán thành công, tự động làm mới thông tin tài khoản để hiển thị VIP ngay
          if (response.data.status === 'SUCCESS') {
            try {
              const myInfoRes = await authApi.getMyInfo();
              if (myInfoRes?.data) {
                dispatch(updateUser(myInfoRes.data));
              }
            } catch (err) {
              console.error('Không thể đồng bộ thông tin người dùng:', err);
            }
          }
        } else {
          setResult({
            status: 'FAILED',
            message: t('paymentResult.err_no_response')
          });
        }
      } catch (err: any) {
        setResult({
          status: 'FAILED',
          message: err.response?.data?.message || t('paymentResult.err_default')
        });
      } finally {
        setIsLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams, dispatch, t]);

  const formatVND = (price?: number) => {
    if (!price && price !== 0) return i18n.language === 'en' ? '0 VND' : '0 ₫';
    return new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'vi-VN', { 
      style: 'currency', 
      currency: 'VND' 
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-4 min-h-[60vh]">
        <div className="w-12 h-12 relative flex items-center justify-center mb-4">
          <div className="w-12 h-12 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin absolute" />
          <Crown className="w-5 h-5 text-orange-500 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">{t('paymentResult.verifying_title')}</h2>
        <p className="text-slate-500 text-xs mt-1 text-center max-w-xs">
          {t('paymentResult.verifying_desc')}
        </p>
      </div>
    );
  }

  // 1. Trường hợp: Người dùng ấn HỦY giao dịch trên cổng thanh toán
  if (result?.status === 'CANCELLED') {
    return (
      <div className="w-full flex items-center justify-center px-4 py-2">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header cam ấm compact */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 px-6 py-5 text-center text-white relative">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-inner">
              <RotateCcw className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">{t('paymentResult.cancelled_title')}</h2>
            <p className="text-orange-100 text-xs mt-0.5">
              {t('paymentResult.cancelled_subtitle')}
            </p>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6">
            <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-3 mb-4 text-center">
              <p className="text-xs text-slate-700 leading-relaxed">
                {t('paymentResult.cancelled_notice_prefix')}
                <span className="font-semibold text-slate-900">{t('paymentResult.cancelled_notice_highlight')}</span>
                {t('paymentResult.cancelled_notice_suffix')}
              </p>
            </div>

            {result.vnpTxnRef && (
              <div className="space-y-2 bg-slate-50/90 rounded-2xl p-3.5 border border-slate-100 mb-5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>{t('paymentResult.ref_code')}</span>
                  <span className="font-mono font-medium text-slate-800">{result.vnpTxnRef}</span>
                </div>
                {result.planName && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>{t('paymentResult.selected_plan')}</span>
                    <span className="font-semibold text-slate-800">{result.planName}</span>
                  </div>
                )}
                {result.amount && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>{t('paymentResult.amount')}</span>
                    <span className="font-semibold text-orange-600">{formatVND(result.amount)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                onClick={() => navigate('/student/premium')}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition active:scale-[0.99]"
              >
                <RotateCcw className="w-4 h-4" />
                {t('paymentResult.btn_retry')}
              </button>
              <button
                onClick={() => navigate('/student/dashboard')}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
              >
                <Home className="w-4 h-4" />
                {t('paymentResult.btn_home')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Trường hợp: THÀNH CÔNG
  if (result?.status === 'SUCCESS') {
    return (
      <div className="w-full flex items-center justify-center px-4 py-2">
        <div className="bg-white rounded-3xl border border-orange-100/90 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header rực rỡ compact */}
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-6 py-5 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-md shadow-black/10">
              <CheckCircle2 className="w-8 h-8 text-orange-500" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-semibold uppercase tracking-wider mb-1">
              <Crown className="w-3 h-3 text-amber-200" />
              {t('paymentResult.success_badge')}
            </div>
            <h2 className="text-xl font-bold tracking-tight">{t('paymentResult.success_title')}</h2>
            <p className="text-orange-100 text-xs mt-0.5">
              {t('paymentResult.success_subtitle')}
            </p>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6">
            <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-100 space-y-2.5 text-xs mb-5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-orange-500" /> {t('paymentResult.plan_label')}
                </span>
                <span className="font-bold text-slate-900">{result.planName || t('paymentResult.default_plan_name')}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-orange-500" /> {t('paymentResult.payment_amount')}
                </span>
                <span className="font-bold text-orange-600 text-sm">{formatVND(result.amount)}</span>
              </div>

              {result.durationDays ? (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-orange-500" /> {t('paymentResult.duration_added')}
                  </span>
                  <span className="font-semibold text-slate-800">{t('paymentResult.days_added', { count: result.durationDays })}</span>
                </div>
              ) : null}

              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-orange-500" /> {t('paymentResult.transaction_code')}
                </span>
                <span className="font-mono text-[11px] text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {result.vnpTxnRef}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-orange-500" /> {t('paymentResult.gateway')}
                </span>
                <span className="font-medium text-slate-800">{result.bankCode || 'VNPAY'}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => navigate('/student/exams')}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition active:scale-[0.99]"
              >
                {t('paymentResult.btn_start_learning')}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/student/settings')}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
              >
                {t('paymentResult.btn_view_account')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Trường hợp: LỖI GIAO DỊCH HOẶC CHỮ KÝ SAI
  return (
    <div className="w-full flex items-center justify-center px-4 py-2">
      <div className="bg-white rounded-3xl border border-red-100 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-br from-red-500 to-orange-600 px-6 py-5 text-center text-white">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-inner">
            <XCircle className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">{t('paymentResult.failed_title')}</h2>
          <p className="text-red-100 text-xs mt-0.5">
            {result?.message || t('paymentResult.failed_subtitle_default')}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="bg-red-50/70 border border-red-100 rounded-2xl p-3 mb-4 text-center text-xs text-red-700">
            {result?.status === 'INVALID_SIGNATURE' 
              ? t('paymentResult.invalid_signature_msg')
              : t('paymentResult.failed_default_msg')}
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => navigate('/student/premium')}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition active:scale-[0.99]"
            >
              <RotateCcw className="w-4 h-4" />
              {t('paymentResult.btn_retry')}
            </button>
            <button
              onClick={() => navigate('/student/dashboard')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
            >
              <Home className="w-4 h-4" />
              {t('paymentResult.btn_home')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentResultPage;
