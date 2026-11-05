import React from 'react';
import { X, CheckCircle2, Clock, AlertTriangle, HelpCircle, FileCheck2, Cpu, ListOrdered } from 'lucide-react';

export interface AttemptStatusMeta {
  key: string;
  label: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  barColor: string;
  description: string;
  icon: React.ReactNode;
}

export const ATTEMPT_STATUS_DEFINITIONS: AttemptStatusMeta[] = [
  {
    key: 'COMPLETED',
    label: 'Đã hoàn thành',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    badgeText: 'text-emerald-700',
    dotColor: 'bg-emerald-500',
    barColor: 'bg-emerald-500',
    description: 'Học viên đã nộp bài thành công và hệ thống đã chấm điểm hoàn tất kết quả.',
    icon: <CheckCircle2 size={16} className="text-emerald-600" />,
  },
  {
    key: 'IN_PROGRESS',
    label: 'Đang làm bài',
    badgeBg: 'bg-amber-50 border-amber-200',
    badgeText: 'text-amber-700',
    dotColor: 'bg-amber-500',
    barColor: 'bg-amber-500',
    description: 'Học viên đã bấm bắt đầu mở bài thi nhưng chưa nhấn nộp, bài làm đang diễn ra hoặc bị bỏ dở giữa chừng.',
    icon: <Clock size={16} className="text-amber-600" />,
  },
  {
    key: 'EXPIRED',
    label: 'Quá hạn / Hết giờ',
    badgeBg: 'bg-rose-50 border-rose-200',
    badgeText: 'text-rose-700',
    dotColor: 'bg-rose-500',
    barColor: 'bg-rose-500',
    description: 'Đã hết thời gian làm bài theo quy chuẩn của đề thi mà học viên không bấm nộp bài kịp thời.',
    icon: <AlertTriangle size={16} className="text-rose-600" />,
  },
  {
    key: 'SUBMITTED',
    label: 'Đã nộp bài',
    badgeBg: 'bg-blue-50 border-blue-200',
    badgeText: 'text-blue-700',
    dotColor: 'bg-blue-500',
    barColor: 'bg-blue-500',
    description: 'Bài thi đã được ghi nhận nộp lên hệ thống, đang trong tiến trình chờ tính điểm hoặc chờ worker xử lý.',
    icon: <FileCheck2 size={16} className="text-blue-600" />,
  },
  {
    key: 'AI_GRADING',
    label: 'AI đang chấm điểm',
    badgeBg: 'bg-purple-50 border-purple-200',
    badgeText: 'text-purple-700',
    dotColor: 'bg-purple-500',
    barColor: 'bg-purple-500',
    description: 'Bài làm phần tự luận / Writing đang được mô hình AI phân tích và chấm điểm chi tiết.',
    icon: <Cpu size={16} className="text-purple-600" />,
  },
  {
    key: 'AI_GRADING_QUEUED',
    label: 'Chờ hàng đợi AI',
    badgeBg: 'bg-indigo-50 border-indigo-200',
    badgeText: 'text-indigo-700',
    dotColor: 'bg-indigo-500',
    barColor: 'bg-indigo-500',
    description: 'Bài làm đang nằm trong hàng đợi xử lý nền, chờ tài nguyên API AI chấm bài.',
    icon: <ListOrdered size={16} className="text-indigo-600" />,
  },
  {
    key: 'GRADING_FAILED',
    label: 'Lỗi chấm điểm',
    badgeBg: 'bg-red-50 border-red-200',
    badgeText: 'text-red-700',
    dotColor: 'bg-red-500',
    barColor: 'bg-red-500',
    description: 'Quá trình chấm điểm tự động gặp sự cố kỹ thuật hoặc lỗi kết nối dịch vụ ngoài, cần quản trị viên kiểm tra.',
    icon: <AlertTriangle size={16} className="text-red-600" />,
  },
];

interface AttemptsStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusMap?: Record<string, number>;
  totalValid?: number;
}

export const AttemptsStatusModal: React.FC<AttemptsStatusModalProps> = ({
  isOpen,
  onClose,
  statusMap = {},
  totalValid = 0,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-amber-50/60 to-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
              <h3 className="text-lg font-bold text-gray-900">
                Thống Kê Chi Tiết Trạng Thái Lượt Làm Bài
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
              <span>Hệ thống kiểm tra trực tuyến (CBT)</span>
              <span>•</span>
              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded font-medium">
                Chỉ tính đề thi còn tồn tại trên hệ thống
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content body with custom scroll */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top highlight stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
              <span className="text-xs font-medium text-amber-800">Tổng Lượt Hợp Lệ</span>
              <div className="text-2xl font-bold text-amber-950 mt-1">
                {totalValid.toLocaleString()}
              </div>
              <p className="text-[11px] text-amber-700 mt-0.5">Lượt thi toàn hệ thống</p>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5">
              <span className="text-xs font-medium text-emerald-800">Đã Hoàn Thành</span>
              <div className="text-2xl font-bold text-emerald-950 mt-1">
                {(statusMap.COMPLETED ?? 0).toLocaleString()}
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                {totalValid > 0
                  ? `${Math.round(((statusMap.COMPLETED ?? 0) / totalValid) * 1000) / 10}% tỷ lệ nộp bài`
                  : '0% tỷ lệ nộp bài'}
              </p>
            </div>

            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5">
              <span className="text-xs font-medium text-blue-800">Đang Xử Lý / Thi Dở</span>
              <div className="text-2xl font-bold text-blue-950 mt-1">
                {(
                  (statusMap.IN_PROGRESS ?? 0) +
                  (statusMap.SUBMITTED ?? 0) +
                  (statusMap.AI_GRADING ?? 0)
                ).toLocaleString()}
              </div>
              <p className="text-[11px] text-blue-700 mt-0.5">Chưa hoàn tất chấm điểm</p>
            </div>
          </div>

          {/* Detailed distribution list */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
              <span>Phân Bổ Số Lượng Theo Từng Trạng Thái</span>
            </h4>

            <div className="space-y-2.5">
              {ATTEMPT_STATUS_DEFINITIONS.map((status) => {
                const count = statusMap[status.key] ?? 0;
                const percentage = totalValid > 0 ? (count / totalValid) * 100 : 0;
                const percentStr = Math.round(percentage * 10) / 10;

                return (
                  <div
                    key={status.key}
                    className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${status.dotColor}`} />
                        <span className="font-semibold text-gray-900">{status.label}</span>
                        <code className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded font-mono">
                          {status.key}
                        </code>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-gray-900 text-sm">
                          {count.toLocaleString()}
                        </span>
                        <span className="text-gray-400 text-xs font-medium">({percentStr}%)</span>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200/70 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${status.barColor} transition-all duration-300 rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Business Definitions Guide */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
              <HelpCircle size={14} className="text-amber-600" />
              <span>Chú Thích Ý Nghĩa Nghiệp Vụ Từng Trạng Thái</span>
            </h4>

            <div className="grid grid-cols-1 gap-2.5">
              {ATTEMPT_STATUS_DEFINITIONS.map((status) => (
                <div
                  key={`guide-${status.key}`}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-150 hover:border-amber-200 transition-colors text-xs"
                >
                  <div className="p-1.5 rounded-lg bg-gray-50 border border-gray-100 shrink-0 mt-0.5">
                    {status.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-gray-900">{status.label}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.badgeBg} ${status.badgeText}`}
                      >
                        {status.key}
                      </span>
                    </div>
                    <p className="text-gray-600 text-[11.5px] leading-relaxed">
                      {status.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between text-xs text-gray-500">
          <span>Dữ liệu tự động cập nhật theo thời gian thực</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

