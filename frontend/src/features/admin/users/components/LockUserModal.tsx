import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { AdminUser } from '../../types/adminTypes';

interface LockUserModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: number, isActive: boolean, reason: string) => void;
  isLoading: boolean;
}

export const LockUserModal: React.FC<LockUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !user) return null;

  const isLocking = user.isActive;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocking && !reason.trim()) {
      setError('Vui lòng nhập lý do khóa tài khoản học viên');
      return;
    }
    setError('');
    onConfirm(user.id, !isLocking, reason);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isLocking
                  ? 'bg-red-50 text-red-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <AlertTriangle size={18} />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              {isLocking ? 'Xác Nhận Khóa Tài Khoản' : 'Mở Khóa Tài Khoản'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-sm text-gray-600">
            {isLocking ? (
              <p>
                Bạn sắp khóa tài khoản của học viên{' '}
                <strong className="text-gray-900">{user.fullName || user.email}</strong>.
                Hệ thống sẽ thu hồi toàn bộ phiên làm việc của học viên này ngay lập tức.
              </p>
            ) : (
              <p>
                Bạn có chắc chắn muốn mở khóa cho tài khoản{' '}
                <strong className="text-gray-900">{user.fullName || user.email}</strong>?
                Học viên sẽ có thể đăng nhập và tiếp tục học tập bình thường.
              </p>
            )}
          </div>

          {isLocking && (
            <div>
              <label
                htmlFor="lockReason"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Lý do khóa tài khoản <span className="text-red-500">*</span>
              </label>
              <textarea
                id="lockReason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Ví dụ: Nghi ngờ chia sẻ tài khoản đăng nhập trên nhiều thiết bị..."
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              />
              {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors shadow-xs ${
                isLocking
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isLoading
                ? 'Đang xử lý...'
                : isLocking
                ? 'Khóa tài khoản'
                : 'Mở khóa tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
