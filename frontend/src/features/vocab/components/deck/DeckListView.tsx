import React, { useState, useMemo } from 'react';
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
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DeckSummary } from '../../types/vocab.types';
import { SUPPORTED_LANGUAGES } from '../../types/vocab.types';
import { EmptyState } from '../common/EmptyState';

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
 * 2. Thống kê 3 chỉ số chính: Tổng số từ, Số từ tới hạn cần ôn tập hôm nay, Số từ đã thành thạo.
 * 3. Bộ lọc đa năng: Tìm kiếm theo tên/mô tả bộ thẻ kết hợp lọc nhanh theo ngôn ngữ mục tiêu (EN, JA, KO...).
 * 4. Lưới hiển thị các thẻ bộ từ vựng: Hiển thị tag cặp ngôn ngữ, thanh tiến độ % thành thạo, nút Xem chi tiết và menu thao tác Sửa/Xóa.
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
  const { t } = useTranslation();

  // State lưu từ khóa tìm kiếm bộ thẻ của người dùng
  const [searchTerm, setSearchTerm] = useState('');

  // State lưu mã ngôn ngữ đang được lọc ('ALL' hoặc 'en', 'ja', 'ko'...)
  const [selectedLang, setSelectedLang] = useState<string>('ALL');

  /**
   * Tính toán số liệu thống kê tổng hợp của toàn bộ các bộ thẻ:
   * - totalCards: Tổng số lượng thẻ từ vựng đã tạo
   * - dueTodayCards: Số thẻ đang tới hạn cần ôn tập (theo thuật toán SRS)
   * - masteredCards: Số thẻ đã ghi nhớ vững chắc (trạng thái MASTERED)
   */
  const stats = useMemo(() => {
    return decks.reduce(
      (acc, d) => ({
        totalCards: acc.totalCards + (d.totalCards || 0),
        dueTodayCards: acc.dueTodayCards + (d.dueTodayCards || 0),
        masteredCards: acc.masteredCards + (d.masteredCards || 0),
      }),
      { totalCards: 0, dueTodayCards: 0, masteredCards: 0 }
    );
  }, [decks]);

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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Header Banner & Nút Tạo bộ thẻ */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 p-6 sm:p-7 text-white shadow-md shadow-amber-500/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
              {t('vocab.my_decks')}
            </h1>
            <p className="text-base text-amber-50 leading-relaxed font-medium">
              {t('vocab.my_decks_subtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-white text-amber-900 hover:text-amber-950 font-extrabold text-sm shadow-sm hover:bg-amber-100 transition-all transform hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap self-start md:self-auto"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>{t('vocab.create_deck')}</span>
          </button>
        </div>

        {/* Vòng trang trí mờ phía sau */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>

      {/* 2. Ba thẻ Thống Kê Tổng Hợp */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Tổng số từ */}
        <div className="p-5 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-700 block">
              {t('vocab.deck_detail.total_words')}
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-3xl font-black text-slate-900">{stats.totalCards}</span>
              <span className="text-sm text-slate-600 font-medium">từ vựng</span>
            </div>
          </div>
        </div>

        {/* Cần ôn hôm nay */}
        <div className="p-5 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-700 block">
              {t('vocab.deck_detail.due_words')}
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-3xl font-black text-amber-600">{stats.dueTodayCards}</span>
              <span className="text-sm text-slate-600 font-medium">thẻ tới hạn</span>
            </div>
          </div>
        </div>

        {/* Đã thành thạo */}
        <div className="p-5 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-700 block">
              {t('vocab.deck_detail.mastered_words')}
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-3xl font-black text-emerald-600">{stats.masteredCards}</span>
              <span className="text-sm text-slate-600 font-medium">từ thành thạo</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Thanh Tìm Kiếm & Chips Lọc Ngôn Ngữ */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Thanh tìm kiếm */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('vocab.search_decks_placeholder')}
            className="w-full pl-10 pr-4 py-2.5 rounded-md border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400 shadow-xs"
          />
        </div>

        {/* Chip lọc ngôn ngữ */}
        {availableLangs.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedLang('ALL')}
              className={`px-3.5 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all ${
                selectedLang === 'ALL'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              {t('vocab.all_languages')}
            </button>
            {availableLangs.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setSelectedLang(lang.code)}
                className={`px-3 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedLang.toLowerCase() === lang.code.toLowerCase()
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>{lang.shortLabel}</span>
                <span className="text-xs opacity-90">{lang.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Danh Sách Lưới Bộ Thẻ (Deck Grid) */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-lg bg-slate-100 animate-pulse border border-slate-200" />
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
                className="group bg-white rounded-lg p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-400 transition-all duration-200 flex flex-col justify-between cursor-pointer relative"
              >
                {/* Phần trên: Tag ngôn ngữ & Nút menu sửa/xóa */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 text-xs font-bold border border-amber-200 shadow-xs">
                      <span className="uppercase tracking-wide font-extrabold">{deck.targetLanguage || 'EN'}</span>
                      <span className="text-amber-500 font-semibold">➔</span>
                      <span className="uppercase tracking-wide font-extrabold">{deck.sourceLanguage || 'VI'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {deck.isPublic ? (
                        <span title="Công khai">
                          <Globe className="w-4 h-4 text-slate-400" />
                        </span>
                      ) : (
                        <span title="Riêng tư">
                          <Lock className="w-4 h-4 text-slate-400" />
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditDeck(deck);
                        }}
                        className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-slate-100 transition-colors ml-1"
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
                        className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title={t('vocab.delete_deck')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tên bộ thẻ & Mô tả */}
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-1 mb-1.5">
                    {deck.name}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                    {deck.description || 'Chưa có mô tả mục tiêu học tập cho bộ thẻ này.'}
                  </p>
                </div>

                {/* Phần dưới: Tiến độ & Nút hành động */}
                <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
                  {/* Thanh tiến độ */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-700 font-semibold">
                        <span>Thành thạo</span>
                      </span>
                      <span className="text-slate-900 font-extrabold">{percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Thống kê thẻ & Nút Xem chi tiết */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-sm font-bold text-slate-800">
                      {t('vocab.cards_count', { count: total })}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDeck(deck);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white transition-all text-xs sm:text-sm font-bold shadow-xs active:translate-y-0 hover:-translate-y-0.5"
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
  );
};

export default DeckListView;
