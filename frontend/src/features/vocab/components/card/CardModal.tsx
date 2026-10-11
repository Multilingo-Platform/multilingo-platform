import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CreateFlashcardRequest, Flashcard } from '../../types/vocab.types';
import { speakWord } from '../../../../utils/speech';
import { alertUtil } from '../../../../utils/alert';

/**
 * Interface định nghĩa các thuộc tính (Props) cho component CardModal:
 * - isOpen: Trạng thái hiển thị modal
 * - onClose: Hàm callback đóng modal
 * - onSubmit: Hàm callback bất đồng bộ gửi dữ liệu thẻ từ vựng lên backend
 * - initialData: Dữ liệu thẻ hiện tại nếu đang chỉnh sửa (null nếu thêm mới)
 * - targetLanguage: Ngôn ngữ của từ vựng (dùng để phát âm Text-to-Speech chuẩn xác)
 * - sourceLanguage: Ngôn ngữ dịch nghĩa của từ
 */
export interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateFlashcardRequest) => Promise<void>;
  initialData?: Flashcard | null;
  targetLanguage: string;
  sourceLanguage: string;
}

/**
 * Danh sách các loại từ ngữ pháp phổ biến (Parts of Speech - POS)
 * hỗ trợ học viên phân loại từ vựng chính xác
 */
const POS_OPTIONS = [
  { value: '', label: '-- Chọn loại từ --' },
  { value: 'noun', label: 'Danh từ (noun)' },
  { value: 'verb', label: 'Động từ (verb)' },
  { value: 'adjective', label: 'Tính từ (adj)' },
  { value: 'adverb', label: 'Trạng từ (adv)' },
  { value: 'preposition', label: 'Giới từ (prep)' },
  { value: 'conjunction', label: 'Liên từ (conj)' },
  { value: 'phrase', label: 'Cụm từ (phrase)' },
  { value: 'idiom', label: 'Thành ngữ (idiom)' },
];

/**
 * Chuyển đổi loại từ (Part of Speech) sang dạng viết tắt chữ thường không có dấu chấm (n, v, adj, adv...)
 */
const formatPosShort = (pos?: string): string => {
  if (!pos) return '';
  const clean = pos.toLowerCase().trim().replace(/\.+$/, '');
  switch (clean) {
    case 'noun':
    case 'n':
      return 'n';
    case 'verb':
    case 'v':
      return 'v';
    case 'adjective':
    case 'adj':
      return 'adj';
    case 'adverb':
    case 'adv':
      return 'adv';
    case 'preposition':
    case 'prep':
      return 'prep';
    case 'conjunction':
    case 'conj':
      return 'conj';
    case 'interjection':
    case 'interj':
      return 'interj';
    case 'pronoun':
    case 'pron':
      return 'pron';
    case 'phrase':
    case 'phr':
      return 'phr';
    case 'idiom':
    case 'idm':
      return 'idm';
    default:
      return clean;
  }
};

/**
 * Component CardModal (Hộp thoại Thêm mới / Chỉnh sửa Thẻ từ vựng)
 *
 * CÁC TÍNH NĂNG NỔI BẬT:
 * 1. Bố cục 2 cột trực quan: Cột trái là Form nhập liệu chi tiết, Cột phải là Live Preview thẻ Flashcard 2 mặt.
 * 2. Tích hợp Text-to-Speech (Web Speech API) trực tiếp trong form qua nút "Nghe thử phát âm".
 * 3. Cho phép người dùng nhấp vào thẻ xem trước bên phải để lật qua lại giữa Mặt Trước và Mặt Sau.
 * 4. Thông báo lỗi validation ngay dưới từng trường nhập liệu cụ thể.
 */
