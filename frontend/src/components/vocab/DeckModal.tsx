import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Globe, BookOpen } from 'lucide-react';
import type { CreateDeckRequest, DeckSummary } from '../../types/vocab';
import { SUPPORTED_LANGUAGES } from '../../types/vocab';
import './vocab.css';

/**
 * Interface định nghĩa các Props cho Modal Tạo / Chỉnh sửa Bộ thẻ từ vựng.
 */
interface DeckModalProps {
  /** Trạng thái hiển thị Modal */
  isOpen: boolean;
  /** Hàm callback đóng Modal */
  onClose: () => void;
  /** Hàm callback gửi request lưu bộ thẻ lên Backend */
  onSubmit: (data: CreateDeckRequest) => Promise<void>;
  /** Dữ liệu bộ thẻ truyền vào khi ở chế độ chỉnh sửa (null nếu là tạo mới) */
  initialData?: DeckSummary | null;
}

/**
 * Component Modal Tạo mới / Cập nhật Bộ thẻ từ vựng (Flashcard Deck).
 *
 * TÍNH NĂNG CHÍNH:
 * 1. Cho phép thiết lập tên và mô tả bộ thẻ.
 * 2. Cấu hình cặp ngôn ngữ đa quốc gia: targetLanguage (ngôn ngữ học) và sourceLanguage (ngôn ngữ giải nghĩa).
 * 3. Cho phép bật/tắt quyền riêng tư (isPublic).
 * 4. Kiểm tra hợp lệ dữ liệu và xử lý loading/lỗi trực quan.
 */
