import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Volume2,
  Edit2,
  Trash2,
  Flame,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import type { DeckSummary, Flashcard } from '../../types/vocab';
import { SUPPORTED_LANGUAGES } from '../../types/vocab';
import { speakWord } from '../../utils/speech';
import './vocab.css';

/**
 * Interface định nghĩa các Props cho Component Chi tiết Bộ thẻ (DeckDetailView).
 */
interface DeckDetailViewProps {
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
}

/**
 * Component Hiển thị Chi tiết Bộ thẻ và Quản lý Danh sách Thẻ Từ vựng (DeckDetailView).
 *
 * TÍNH NĂNG CHÍNH:
 * 1. Hiển thị thông tin tổng quan của bộ thẻ: Cặp ngôn ngữ, số lượng thẻ, nút bắt đầu ôn tập SRS.
 * 2. Tìm kiếm từ vựng theo từ hoặc nghĩa và lọc theo trạng thái Spaced Repetition (NEW, LEARNING, MASTERED).
 * 3. Tích hợp nút phát âm bản xứ (Web Speech API) trực tiếp bên cạnh mỗi từ vựng.
 * 4. Bảng danh sách thẻ đẹp mắt, hiển thị phiên âm, từ loại, nghĩa, câu ví dụ và ảnh minh họa.
 * 5. Thao tác thêm mới, chỉnh sửa và xóa từng thẻ từ vựng.
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
   * Helper render badge trạng thái SRS với phong cách cổ điển, vuông vắn vừa phải
   */
  const renderStatusBadge = (cardStatus: string) => {
    switch (cardStatus) {
      case 'MASTERED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
            Thành thạo
          </span>
        );
      case 'LEARNING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
            Đang học
          </span>
        );
      case 'NEW':
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>
            Mới
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ========================================================
          1. HEADER CHI TIẾT BỘ THẺ & CÁC NÚT ĐIỀU HƯỚNG
         ======================================================== */}
      <div>
        {/* Nút quay lại danh sách bộ thẻ */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-amber-600 transition mb-3 cursor-pointer"
        >
          <ArrowLeft size={16} /> Quay lại danh sách bộ thẻ
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {/* Badge Cặp ngôn ngữ học [Target ➔ Source] không bị lỗi font trên Windows */}
              <div className="vocab-pair-chip">
                <span className="vocab-lang-tag target">{getLangShort(deck.targetLanguage)}</span>
                <span style={{ color: '#d97706' }}>➔</span>
                <span className="vocab-lang-tag source">{getLangShort(deck.sourceLanguage)}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#78350f', marginLeft: '0.2rem' }}>
                  {getLangName(deck.targetLanguage)}
                </span>
              </div>
              <span className="text-xs text-gray-400 font-medium">
                {deck.totalCards} từ vựng
              </span>
            </div>

            {/* Tên bộ thẻ */}
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              {deck.name}
            </h1>
            {/* Mô tả bộ thẻ */}
            {deck.description && (
              <p className="text-sm text-gray-500 mt-1 max-w-2xl">{deck.description}</p>
            )}
          </div>

          {/* Các nút hành động chính */}
          <div className="flex items-center gap-2.5">
            {/* Nút thêm từ mới */}
            <button
              onClick={onAddCardClick}
              className="btn btn-outline text-sm py-2 flex items-center gap-1.5"
            >
              <Plus size={16} /> Thêm từ mới
            </button>

            {/* Nút bắt đầu học / ôn tập SRS */}
            <button
              onClick={onStudyClick}
              disabled={cards.length === 0}
              className={`btn text-sm py-2 flex items-center gap-2 ${
                cards.length === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {deck.dueTodayCards > 0 ? (
                <>
                  <Flame size={16} className="fill-white" />
                  Ôn tập ngay ({deck.dueTodayCards})
                </>
              ) : (
                <>
                  <GraduationCap size={16} />
                  Luyện tập thẻ
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. THANH TÌM KIẾM TỪ KHÓA & BỘ LỌC TRẠNG THÁI SRS
         ======================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Ô tìm kiếm từ vựng */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white transition"
            placeholder="Tìm theo từ vựng hoặc nghĩa giải thích..."
            value={keyword}
            onChange={handleKeywordChange}
          />
        </div>

        {/* Các nút lọc theo trạng thái SRS */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md border border-gray-200">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'NEW', label: 'Mới' },
            { id: 'LEARNING', label: 'Đang học' },
            { id: 'MASTERED', label: 'Thành thạo' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleStatusChange(tab.id)}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                status === tab.id
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================
          3. DANH SÁCH THẺ TỪ VỰNG (CARDS TABLE / LIST)
         ======================================================== */}
      {loading ? (
        // Hiệu ứng Loading Skeleton khi đang tải danh sách thẻ
        <div className="ed-card bg-white p-6 space-y-4 rounded-lg">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-14 bg-gray-100 rounded-md animate-pulse"></div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        // Giao diện khi chưa có thẻ nào trong bộ (Empty State)
        <div className="ed-card p-10 text-center bg-white rounded-lg border-dashed border-2 border-gray-200">
          <div className="mx-auto w-12 h-12 rounded-md bg-amber-50 flex items-center justify-center text-amber-600 mb-3 border border-amber-200">
            <BookOpen size={24} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">
            {keyword ? 'Không tìm thấy thẻ từ vựng phù hợp' : 'Bộ thẻ này chưa có từ vựng nào'}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
            {keyword
              ? 'Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang tab trạng thái khác.'
              : 'Hãy thêm các từ vựng mới để bắt đầu học và áp dụng thuật toán ghi nhớ Spaced Repetition.'}
          </p>
          <button onClick={onAddCardClick} className="btn btn-primary text-sm inline-flex items-center gap-1.5">
            <Plus size={16} /> Thêm từ vựng đầu tiên
          </button>
        </div>
      ) : (
        // Danh sách các thẻ từ vựng
        <div className="ed-card bg-white overflow-hidden rounded-lg shadow-xs divide-y divide-gray-100">
          {cards.map((card, index) => (
            <div
              key={card.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/70 transition"
            >
              {/* Cột trái: Từ vựng, nút loa phát âm, phiên âm, từ loại */}
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono w-5">#{index + 1}</span>
                  <span className="text-lg font-bold text-gray-900">{card.customWord}</span>

                  {/* Nút phát âm trực tiếp chuẩn Web Speech TTS */}
                  <button
                    onClick={() => speakWord(card.customWord, deck.targetLanguage)}
                    title="Nghe phát âm chuẩn"
                    className="p-1.5 rounded-full text-amber-600 hover:bg-amber-100 transition cursor-pointer"
                  >
                    <Volume2 size={16} />
                  </button>

                  {/* Phiên âm nếu có */}
                  {card.phonetic && (
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                      {card.phonetic}
                    </span>
                  )}

                  {/* Từ loại (Noun, Verb, Adj,...) */}
                  {card.pos && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                      {card.pos}
                    </span>
                  )}
                </div>

                {/* Nghĩa của từ vựng */}
                <p className="text-sm font-medium text-gray-700 mt-1 pl-7">
                  {card.customMeaning || 'Chưa có giải nghĩa'}
                </p>

                {/* Câu ví dụ ngữ cảnh minh họa nếu có */}
                {card.exampleSentence && (
                  <p className="text-xs text-gray-500 italic mt-1.5 pl-7 border-l-2 border-amber-400/60 ml-7">
                    "{card.exampleSentence}"
                  </p>
                )}
              </div>

              {/* Cột giữa: Ảnh minh họa (nếu có) */}
              {card.customImageUrl && (
                <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={card.customImageUrl}
                    alt={card.customWord}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Cột phải: Trạng thái Spaced Repetition & Các nút thao tác */}
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                {/* Trạng thái SRS */}
                <div className="text-right">
                  <div>{renderStatusBadge(card.status)}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Lặp lại: {card.reviewCount} lần
                  </div>
                </div>

                {/* Nút Sửa & Xóa thẻ */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditCard(card)}
                    className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                    title="Chỉnh sửa thẻ"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onDeleteCard(card)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                    title="Xóa thẻ khỏi bộ"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
