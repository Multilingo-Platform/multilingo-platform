import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Volume2,
  Edit2,
  Trash2,
  Layers,
  Target,
  Clock,
  Gamepad2,
  BookOpen,
} from 'lucide-react';
import type { DeckSummary, Flashcard } from '../../types/vocab';
import { SUPPORTED_LANGUAGES } from '../../types/vocab';
import { speakWord } from '../../utils/speech';
import './vocab.css';

/**
 * Interface định nghĩa các Props cho Component Chi tiết Bộ thẻ (DeckDetailView).
 */
export interface DeckDetailViewProps {
  /** Thông tin của bộ thẻ hiện tại */
  deck: DeckSummary;
  /** Danh sách các thẻ từ vựng thuộc bộ thẻ này */
  cards: Flashcard[];
  /** Trạng thái loading khi đang tải danh sách thẻ */
  loading: boolean;
  /** Callback quay lại màn hình danh sách các bộ thẻ */
  onBack: () => void;
  /** Callback mở chế độ ôn tập lặp lại ngắt quãng (SRS Study Mode) */
  onStudyClick: () => void;
  /** Callback mở Modal thêm thẻ mới vào bộ */
  onAddCardClick: () => void;
  /** Callback mở Modal chỉnh sửa một thẻ từ vựng */
  onEditCard: (card: Flashcard) => void;
  /** Callback xóa một thẻ từ vựng khỏi bộ */
  onDeleteCard: (card: Flashcard) => void;
  /** Callback tìm kiếm và lọc trạng thái truyền về cho Component cha */
  onFilterChange: (keyword: string, status: string) => void;
  /** Callback mở chế độ Trắc nghiệm Quiz */
  onQuizClick?: () => void;
  /** Callback mở chế độ Kiểm tra từ vựng */
  onTestClick?: () => void;
  /** Callback mở chế độ Ghép từ tốc độ */
  onMatchGameClick?: () => void;
}

/**
 * Component Hiển thị Chi tiết Bộ thẻ và Quản lý Danh sách Thẻ Từ vựng (DeckDetailView).
 *
 * TÍNH NĂNG CHÍNH:
 * 1. Khối 4 Cổng Chế độ học tập (Flashcard SRS, Trắc nghiệm Quiz, Kiểm tra từ vựng, Ghép từ tốc độ).
 * 2. Khối Quản lý Thẻ Từ vựng dạng Bảng chuẩn với 5 cột:
 *    - Từ vựng & Phát âm (Web Speech TTS)
 *    - Phiên âm & Loại (IPA + Badge từ loại)
 *    - Định nghĩa tiếng Việt & Câu ví dụ ngữ cảnh
 *    - Kế hoạch ôn (Hôm nay / Số lần ôn)
 *    - Trạng thái & Thao tác Sửa/Xóa
 * 3. Bộ lọc Pills: Tất cả, Cần ôn, Đã thuộc, Từ mới kèm số lượng động và ô tìm kiếm từ/nghĩa.
 */
