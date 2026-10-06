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
  LayoutGrid,
  List,
  Sparkles,
  CheckCircle2,
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
  /** Callback mở chế độ ôn tập lặp lại ngắt quãng (Flashcard SRS) */
  onStudyClick: () => void;
  /** Callback mở chế độ Luyện tập trắc nghiệm */
  onQuizClick?: () => void;
  /** Callback mở chế độ Thi thử tính giờ */
  onTestClick?: () => void;
  /** Callback mở trò chơi Ghép từ tốc độ */
  onMatchGameClick?: () => void;
  /** Callback mở Modal thêm thẻ mới vào bộ */
  onAddCardClick: () => void;
  /** Callback mở Modal chỉnh sửa một thẻ từ vựng */
  onEditCard: (card: Flashcard) => void;
  /** Callback xóa một thẻ từ vựng khỏi bộ */
  onDeleteCard: (card: Flashcard) => void;
  /** Callback tìm kiếm và lọc trạng thái truyền về cho Component cha */
  onFilterChange: (keyword: string, status: string) => void;
}

/**
 * Component Trang Chi Tiết 1 Bộ Thẻ (DeckDetailView).
 *
 * TÍNH NĂNG VƯỢT TRỘI:
 * 1. Khối Header & Thanh Tiến độ Ghi nhớ: Cặp ngôn ngữ, tỷ lệ % Mastered, tổng số từ.
 * 2. 4 Tính năng học tập cốt lõi (Flashcard, Luyện tập, Thi thử, Ghép từ) với nút tương tác trực tiếp.
 * 3. Bộ lọc thông minh và Thanh tìm kiếm tức thì.
 * 4. Chuyển đổi hiển thị toàn bộ từ vựng linh hoạt: Dạng Lưới Thẻ (Cards Grid) hoặc Dạng Bảng tra cứu (Table View).
 */
