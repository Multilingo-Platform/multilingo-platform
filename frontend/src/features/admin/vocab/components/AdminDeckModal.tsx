import React, { useState, useEffect } from 'react';
import { X, BookOpen } from 'lucide-react';
import type { AdminDeck, CreateDeckPayload, UpdateDeckPayload } from '../types/adminVocab.types';

interface AdminDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDeckPayload | UpdateDeckPayload) => void;
  initialData?: AdminDeck | null;
  isLoading?: boolean;
}

export const AdminDeckModal: React.FC<AdminDeckModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}) => {
  const isEdit = !!initialData;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [sourceLanguage, setSourceLanguage] = useState('vi');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setTargetLanguage(initialData.targetLanguage || 'en');
      setSourceLanguage(initialData.sourceLanguage || 'vi');
      setIsPublic(initialData.isPublic ?? true);
    } else {
      setName('');
      setDescription('');
      setTargetLanguage('en');
      setSourceLanguage('vi');
      setIsPublic(true);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên bộ thẻ từ vựng');
      return;
    }
    if (name.trim().length > 200) {
      setError('Tên bộ thẻ không được vượt quá 200 ký tự');
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      targetLanguage,
      sourceLanguage,
      isPublic,
    });
  };

  return (
    <div className="fixed inset-0 z-[1050] overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50/50 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <BookOpen size={19} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isEdit ? 'Chỉnh Sửa Bộ Thẻ Từ Vựng' : 'Tạo Bộ Thẻ Từ Vựng Mới'}
              </h3>
              <p className="text-xs text-gray-500">
                {isEdit ? `Cập nhật thông tin bộ thẻ #${initialData?.id}` : 'Thêm bộ thẻ chính thức vào thư viện hệ thống'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Tên bộ thẻ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="VD: 500 Từ Vựng TOEIC Căn Bản, Oxford 3000..."
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-800"
              maxLength={200}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Mô tả nội dung & mục tiêu
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú chi tiết về đối tượng người học, chủ đề trọng tâm..."
              rows={3}
              maxLength={1000}
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-800"
            />
          </div>

          {/* Languages Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Ngôn ngữ học (Đích)
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-700"
              >
                <option value="en">🇬🇧 Tiếng Anh (en)</option>
                <option value="vi">🇻🇳 Tiếng Việt (vi)</option>
                <option value="ja">🇯🇵 Tiếng Nhật (ja)</option>
                <option value="ko">🇰🇷 Tiếng Hàn (ko)</option>
                <option value="zh">🇨🇳 Tiếng Trung (zh)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Ngôn ngữ giải nghĩa (Nguồn)
              </label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-700"
              >
                <option value="vi">🇻🇳 Tiếng Việt (vi)</option>
                <option value="en">🇬🇧 Tiếng Anh (en)</option>
              </select>
            </div>
          </div>

          {/* Public Toggle Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-orange-300 bg-gray-50/50 hover:bg-orange-50/20 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-gray-800">
                  Công khai bộ thẻ (Public)
                </span>
                <p className="text-gray-500 mt-0.5">
                  Tất cả học viên đều có thể tìm thấy, xem và sao chép bộ thẻ này vào tài khoản cá nhân.
                </p>
              </div>
            </label>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl font-medium transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>{isEdit ? 'Lưu Thay Đổi' : 'Tạo Bộ Thẻ'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