export const DeckDetailView: React.FC<DeckDetailViewProps> = ({
  deck,
  cards,
  loading,
  onBack,
  onStudyClick,
  onAddCardClick,
  onEditCard,
  onDeleteCard,
  onFilterChange,
  onQuizClick,
  onTestClick,
  onMatchGameClick,
}) => {
  // State quản lý bộ lọc tìm kiếm cục bộ
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('ALL');

  /**
   * Helper lấy tên ngắn của ngôn ngữ (ví dụ 'en' -> 'EN')
   */
  const getLangShort = (code: string) => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.shortLabel || code.toUpperCase();
  };

  /**
   * Helper lấy tên đầy đủ của ngôn ngữ (ví dụ 'en' -> 'Tiếng Anh')
   */
  const getLangName = (code: string) => {
    const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return found ? found.name.split(' (')[0] : code.toUpperCase();
  };

  /**
   * Xử lý khi người dùng thay đổi từ khóa tìm kiếm
   */
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setKeyword(val);
    onFilterChange(val, status);
  };

  /**
   * Xử lý khi người dùng chọn tab trạng thái SRS
   */
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    onFilterChange(keyword, newStatus);
  };

  /**
   * Helper render badge trạng thái SRS
   */
  const renderStatusBadge = (cardStatus: string) => {
    switch (cardStatus) {
      case 'MASTERED':
        return (
          <span className="vocab-study-badge vocab-study-badge-green" style={{ padding: '0.25rem 0.65rem', fontSize: '0.82rem', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
            Đã thuộc
          </span>
        );
      case 'LEARNING':
      case 'REVIEW':
        return (
          <span className="vocab-study-badge vocab-study-badge-amber" style={{ padding: '0.25rem 0.65rem', fontSize: '0.82rem' }}>
            Đang học
          </span>
        );
      case 'NEW':
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.25rem 0.65rem',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: '#dbeafe',
              color: '#1e40af',
              border: '1px solid #bfdbfe',
              whiteSpace: 'nowrap',
            }}
          >
            Từ mới
          </span>
        );
    }
  };

  /**
   * Helper hiển thị kế hoạch ôn của thẻ
   */
  const renderSchedule = (card: Flashcard) => {
    if (card.status === 'MASTERED') {
      return <p className="vocab-schedule-mastered">Đã thuộc</p>;
    }
    if (card.nextReviewDate) {
      const isDue = new Date(card.nextReviewDate).getTime() <= Date.now() + 60 * 1000;
      if (isDue) {
        return <p className="vocab-schedule-due">Hôm nay</p>;
      }
      const daysLeft = Math.ceil((new Date(card.nextReviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return <p className="vocab-schedule-neutral">Sau {daysLeft} ngày</p>;
    }
    // Mặc định cho các thẻ đang học hoặc mới
    return <p className="vocab-schedule-due">Hôm nay</p>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* ========================================================
          1. HEADER THÔNG TIN BỘ THẺ & NÚT ĐIỀU HƯỚNG (CLEAN LAYOUT)
         ======================================================== */}
      <div className="vocab-deck-header-clean">
        <button
          onClick={onBack}
          className="vocab-deck-back-btn"
        >
          <ArrowLeft size={18} /> Quay lại danh sách bộ thẻ
        </button>

        <div className="vocab-deck-title-row">
          <div className="vocab-deck-title-group">
            <div className="vocab-deck-meta">
              <span className="vocab-lang-badge">
                {getLangShort(deck.targetLanguage)} ➔ {getLangShort(deck.sourceLanguage)}
                <span style={{ fontWeight: 500, marginLeft: '0.25rem', opacity: 0.85 }}>
                  ({getLangName(deck.targetLanguage)})
                </span>
              </span>
              <span className="vocab-count-badge">
                {deck.totalCards} từ vựng
              </span>
            </div>

            <h1 className="vocab-deck-h1">{deck.name}</h1>
            {deck.description && (
              <p className="vocab-deck-subtitle">{deck.description}</p>
            )}
          </div>

          <div>
            <button
              onClick={onAddCardClick}
              className="vocab-btn-add-word"
            >
              <Plus size={18} /> Thêm từ mới
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. KHỐI CHẾ ĐỘ HỌC TẬP (4 CỔNG CHẾ ĐỘ TRỰC QUAN)
         ======================================================== */}
      <section className="vocab-study-modes-section">
        <div className="vocab-study-modes-header">
          <h2 className="vocab-study-modes-title">Chế độ học tập</h2>
          <p className="vocab-study-modes-subtitle">
            Chọn phương pháp ghi nhớ hiệu quả phù hợp với mục tiêu hôm nay
          </p>
        </div>

        <div className="vocab-study-grid">
          {/* 1. Flashcard SRS (Thiết kế phẳng, không dùng 3D) */}
          <div className="vocab-study-card">
            <div className="vocab-study-card-top">
              <div className="vocab-study-card-header-left">
                <Layers size={20} color="#d97706" />
                <h3 className="vocab-study-card-title">Flashcard SRS</h3>
              </div>
              <span className="vocab-study-badge vocab-study-badge-amber">SM-2</span>
            </div>
            <p className="vocab-study-card-desc">
              Lặp lại ngắt quãng thông minh chống quên theo phương pháp SM-2.
            </p>
            <button
              className="vocab-study-btn-primary"
              onClick={onStudyClick}
              disabled={cards.length === 0}
            >
              <Layers size={18} /> Ôn tập ngay ({deck.dueTodayCards || 0})
            </button>
          </div>

          {/* 2. Trắc nghiệm Quiz */}
          <div className="vocab-study-card">
            <div className="vocab-study-card-top">
              <div className="vocab-study-card-header-left">
                <Target size={20} color="#3b82f6" />
                <h3 className="vocab-study-card-title">Trắc nghiệm Quiz</h3>
              </div>
              <span className="vocab-study-badge vocab-study-badge-gray">Luyện tập</span>
            </div>
            <p className="vocab-study-card-desc">
              Luyện phản xạ chọn đúng nghĩa và điền câu mẫu.
            </p>
            <button
              className="vocab-study-btn-outline"
              onClick={
                onQuizClick ||
                (() => alert('Tính năng Trắc nghiệm Quiz đang được chuẩn bị hoàn thiện!'))
              }
            >
              <Target size={18} /> Luyện tập
            </button>
          </div>

          {/* 3. Kiểm tra từ vựng */}
          <div className="vocab-study-card">
            <div className="vocab-study-card-top">
              <div className="vocab-study-card-header-left">
                <Clock size={20} color="#10b981" />
                <h3 className="vocab-study-card-title">Kiểm tra từ vựng</h3>
              </div>
              <span className="vocab-study-badge vocab-study-badge-gray">10 phút</span>
            </div>
            <p className="vocab-study-card-desc">
              Tính giờ tập trung và chấm điểm xếp loại tự động.
            </p>
            <button
              className="vocab-study-btn-outline"
              onClick={
                onTestClick ||
                (() => alert('Tính năng Kiểm tra từ vựng đang được chuẩn bị hoàn thiện!'))
              }
            >
              <Clock size={18} /> Làm bài thi
            </button>
          </div>

          {/* 4. Ghép từ tốc độ */}
          <div className="vocab-study-card">
            <div className="vocab-study-card-top">
              <div className="vocab-study-card-header-left">
                <Gamepad2 size={20} color="#ef4444" />
                <h3 className="vocab-study-card-title">Ghép từ tốc độ</h3>
              </div>
              <span className="vocab-study-badge vocab-study-badge-gray">60 giây</span>
            </div>
            <p className="vocab-study-card-desc">
              Thử thách phản xạ nối nhanh từ vựng với định nghĩa.
            </p>
            <button
              className="vocab-study-btn-outline"
              onClick={
                onMatchGameClick ||
                (() => alert('Trò chơi Ghép từ tốc độ đang được chuẩn bị hoàn thiện!'))
              }
            >
              <Gamepad2 size={18} /> Chơi ngay
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          3. BẢNG DANH SÁCH THẺ TỪ VỰNG (CARD CONTAINER & DATA TABLE)
         ======================================================== */}
      <div className="vocab-table-card">
        {/* Thanh công cụ: Tabs bộ lọc và Ô tìm kiếm */}
        <div className="vocab-table-toolbar">
          {/* Các nút Tab lọc theo trạng thái */}
          <div className="vocab-pills-group">
            {[
              { id: 'ALL', label: `Tất cả (${deck.totalCards})` },
              { id: 'DUE', label: `Cần ôn (${deck.dueTodayCards || 0})` },
              { id: 'MASTERED', label: `Đã thuộc (${deck.masteredCards || 0})` },
              { id: 'NEW', label: `Từ mới (${deck.newCards || 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleStatusChange(tab.id)}
                className={`vocab-pill-btn ${status === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Ô tìm kiếm từ hoặc nghĩa */}
          <div className="vocab-search-wrapper">
            <Search size={18} className="vocab-search-icon" />
            <input
              type="text"
              className="vocab-search-input"
              placeholder="Tìm từ hoặc nghĩa..."
              value={keyword}
              onChange={handleKeywordChange}
            />
          </div>
        </div>

        {/* Nội dung danh sách / bảng */}
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 bg-gray-100 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-14 h-14 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 mb-3 border border-amber-200">
              <BookOpen size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {keyword ? 'Không tìm thấy thẻ từ vựng phù hợp' : 'Không có thẻ từ vựng nào trong mục này'}
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
              {keyword
                ? 'Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang tab lọc khác.'
                : 'Hãy thêm các từ vựng mới để bắt đầu học và ghi nhớ hiệu quả.'}
            </p>
            <button
              onClick={onAddCardClick}
              className="btn btn-primary text-base inline-flex items-center gap-2 px-4 py-2"
            >
              <Plus size={18} /> Thêm từ vựng mới
            </button>
          </div>
        ) : (
          <div className="vocab-table-responsive">
            <table className="vocab-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Từ vựng & Phát âm</th>
                  <th style={{ width: '18%' }}>Phiên âm & Loại</th>
                  <th style={{ width: '38%' }}>Định nghĩa tiếng Việt</th>
                  <th style={{ width: '12%' }}>Kế hoạch ôn</th>
                  <th style={{ width: '10%' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.id}>
                    {/* Cột 1: Từ vựng & Phát âm */}
                    <td>
                      <div className="vocab-word-cell">
                        <button
                          onClick={() => speakWord(card.customWord, deck.targetLanguage)}
                          title="Nghe phát âm chuẩn"
                          className="vocab-audio-btn cursor-pointer"
                        >
                          <Volume2 size={20} />
                        </button>
                        <span className="vocab-word-title">{card.customWord}</span>
                      </div>
                    </td>

                    {/* Cột 2: Phiên âm & Loại */}
                    <td>
                      <div className="vocab-phonetic-cell">
                        {card.phonetic ? (
                          <span className="vocab-phonetic-text">{card.phonetic}</span>
                        ) : (
                          <span className="vocab-phonetic-text" style={{ color: '#94a3b8' }}>---</span>
                        )}
                        {card.pos && (
                          <span className="vocab-pos-badge">{card.pos.toLowerCase()}</span>
                        )}
                      </div>
                    </td>

                    {/* Cột 3: Định nghĩa tiếng Việt & Câu ví dụ ngữ cảnh */}
                    <td>
                      <div className="vocab-meaning-cell">
                        <p className="vocab-meaning-text">
                          {card.customMeaning || 'Chưa có giải nghĩa'}
                        </p>
                        {card.exampleSentence && (
                          <p className="vocab-example-text">"{card.exampleSentence}"</p>
                        )}
                      </div>
                    </td>

                    {/* Cột 4: Kế hoạch ôn */}
                    <td>
                      <div className="vocab-schedule-cell">
                        {renderSchedule(card)}
                        <p className="vocab-schedule-count">Đã ôn {card.reviewCount} lần</p>
                      </div>
                    </td>

                    {/* Cột 5: Trạng thái & Nút thao tác Sửa/Xóa */}
                    <td>
                      <div className="vocab-status-actions-cell">
                        <div>{renderStatusBadge(card.status)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            onClick={() => onEditCard(card)}
                            className="vocab-row-action-btn vocab-row-edit-btn"
                            title="Chỉnh sửa thẻ"
                          >
                            <Edit2 size={17} />
                          </button>
                          <button
                            onClick={() => onDeleteCard(card)}
                            className="vocab-row-action-btn"
                            title="Xóa thẻ khỏi bộ"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
