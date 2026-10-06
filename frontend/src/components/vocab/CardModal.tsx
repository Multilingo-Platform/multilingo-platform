import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CreateFlashcardRequest, Flashcard } from '../../types/vocab';
import { speakWord } from '../../utils/speech';
import './vocab.css';

/**
 * Interface định nghĩa các Props truyền vào cho Modal Thêm / Chỉnh sửa Thẻ từ vựng.
 */
interface CardModalProps {
  /** Trạng thái mở/đóng của Modal */
  isOpen: boolean;
  /** Hàm callback đóng Modal khi bấm nút Đóng hoặc bấm Hủy */
  onClose: () => void;
  /** Hàm callback gửi request lưu dữ liệu thẻ từ vựng lên Backend */
  onSubmit: (data: CreateFlashcardRequest) => Promise<void>;
  /** Dữ liệu thẻ hiện tại nếu là hành động chỉnh sửa (null/undefined nếu là tạo mới) */
  initialData?: Flashcard | null;
  /** Mã ngôn ngữ của từ vựng cần học trong bộ thẻ (ví dụ 'en', 'ko', 'zh') */
  targetLanguage: string;
  /** Mã ngôn ngữ giải nghĩa của người học (ví dụ 'vi', 'ko', 'en') */
  sourceLanguage: string;
}

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
 * Component Modal Thêm mới hoặc Cập nhật Thẻ từ vựng với giao diện 2 cột:
 * - Cột trái: Form nhập liệu đầy đủ (Từ vựng, Phiên âm IPA, Loại từ, Nghĩa, Câu ví dụ, Link ảnh).
 * - Cột phải: Live Flashcard Preview xem trước trực quan 2 mặt theo thời gian thực.
 * - Quy chuẩn UI: Hoàn toàn không dùng icon trang trí theo yêu cầu tinh gọn của người dùng.
 */
