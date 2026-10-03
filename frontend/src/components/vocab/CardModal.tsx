import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Volume2, Sparkles, Image, BookOpen } from 'lucide-react';
import type { CreateFlashcardRequest, Flashcard } from '../../types/vocab';
import { speakWord } from '../../utils/speech';
import './vocab.css';

/**
 * Interface định nghĩa các Props truyền vào cho Modal Thêm / Chỉnh sửa Thẻ từ vựng.
 */
interface CardModalProps {
  /** Trạng thái mở/đóng của Modal */
  isOpen: boolean;
  /** Hàm callback đóng Modal khi bấm nút X hoặc bấm Hủy */
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

/**
 * Component Modal Thêm mới hoặc Cập nhật Thẻ từ vựng cá nhân trong Bộ thẻ.
 *
 * TÍNH NĂNG CHÍNH:
 * 1. Hỗ trợ nhập từ vựng và nghe thử phát âm ngay lập tức qua Web Speech API.
 * 2. Cho phép bỏ trống customMeaning nếu từ có sẵn trong từ điển để Backend tự bốc nghĩa theo sourceLanguage.
 * 3. Bắt lỗi trùng lặp từ (HTTP 409 Conflict) và hiển thị thông báo thân thiện.
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
  const [customWord, setCustomWord] = useState('');           // Từ vựng gốc (Ví dụ: ubiquitous)
  const [customMeaning, setCustomMeaning] = useState('');     // Nghĩa cá nhân hoặc để trống để auto-extract
  const [exampleSentence, setExampleSentence] = useState(''); // Câu ví dụ minh họa ngữ cảnh
  const [customImageUrl, setCustomImageUrl] = useState('');   // Đường link ảnh minh họa
  const [loading, setLoading] = useState(false);              // Trạng thái đang gửi API
  const [error, setError] = useState<string | null>(null);    // Thông báo lỗi nếu có

  /**
   * Đồng bộ dữ liệu vào Form mỗi khi mở Modal hoặc thay đổi initialData (chuyển giữa Tạo mới <-> Sửa thẻ)
   */
  useEffect(() => {
    if (initialData) {
      // Chế độ chỉnh sửa: Nạp dữ liệu của thẻ đang chọn
      setCustomWord(initialData.customWord || '');
      setCustomMeaning(initialData.customMeaning || '');
      setExampleSentence(initialData.exampleSentence || '');
      setCustomImageUrl(initialData.customImageUrl || '');
    } else {
      // Chế độ tạo mới: Reset trắng toàn bộ các ô nhập
      setCustomWord('');
      setCustomMeaning('');
      setExampleSentence('');
      setCustomImageUrl('');
    }
    setError(null);
  }, [initialData, isOpen]);

  // Khóa cuộn trang khi Modal đang mở, tự động trả lại cuộn khi đóng
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

  // Nếu modal không ở trạng thái mở, không render gì vào DOM
  if (!isOpen) return null;

  /**
   * Xử lý phát âm từ vựng ngay tại Modal bằng Web Speech API
   * Sử dụng đúng giọng đọc theo targetLanguage của bộ thẻ
   */
  const handleSpeak = (e: React.MouseEvent) => {
    e.preventDefault();
    if (customWord.trim()) {
      speakWord(customWord.trim(), targetLanguage);
    }
  };

