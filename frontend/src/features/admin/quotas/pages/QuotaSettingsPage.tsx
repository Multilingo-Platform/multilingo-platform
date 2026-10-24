import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  BookOpen,
  MessageSquare,
  PenTool,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import type { UserQuotaItem } from '../../types/adminTypes';
import { alertUtil } from '../../../../utils/alert';

export const QuotaSettingsPage = () => {
  const queryClient = useQueryClient();

  const { data: quotas, isLoading } = useQuery({
    queryKey: ['adminQuotas'],
    queryFn: () => adminApi.getAllQuotas(),
  });

  // Local state to manage editable limits
  const [formState, setFormState] = useState<Record<string, number>>({});

  useEffect(() => {
    if (quotas) {
      const state: Record<string, number> = {};
      quotas.forEach((q: UserQuotaItem) => {
        state[`${q.feature}_${q.tier}`] = q.dailyLimit;
      });
      setFormState(state);
    }
  }, [quotas]);

  const updateQuotaMutation = useMutation({
    mutationFn: (payload: { feature: string; tier: string; dailyLimit: number }) =>
      adminApi.updateQuota({
        feature: payload.feature,
        tier: payload.tier,
        dailyLimit: payload.dailyLimit,
        resetCycle: 'DAILY',
      }),
    onSuccess: (_, variables) => {
      alertUtil.toast(
        `Đã cập nhật hạn mức ${variables.feature} (${variables.tier}) thành công!`,
        'success'
      );
      queryClient.invalidateQueries({ queryKey: ['adminQuotas'] });
    },
    onError: () => {
      alertUtil.popup('Không thể cập nhật hạn mức Quota AI. Vui lòng thử lại.', 'error');
    },
  });

  const handleInputChange = (feature: string, tier: string, val: number) => {
    setFormState((prev) => ({
      ...prev,
      [`${feature}_${tier}`]: Math.max(0, val),
    }));
  };

  const handleSave = (feature: string, tier: string) => {
    const key = `${feature}_${tier}`;
    const limit = formState[key] ?? 0;
    updateQuotaMutation.mutate({ feature, tier, dailyLimit: limit });
  };

  const features = [
    {
      code: 'WRITING_ASSISTANT',
      name: 'Trợ Lý Luyện Viết AI (Writing Assistant)',
      description: 'Chấm điểm tự động và sửa lỗi ngữ pháp bài viết IELTS/TOEIC theo thời gian thực.',
      icon: <PenTool size={20} className="text-amber-600" />,
    },
    {
      code: 'DICTIONARY_LOOKUP',
      name: 'Tra Cứu Từ Điển & Ngữ Cảnh AI (Dictionary Lookup)',
      description: 'Sinh ví dụ song ngữ, giải thích nghĩa chuyên sâu và phát âm bằng AI.',
      icon: <BookOpen size={20} className="text-blue-600" />,
    },
    {
      code: 'CHAT_TUTOR',
      name: 'Gia Sư Đàm Thoại AI (Chat Tutor)',
      description: 'Hội thoại phản xạ tình huống trực tiếp với gia sư ảo bằng tiếng Anh/Việt.',
      icon: <MessageSquare size={20} className="text-emerald-600" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Cấu Hình Hạn Mức Quota AI
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Thiết lập số lượt sử dụng tối đa trong ngày cho từng tính năng AI theo nhóm tài khoản Free và VIP. Mọi thay đổi đều được lưu vết trong Nhật ký kiểm toán.
        </p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
          Đang tải cấu hình định mức Quota AI...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {features.map((feat) => {
            const freeKey = `${feat.code}_FREE`;
            const vipKey = `${feat.code}_VIP`;
            const freeVal = formState[freeKey] ?? 0;
            const vipVal = formState[vipKey] ?? 0;

            return (
              <div
                key={feat.code}
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-5"
              >
                {/* Title & Description */}
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 shrink-0">
                    {feat.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {feat.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {feat.description}
                    </p>
                  </div>
                </div>

                {/* Quota Control Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Free Tier */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Nhóm Miễn Phí (FREE)
                      </span>
                      <span className="text-[11px] font-medium text-gray-500">
                        Chu kỳ: 24 giờ
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={freeVal}
                        onChange={(e) =>
                          handleInputChange(feat.code, 'FREE', Number(e.target.value))
                        }
                        className="flex-1 text-sm font-semibold px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-xs text-gray-500 font-medium">
                        lượt / ngày
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSave(feat.code, 'FREE')}
                        disabled={updateQuotaMutation.isPending}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                      >
                        <Save size={14} />
                        <span>Lưu</span>
                      </button>
                    </div>
                  </div>

                  {/* VIP Tier */}
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                        <span>Gói Hội Viên (VIP / PREMIUM)</span>
                      </span>
                      <span className="text-[11px] font-medium text-amber-700">
                        Chu kỳ: 24 giờ
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={vipVal}
                        onChange={(e) =>
                          handleInputChange(feat.code, 'VIP', Number(e.target.value))
                        }
                        className="flex-1 text-sm font-semibold px-3 py-2 bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-xs text-amber-800 font-medium">
                        lượt / ngày
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSave(feat.code, 'VIP')}
                        disabled={updateQuotaMutation.isPending}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                      >
                        <Save size={14} />
                        <span>Lưu</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default QuotaSettingsPage;
