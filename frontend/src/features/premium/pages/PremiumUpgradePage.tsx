
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Info, Shield, Zap, Sparkles } from 'lucide-react';
import axiosClient from '../../../core/api/axiosClient';
import { PaymentConfirmationModal } from '../components/PaymentConfirmationModal';

// Tạm thời gọi API admin để lấy danh sách gói (sau này có thể tách API public riêng)
const fetchPlans = async () => {
  const res = await axiosClient.get('/admin/plans');
  return res.data;
};

const PremiumUpgradePage = () => {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: plansData, isLoading } = useQuery({
    queryKey: ['premiumPlans'],
    queryFn: fetchPlans,
  });

  const activePlans = plansData?.filter((p: any) => p.isActive) || [];

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
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
            Nâng cấp trải nghiệm học tập của bạn
          </h1>
          <p className="mt-5 text-xl text-slate-500">
            Chọn gói phù hợp nhất với mục tiêu của bạn. Truy cập không giới hạn vào kho đề thi, giải thích chi tiết và AI Tutor.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">

            {/* 1. Free Plan (Hardcoded) */}
            <div className="flex flex-col bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-md transition-shadow relative">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Miễn phí</h3>
                <h4 className="text-2xl font-bold text-slate-900 mb-4">Dùng thử Cơ bản</h4>
                <p className="text-sm text-slate-500 mb-6 min-h-[60px]">
                  Tìm hiểu cách hệ thống hoạt động, làm bài kiểm tra cơ bản với một số giới hạn.
                </p>
                <div className="flex items-baseline text-slate-900">
                  <span className="text-4xl font-extrabold tracking-tight">₫0</span>
                  <span className="ml-1 text-xl font-medium text-slate-500">/ tháng</span>
                </div>
              </div>

              <button className="mt-4 w-full bg-slate-100 text-slate-700 font-semibold py-3 px-4 rounded-full hover:bg-slate-200 transition-colors">
                Gói đang dùng
              </button>

              <div className="mt-8 flex-1">
                <p className="text-sm font-semibold text-slate-900 mb-4">Các tính năng cơ bản:</p>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <Check className="flex-shrink-0 w-5 h-5 text-slate-400 mr-3" />
                    <span className="text-sm text-slate-600">Truy cập giới hạn đề thi TOEIC/IELTS</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="flex-shrink-0 w-5 h-5 text-slate-400 mr-3" />
                    <span className="text-sm text-slate-600">Làm bài thi và xem điểm tổng</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="flex-shrink-0 w-5 h-5 text-slate-400 mr-3" />
                    <span className="text-sm text-slate-600">Hỗ trợ từ cộng đồng</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="flex-shrink-0 w-5 h-5 text-slate-400 mr-3" />
                    <span className="text-sm text-slate-600">Có quảng cáo</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 2. Dynamic Premium Plans */}
            {activePlans.map((plan: any, index: number) => {
              // Highlight the second plan (or first premium plan) like ChatGPT Plus
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
                        Phổ biến nhất
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center">
                      {plan.name}
                      {isHighlighted && <Sparkles className="w-4 h-4 ml-2 text-orange-500" />}
                    </h3>
                    <h4 className="text-2xl font-bold text-slate-900 mb-4">Sức mạnh tối đa</h4>
                    <p className="text-sm text-slate-500 mb-6 min-h-[60px]">
                      Mở khóa toàn bộ trí tuệ nhân tạo và kho đề thi cập nhật mới nhất cho mục tiêu cao.
                    </p>
                    <div className="flex items-baseline text-slate-900">
                      <span className="text-4xl font-extrabold tracking-tight">{formatVND(plan.price).replace('₫', '₫ ')}</span>
                      <span className="ml-1 text-sm font-medium text-slate-500">/ {plan.durationDays} ngày</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className={`mt-4 w-full font-semibold py-3 px-4 rounded-full transition-colors ${isHighlighted
                      ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-md hover:shadow-lg'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                  >
                    Nâng cấp ngay
                  </button>

                  <div className="mt-8 flex-1">
                    <p className="text-sm font-semibold text-slate-900 mb-4">Mọi thứ trong Miễn phí, cộng thêm:</p>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <Check className={`flex-shrink-0 w-5 h-5 mr-3 ${isHighlighted ? 'text-orange-500' : 'text-slate-700'}`} />
                        <span className="text-sm text-slate-600">Truy cập <strong>không giới hạn</strong> tất cả đề thi</span>
                      </li>
                      <li className="flex items-start">
                        <Check className={`flex-shrink-0 w-5 h-5 mr-3 ${isHighlighted ? 'text-orange-500' : 'text-slate-700'}`} />
                        <span className="text-sm text-slate-600">Xem <strong>giải thích chi tiết</strong> cho từng câu hỏi</span>
                      </li>
                      <li className="flex items-start">
                        <Check className={`flex-shrink-0 w-5 h-5 mr-3 ${isHighlighted ? 'text-orange-500' : 'text-slate-700'}`} />
                        <span className="text-sm text-slate-600">Sử dụng tính năng <strong>AI Tutor</strong> hỏi đáp 24/7</span>
                      </li>
                      <li className="flex items-start">
                        <Check className={`flex-shrink-0 w-5 h-5 mr-3 ${isHighlighted ? 'text-orange-500' : 'text-slate-700'}`} />
                        <span className="text-sm text-slate-600">Không có quảng cáo</span>
                      </li>
                      <li className="flex items-start">
                        <Check className={`flex-shrink-0 w-5 h-5 mr-3 ${isHighlighted ? 'text-orange-500' : 'text-slate-700'}`} />
                        <span className="text-sm text-slate-600">Ưu tiên trải nghiệm tính năng mới</span>
                      </li>
                    </ul>
                  </div>
                </div>
              );
            })}

          </div>
        )}

        <div className="mt-16 text-center text-sm text-slate-500">
          <p className="mb-2">Gói cước của bạn sẽ tự động hết hạn, chúng tôi không tự động trừ tiền qua thẻ.</p>
          <div className="flex justify-center items-center space-x-6">
            <a href="#" className="hover:text-slate-800 transition-colors">Điều khoản thanh toán</a>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <a href="#" className="hover:text-slate-800 transition-colors">Liên hệ hỗ trợ</a>
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
