# Kế hoạch triển khai Giao diện Xác nhận Thanh toán

> **Dành cho agent:** KỸ NĂNG BẮT BUỘC: Sử dụng superpowers:subagent-driven-development (khuyên dùng) hoặc superpowers:executing-plans để triển khai kế hoạch này theo từng task. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi.

**Mục tiêu:** Tạo một Modal Xác nhận Thanh toán bắt mắt với tông màu Trắng - Cam, cho phép người dùng xem lại gói Premium đã chọn và chuyển hướng sang VNPay để hoàn tất thanh toán.

**Kiến trúc:** Chúng ta sẽ xây dựng một React Modal thuần bằng Tailwind CSS trong thư mục tính năng `premium`. Trang `PremiumUpgradePage` sẽ quản lý trạng thái (state) của gói được chọn. Khi người dùng bấm "Nâng cấp ngay", Modal mở lên hiển thị chi tiết và cung cấp nút "Thanh toán VNPay". Nút này sẽ gọi API backend `/api/v1/billing/vnpay/create-payment`.

**Công nghệ:** React, Tailwind CSS, Axios, Lucide React (chứa các biểu tượng).

**Tài liệu Đặc tả (Spec):** `docs/superpowers/specs/2026-10-09-vnpay-integration-AC.md`

## Các ràng buộc chung (Global Constraints)

- Giao diện: Sử dụng Trắng và Cam làm màu chủ đạo.
- API Endpoint: Gọi `POST /api/v1/billing/vnpay/create-payment` với body `{ planId, bankCode }`.
- Cấu trúc Frontend: Thiết kế theo Feature-based. Component dành cho premium phải được đặt vào `features/premium/components`.
- Không sử dụng thư viện Modal của bên thứ 3; chỉ sử dụng Tailwind CSS để làm overlay (lớp phủ).

## Trọng tâm Review

- Xử lý lỗi API: Cần làm gì nếu backend bị sập hoặc token hết hạn khi gọi tạo URL thanh toán? (Phải hiển thị cảnh báo lỗi rõ ràng trên UI).
- Chống bấm nút nhiều lần (Button spamming): Người dùng bấm liên tục nút thanh toán. (Phải disable nút và hiển thị vòng xoay loading).

---

### Task 1: Tạo Component PaymentConfirmationModal

**Các file:**
- Tạo mới: `frontend/src/features/premium/components/PaymentConfirmationModal.tsx`

**Giao tiếp (Interfaces):**
- Đầu vào: Đối tượng Plan (id, name, price, durationDays), `isOpen` (boolean), `onClose` (function)
- Đầu ra: Trả về một React Component render khung Modal hiển thị thông tin.

- [ ] **Bước 1: Khởi tạo cấu trúc Modal cơ bản**

Tạo file `PaymentConfirmationModal.tsx` với backdrop bán trong suốt và một thẻ card màu trắng, điểm xuyết màu cam.

```tsx
import React, { useState } from 'react';
import { X, ShieldCheck, CreditCard, Loader2 } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !plan) return null;

  const handlePayment = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axiosClient.post('/v1/billing/vnpay/create-payment', {
        planId: plan.id,
        bankCode: 'NCB' // Mã ngân hàng test
      });
      if (response.data?.data?.paymentUrl) {
        window.location.href = response.data.data.paymentUrl;
      } else {
        setError('Không nhận được đường dẫn thanh toán. Vui lòng thử lại.');
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi tạo thanh toán.');
      setIsLoading(false);
    }
  };

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="relative h-24 bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full p-1 transition">
            <X size={20} />
          </button>
          <ShieldCheck size={48} className="text-white drop-shadow-md" />
        </div>
        
        <div className="p-6">
          <h3 className="text-2xl font-bold text-center text-slate-800 mb-2">Xác nhận thanh toán</h3>
          <p className="text-center text-slate-500 text-sm mb-6">Vui lòng kiểm tra lại thông tin gói cước của bạn.</p>
          
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6">
            <div className="flex justify-between items-center mb-3 border-b border-orange-200/50 pb-3">
              <span className="text-slate-600 font-medium">Gói cước</span>
              <span className="text-slate-900 font-bold">{plan.name}</span>
            </div>
            <div className="flex justify-between items-center mb-3 border-b border-orange-200/50 pb-3">
              <span className="text-slate-600 font-medium">Thời hạn</span>
              <span className="text-slate-900 font-bold">{plan.durationDays} ngày</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Tổng thanh toán</span>
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
            {isLoading ? 'Đang tạo giao dịch...' : 'Thanh toán qua VNPay'}
          </button>
          
          <p className="mt-4 text-xs text-center text-slate-400 flex items-center justify-center">
            Bạn sẽ được chuyển hướng tới cổng thanh toán an toàn VNPay.
          </p>
        </div>
      </div>
    </div>
  );
};
```

### Task 2: Tích hợp Modal vào PremiumUpgradePage

**Các file:**
- Thay đổi: `frontend/src/features/premium/pages/PremiumUpgradePage.tsx`

**Giao tiếp (Interfaces):**
- Sử dụng: Component `PaymentConfirmationModal`.

- [ ] **Bước 1: Import Modal và khai báo state**

Mở `frontend/src/features/premium/pages/PremiumUpgradePage.tsx`. Thêm các biến state để quản lý trạng thái mở/đóng Modal và lưu giữ thông tin gói cước đang được chọn.

- [ ] **Bước 2: Cập nhật sự kiện click của nút 'Nâng cấp ngay'**

Sửa `onClick` của các nút chọn gói cước để gọi hàm mở modal, đồng thời truyền dữ liệu gói cước tương ứng vào state.

- [ ] **Bước 3: Hiển thị Component Modal**

Thêm thẻ `<PaymentConfirmationModal />` vào cuối JSX được trả về, đồng thời truyền các biến state vào dưới dạng props.

```tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Info, Shield, Zap, Sparkles } from 'lucide-react';
import axiosClient from '../../../core/api/axiosClient';
import { PaymentConfirmationModal } from '../components/PaymentConfirmationModal';

// ... (giữ nguyên fetchPlans)

const PremiumUpgradePage = () => {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ... (giữ nguyên useQuery và formatVND)

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ... (giữ nguyên JSX) ... */}
      
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className={`mt-4 w-full font-semibold py-3 px-4 rounded-full transition-colors ${isHighlighted
                      ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-md hover:shadow-lg'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                  >
                    Nâng cấp ngay
                  </button>

      {/* ... (giữ nguyên JSX) ... */}
      
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
```