export const CardModal: React.FC<CardModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  targetLanguage,
}) => {
  const { t } = useTranslation();

  // --- Các State quản lý dữ liệu Form Thẻ từ vựng ---
  const [customWord, setCustomWord] = useState('');                 // Từ vựng gốc (bắt buộc)
  const [phonetic, setPhonetic] = useState('');                     // Phiên âm chuẩn quốc tế IPA (tùy chọn)
  const [pos, setPos] = useState('');                               // Loại từ (noun, verb, adj...)
  const [customMeaning, setCustomMeaning] = useState('');           // Ý nghĩa từ vựng (bắt buộc)
  const [exampleSentence, setExampleSentence] = useState('');       // Câu ví dụ minh họa ngữ cảnh
  const [customImageUrl, setCustomImageUrl] = useState('');         // Đường dẫn ảnh minh họa (nếu có)

  // --- State quản lý mặt hiển thị của khung Live Preview ('FRONT' hoặc 'BACK') ---
  const [previewSide, setPreviewSide] = useState<'FRONT' | 'BACK'>('FRONT');

  // --- State trạng thái gửi API & Lỗi validation theo từng trường ---
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ word?: string; meaning?: string }>({});

  /**
   * Effect: Đồng bộ dữ liệu khi mở modal hoặc thay đổi initialData
   */
  useEffect(() => {
    if (initialData) {
      setCustomWord(initialData.customWord || '');
      setPhonetic(initialData.phonetic || '');
      setPos(initialData.pos || '');
      setCustomMeaning(initialData.customMeaning || '');
      setExampleSentence(initialData.exampleSentence || '');
      setCustomImageUrl(initialData.customImageUrl || '');
    } else {
      setCustomWord('');
      setPhonetic('');
      setPos('');
      setCustomMeaning('');
      setExampleSentence('');
      setCustomImageUrl('');
    }
    setPreviewSide('FRONT');
    setFieldErrors({});
  }, [initialData, isOpen]);

  /**
   * Effect: Khóa cuộn trang nền khi modal đang mở
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
   * Hàm phát âm từ vựng mẫu phục vụ người dùng nghe thử âm thanh
   */
  const handleSpeak = (e: React.MouseEvent) => {
    e.preventDefault();
    if (customWord.trim()) {
      speakWord(customWord.trim(), targetLanguage);
    }
  };

  /**
   * Xử lý xác thực dữ liệu và submit form:
   * - Bắt buộc phải có Từ vựng và Ý nghĩa (báo lỗi ngay bên dưới trường)
   * - Tự động loại bỏ khoảng trắng thừa (trim)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { word?: string; meaning?: string } = {};
    if (!customWord.trim()) {
      newErrors.word = 'Vui lòng nhập từ vựng';
    }
    if (!customMeaning.trim()) {
      newErrors.meaning = 'Vui lòng nhập ý nghĩa từ vựng';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      setFieldErrors({});
      await onSubmit({
        customWord: customWord.trim(),
        customMeaning: customMeaning.trim(),
        phonetic: phonetic.trim() || undefined,
        pos: pos || undefined,
        exampleSentence: exampleSentence.trim() || undefined,
        customImageUrl: customImageUrl.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      console.error('Lỗi khi lưu thẻ từ vựng:', err);
      const message =
        err instanceof Error ? err.message : 'Không thể lưu thẻ từ vựng. Vui lòng thử lại!';
      alertUtil.popup(message, 'error', 'Lỗi lưu thẻ');
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
        className="bg-white w-full max-w-4xl rounded-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {initialData
                ? t('vocab.card_form.title_edit', 'Chỉnh sửa từ vựng')
                : t('vocab.card_form.title_create', 'Thêm từ vựng mới')}
            </h2>
            <p className="text-sm text-slate-600 mt-0.5 font-medium">
              {t('vocab.card_form.subtitle', 'Thêm thông tin ngữ cảnh, phiên âm và câu ví dụ để ghi nhớ sâu')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Layout 2 cột: Cột trái form, Cột phải live preview */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
          {/* Cột trái: Form nhập liệu (7 cột) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Từ vựng */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-bold text-slate-900">
                  {t('vocab.card_form.word_label', 'Từ vựng')} <span className="text-rose-500">*</span>
                </label>
                {customWord.trim() && (
                  <button
                    type="button"
                    onClick={handleSpeak}
                    className="text-amber-600 hover:text-amber-700 flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md hover:bg-amber-50 transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{t('vocab.card_form.listen_test', 'Nghe phát âm')}</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={customWord}
                onChange={(e) => {
                  setCustomWord(e.target.value);
                  if (fieldErrors.word) {
                    setFieldErrors((prev) => ({ ...prev, word: undefined }));
                  }
                }}
                placeholder={t('vocab.card_form.word_placeholder', 'VD: ubiquitous, diligent, ephemeral...')}
                maxLength={150}
                autoFocus
                className={`w-full px-3.5 py-2 rounded-lg border bg-white text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400 ${
                  fieldErrors.word
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-300 focus:border-amber-500 focus:ring-amber-500/20'
                }`}
              />
              {fieldErrors.word && (
                <p className="mt-1.5 text-xs text-rose-600 font-semibold animate-in fade-in duration-150">
                  {fieldErrors.word}
                </p>
              )}
            </div>

            {/* Phiên âm IPA & Loại từ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  {t('vocab.card_form.phonetic_label', 'Phiên âm IPA')}
                </label>
                <input
                  type="text"
                  value={phonetic}
                  onChange={(e) => setPhonetic(e.target.value)}
                  placeholder={t('vocab.card_form.phonetic_placeholder', "VD: /juːˈbɪk.wɪ.təs/")}
                  maxLength={100}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  {t('vocab.card_form.pos_label', 'Loại từ')}
                </label>
                <select
                  value={pos}
                  onChange={(e) => setPos(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
                >
                  <option value="">{t('vocab.card_form.pos_select', '-- Chọn loại từ --')}</option>
                  {POS_OPTIONS.filter((item) => item.value !== '').map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nghĩa của từ */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1.5">
                {t('vocab.card_form.meaning_label', 'Ý nghĩa từ vựng')} <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={customMeaning}
                onChange={(e) => {
                  setCustomMeaning(e.target.value);
                  if (fieldErrors.meaning) {
                    setFieldErrors((prev) => ({ ...prev, meaning: undefined }));
                  }
                }}
                placeholder={t('vocab.card_form.meaning_placeholder', 'Giải nghĩa rõ ràng bằng ngôn ngữ mẹ đẻ...')}
                rows={2}
                className={`w-full px-3.5 py-2 rounded-lg border bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 transition-all resize-none placeholder:text-slate-400 ${
                  fieldErrors.meaning
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-300 focus:border-amber-500 focus:ring-amber-500/20'
                }`}
              />
              {fieldErrors.meaning && (
                <p className="mt-1.5 text-xs text-rose-600 font-semibold animate-in fade-in duration-150">
                  {fieldErrors.meaning}
                </p>
              )}
            </div>

            {/* Câu ví dụ */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1.5">
                {t('vocab.card_form.example_label', 'Câu ví dụ')}
              </label>
              <textarea
                value={exampleSentence}
                onChange={(e) => setExampleSentence(e.target.value)}
                placeholder={t('vocab.card_form.example_placeholder', 'VD: Smartphones have become ubiquitous in daily life.')}
                rows={2}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Link ảnh minh họa (tùy chọn) */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1.5">
                Link ảnh minh họa (URL)
              </label>
              <input
                type="url"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... hoặc link ảnh online"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Cột phải: Live Flashcard Preview (5 cột) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 text-center">
              {t('vocab.card_form.live_preview_title', 'XEM TRƯỚC THẺ GHI NHỚ')}
            </span>

            {/* Thẻ Preview mini */}
            <div
              onClick={() => setPreviewSide((prev) => (prev === 'FRONT' ? 'BACK' : 'FRONT'))}
              className="w-full aspect-[4/3] rounded-2xl bg-white border border-slate-200 hover:border-amber-400 p-6 flex flex-col items-center justify-center text-center cursor-pointer shadow-xs hover:shadow-md transition-all select-none relative overflow-hidden group"
              title="Nhấp để lật xem mặt trước hoặc mặt sau"
            >
              {/* Nhãn nhỏ chỉ báo mặt trước / mặt sau */}
              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 group-hover:bg-amber-50 group-hover:text-amber-700 transition-colors">
                {previewSide === 'FRONT' ? 'Mặt trước' : 'Mặt sau'}
              </span>

              {previewSide === 'FRONT' ? (
                customWord.trim() ? (
                  <>
                    {customImageUrl && (
                      <img
                        src={customImageUrl}
                        alt={customWord}
                        className="w-16 h-16 object-cover rounded-lg mb-2 border border-slate-200 shadow-xs"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex items-baseline justify-center gap-1.5 flex-wrap">
                      <h3 className="text-2xl font-black text-slate-900 group-hover:text-amber-600 transition-colors break-words">
                        {customWord.trim()}
                      </h3>
                      {pos && (
                        <span className="text-sm font-medium text-slate-500 italic lowercase">
                          ({formatPosShort(pos)})
                        </span>
                      )}
                    </div>
                    {phonetic && (
                      <span className="text-sm text-slate-500 font-mono font-medium mt-1">
                        {phonetic}
                      </span>
                    )}
                  </>
                ) : (
                  /* Khi chưa nhập từ: để thẻ trắng sạch sẽ */
                  null
                )
              ) : (
                customMeaning.trim() ? (
                  <>
                    <p className="text-base sm:text-lg font-bold text-slate-900 break-words">
                      {customMeaning.trim()}
                    </p>
                    {exampleSentence && (
                      <p className="text-xs sm:text-sm text-slate-600 italic mt-3 line-clamp-3 font-medium">
                        "{exampleSentence}"
                      </p>
                    )}
                  </>
                ) : (
                  /* Khi chưa nhập ý nghĩa: để thẻ trắng sạch sẽ */
                  null
                )
              )}
            </div>

            <p className="text-xs text-slate-500 font-medium text-center mt-3">
              {t('vocab.card_form.preview_guide', 'Nhấp vào thẻ để lật xem mặt trước và mặt sau')}
            </p>
          </div>

          {/* Nút hành động */}
          <div className="lg:col-span-12 flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {t('vocab.actions.cancel', 'Hủy')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : t('vocab.actions.save', 'Lưu thẻ')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CardModal;
