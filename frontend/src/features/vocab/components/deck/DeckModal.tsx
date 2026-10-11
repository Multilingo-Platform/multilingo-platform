import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CreateDeckRequest, DeckSummary } from '../../types/vocab.types';
import { SUPPORTED_LANGUAGES } from '../../types/vocab.types';

/**
 * Interface định nghĩa các thuộc tính (Props) cho component DeckModal:
 * - isOpen: Trạng thái hiển thị modal (true: mở, false: đóng)
 * - onClose: Hàm callback đóng modal
 * - onSubmit: Hàm callback bất đồng bộ gửi dữ liệu tạo mới hoặc cập nhật bộ thẻ
 * - initialData: Dữ liệu bộ thẻ hiện có nếu đang ở chế độ chỉnh sửa (null nếu tạo mới)
 */
export interface DeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDeckRequest) => Promise<void>;
  initialData?: DeckSummary | null;
}

/**
 * Component DeckModal (Hộp thoại Tạo mới / Chỉnh sửa Bộ thẻ từ vựng)
 *
 * ĐẶC ĐIỂM KỸ THUẬT:
 * 1. Sử dụng React Portal (`createPortal`) để mount trực tiếp vào `document.body`, đảm bảo z-index luôn nổi trên cùng.
 * 2. Tự động khóa cuộn trang (`overflow: hidden` trên body) khi mở modal để tránh cuộn nền.
 * 3. Hỗ trợ 2 chế độ (Create/Edit) tự động điền form dựa trên `initialData`.
 * 4. Kiểm tra dữ liệu hợp lệ (Validation) trước khi gọi API lưu trữ.
 */
export const DeckModal: React.FC<DeckModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const { t } = useTranslation();

  // --- Các State quản lý dữ liệu Form nhập liệu ---
  const [name, setName] = useState('');                           // Tên bộ thẻ (bắt buộc)
  const [description, setDescription] = useState('');             // Mô tả mục tiêu học tập (tùy chọn)
  const [targetLanguage, setTargetLanguage] = useState('en');     // Ngôn ngữ cần học (mặc định: Tiếng Anh)
  const [sourceLanguage, setSourceLanguage] = useState('vi');     // Ngôn ngữ giải nghĩa (mặc định: Tiếng Việt)
  const [isPublic, setIsPublic] = useState(false);                 // Quyền riêng tư (chia sẻ công khai hoặc riêng tư)

  // --- State quản lý trạng thái tương tác ---
  const [loading, setLoading] = useState(false);                   // Trạng thái đang gửi request API
  const [error, setError] = useState<string | null>(null);          // Thông báo lỗi validate hoặc lỗi server

  /**
   * Effect 1: Tự động khởi tạo hoặc làm mới form khi modal mở ra
   * - Nếu có `initialData`: Điền thông tin cũ vào form để chỉnh sửa
   * - Nếu không: Reset form về trạng thái trắng ban đầu để tạo mới
   */
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setTargetLanguage(initialData.targetLanguage || 'en');
      setSourceLanguage(initialData.sourceLanguage || 'vi');
      setIsPublic(initialData.isPublic || false);
    } else {
      setName('');
      setDescription('');
      setTargetLanguage('en');
      setSourceLanguage('vi');
      setIsPublic(false);
    }
    setError(null);
  }, [initialData, isOpen]);

  /**
   * Effect 2: Khóa cuộn trang khi modal đang mở, tự động mở lại cuộn khi đóng modal
   */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  /**
   * Xử lý gửi Form tạo/sửa bộ thẻ:
   * - Validate tên bộ thẻ không được rỗng
   * - Bật loading spinner và gọi callback onSubmit
   * - Tự động đóng modal khi thành công, hoặc hiển thị lỗi nếu xảy ra sự cố
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError(t('vocab.deck_form.validation_name_required'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        targetLanguage,
        sourceLanguage,
        isPublic,
      });
      onClose();
    } catch (err: unknown) {
      console.error('Lỗi khi lưu bộ thẻ:', err);
      setError(
        err instanceof Error ? err.message : t('vocab.validation.save_error', 'Không thể lưu bộ thẻ. Vui lòng thử lại!')
      );
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-xl p-6 sm:p-7 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {initialData ? t('vocab.deck_form.title_edit') : t('vocab.deck_form.title_create')}
              </h2>
              <p className="text-sm text-slate-600 mt-0.5 font-medium">
                {t('vocab.deck_form.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {error && (
            <div className="p-3 text-sm rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-bold">
              {error}
            </div>
          )}

          {/* Tên bộ thẻ */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1.5">
              {t('vocab.deck_form.name_label')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('vocab.deck_form.name_placeholder')}
              maxLength={200}
              autoFocus
              className="w-full px-3.5 py-2 rounded-md border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1.5">
              {t('vocab.deck_form.desc_label')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('vocab.deck_form.desc_placeholder')}
              rows={3}
              maxLength={1000}
              className="w-full px-3.5 py-2 rounded-md border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Cặp ngôn ngữ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-md bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('vocab.deck_form.target_lang')}</span>
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={`target-${lang.code}`} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-500" />
                <span>{t('vocab.deck_form.source_lang')}</span>
              </label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={`source-${lang.code}`} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quyền riêng tư */}
          <label className="flex items-center gap-3 p-3 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500/20 border-slate-300"
            />
            <div className="text-sm">
              <span className="font-bold text-slate-900 block">{t('vocab.deck_form.public_share')}</span>
              <span className="text-xs text-slate-600 font-medium">{t('vocab.deck_form.public_desc')}</span>
            </div>
          </label>

          {/* Nút hành động */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-md text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              {t('vocab.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-md text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : t('vocab.actions.save')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default DeckModal;
