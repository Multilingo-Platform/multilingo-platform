import React, { useState } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Edit2,
  Trash2,
  Lock,
  Globe,
  Flame,
  CheckCircle2,
  GraduationCap,
} from 'lucide-react';
import type { DeckSummary } from '../../types/vocab';
import { SUPPORTED_LANGUAGES } from '../../types/vocab';
import './vocab.css';

/**
 * Interface định nghĩa các Props cho Component Danh sách Bộ thẻ (DeckListView).
 */
interface DeckListViewProps {
  /** Danh sách toàn bộ các bộ thẻ của người dùng lấy từ Backend */
  decks: DeckSummary[];
  /** Trạng thái loading khi đang tải dữ liệu từ API */
  loading: boolean;
  /** Callback khi người dùng click vào một bộ thẻ để xem danh sách thẻ con */
  onSelectDeck: (deck: DeckSummary) => void;
  /** Callback khi người dùng click vào nút 'Ôn tập ngay (SRS)' */
  onStudyDeck: (deck: DeckSummary) => void;
  /** Callback mở Modal tạo bộ thẻ mới */
  onCreateClick: () => void;
  /** Callback mở Modal chỉnh sửa bộ thẻ */
  onEditDeck: (deck: DeckSummary) => void;
  /** Callback mở xác nhận xóa bộ thẻ */
  onDeleteDeck: (deck: DeckSummary) => void;
}

/**
 * Component Hiển thị Danh sách Toàn bộ các Bộ thẻ từ vựng (DeckListView).
 *
 * TÍNH NĂNG VÀ GIAO DIỆN CHUẨN EDTECH:
 * 1. Banner giới thiệu sinh động, nút tạo mới bộ thẻ nổi bật.
 * 2. 3 Thẻ thống kê (Stats Summary) rõ ràng: Tổng bộ thẻ, Cần ôn hôm nay (SRS), Đã thành thạo.
 * 3. Thanh tìm kiếm độc lập và Tabs lọc ngôn ngữ hiển thị dạng Chip chuyên nghiệp (không bị lỗi ký tự flag trên Windows).
 * 4. Lưới các bộ thẻ với khoảng cách rộng rãi, hover nâng thẻ (elevation effect), badge cặp ngôn ngữ [EN ➔ VI] sắc nét.
 * 5. Bộ nút hành động dưới chân thẻ rõ ràng, trực quan.
 */