export const CardModal: React.FC<CardModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  targetLanguage,
  sourceLanguage,
}) => {
  // --- Quản lý State cho các trường thông tin của thẻ từ vựng ---
  const [customWord, setCustomWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [pos, setPos] = useState('');
  const [customMeaning, setCustomMeaning] = useState('');
  const [exampleSentence, setExampleSentence] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [previewSide, setPreviewSide] = useState<'FRONT' | 'BACK'>('FRONT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Đồng bộ dữ liệu vào Form mỗi khi mở Modal hoặc thay đổi initialData
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
    setError(null);
  }, [initialData, isOpen]);

  // Khóa cuộn trang khi Modal đang mở
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

  const handleSpeak = (e: React.MouseEvent, text: string) => {
    e.preventDefault();
    if (text.trim()) {
      speakWord(text.trim(), targetLanguage);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customWord.trim()) {
      setError('Vui lòng nhập từ vựng cần lưu');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await onSubmit({
        customWord: customWord.trim(),
        phonetic: phonetic.trim() || undefined,
        pos: pos.trim() || undefined,
        customMeaning: customMeaning.trim() || undefined,
        exampleSentence: exampleSentence.trim() || undefined,
        customImageUrl: customImageUrl.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu thẻ từ vựng:', err);
      if (err?.response?.status === 409) {
        setError('Từ vựng này đã tồn tại trong bộ thẻ (hệ thống không phân biệt chữ hoa/thường).');
      } else {
        setError(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu thẻ từ vựng');
      }
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="vocab-modal-backdrop" onClick={onClose}>
      <div
        className="vocab-modal-card vocab-modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- Header của Modal --- */}
        <div className="vocab-modal-header">
          <div className="vocab-modal-header-info">
            <span className="vocab-modal-main-title">
              {initialData ? 'Chỉnh sửa thẻ từ vựng' : 'Thêm thẻ từ vựng mới'}
            </span>
            <span className="vocab-modal-lang-pair">
              [{targetLanguage.toUpperCase()} ➔ {sourceLanguage.toUpperCase()}]
            </span>
          </div>
          <button
            onClick={onClose}
            className="vocab-modal-close-text-btn"
            title="Đóng hộp thoại"
          >
            Đóng [✕]
          </button>
        </div>

        {/* Khối hiển thị thông báo lỗi nếu có */}
        {error && (
          <div className="vocab-error-banner">
            {error}
          </div>
        )}

        {/* --- Bố cục 2 cột: Trái là Form, Phải là Live Preview --- */}
        <div className="vocab-modal-split-layout">
          {/* CỘT TRÁI: FORM NHẬP LIỆU */}
          <form id="vocab-card-form" onSubmit={handleSubmit} className="vocab-modal-left-col">
            {/* 1. Từ vựng & Nút phát âm */}
            <div className="vocab-form-group">
              <label className="vocab-form-label">
                <span>Từ vựng ({targetLanguage.toUpperCase()}) <span style={{ color: '#ef4444' }}>*</span></span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  className="vocab-form-input"
                  style={{ paddingRight: '5.5rem' }}
                  placeholder="Ví dụ: ephemeral, ubiquitous..."
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value)}
                  maxLength={150}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={(e) => handleSpeak(e, customWord)}
                  disabled={!customWord.trim()}
                  className="vocab-input-inline-btn"
                >
                  Nghe đọc
                </button>
              </div>
            </div>

            {/* 2. Hàng đôi: Phiên âm (IPA) & Loại từ (POS) */}
            <div className="vocab-form-row-2col">
              <div className="vocab-form-group">
                <label className="vocab-form-label">
                  <span>Phiên âm (IPA)</span>
                </label>
                <input
                  type="text"
                  className="vocab-form-input"
                  placeholder="Ví dụ: /juːˈbɪk.wɪ.təs/"
                  value={phonetic}
                  onChange={(e) => setPhonetic(e.target.value)}
                  maxLength={150}
                />
              </div>

              <div className="vocab-form-group">
                <label className="vocab-form-label">
                  <span>Loại từ</span>
                </label>
                <select
                  className="vocab-form-input vocab-form-select"
                  value={pos}
                  onChange={(e) => setPos(e.target.value)}
                >
                  {POS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Nghĩa từ vựng */}
            <div className="vocab-form-group">
              <div className="vocab-form-label">
                <span>Nghĩa ({sourceLanguage.toUpperCase()}) <span style={{ color: '#ef4444' }}>*</span></span>
                <span className="vocab-label-hint">
                  Tự động trích xuất nếu để trống
                </span>
              </div>
              <textarea
                className="vocab-form-textarea"
                rows={2}
                placeholder="Nhập nghĩa giải thích (hoặc để trống để bốc nghĩa từ từ điển gốc)..."
                value={customMeaning}
                onChange={(e) => setCustomMeaning(e.target.value)}
              />
            </div>

            {/* 4. Câu ví dụ minh họa */}
            <div className="vocab-form-group">
              <label className="vocab-form-label">
                <span>Câu ví dụ minh họa ngữ cảnh</span>
              </label>
              <textarea
                className="vocab-form-textarea"
                rows={2}
                placeholder="Ví dụ: Smartphones have become ubiquitous in modern life."
                value={exampleSentence}
                onChange={(e) => setExampleSentence(e.target.value)}
              />
            </div>

            {/* 5. Link ảnh minh họa */}
            <div className="vocab-form-group">
              <label className="vocab-form-label">
                <span>Link ảnh minh họa (tùy chọn)</span>
              </label>
              <input
                type="url"
                className="vocab-form-input"
                placeholder="https://images.unsplash.com/..."
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
              />
            </div>
          </form>

          {/* CỘT PHẢI: LIVE FLASHCARD PREVIEW */}
          <div className="vocab-modal-right-col">
            <div className="vocab-preview-header">
              <span className="vocab-preview-heading">XEM TRƯỚC THẺ HỌC</span>
              <button
                type="button"
                onClick={() => setPreviewSide(previewSide === 'FRONT' ? 'BACK' : 'FRONT')}
                className="vocab-preview-switch-btn"
              >
                {previewSide === 'FRONT' ? 'Xem Mặt sau ➔' : '➔ Xem Mặt trước'}
              </button>
            </div>

            {/* Khung thẻ học Live Preview */}
            <div className={`vocab-live-card-box ${previewSide.toLowerCase()}`}>
              <div className="vocab-live-card-badge">
                {previewSide === 'FRONT' ? 'MẶT TRƯỚC' : 'MẶT SAU'}
              </div>

              {previewSide === 'FRONT' ? (
                /* Mặt trước thẻ */
                <div className="vocab-preview-content">
                  {customImageUrl ? (
                    <div className="vocab-preview-img-frame">
                      <img
                        src={customImageUrl}
                        alt="Minh họa"
                        className="vocab-preview-img"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="vocab-preview-word-row">
                    <span className="vocab-preview-word-text">
                      {customWord.trim() || 'Từ vựng'}
                    </span>
                  </div>

                  <div className="vocab-preview-meta-row">
                    {phonetic && (
                      <span className="vocab-preview-phonetic-text">{phonetic}</span>
                    )}
                    {pos && (
                      <span className="vocab-preview-pos-badge">{pos.toLowerCase()}</span>
                    )}
                  </div>

                  {customWord.trim() && (
                    <button
                      type="button"
                      onClick={(e) => handleSpeak(e, customWord)}
                      className="vocab-preview-listen-btn"
                    >
                      Nghe phát âm
                    </button>
                  )}
                </div>
              ) : (
                /* Mặt sau thẻ */
                <div className="vocab-preview-content back">
                  <div className="vocab-preview-meaning-section">
                    <span className="vocab-preview-sublabel">Định nghĩa:</span>
                    <p className="vocab-preview-meaning-text">
                      {customMeaning.trim() || 'Định nghĩa giải thích từ vựng sẽ hiển thị tại đây...'}
                    </p>
                  </div>

                  {exampleSentence && (
                    <div className="vocab-preview-example-section">
                      <span className="vocab-preview-sublabel">Ví dụ ngữ cảnh:</span>
                      <p className="vocab-preview-example-text">
                        "{exampleSentence}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="vocab-preview-hint">
              Thẻ xem trước tự động cập nhật theo thời gian thực khi bạn nhập thông tin.
            </p>
          </div>
        </div>

        {/* --- Footer Modal Action Buttons --- */}
        <div className="vocab-modal-actions">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="vocab-btn-secondary"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="vocab-card-form"
            disabled={loading}
            className="vocab-btn-primary"
          >
            {loading ? 'Đang lưu...' : initialData ? 'Lưu thay đổi' : 'Thêm từ này'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