export const DeckDetailView: React.FC<DeckDetailViewProps> = ({
  deck,
  cards,
  loading,
  onBack,
  onStudyClick,
  onQuizClick,
  onTestClick,
  onMatchGameClick,
  onAddCardClick,
  onEditCard,
  onDeleteCard,
  onFilterChange,
}) => {
  // State quản lý bộ lọc và tìm kiếm
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('ALL');
  // Chế độ xem danh sách: 'GRID' (thẻ bài trực quan) hoặc 'TABLE' (bảng danh sách)
  const [displayMode, setDisplayMode] = useState<'GRID' | 'TABLE'>('GRID');

  const getLangShort = (code: string) => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.shortLabel || code.toUpperCase();
  };

  const getLangName = (code: string) => {
    const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return found ? found.name.split(' (')[0] : code.toUpperCase();
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setKeyword(val);
    onFilterChange(val, status);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    onFilterChange(keyword, newStatus);
  };

  // Tính toán tỷ lệ % thành thạo
  const masteredPercent = deck.totalCards > 0
    ? Math.round(((deck.masteredCards || 0) / deck.totalCards) * 100)
    : 0;

  const renderStatusBadge = (cardStatus: string) => {
    switch (cardStatus) {
      case 'MASTERED':
        return (
          <span className="vocab-status-pill mastered">
            <CheckCircle2 size={13} /> Đã thuộc
          </span>
        );
      case 'LEARNING':
      case 'REVIEW':
        return (
          <span className="vocab-status-pill learning">
            <Sparkles size={13} /> Đang học
          </span>
        );
      case 'NEW':
      default:
        return (
          <span className="vocab-status-pill new">
            Từ mới
          </span>
        );
    }
  };

  const renderScheduleText = (card: Flashcard) => {
    if (card.status === 'MASTERED') {
      return <span className="vocab-schedule-due mastered">Đã thuộc</span>;
    }
    if (card.nextReviewDate) {
      const isDue = new Date(card.nextReviewDate).getTime() <= Date.now() + 60 * 1000;
      if (isDue) {
        return <span className="vocab-schedule-due">Hôm nay 🔥</span>;
      }
      const daysLeft = Math.ceil((new Date(card.nextReviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return <span className="vocab-schedule-due upcoming">Sau {daysLeft} ngày</span>;
    }
    return <span className="vocab-schedule-due">Hôm nay 🔥</span>;
  };

  return (
    <div className="vocab-deck-detail-wrapper">
      {/* ========================================================
          1. HEADER THÔNG TIN BỘ THẺ & ĐIỀU HƯỚNG
         ======================================================== */}
      <div className="vocab-detail-header-card">
        <div className="vocab-detail-header-top">
          <button onClick={onBack} className="vocab-deck-back-btn">
            <ArrowLeft size={18} /> Quay lại danh sách bộ thẻ
          </button>
          
          <button onClick={onAddCardClick} className="vocab-btn-create-deck">
            <Plus size={18} /> Thêm từ mới
          </button>
        </div>

        <div className="vocab-detail-header-main">
          <div className="vocab-detail-meta-tags">
            <span className="vocab-lang-badge-pill">
              {getLangShort(deck.targetLanguage)} ➔ {getLangShort(deck.sourceLanguage)}
              <span className="vocab-lang-fullname">({getLangName(deck.targetLanguage)})</span>
            </span>
            <span className="vocab-cards-count-pill">
              {deck.totalCards} từ vựng
            </span>
            {deck.isPublic && (
              <span className="vocab-public-badge-pill">Công khai</span>
            )}
          </div>

          <h1 className="vocab-detail-title">{deck.name}</h1>
          {deck.description && (
            <p className="vocab-detail-desc">{deck.description}</p>
          )}

          {/* Thanh Tiến độ Ghi nhớ */}
          <div className="vocab-progress-panel">
            <div className="vocab-progress-header">
              <span className="vocab-progress-label">Tiến độ ghi nhớ bộ thẻ</span>
              <span className="vocab-progress-percent">{masteredPercent}% đã thuộc</span>
            </div>
            <div className="vocab-progress-track">
              <div
                className="vocab-progress-fill"
                style={{ width: `${masteredPercent}%` }}
              />
            </div>
            <div className="vocab-progress-stats">
              <span>🌱 Từ mới: <strong>{deck.newCards || 0}</strong></span>
              <span>📖 Đang học: <strong>{deck.learningCards || 0}</strong></span>
              <span>✨ Thành thạo: <strong>{deck.masteredCards || 0}</strong></span>
              <span className="due-stat">🔥 Cần ôn: <strong>{deck.dueTodayCards || 0}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. KHỐI 4 TÍNH NĂNG HỌC TẬP CỐT LÕI (LEARNING MODES HUB)
         ======================================================== */}
      <section className="vocab-learning-hub-section">
        <div className="vocab-section-heading">
          <div>
            <h2 className="vocab-section-title">4 Chế Độ Học & Luyện Tập</h2>
            <p className="vocab-section-subtitle">
              Chọn phương pháp ghi nhớ phù hợp để ôn tập toàn diện từ vựng của bộ thẻ này
            </p>
          </div>
        </div>

        <div className="vocab-features-grid">
          {/* 1. Flashcard */}
          <div className="vocab-feature-card orange">
            <div className="vocab-feature-card-header">
              <div className="vocab-feature-icon-wrapper orange">
                <Layers size={22} />
              </div>
              <span className="vocab-feature-badge orange">
                {deck.dueTodayCards ? `${deck.dueTodayCards} cần ôn` : 'SRS SM-2'}
              </span>
            </div>
            <h3 className="vocab-feature-title">Flashcard</h3>
            <p className="vocab-feature-desc">
              Lặp lại ngắt quãng thông minh chống quên, lật thẻ 3D ghi nhớ phản xạ.
            </p>
            <button
              onClick={onStudyClick}
              disabled={cards.length === 0}
              className="vocab-feature-btn orange"
            >
              <Layers size={17} /> Ôn tập Flashcard
            </button>
          </div>

          {/* 2. Luyện tập */}
          <div className="vocab-feature-card blue">
            <div className="vocab-feature-card-header">
              <div className="vocab-feature-icon-wrapper blue">
                <Target size={22} />
              </div>
              <span className="vocab-feature-badge blue">Phản xạ</span>
            </div>
            <h3 className="vocab-feature-title">Luyện tập</h3>
            <p className="vocab-feature-desc">
              Trắc nghiệm 4 đáp án chọn nghĩa từ vựng, luyện phản xạ và nhớ sâu ngữ cảnh.
            </p>
            <button
              onClick={onQuizClick}
              disabled={cards.length < 4}
              title={cards.length < 4 ? 'Cần tối thiểu 4 từ để luyện tập' : 'Bắt đầu luyện tập trắc nghiệm'}
              className="vocab-feature-btn blue"
            >
              <Target size={17} />
              {cards.length < 4 ? 'Cần ≥ 4 từ' : 'Bắt đầu Luyện tập'}
            </button>
          </div>

          {/* 3. Thi thử */}
          <div className="vocab-feature-card green">
            <div className="vocab-feature-card-header">
              <div className="vocab-feature-icon-wrapper green">
                <Clock size={22} />
              </div>
              <span className="vocab-feature-badge green">Tính giờ</span>
            </div>
            <h3 className="vocab-feature-title">Thi thử</h3>
            <p className="vocab-feature-desc">
              Bài kiểm tra từ vựng bấm giờ, chấm điểm tự động và phân tích câu sai.
            </p>
            <button
              onClick={onTestClick}
              disabled={cards.length < 4}
              title={cards.length < 4 ? 'Cần tối thiểu 4 từ để thi thử' : 'Làm bài thi thử'}
              className="vocab-feature-btn green"
            >
              <Clock size={17} />
              {cards.length < 4 ? 'Cần ≥ 4 từ' : 'Bắt đầu Thi thử'}
            </button>
          </div>

          {/* 4. Ghép từ */}
          <div className="vocab-feature-card rose">
            <div className="vocab-feature-card-header">
              <div className="vocab-feature-icon-wrapper rose">
                <Gamepad2 size={22} />
              </div>
              <span className="vocab-feature-badge rose">60 giây</span>
            </div>
            <h3 className="vocab-feature-title">Ghép từ</h3>
            <p className="vocab-feature-desc">
              Trò chơi nối nhanh từ vựng với định nghĩa, tích điểm combo thần tốc.
            </p>
            <button
              onClick={onMatchGameClick}
              disabled={cards.length < 4}
              title={cards.length < 4 ? 'Cần tối thiểu 4 từ để chơi ghép từ' : 'Chơi trò chơi ghép từ'}
              className="vocab-feature-btn rose"
            >
              <Gamepad2 size={17} />
              {cards.length < 4 ? 'Cần ≥ 4 từ' : 'Chơi Ghép từ'}
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          3. HIỂN THỊ TOÀN BỘ TỪ VỰNG CỦA BỘ THẺ (VOCABULARY LIST)
         ======================================================== */}
      <section className="vocab-cards-explorer-section">
        {/* Thanh công cụ danh sách */}
        <div className="vocab-explorer-toolbar">
          <div className="vocab-toolbar-left">
            <h2 className="vocab-explorer-heading">
              Danh sách từ vựng ({cards.length})
            </h2>
            <div className="vocab-pills-bar">
              {[
                { id: 'ALL', label: `Tất cả (${deck.totalCards})` },
                { id: 'DUE', label: `🔥 Cần ôn (${deck.dueTodayCards || 0})` },
                { id: 'MASTERED', label: `✨ Đã thuộc (${deck.masteredCards || 0})` },
                { id: 'NEW', label: `🌱 Mới (${deck.newCards || 0})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleStatusChange(tab.id)}
                  className={`vocab-filter-pill ${status === tab.id ? 'active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="vocab-toolbar-right">
            {/* Ô tìm kiếm từ vựng */}
            <div className="vocab-search-box">
              <Search size={17} className="vocab-search-icon" />
              <input
                type="text"
                className="vocab-search-field"
                placeholder="Tìm từ vựng, phiên âm hoặc nghĩa..."
                value={keyword}
                onChange={handleKeywordChange}
              />
            </div>

            {/* Nút chuyển đổi kiểu xem Grid / Table */}
            <div className="vocab-view-switcher">
              <button
                onClick={() => setDisplayMode('GRID')}
                className={`vocab-switch-btn ${displayMode === 'GRID' ? 'active' : ''}`}
                title="Dạng lưới thẻ trực quan"
              >
                <LayoutGrid size={17} />
              </button>
              <button
                onClick={() => setDisplayMode('TABLE')}
                className={`vocab-switch-btn ${displayMode === 'TABLE' ? 'active' : ''}`}
                title="Dạng bảng chi tiết"
              >
                <List size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* Nội dung hiển thị từ vựng */}
        {loading ? (
          <div className="vocab-loading-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="vocab-skeleton-card" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="vocab-empty-words-card">
            <div className="vocab-empty-icon-circle">
              <BookOpen size={36} color="#d97706" />
            </div>
            <h3 className="vocab-empty-words-title">
              {keyword ? 'Không tìm thấy từ vựng phù hợp' : 'Chưa có từ vựng nào trong mục này'}
            </h3>
            <p className="vocab-empty-words-desc">
              {keyword
                ? 'Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang tab lọc khác.'
                : 'Bắt đầu xây dựng bộ thẻ của bạn bằng cách thêm từ vựng đầu tiên ngay hôm nay!'}
            </p>
            <button onClick={onAddCardClick} className="vocab-btn-create-deck">
              <Plus size={18} /> Thêm từ vựng mới
            </button>
          </div>
        ) : displayMode === 'GRID' ? (
          /* ========================================================
             3.1 DẠNG LƯỚI THẺ TRỰC QUAN (CARDS GRID VIEW)
             ======================================================== */
          <div className="vocab-cards-display-grid">
            {cards.map((card) => (
              <div key={card.id} className="vocab-word-display-card">
                {/* Phần Header Thẻ */}
                <div className="vocab-card-item-top">
                  <div className="vocab-card-word-group">
                    <button
                      onClick={() => speakWord(card.customWord, deck.targetLanguage)}
                      className="vocab-card-audio-btn"
                      title="Nghe phát âm chuẩn giọng bản xứ"
                    >
                      <Volume2 size={19} />
                    </button>
                    <span className="vocab-card-word-title">{card.customWord}</span>
                  </div>
                  <div>{renderStatusBadge(card.status)}</div>
                </div>

                {/* Phiên âm IPA & Loại từ */}
                {(card.phonetic || card.pos) && (
                  <div className="vocab-card-meta-line">
                    {card.phonetic && (
                      <span className="vocab-card-phonetic">{card.phonetic}</span>
                    )}
                    {card.pos && (
                      <span className="vocab-pos-badge">{card.pos.toLowerCase()}</span>
                    )}
                  </div>
                )}

                {/* Định nghĩa tiếng Việt */}
                <div className="vocab-card-meaning-box">
                  <p className="vocab-card-meaning-text">
                    {card.customMeaning || 'Chưa có định nghĩa'}
                  </p>
                </div>

                {/* Câu ví dụ ngữ cảnh */}
                {card.exampleSentence && (
                  <div className="vocab-card-example-box">
                    <p className="vocab-card-example-text">
                      "{card.exampleSentence}"
                    </p>
                  </div>
                )}

                {/* Ảnh minh họa nếu có */}
                {card.customImageUrl && (
                  <div className="vocab-card-img-wrapper">
                    <img
                      src={card.customImageUrl}
                      alt={card.customWord}
                      className="vocab-card-img"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Phần Footer Thẻ: Kế hoạch ôn & Nút Sửa / Xóa */}
                <div className="vocab-card-item-footer">
                  <div className="vocab-card-schedule-info">
                    <span className="schedule-badge">{renderScheduleText(card)}</span>
                    <span className="review-count-text">Đã ôn: {card.reviewCount || 0} lần</span>
                  </div>

                  <div className="vocab-card-actions-group">
                    <button
                      onClick={() => onEditCard(card)}
                      className="vocab-card-action-btn edit"
                      title="Chỉnh sửa thẻ từ vựng"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDeleteCard(card)}
                      className="vocab-card-action-btn delete"
                      title="Xóa thẻ khỏi bộ"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ========================================================
             3.2 DẠNG BẢNG TRA CỨU CHI TIẾT (TABLE VIEW)
             ======================================================== */
          <div className="vocab-table-card">
            <div className="vocab-table-responsive">
              <table className="vocab-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Từ vựng & Phát âm</th>
                    <th style={{ width: '18%' }}>Phiên âm & Loại</th>
                    <th style={{ width: '38%' }}>Định nghĩa tiếng Việt</th>
                    <th style={{ width: '12%' }}>Kế hoạch ôn</th>
                    <th style={{ width: '10%' }}>Thao tác</th>
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
                            <Volume2 size={19} />
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
                            <span className="vocab-phonetic-text empty">---</span>
                          )}
                          {card.pos && (
                            <span className="vocab-pos-badge">{card.pos.toLowerCase()}</span>
                          )}
                        </div>
                      </td>

                      {/* Cột 3: Định nghĩa tiếng Việt & Câu ví dụ */}
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
                          {renderScheduleText(card)}
                          <p className="vocab-schedule-count">Đã ôn {card.reviewCount || 0} lần</p>
                        </div>
                      </td>

                      {/* Cột 5: Trạng thái & Thao tác */}
                      <td>
                        <div className="vocab-status-actions-cell">
                          <div>{renderStatusBadge(card.status)}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
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
          </div>
        )}
      </section>
    </div>
  );
};