export const DeckListView: React.FC<DeckListViewProps> = ({
  decks,
  loading,
  onSelectDeck,
  onStudyDeck,
  onCreateClick,
  onEditDeck,
  onDeleteDeck,
}) => {
  // State quản lý tìm kiếm và bộ lọc ngôn ngữ
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLang, setSelectedLang] = useState<string>('ALL');

  // Tính toán số liệu thống kê tổng hợp
  const totalCardsAll = decks.reduce((sum, d) => sum + (d.totalCards || 0), 0);
  const totalDueTodayAll = decks.reduce((sum, d) => sum + (d.dueTodayCards || 0), 0);
  const totalMasteredAll = decks.reduce((sum, d) => sum + (d.masteredCards || 0), 0);

  // Lọc danh sách bộ thẻ theo từ khóa tìm kiếm và ngôn ngữ được chọn
  const filteredDecks = decks.filter((deck) => {
    const matchesSearch =
      deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (deck.description && deck.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesLang =
      selectedLang === 'ALL' ||
      deck.targetLanguage === selectedLang ||
      deck.sourceLanguage === selectedLang;

    return matchesSearch && matchesLang;
  });

  /**
   * Helper lấy tên ngắn gọn của ngôn ngữ (ví dụ 'en' -> 'EN', 'vi' -> 'VI')
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

  return (
    <div className="vocab-page-wrapper">
      {/* ========================================================
          1. HEADER BANNER GIỚI THIỆU & NÚT TẠO MỚI BỘ THẺ
         ======================================================== */}
      <div className="vocab-header-banner">
        <div>
          <div className="vocab-banner-badge">
            <Flame size={14} className="fill-amber-600 text-amber-600" />
            Spaced Repetition System
          </div>
          <h1 className="vocab-banner-title">
            Sổ tay & Bộ thẻ Từ vựng
          </h1>
          <p className="vocab-banner-desc">
            Ôn tập thông minh với thuật toán lặp lại ngắt quãng (SRS), hỗ trợ các cặp ngôn ngữ đa dạng và phát âm chuẩn bản xứ.
          </p>
        </div>

        <button
          onClick={onCreateClick}
          className="vocab-btn-create-deck"
        >
          <Plus size={18} />
          Tạo bộ thẻ mới
        </button>
      </div>

      {/* ========================================================
          2. CÁC THẺ THỐNG KÊ TỔNG QUAN (STATS SUMMARY CARDS)
         ======================================================== */}
      <div className="vocab-stats-grid">
        {/* Tổng số bộ thẻ & từ vựng */}
        <div className="vocab-stat-card">
          <div className="vocab-stat-icon-wrapper vocab-stat-icon-amber">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="vocab-stat-label">Tổng số bộ thẻ</div>
            <div className="vocab-stat-number">
              {decks.length}
              <span className="vocab-stat-subtext">bộ ({totalCardsAll} từ)</span>
            </div>
          </div>
        </div>

        {/* Số thẻ cần ôn tập hôm nay */}
        <div className="vocab-stat-card">
          <div className="vocab-stat-icon-wrapper vocab-stat-icon-orange">
            <Flame size={24} />
          </div>
          <div>
            <div className="vocab-stat-label">Cần ôn tập hôm nay</div>
            <div className="vocab-stat-number" style={{ color: '#ea580c' }}>
              {totalDueTodayAll}
              <span className="vocab-stat-subtext">thẻ SRS</span>
            </div>
          </div>
        </div>

        {/* Số thẻ đã thành thạo */}
        <div className="vocab-stat-card">
          <div className="vocab-stat-icon-wrapper vocab-stat-icon-emerald">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="vocab-stat-label">Đã thành thạo</div>
            <div className="vocab-stat-number" style={{ color: '#059669' }}>
              {totalMasteredAll}
              <span className="vocab-stat-subtext">từ vựng</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. THANH TÌM KIẾM & BỘ LỌC NGÔN NGỮ (FILTER ROW)
         ======================================================== */}
      <div className="vocab-filter-row">
        {/* Ô input tìm kiếm */}
        <div className="vocab-search-box">
          <Search size={18} className="vocab-search-icon" />
          <input
            type="text"
            className="vocab-search-input"
            placeholder="Tìm kiếm bộ thẻ theo tên, mục tiêu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Các nút Tab lọc nhanh theo ngôn ngữ học */}
        <div className="vocab-lang-tabs">
          <button
            onClick={() => setSelectedLang('ALL')}
            className={`vocab-lang-tab ${selectedLang === 'ALL' ? 'active' : 'inactive'}`}
          >
            Tất cả ({decks.length})
          </button>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const count = decks.filter(
              (d) => d.targetLanguage === lang.code || d.sourceLanguage === lang.code
            ).length;
            if (count === 0 && selectedLang !== lang.code) return null;
            return (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={`vocab-lang-tab ${selectedLang === lang.code ? 'active' : 'inactive'}`}
              >
                <span>{lang.shortLabel}</span>
                <span style={{ opacity: 0.8 }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          4. DANH SÁCH BỘ THẺ DẠNG LƯỚI (DECK GRID)
         ======================================================== */}
      {loading ? (
        // Hiệu ứng Loading Skeleton khi đang fetch API
        <div className="vocab-deck-grid">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="vocab-deck-card"
              style={{ height: '230px', animation: 'pulse 1.5s infinite', background: '#f9fafb' }}
            >
              <div style={{ height: '16px', background: '#e5e7eb', borderRadius: '8px', width: '40%' }}></div>
              <div style={{ height: '24px', background: '#e5e7eb', borderRadius: '8px', width: '70%', margin: '1rem 0' }}></div>
              <div style={{ height: '16px', background: '#e5e7eb', borderRadius: '8px', width: '90%' }}></div>
              <div style={{ height: '40px', background: '#e5e7eb', borderRadius: '12px', marginTop: 'auto' }}></div>
            </div>
          ))}
        </div>
      ) : filteredDecks.length === 0 ? (
        // Giao diện khi không có dữ liệu (Empty State)
        <div
          className="vocab-deck-card"
          style={{ padding: '3.5rem 2rem', textAlign: 'center', borderStyle: 'dashed', borderWidth: '2px' }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <BookOpen size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '0.5rem' }}>
            {searchTerm ? 'Không tìm thấy bộ thẻ phù hợp' : 'Chưa có bộ thẻ từ vựng nào'}
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#6b7280', maxWidth: '440px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            {searchTerm
              ? 'Thử tìm với từ khóa khác hoặc bấm Tất cả để xem lại toàn bộ các bộ thẻ.'
              : 'Hãy tạo bộ thẻ đầu tiên để lưu lại những từ vựng bạn muốn ghi nhớ và bắt đầu ôn tập ngay hôm nay!'}
          </p>
          <button
            onClick={onCreateClick}
            className="vocab-btn-create-deck"
            style={{ margin: '0 auto' }}
          >
            <Plus size={18} /> Tạo bộ thẻ đầu tiên
          </button>
        </div>
      ) : (
        // Lưới hiển thị các thẻ bộ thẻ
        <div className="vocab-deck-grid">
          {filteredDecks.map((deck) => {
            const hasDue = deck.dueTodayCards > 0;
            return (
              <div key={deck.id} className="vocab-deck-card">
                <div>
                  {/* Hàng trên cùng: Cặp ngôn ngữ & Quyền riêng tư & Nút Sửa/Xóa */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    {/* Badge Cặp ngôn ngữ học [Target ➔ Source] không bị lỗi font trên Windows */}
                    <div className="vocab-pair-chip">
                      <span className="vocab-lang-tag target">{getLangShort(deck.targetLanguage)}</span>
                      <span style={{ color: '#d97706' }}>➔</span>
                      <span className="vocab-lang-tag source">{getLangShort(deck.sourceLanguage)}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#78350f', marginLeft: '0.2rem' }}>
                        {getLangName(deck.targetLanguage)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {/* Biểu tượng trạng thái công khai */}
                      {deck.isPublic ? (
                        <span style={{ color: '#059669', display: 'flex', alignItems: 'center' }} title="Công khai">
                          <Globe size={15} />
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center' }} title="Riêng tư">
                          <Lock size={15} />
                        </span>
                      )}

                      {/* Nút Chỉnh sửa */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditDeck(deck);
                        }}
                        style={{
                          padding: '0.35rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'transparent',
                          color: '#9ca3af',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#d97706')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                        title="Chỉnh sửa bộ thẻ"
                      >
                        <Edit2 size={16} />
                      </button>

                      {/* Nút Xóa */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDeck(deck);
                        }}
                        style={{
                          padding: '0.35rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'transparent',
                          color: '#9ca3af',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                        title="Xóa bộ thẻ"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Tên bộ thẻ */}
                  <h3
                    onClick={() => onSelectDeck(deck)}
                    className="vocab-card-title"
                  >
                    {deck.name}
                  </h3>

                  {/* Mô tả bộ thẻ */}
                  <p className="vocab-card-desc">
                    {deck.description || 'Chưa có mô tả cho bộ thẻ này.'}
                  </p>

                  {/* Dòng Thống kê thẻ: Tổng, Mới, Đang học, Thành thạo */}
                  <div className="vocab-stats-row">
                    <span style={{ fontWeight: 800, color: '#111827' }}>
                      {deck.totalCards} <span style={{ fontWeight: 500, color: '#6b7280' }}>từ vựng</span>
                    </span>

                    <div className="vocab-pill-stats">
                      <span className="vocab-stat-dot blue" title="Từ mới">
                        <span className="dot-circle blue"></span>
                        {deck.newCards}
                      </span>
                      <span className="vocab-stat-dot amber" title="Đang học">
                        <span className="dot-circle amber"></span>
                        {deck.learningCards}
                      </span>
                      <span className="vocab-stat-dot emerald" title="Thành thạo">
                        <span className="dot-circle emerald"></span>
                        {deck.masteredCards}
                      </span>
                    </div>
                  </div>

                  {/* Alert nếu có thẻ cần ôn hôm nay */}
                  {hasDue && (
                    <div className="vocab-due-alert">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Flame size={15} className="fill-orange-500 text-orange-500" />
                        Cần ôn tập hôm nay:
                      </span>
                      <span style={{ fontWeight: 800, color: '#9a3412' }}>{deck.dueTodayCards} thẻ</span>
                    </div>
                  )}
                </div>

                {/* Hàng nút bấm hành động ở chân thẻ */}
                <div className="vocab-card-actions">
                  <button
                    onClick={() => onSelectDeck(deck)}
                    className="vocab-btn-secondary"
                  >
                    Xem từ vựng
                  </button>

                  <button
                    onClick={() => onStudyDeck(deck)}
                    disabled={deck.totalCards === 0}
                    className={hasDue ? 'vocab-btn-primary' : 'vocab-btn-study-soft'}
                  >
                    {hasDue ? <Flame size={16} /> : <GraduationCap size={16} />}
                    {hasDue ? 'Ôn tập ngay' : 'Luyện tập'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
