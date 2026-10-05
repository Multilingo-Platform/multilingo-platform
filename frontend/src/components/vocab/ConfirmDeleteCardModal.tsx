import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { Flashcard } from '../../types/vocab';
import './vocab.css';

/**
 * Interface định nghĩa các Props cho Modal Xác nhận Xóa Thẻ từ vựng (ConfirmDeleteCardModal).
 * Tuân thủ theo đặc tả use case UC012.6: Xóa thẻ ghi nhớ (Flashcard).
 */
interface ConfirmDeleteCardModalProps {
  /** Trạng thái mở/đóng của Modal */
  isOpen: boolean;
  /** Thông tin thẻ từ vựng đang được chọn để xóa (null nếu modal đóng) */
  card: Flashcard | null;
  /** Callback đóng Modal khi người dùng hủy bỏ hoặc bấm phím ESC */
  onClose: () => void;
  /** Callback thực thi xóa thẻ khi người dùng xác nhận */
  onConfirm: () => Promise<void>;
  /** Trạng thái đang gọi API xóa để vô hiệu hóa nút bấm và hiển thị spinner */
  isDeleting?: boolean;
}

/**
 * Component Modal Xác nhận Xóa Thẻ từ vựng con (UC012.6).
 *
 * ĐẶC ĐIỂM THIẾT KẾ & AN TOÀN:
 * 1. Portaled trực tiếp vào `document.body` để luôn căn giữa chuẩn xác trên mọi kích thước màn hình.
 * 2. Khóa cuộn trang nền (`document.body.style.overflow = 'hidden'`) tránh nhảy layout.
 * 3. Hỗ trợ phím tắt ESC và click ra ngoài backdrop để hủy bỏ nhanh.
 * 4. Hiển thị rõ ràng từ vựng chuẩn bị xóa cùng cảnh báo mất tiến độ ôn tập ngắt quãng (SRS).
 */
export const ConfirmDeleteCardModal: React.FC<ConfirmDeleteCardModalProps> = ({
  isOpen,
  card,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  // 1. Khóa cuộn trang khi Modal đang mở, tự động trả lại cuộn khi đóng
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

  // 2. Lắng nghe phím ESC để đóng Modal an toàn
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  // Nếu modal không ở trạng thái mở hoặc không có thẻ nào được chọn, không render vào DOM
  if (!isOpen || !card) return null;

  return createPortal(
    <div className="vocab-modal-backdrop" onClick={() => !isDeleting && onClose()}>
      <div
        className="vocab-modal-card"
        style={{ maxWidth: '440px' }}
        onClick={(e) => e.stopPropagation()} // Ngăn chặn sự kiện click lan ra backdrop
      >
        {/* Header Modal với Icon cảnh báo */}
        <div className="vocab-modal-header" style={{ background: '#fff1f2', borderBottomColor: '#fecdd3' }}>
          <div className="vocab-modal-title">
            <div
              className="vocab-modal-title-icon"
              style={{ background: '#ffe4e6', borderColor: '#fca5a5', color: '#e11d48' }}
            >
              <AlertTriangle size={18} />
            </div>
            <span style={{ color: '#9f1239' }}>Xác nhận xóa thẻ từ vựng</span>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="vocab-modal-close-btn"
            title="Đóng hộp thoại (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nội dung thông báo và cảnh báo */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#1e293b', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn xóa thẻ từ vựng{' '}
              <strong style={{ color: '#0f172a', background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                {card.customWord}
              </strong>{' '}
              khỏi bộ thẻ này không?
            </p>
            {card.customMeaning && (
              <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                Giải nghĩa: "{card.customMeaning}"
              </p>
            )}
          </div>

          {/* Hộp cảnh báo mất tiến độ SRS */}
          <div className="vocab-modal-danger-box">
            <strong>Lưu ý:</strong> Hành động này sẽ xóa vĩnh viễn thẻ từ vựng và toàn bộ dữ liệu tiến độ lặp lại ngắt quãng (SRS) liên quan. Bạn sẽ không thể khôi phục lại thẻ này.
          </div>

          {/* Các nút hành động */}
          <div className="vocab-modal-actions" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="vocab-btn-secondary"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="vocab-btn-danger"
            >
              <Trash2 size={16} />
              {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
