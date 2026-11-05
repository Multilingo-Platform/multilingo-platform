import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Edit2,
  Trash2,
  ArrowRight,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DeckSummary } from '../../types/vocab.types';
import { SUPPORTED_LANGUAGES } from '../../types/vocab.types';
import { EmptyState } from '../common/EmptyState';
import flashcardBannerImg from '../../../../assets/flashcard-banner.jpg';

/**
 * Interface định nghĩa các thuộc tính đầu vào (Props) cho component DeckListView:
 * - decks: Danh sách các bộ thẻ từ vựng của người dùng
 * - loading: Trạng thái đang tải dữ liệu từ API
 * - onSelectDeck: Callback khi người dùng chọn vào 1 bộ thẻ (chuyển sang DeckDetailView)
 * - onStudyDeck: Callback khi người dùng muốn bắt đầu phiên học tập ngay
 * - onCreateClick: Callback mở Modal tạo bộ thẻ mới
 * - onEditDeck: Callback mở Modal chỉnh sửa bộ thẻ đã chọn
 * - onDeleteDeck: Callback kích hoạt luồng xác nhận xóa bộ thẻ
 */
export interface DeckListViewProps {
  decks: DeckSummary[];
  loading: boolean;
  onSelectDeck: (deck: DeckSummary) => void;
  onStudyDeck: (deck: DeckSummary) => void;
  onCreateClick: () => void;
  onEditDeck: (deck: DeckSummary) => void;
  onDeleteDeck: (deck: DeckSummary) => void;
}

/**
 * Component DeckListView (Màn hình Danh sách Bộ thẻ từ vựng)
 *
 * CHỨC NĂNG CHÍNH:
 * 1. Hiển thị Banner tổng quan và nút "Tạo bộ thẻ" nhanh.
 * 2. Bộ lọc đa năng: Tìm kiếm theo tên/mô tả bộ thẻ kết hợp lọc nhanh theo ngôn ngữ mục tiêu (EN, JA, KO...).
 * 3. Lưới hiển thị các thẻ bộ từ vựng: Hiển thị tag cặp ngôn ngữ, thanh tiến độ % thành thạo, nút Xem chi tiết và menu thao tác Sửa/Xóa.
 */
