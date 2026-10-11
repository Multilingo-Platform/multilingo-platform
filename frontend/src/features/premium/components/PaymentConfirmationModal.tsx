import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, CreditCard, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axiosClient from '../../../core/api/axiosClient';

interface Plan {
  id: number;
  name: string;
  price: number;
  durationDays: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
}

export const PaymentConfirmationModal: React.FC<Props> = ({ isOpen, onClose, plan }) => {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !plan || !mounted) return null;

  const handlePayment = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axiosClient.post('/v1/billing/vnpay/create-payment', {
        planId: plan.id,
        bankCode: 'NCB' // Test bank code
      });
      if (response?.data?.paymentUrl) {
        window.location.href = response.data.paymentUrl;
      } else {
        setError(t('premium.modal.err_no_url'));
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('premium.modal.err_default'));
      setIsLoading(false);
    }
  };

  const formatVND = (price: number) => {
    return new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'vi-VN', { 
      style: 'currency', 
      currency: 'VND' 
    }).format(price);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="relative h-24 bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full p-1 transition">
            <X size={20} />
          </button>
          <ShieldCheck size={48} className="text-white drop-shadow-md" />
        </div>
        
        <div className="p-6">
          <h3 className="text-2xl font-bold text-center text-slate-800 mb-2">{t('premium.modal.title')}</h3>
          <p className="text-center text-slate-500 text-sm mb-6">{t('premium.modal.subtitle')}</p>
          
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6">
            <div className="flex justify-between items-center mb-3 border-b border-orange-200/50 pb-3">
              <span className="text-slate-600 font-medium">{t('premium.modal.plan_label')}</span>
              <span className="text-slate-900 font-bold">{plan.name}</span>
            </div>
            <div className="flex justify-between items-center mb-3 border-b border-orange-200/50 pb-3">
              <span className="text-slate-600 font-medium">{t('premium.modal.duration_label')}</span>
              <span className="text-slate-900 font-bold">{t('premium.modal.duration_days', { count: plan.durationDays })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">{t('premium.modal.total_payment')}</span>
              <span className="text-orange-600 font-extrabold text-xl">{formatVND(plan.price)}</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center">
              {error}
            </div>
          )}

          <button 
            onClick={handlePayment} 
            disabled={isLoading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <CreditCard className="w-5 h-5 mr-2" />
            )}
            {isLoading ? t('premium.modal.btn_processing') : t('premium.modal.btn_pay')}
          </button>
          
          <p className="mt-4 text-xs text-center text-slate-400 flex items-center justify-center">
            {t('premium.modal.disclaimer')}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};