  /**
   * Xử lý submit form và gọi callback lưu dữ liệu lên Backend
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Kiểm tra validation bắt buộc: Từ vựng không được để trống
    if (!customWord.trim()) {
      setError('Vui lòng nhập từ vựng cần lưu');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 2. Gửi dữ liệu lên API Backend
      await onSubmit({
        customWord: customWord.trim(),
        customMeaning: customMeaning.trim() || undefined,
        exampleSentence: exampleSentence.trim() || undefined,
        customImageUrl: customImageUrl.trim() || undefined,
      });

      // 3. Đóng modal sau khi lưu thành công
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu thẻ từ vựng:', err);
      // Xử lý thông báo trực quan theo mã lỗi HTTP từ Backend
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
        className="vocab-modal-card"
        onClick={(e) => e.stopPropagation()} // Ngăn chặn sự kiện click lan ra ngoài gây đóng modal
      >
        {/* --- Header của Modal --- */}
        <div className="vocab-modal-header">
          <div className="vocab-modal-title">
            <div className="vocab-modal-title-icon">
              <BookOpen size={20} />
            </div>
            <span>{initialData ? 'Chỉnh sửa thẻ từ vựng' : 'Thêm thẻ từ vựng mới'}</span>
          </div>
          <button
            onClick={onClose}
            className="vocab-modal-close-btn"
            title="Đóng hộp thoại"
          >
            <X size={18} />
          </button>
        </div>

        {/* --- Nội dung Form nhập liệu --- */}
        <form onSubmit={handleSubmit} className="vocab-modal-form">
          {/* Khối hiển thị thông báo lỗi nếu có */}
          {error && (
            <div className="vocab-error-banner">
              {error}
            </div>
          )}

          {/* Ô nhập Từ vựng & Nút phát âm trực tiếp */}
          <div className="vocab-form-group">
            <label className="vocab-form-label">
              <span>Từ vựng ({targetLanguage.toUpperCase()}) <span style={{ color: '#ef4444' }}>*</span></span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                className="vocab-form-input"
                style={{ paddingRight: '3rem' }}
                placeholder="Ví dụ: ephemeral, ubiquitous, ..."
                value={customWord}
                onChange={(e) => setCustomWord(e.target.value)}
                maxLength={200}
                autoFocus
              />
              {/* Nút nghe phát âm giọng đọc bản xứ qua Web Speech API */}
              <button
                type="button"
                onClick={handleSpeak}
                disabled={!customWord.trim()}
                title="Nghe phát âm chuẩn giọng bản xứ"
                style={{
                  position: 'absolute',
                  right: '0.6rem',
                  padding: '0.4rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: customWord.trim() ? '#d97706' : '#d1d5db',
                  cursor: customWord.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Volume2 size={20} />
              </button>
            </div>
          </div>

          {/* Ô nhập Nghĩa của từ vựng */}
          <div className="vocab-form-group">
            <div className="vocab-form-label">
              <span>Nghĩa ({sourceLanguage.toUpperCase()})</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309' }}>
                Hỗ trợ tự động trích xuất
              </span>
            </div>
            <textarea
              className="vocab-form-textarea"
              rows={2}
              placeholder={`Nhập nghĩa giải thích (hoặc để trống nếu muốn hệ thống tự bốc nghĩa tiếng ${sourceLanguage.toUpperCase()} từ từ điển gốc)...`}
              value={customMeaning}
              onChange={(e) => setCustomMeaning(e.target.value)}
            />
          </div>

          {/* Ô nhập Câu ví dụ minh họa ngữ cảnh */}
          <div className="vocab-form-group">
            <label className="vocab-form-label">
              <span>Câu ví dụ minh họa (Ngữ cảnh sử dụng)</span>
            </label>
            <textarea
              className="vocab-form-textarea"
              rows={2}
              placeholder="Ví dụ: Smartphones have become ubiquitous in daily modern life."
              value={exampleSentence}
              onChange={(e) => setExampleSentence(e.target.value)}
            />
          </div>

          {/* Ô nhập Đường dẫn ảnh minh họa */}
          <div className="vocab-form-group">
            <label className="vocab-form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Image size={15} style={{ color: '#6b7280' }} /> Link ảnh minh họa (tùy chọn)
              </span>
            </label>
            <input
              type="url"
              className="vocab-form-input"
              placeholder="https://images.unsplash.com/..."
              value={customImageUrl}
              onChange={(e) => setCustomImageUrl(e.target.value)}
            />
          </div>

          {/* --- Các nút hành động phía dưới --- */}
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
              disabled={loading}
              className="vocab-btn-primary"
            >
              {loading ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {initialData ? 'Lưu thay đổi' : 'Thêm từ này'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