export const DeckListView: React.FC<DeckListViewProps> = ({
  decks,
  loading,
  onSelectDeck,
  onStudyDeck: _onStudyDeck,
  onCreateClick,
  onEditDeck,
  onDeleteDeck,
}) => {
  const { t } = useTranslation();

  // State lưu từ khóa tìm kiếm bộ thẻ của người dùng
  const [searchTerm, setSearchTerm] = useState('');

  // State lưu mã ngôn ngữ đang được lọc ('ALL' hoặc 'en', 'ja', 'ko'...)
  const [selectedLang, setSelectedLang] = useState<string>('ALL');

  /**
   * Lọc danh sách các ngôn ngữ thực tế có trong bộ thẻ của người dùng
   * để sinh ra các nút chip lọc ngôn ngữ tương ứng
   */
  const availableLangs = useMemo(() => {
    const langCodes = new Set(decks.map((d) => d.targetLanguage || 'en'));
    return SUPPORTED_LANGUAGES.filter((l) => langCodes.has(l.code));
  }, [decks]);

  /**
   * Lọc danh sách bộ thẻ theo từ khóa tìm kiếm (so khớp không phân biệt hoa thường)
   * và theo ngôn ngữ mục tiêu đã chọn
   */
  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => {
      const matchSearch =
        deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (deck.description && deck.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchLang =
        selectedLang === 'ALL' || (deck.targetLanguage || 'en').toLowerCase() === selectedLang.toLowerCase();

      return matchSearch && matchLang;
    });
  }, [decks, searchTerm, selectedLang]);

  return (
    <div className="w-full pb-12 animate-in fade-in duration-300">
      {/* 1. Hero Section - Full-width Banner & Minh Họa Sinh Động */}
      <header className="relative w-full overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/10">
        {/* Vòng trang trí nền tạo hiệu ứng ánh sáng mờ */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -bottom-20 left-10 w-80 h-80 rounded-full bg-yellow-300/20 blur-3xl" />
        </div>

        {/* Nội dung Banner căn giữa chuẩn max-w-7xl */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* Cột trái: Tiêu đề, Mô tả chính, Text hỗ trợ cân đối & Hàng Thao tác */}
            <div className="flex-1 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mb-3.5 leading-tight">
                {t('vocab.my_decks', 'Bộ thẻ từ vựng')}
              </h1>

              {/* Mô tả chính */}
              <p className="text-base sm:text-lg text-amber-50 leading-relaxed font-medium mb-3 opacity-95">
                {t(
                  'vocab.my_decks_subtitle',
                  'Khám phá 4 cách học từ vựng thú vị: ghi nhớ với Flashcard, luyện tập kiến thức, thử thách bản thân với bài thi và ghép từ đầy thú vị.'
                )}
              </p>

              {/* Text bổ trợ giúp cân đối với chiều cao ảnh minh họa */}
              <p className="text-sm sm:text-base text-amber-100/90 leading-relaxed font-normal mb-5">
                {t(
                  'vocab.my_decks_supplement',
                  'Tự do tạo lập các bộ thẻ cá nhân theo từng chủ đề hoặc luyện tập theo lộ trình thông minh để ghi nhớ sâu sắc và gia tăng vốn từ nhanh chóng.'
                )}
              </p>

              {/* 4 Chế độ học tập trực quan (Bo góc vừa phải rounded-lg, không bo tròn quá) */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-xs border border-white/25 text-xs sm:text-sm font-bold text-white shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-yellow-300"></span>
                  Flashcard SRS
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-xs border border-white/25 text-xs sm:text-sm font-bold text-white shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                  Luyện tập trắc nghiệm
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-xs border border-white/25 text-xs sm:text-sm font-bold text-white shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-sky-300"></span>
                  Bài thi thử thách
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-xs border border-white/25 text-xs sm:text-sm font-bold text-white shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-pink-300"></span>
                  Ghép từ vui nhộn
                </span>
              </div>

              {/* Hàng Tìm kiếm & Nút Tạo bộ thẻ (Bo góc vừa phải rounded-lg, không bo tròn quá) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('vocab.search_decks_placeholder', 'Tìm kiếm bộ thẻ...')}
                    className="w-full pl-11 pr-10 py-3 rounded-lg bg-white text-slate-900 text-sm sm:text-base font-medium shadow-sm border border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all placeholder:text-slate-400"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                      title="Xóa tìm kiếm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onCreateClick}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white text-orange-600 hover:text-orange-700 font-extrabold text-sm shadow-sm hover:bg-amber-50 transition-all transform hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>{t('vocab.create_deck', 'Tạo bộ thẻ')}</span>
                </button>
              </div>
            </div>

            {/* Cột phải: Hình ảnh minh họa bộ thẻ từ vựng sinh động */}
            <div className="hidden lg:flex items-center justify-end shrink-0 select-none">
              <div className="relative overflow-hidden rounded-xl shadow-2xl border-2 border-white/40 max-w-xs sm:max-w-sm xl:max-w-md transform hover:scale-[1.02] transition-transform duration-300">
                <img
                  src={flashcardBannerImg}
                  alt="Minh họa flashcards từ vựng"
                  className="w-full h-auto object-cover rounded-lg block"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Nội dung chính bên dưới (Tabs lọc ngôn ngữ & Lưới bộ thẻ) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        {/* Thanh Tabs Lọc ngôn ngữ (Bo góc vừa phải rounded-lg) */}
        {availableLangs.length > 0 && (
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedLang('ALL')}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                selectedLang === 'ALL'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t('vocab.all_languages', 'Tất cả ngôn ngữ')}
            </button>
            {availableLangs.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setSelectedLang(lang.code)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedLang.toLowerCase() === lang.code.toLowerCase()
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="font-extrabold">{lang.shortLabel}</span>
                <span className="text-xs opacity-90 font-medium">({lang.name.replace(/\s*\([^)]*\)/, '')})</span>
              </button>
            ))}
          </div>
        )}

        {/* 3. Danh Sách Lưới Bộ Thẻ (Deck Grid) */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
            ))}
          </div>
        ) : filteredDecks.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={t('vocab.empty_decks_title')}
            description={
              searchTerm || selectedLang !== 'ALL'
                ? 'Không tìm thấy bộ thẻ nào phù hợp với bộ lọc hiện tại.'
                : t('vocab.empty_decks_desc')
            }
            actionText={searchTerm || selectedLang !== 'ALL' ? undefined : t('vocab.create_deck')}
            onAction={searchTerm || selectedLang !== 'ALL' ? undefined : onCreateClick}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDecks.map((deck) => {
              const total = deck.totalCards || 0;
              const mastered = deck.masteredCards || 0;
              const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;

              return (
                <div
                  key={deck.id}
                  onClick={() => onSelectDeck(deck)}
                  className="group bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-400/80 transition-all duration-200 flex flex-col justify-between cursor-pointer relative"
                >
                  {/* Phần trên: Tag ngôn ngữ & Nút menu sửa/xóa */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-bold border border-orange-200/80 shadow-2xs">
                        <span className="uppercase tracking-wide font-extrabold">{deck.targetLanguage || 'EN'}</span>
                        <span className="text-orange-400 font-semibold">➔</span>
                        <span className="uppercase tracking-wide font-extrabold">{deck.sourceLanguage || 'VI'}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditDeck(deck);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                          title={t('vocab.edit_deck')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDeck(deck);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title={t('vocab.delete_deck')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Tên bộ thẻ & Mô tả */}
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-1 mb-1.5">
                      {deck.name}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                      {deck.description || 'Không có mô tả'}
                    </p>
                  </div>

                  {/* Phần dưới: Tiến độ & Nút hành động */}
                  <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
                    {/* Thanh tiến độ */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                        <span className="text-slate-600 font-medium">Thành thạo</span>
                        <span className="text-slate-900 font-bold">{percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Thống kê thẻ & Nút Xem chi tiết */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-sm font-bold text-slate-700">
                        {t('vocab.cards_count', { count: total })}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDeck(deck);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-all text-xs sm:text-sm font-bold shadow-xs active:translate-y-0 hover:-translate-y-0.5"
                      >
                        <span>{t('vocab.actions.view_detail')}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeckListView;
