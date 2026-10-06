import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { DeckSummary } from '../../types/vocab';
import './vocab.css';

/**
 * Interface định nghĩa các Props cho Modal Xác nhận Xóa Bộ thẻ từ vựng (ConfirmDeleteDeckModal).
 */
interface ConfirmDeleteDeckModalProps {
  /** Trạng thái mở/đóng của Modal */
  isOpen: boolean;
  /** Thông tin bộ thẻ đang được chọn để xóa (null nếu modal đóng) */
  deck: DeckSummary | null;
  /** Callback đóng Modal khi người dùng hủy bỏ hoặc bấm phím ESC */
  onClose: () => void;
  /** Callback thực thi xóa bộ thẻ khi người dùng xác nhận */
  onConfirm: () => Promise<void>;
  /** Trạng thái đang gọi API xóa để vô hiệu hóa nút bấm và hiển thị spinner */
  isDeleting?: boolean;
}

/**
 * Component Modal Xác nhận Xóa Toàn bộ Bộ thẻ từ vựng.
 *
 * ĐẶC ĐIỂM THIẾT KẾ & AN TOÀN:
 * 1. Portaled trực tiếp vào `document.body` để luôn căn giữa chuẩn xác trên mọi kích thước màn hình.
 * 2. Khóa cuộn trang nền (`document.body.style.overflow = 'hidden'`) tránh nhảy layout.
 * 3. Hỗ trợ phím tắt ESC và click ra ngoài backdrop để hủy bỏ nhanh.
 * 4. Hiển thị rõ ràng tên bộ thẻ, ngôn ngữ cùng cảnh báo mất toàn bộ thẻ từ vựng và tiến độ SRS.
 */
export const ConfirmDeleteDeckModal: React.FC<ConfirmDeleteDeckModalProps> = ({
  isOpen,
  deck,
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

  // Nếu modal không ở trạng thái mở hoặc không có bộ thẻ nào được chọn, không render vào DOM
  if (!isOpen || !deck) return null;

  return createPortal(
    <div className="vocab-modal-backdrop" onClick={() => !isDeleting && onClose()}>
      <div
        className="vocab-modal-card"
        style={{ maxWidth: '460px' }}
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
            <span style={{ color: '#9f1239' }}>Xác nhận xóa bộ thẻ</span>
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
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn xóa bộ thẻ{' '}
              <strong style={{ color: '#0f172a', background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                {deck.name}
              </strong>{' '}
              không?
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
              <span className="vocab-pair-chip" style={{ margin: 0 }}>
                <span className="vocab-lang-tag target">{deck.targetLanguage?.toUpperCase()}</span>
                <span style={{ color: '#d97706' }}>➔</span>
                <span className="vocab-lang-tag source">{deck.sourceLanguage?.toUpperCase()}</span>
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                • Tổng số: <strong style={{ color: '#334155' }}>{deck.totalCards || 0}</strong> thẻ từ vựng
              </span>
            </div>
          </div>

          {/* Hộp cảnh báo dữ liệu mất vĩnh viễn */}
          <div className="vocab-modal-danger-box">
            <strong>Lưu ý quan trọng:</strong> Hành động này sẽ xóa vĩnh viễn bộ thẻ và toàn bộ{' '}
            <strong>{deck.totalCards || 0}</strong> thẻ từ vựng bên trong cùng lịch sử ôn tập (SRS). Bạn sẽ không thể khôi phục lại dữ liệu này.
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