export const DeckModal: React.FC<DeckModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  // --- Quản lý các trường thông tin trong Form ---
  const [name, setName] = useState('');                           // Tên bộ thẻ (bắt buộc)
  const [description, setDescription] = useState('');             // Mô tả ngắn mục tiêu học
  const [targetLanguage, setTargetLanguage] = useState('en');     // Ngôn ngữ học từ vựng (mặc định: tiếng Anh 'en')
  const [sourceLanguage, setSourceLanguage] = useState('vi');     // Ngôn ngữ giải nghĩa (mặc định: tiếng Việt 'vi')
  const [isPublic, setIsPublic] = useState(false);                // Cờ chia sẻ công khai
  const [loading, setLoading] = useState(false);                  // Trạng thái đang gửi API
  const [error, setError] = useState<string | null>(null);        // Chuỗi lỗi hiển thị

  /**
   * Đồng bộ dữ liệu vào Form khi Modal mở ra hoặc khi thay đổi initialData
   */
  useEffect(() => {
    if (initialData) {
      // Chế độ Chỉnh sửa: Nạp thông tin bộ thẻ có sẵn
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setTargetLanguage(initialData.targetLanguage || 'en');
      setSourceLanguage(initialData.sourceLanguage || 'vi');
      setIsPublic(initialData.isPublic || false);
    } else {
      // Chế độ Tạo mới: Reset form về giá trị mặc định
      setName('');
      setDescription('');
      setTargetLanguage('en');
      setSourceLanguage('vi');
      setIsPublic(false);
    }
    setError(null);
  }, [initialData, isOpen]);

  // Khóa cuộn trang khi Modal đang mở, tự động mở lại khi đóng
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

  // Không hiển thị gì nếu Modal đang đóng
  if (!isOpen) return null;

  /**
   * Xử lý xác nhận form và gửi dữ liệu lên Backend
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Kiểm tra validation phía client: Tên bộ thẻ không được để trống
    if (!name.trim()) {
      setError('Vui lòng nhập tên bộ thẻ từ vựng');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 2. Gọi hàm callback do component cha truyền vào để gọi API
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        targetLanguage,
        sourceLanguage,
        isPublic,
      });

      // 3. Đóng modal sau khi tạo/sửa thành công
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu bộ thẻ:', err);
      setError(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu bộ thẻ');
    } finally {
      setLoading(false);
    }
  };

  // Tìm đối tượng ngôn ngữ tương ứng để lấy cờ quốc gia (Flag Emoji)
  const targetLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage);
  const sourceLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === sourceLanguage);

  return createPortal(
    <div className="vocab-modal-backdrop" onClick={onClose}>
      <div
        className="vocab-modal-card"
        onClick={(e) => e.stopPropagation()} // Tránh click xuyên ra ngoài
      >
        {/* --- Header của Modal --- */}
        <div className="vocab-modal-header">
          <div className="vocab-modal-title">
            <div className="vocab-modal-title-icon">
              <BookOpen size={20} />
            </div>
            <span>{initialData ? 'Chỉnh sửa bộ thẻ' : 'Tạo bộ thẻ từ vựng mới'}</span>
          </div>
          <button
            onClick={onClose}
            className="vocab-modal-close-btn"
            title="Đóng hộp thoại"
          >
            <X size={18} />
          </button>
        </div>

        {/* --- Form nhập liệu Bộ thẻ --- */}
        <form onSubmit={handleSubmit} className="vocab-modal-form">
          {/* Thông báo lỗi nếu có */}
          {error && (
            <div className="vocab-error-banner">
              {error}
            </div>
          )}

          {/* Ô nhập Tên bộ thẻ */}
          <div className="vocab-form-group">
            <label className="vocab-form-label">
              <span>Tên bộ thẻ <span style={{ color: '#ef4444' }}>*</span></span>
            </label>
            <input
              type="text"
              className="vocab-form-input"
              placeholder="Ví dụ: IELTS Academic 3000 từ cốt lõi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          {/* Ô nhập Mô tả */}
          <div className="vocab-form-group">
            <label className="vocab-form-label">
              <span>Mô tả ngắn</span>
            </label>
            <textarea
              className="vocab-form-textarea"
              rows={2}
              placeholder="Ghi chú mục tiêu hoặc phạm vi từ vựng của bộ thẻ..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Khối Cấu hình Cặp ngôn ngữ (Language Pair Selector) */}
          <div className="vocab-form-section">
            <div className="vocab-form-section-header">
              <span className="vocab-form-section-title">
                <Globe size={15} style={{ color: '#d97706' }} /> Cấu hình Cặp ngôn ngữ
              </span>
              <div className="vocab-pair-chip" style={{ padding: '0.2rem 0.5rem' }}>
                <span className="vocab-lang-tag target">{targetLangObj?.shortLabel || targetLanguage.toUpperCase()}</span>
                <span style={{ color: '#d97706' }}>➔</span>
                <span className="vocab-lang-tag source">{sourceLangObj?.shortLabel || sourceLanguage.toUpperCase()}</span>
              </div>
            </div>

            <div className="vocab-form-grid-2">
              {/* Chọn ngôn ngữ học (Từ vựng cần nhớ) */}
              <div className="vocab-form-group">
                <label className="vocab-form-label" style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                  Ngôn ngữ học (Từ vựng)
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="vocab-form-select"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      [{lang.shortLabel}] {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chọn ngôn ngữ giải nghĩa (Ngôn ngữ của người học) */}
              <div className="vocab-form-group">
                <label className="vocab-form-label" style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                  Ngôn ngữ giải nghĩa
                </label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className="vocab-form-select"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      [{lang.shortLabel}] {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="vocab-form-hint">
              * Khi thêm từ mới vào bộ thẻ này, hệ thống sẽ tự động tra cứu từ điển và trích xuất nghĩa theo đúng ngôn ngữ giải nghĩa bạn đã chọn.
            </p>
          </div>

          {/* Toggle Chia sẻ công khai */}
          <label htmlFor="isPublicCheck" className="vocab-checkbox-row">
            <input
              type="checkbox"
              id="isPublicCheck"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="vocab-checkbox"
            />
            <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
              Cho phép chia sẻ công khai với cộng đồng người học khác trên Multilingo
            </span>
          </label>

          {/* --- Nút điều khiển --- */}
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
                  {initialData ? 'Cập nhật' : 'Tạo bộ thẻ'}
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
