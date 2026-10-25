import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axiosClient from '../../../core/api/axiosClient';
import { PaymentConfirmationModal } from '../components/PaymentConfirmationModal';

// API lấy danh sách gói cho học viên
const fetchPlans = async () => {
  const res = await axiosClient.get('/v1/billing/plans');
  return res.data;
};

const PremiumUpgradePage = () => {
  const { t, i18n } = useTranslation();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: plansData, isLoading } = useQuery({
    queryKey: ['premiumPlans'],
    queryFn: fetchPlans,
  });

  const activePlans = plansData?.filter((p: any) => p.isActive) || [];

  const formatVND = (price: number) => {
    return new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'vi-VN', { 
      style: 'currency', 
      currency: 'VND' 
    }).format(price);
  };

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
            {t('premium.title')}
          </h1>
          <p className="mt-5 text-xl text-slate-500">
            {t('premium.subtitle')}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">

            {/* 1. Free Plan */}
            <div className="flex flex-col bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-md transition-shadow relative">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('premium.free_plan_tag')}</h3>
                <h4 className="text-2xl font-bold text-slate-900 mb-4">{t('premium.free_plan_name')}</h4>
                <p className="text-sm text-slate-500 mb-6 min-h-[60px]">
                  {t('premium.free_plan_desc')}
                </p>
                <div className="flex items-baseline text-slate-900">
                  <span className="text-4xl font-extrabold tracking-tight">{t('premium.free_price')}</span>
                  <span className="ml-1 text-xl font-medium text-slate-500">{t('premium.per_month')}</span>
                </div>
              </div>

              <button className="mt-4 w-full bg-slate-100 text-slate-700 font-semibold py-3 px-4 rounded-full hover:bg-slate-200 transition-colors">
                {t('premium.current_plan_btn')}
              </button>

              <div className="mt-8 flex-1">
                <p className="text-sm font-semibold text-slate-900 mb-4">{t('premium.free_features_title')}</p>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <Check className="flex-shrink-0 w-5 h-5 text-slate-400 mr-3" />
                    <span className="text-sm text-slate-600">{t('premium.feature_free_1')}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="flex-shrink-0 w-5 h-5 text-slate-400 mr-3" />
                    <span className="text-sm text-slate-600">{t('premium.feature_free_2')}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="flex-shrink-0 w-5 h-5 text-slate-400 mr-3" />
                    <span className="text-sm text-slate-600">{t('premium.feature_free_3')}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="flex-shrink-0 w-5 h-5 text-slate-400 mr-3" />
                    <span className="text-sm text-slate-600">{t('premium.feature_free_4')}</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 2. Dynamic Premium Plans */}
            {activePlans.map((plan: any, index: number) => {
              const isHighlighted = index === 1;

              return (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-3xl p-8 relative ${isHighlighted
                    ? 'bg-orange-50/30 border-2 border-orange-500 shadow-lg transform md:-translate-y-2'
                    : 'bg-white border border-slate-200 shadow-sm hover:shadow-md'
                    } transition-all`}
                >
                  {isHighlighted && (
                    <div className="absolute top-0 right-0 -mt-3 mr-6">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 uppercase tracking-wide">
                        {t('premium.popular_badge')}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center">
                      {plan.name}
                      {isHighlighted && <Sparkles className="w-4 h-4 ml-2 text-orange-500" />}
                    </h3>
                    <h4 className="text-2xl font-bold text-slate-900 mb-4">{t('premium.max_power_title')}</h4>
                    <p className="text-sm text-slate-500 mb-6 min-h-[60px]">
                      {t('premium.premium_plan_desc')}
                    </p>
                    <div className="flex items-baseline text-slate-900">
                      <span className="text-4xl font-extrabold tracking-tight">{formatVND(plan.price)}</span>
                      <span className="ml-1 text-sm font-medium text-slate-500">{t('premium.per_days', { count: plan.durationDays })}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className={`mt-4 w-full font-semibold py-3 px-4 rounded-full transition-colors ${isHighlighted
                      ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-md hover:shadow-lg'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                  >
                    {t('premium.upgrade_now_btn')}
                  </button>

                  <div className="mt-8 flex-1">
                    <p className="text-sm font-semibold text-slate-900 mb-4">{t('premium.premium_features_title')}</p>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <Check className={`flex-shrink-0 w-5 h-5 mr-3 ${isHighlighted ? 'text-orange-500' : 'text-slate-700'}`} />
                        <span className="text-sm text-slate-600">
                          {t('premium.feature_prem_1_prefix')}
                          <strong>{t('premium.feature_prem_1_highlight')}</strong>
                          {t('premium.feature_prem_1_suffix')}
                        </span>
                      </li>
                      <li className="flex items-start">
                        <Check className={`flex-shrink-0 w-5 h-5 mr-3 ${isHighlighted ? 'text-orange-500' : 'text-slate-700'}`} />
                        <span className="text-sm text-slate-600">
                          {t('premium.feature_prem_2_prefix')}
                          <strong>{t('premium.feature_prem_2_highlight')}</strong>
                          {t('premium.feature_prem_2_suffix')}
                        </span>
                      </li>
                      <li className="flex items-start">
                        <Check className={`flex-shrink-0 w-5 h-5 mr-3 ${isHighlighted ? 'text-orange-500' : 'text-slate-700'}`} />
                        <span className="text-sm text-slate-600">
                          {t('premium.feature_prem_3_prefix')}
                          <strong>{t('premium.feature_prem_3_highlight')}</strong>
                          {t('premium.feature_prem_3_suffix')}
                        </span>
                      </li>
                      <li className="flex items-start">
                        <Check className={`flex-shrink-0 w-5 h-5 mr-3 ${isHighlighted ? 'text-orange-500' : 'text-slate-700'}`} />
                        <span className="text-sm text-slate-600">{t('premium.feature_prem_4')}</span>
                      </li>
                      <li className="flex items-start">
                        <Check className={`flex-shrink-0 w-5 h-5 mr-3 ${isHighlighted ? 'text-orange-500' : 'text-slate-700'}`} />
                        <span className="text-sm text-slate-600">{t('premium.feature_prem_5')}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              );
            })}

          </div>
        )}

        <div className="mt-16 text-center text-sm text-slate-500">
          <p className="mb-2">{t('premium.footer_note')}</p>
          <div className="flex justify-center items-center space-x-6">
            <a href="#" className="hover:text-slate-800 transition-colors">{t('premium.terms_link')}</a>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <a href="#" className="hover:text-slate-800 transition-colors">{t('premium.contact_link')}</a>
          </div>
        </div>

        <PaymentConfirmationModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          plan={selectedPlan} 
        />

      </div>
    </div>
  );
};

export default PremiumUpgradePage;
