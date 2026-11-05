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
  Flame,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DeckSummary, Flashcard } from '../../types/vocab.types';
import { speakWord } from '../../../../utils/speech';
import flashcardDetailBannerImg from '../../../../assets/flashcard-detail-banner.png';

/**
 * Interface định nghĩa các thuộc tính đầu vào (Props) cho Component DeckDetailView:
 * - deck: Đối tượng chứa thông tin tổng quan của bộ thẻ đang xem
 * - cards: Danh sách các thẻ từ vựng thuộc bộ thẻ này
 * - loading: Cờ trạng thái đang tải dữ liệu từ máy chủ
 * - onBack: Hàm callback quay lại màn hình danh sách các bộ thẻ
 * - onStudyClick: Hàm callback bắt đầu phiên học Flashcard (thuật toán SRS)
 * - onQuizClick: Hàm callback bắt đầu chế độ Luyện tập trắc nghiệm
 * - onTestClick: Hàm callback bắt đầu chế độ Thi thử tính giờ
 * - onMatchGameClick: Hàm callback bắt đầu trò chơi Ghép từ nhanh
 * - onAddCardClick: Hàm callback mở Modal thêm từ vựng mới
 * - onEditCard: Hàm callback mở Modal chỉnh sửa một từ vựng
 * - onDeleteCard: Hàm callback kích hoạt xác nhận xóa một từ vựng
 * - onFilterChange: Hàm callback thông báo từ khóa tìm kiếm và trạng thái lọc cho component cha
 */
export interface DeckDetailViewProps {
  deck: DeckSummary;
  cards: Flashcard[];
  loading: boolean;
  onBack: () => void;
  onEditDeck?: () => void;
  onStudyClick: () => void;
  onQuizClick?: () => void;
  onTestClick?: () => void;
  onMatchGameClick?: () => void;
  onAddCardClick: () => void;
  onEditCard: (card: Flashcard) => void;
  onDeleteCard: (card: Flashcard) => void;
  onFilterChange: (keyword: string, status: string) => void;
}

/**
 * Component DeckDetailView (Màn hình Chi tiết Bộ thẻ Từ vựng)
 *
 * THIẾT KẾ ĐỒNG NHẤT VỚI TRANG QUẢN LÝ DANH MỤC:
 * 1. Bố cục rộng rãi, thoáng mắt, sử dụng hệ màu Slate & Amber sang trọng.
 * 2. Cỡ chữ to, rõ nét, dễ đọc (bỏ các cỡ chữ siêu nhỏ gây mỏi mắt).
 * 3. Bỏ bớt icon và màu sắc tương phản gắt, sử dụng icon Lucide tinh tế.
 * 4. 4 Thẻ Thống kê độc lập chuẩn giao diện Dashboard.
 * 5. 4 Thẻ Chế độ Học tập được đồng bộ thiết kế thẻ card sạch sẽ.
 * 6. Bộ lọc và danh sách thẻ (Grid / Table) hiển thị ảnh minh họa và phát âm chuẩn.
 */
export const DeckDetailView: React.FC<DeckDetailViewProps> = ({
  deck,
  cards,
  loading,
  onBack,
  onEditDeck,
  onStudyClick,
  onQuizClick,
  onTestClick,
  onMatchGameClick,
  onAddCardClick,
  onEditCard,
  onDeleteCard,
  onFilterChange,
}) => {
  const { t } = useTranslation();

  // State lưu từ khóa tìm kiếm từ vựng (từ, nghĩa, phiên âm)
  const [keyword, setKeyword] = useState('');

  // State lưu trạng thái lọc thẻ ('ALL', 'DUE', 'LEARNING', 'MASTERED')
  const [status, setStatus] = useState('ALL');

  // State chuyển đổi chế độ xem: 'GRID' (dạng thẻ bài) hoặc 'TABLE' (dạng bảng tra cứu)
  const [displayMode, setDisplayMode] = useState<'GRID' | 'TABLE'>('GRID');

  /**
   * Xử lý khi người dùng nhập từ khóa tìm kiếm
   */
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setKeyword(val);
    onFilterChange(val, status);
  };

  /**
   * Xử lý khi người dùng bấm chọn tab lọc trạng thái
   */
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    onFilterChange(keyword, newStatus);
  };

  /**
   * Chuyển đổi loại từ (Part of Speech) sang dạng viết tắt chữ thường không có dấu chấm (n, v, adj, adv...)
   */
  const formatPosShort = (pos?: string): string => {
    if (!pos) return '';
    const clean = pos.toLowerCase().trim().replace(/\.+$/, '');
    switch (clean) {
      case 'noun':
      case 'n':
        return 'n';
      case 'verb':
      case 'v':
        return 'v';
      case 'adjective':
      case 'adj':
        return 'adj';
      case 'adverb':
      case 'adv':
        return 'adv';
      case 'preposition':
      case 'prep':
        return 'prep';
      case 'conjunction':
      case 'conj':
        return 'conj';
      case 'interjection':
      case 'interj':
        return 'interj';
      case 'pronoun':
      case 'pron':
        return 'pron';
      case 'phrase':
      case 'phr':
        return 'phr';
      case 'idiom':
      case 'idm':
        return 'idm';
      default:
        return clean;
    }
  };

  /**
   * Render thông tin lịch ôn tập dự kiến của thẻ từ vựng
   */
  const renderScheduleText = (card: Flashcard) => {
    if (card.status === 'MASTERED') {
      return (
        <span className="text-xs font-bold text-emerald-700">
          {t('vocab.deck_detail.schedule_mastered')}
        </span>
      );
    }
    if (card.nextReviewDate) {
      const isDue = new Date(card.nextReviewDate).getTime() <= Date.now() + 60 * 1000;
      if (isDue) {
        return (
          <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('vocab.deck_detail.schedule_due')}</span>
          </span>
        );
      }
      const daysLeft = Math.ceil(
        (new Date(card.nextReviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return (
        <span className="text-xs font-medium text-slate-600">
          {t('vocab.deck_detail.schedule_days_left', { count: daysLeft })}
        </span>
      );
    }
    return (
      <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
        <Flame className="w-3.5 h-3.5 text-amber-500" />
        <span>{t('vocab.deck_detail.schedule_due')}</span>
      </span>
    );
  };

  return (
    <div className="w-full pb-12 animate-in fade-in duration-300">
      {/* 1. Hero Section - Full-width Banner Màu Cam & Minh Họa Sinh Động */}
      <header className="relative w-full overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/10">
        {/* Vòng trang trí nền tạo hiệu ứng ánh sáng mờ */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -bottom-20 left-10 w-80 h-80 rounded-full bg-yellow-300/20 blur-3xl" />
        </div>

        {/* Nội dung Banner căn giữa chuẩn max-w-7xl */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* Cột trái: Điều hướng, Tiêu đề, Mô tả, Tags & Nút Thao tác */}
            <div className="flex-1 max-w-2xl">
              {/* Nút Quay lại danh sách bộ thẻ */}
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-100 hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-white/10 -ml-3 mb-4 backdrop-blur-xs"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                <span>{t('vocab.deck_detail.back_to_decks', 'Quay lại danh sách bộ thẻ')}</span>
              </button>

              {/* Tên bộ thẻ */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white mb-3 leading-tight">
                {deck.name}
              </h1>

              {/* Mô tả bộ thẻ */}
              <p className="text-base sm:text-lg text-amber-50 leading-relaxed font-medium mb-3 opacity-95">
                {deck.description || t('vocab.deck_detail.no_desc', 'Chưa có mô tả mục tiêu học tập cho bộ thẻ này.')}
              </p>

              {/* Text bổ trợ cân đối và truyền cảm hứng học tập */}
              <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed font-normal mb-6">
                {t(
                  'vocab.deck_detail.hero_supplement',
                  'Luyện tập đều đặn với 4 chế độ học thông minh bên dưới để tối ưu hóa khả năng ghi nhớ ngắt quãng và làm chủ từ vựng nhanh chóng.'
                )}
              </p>

              {/* Hàng Nút Thao tác: + Thêm từ mới (Kích thước to, nổi bật) */}
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={onAddCardClick}
                  className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 sm:py-4 rounded-xl bg-white text-orange-600 hover:text-orange-700 font-black text-base shadow-md hover:shadow-lg hover:bg-amber-50 transition-all transform hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-5 h-5 stroke-[3]" />
                  <span>{t('vocab.deck_detail.add_card', 'Thêm từ mới')}</span>
                </button>
              </div>
            </div>

            {/* Cột phải: Minh họa bộ thẻ từ vựng đầy màu sắc */}
            <div className="hidden lg:flex items-center justify-end shrink-0 select-none">
              <div className="relative overflow-hidden rounded-xl shadow-2xl border-2 border-white/40 w-64 h-64 xl:w-72 xl:h-72 bg-white/15 backdrop-blur-xs p-4 flex items-center justify-center transform hover:scale-[1.03] transition-transform duration-300">
                <img
                  src={flashcardDetailBannerImg}
                  alt="Minh họa bộ thẻ từ vựng"
                  className="w-full h-full object-contain rounded-lg drop-shadow-md"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Nội dung chính bên dưới (4 Chế độ học tập, Bộ lọc & Danh sách từ vựng) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 sm:mt-12 space-y-12">
        {/* BỐN CHẾ ĐỘ HỌC & LUYỆN TẬP */}
        <section>
          {/* Đề mục Section: Tiêu đề & Mô tả căn chỉnh lề (margin) rộng rãi, cân đối */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {t('vocab.deck_detail.modes_title', 'Chế độ Học & Luyện tập')}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium mt-1.5">
              {t(
                'vocab.deck_detail.modes_subtitle',
                'Lựa chọn phương pháp rèn luyện phù hợp để ghi nhớ từ vựng hiệu quả nhất'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Chế độ 1: Flashcard SRS */}
            <div className="relative overflow-hidden bg-white rounded-xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-orange-300 transition-all duration-200 flex flex-col justify-between group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-amber-500" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white transition-all">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200/80">
                    {deck.dueTodayCards
                      ? t('vocab.deck_detail.mode_srs_badge', { count: deck.dueTodayCards })
                      : t('vocab.deck_detail.mode_srs_default_badge', 'SRS Chuẩn')}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 group-hover:text-orange-600 transition-colors mb-2">
                  {t('vocab.deck_detail.mode_study_title', 'Flashcard')}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed min-h-[3rem] mb-5">
                  {t(
                    'vocab.deck_detail.mode_study_desc',
                    'Lặp lại ngắt quãng thông minh chống quên, lật thẻ 3D ghi nhớ phản xạ tự nhiên.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={onStudyClick}
                disabled={cards.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>{t('vocab.deck_detail.mode_study_btn', 'Ôn tập Flashcard')}</span>
              </button>
            </div>

            {/* Chế độ 2: Luyện tập Trắc nghiệm */}
            <div className="relative overflow-hidden bg-white rounded-xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 flex flex-col justify-between group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <Target className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    {t('vocab.deck_detail.mode_quiz_badge', 'Phản xạ')}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-600 transition-colors mb-2">
                  {t('vocab.deck_detail.mode_quiz_title', 'Luyện tập')}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed min-h-[3rem] mb-5">
                  {t(
                    'vocab.deck_detail.mode_quiz_desc',
                    'Trắc nghiệm 4 đáp án chọn nghĩa từ vựng, củng cố phản xạ nhận diện từ ngữ.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={onQuizClick}
                disabled={cards.length < 4}
                title={cards.length < 4 ? t('vocab.requirements.min_cards_quiz') : t('vocab.deck_detail.mode_quiz_btn')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
              >
                <Target className="w-4 h-4" />
                <span>
                  {cards.length < 4
                    ? t('vocab.deck_detail.mode_min_cards', 'Cần ≥ 4 từ vựng')
                    : t('vocab.deck_detail.mode_quiz_btn', 'Bắt đầu Luyện tập')}
                </span>
              </button>
            </div>

            {/* Chế độ 3: Thi thử Tính giờ */}
            <div className="relative overflow-hidden bg-white rounded-xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-sky-300 transition-all duration-200 flex flex-col justify-between group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-500" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 group-hover:scale-105 group-hover:bg-sky-600 group-hover:text-white transition-all">
                    <Clock className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-200/80">
                    {t('vocab.deck_detail.mode_test_badge', 'Tính giờ')}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 group-hover:text-sky-600 transition-colors mb-2">
                  {t('vocab.deck_detail.mode_test_title', 'Thi thử')}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed min-h-[3rem] mb-5">
                  {t(
                    'vocab.deck_detail.mode_test_desc',
                    'Bài kiểm tra từ vựng có tính giờ, chấm điểm tự động và tổng kết kết quả.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={onTestClick}
                disabled={cards.length < 4}
                title={cards.length < 4 ? t('vocab.requirements.min_cards_test') : t('vocab.deck_detail.mode_test_btn')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>
                  {cards.length < 4
                    ? t('vocab.deck_detail.mode_min_cards', 'Cần ≥ 4 từ vựng')
                    : t('vocab.deck_detail.mode_test_btn', 'Làm bài Thi thử')}
                </span>
              </button>
            </div>

            {/* Chế độ 4: Ghép từ Tốc độ */}
            <div className="relative overflow-hidden bg-white rounded-xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-purple-300 transition-all duration-200 flex flex-col justify-between group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-pink-500" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <Gamepad2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80">
                    {t('vocab.deck_detail.mode_match_badge', '60 Giây')}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 group-hover:text-purple-600 transition-colors mb-2">
                  {t('vocab.deck_detail.mode_match_title', 'Ghép từ')}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed min-h-[3rem] mb-5">
                  {t(
                    'vocab.deck_detail.mode_match_desc',
                    'Trò chơi nối nhanh từ vựng với định nghĩa tương ứng, đua combo điểm số.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={onMatchGameClick}
                disabled={cards.length < 6}
                title={cards.length < 6 ? t('vocab.requirements.min_cards_match') : t('vocab.deck_detail.mode_match_btn')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>
                  {cards.length < 6
                    ? t('vocab.deck_detail.mode_min_cards', 'Cần ≥ 6 từ vựng')
                    : t('vocab.deck_detail.mode_match_btn', 'Chơi Ghép từ')}
                </span>
              </button>
            </div>
          </div>
        </section>

      {/* ========================================================
          4. DANH SÁCH TỪ VỰNG & THANH CÔNG CỤ TÌM KIẾM / LỌC
         ======================================================== */}
      <section className="space-y-5">
        {/* Thanh công cụ: Tìm kiếm, Tabs lọc trạng thái, Chuyển Grid/Table */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Nhóm Tabs Lọc trạng thái (Đồng bộ nút bấm với DeckListView) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'ALL', label: t('vocab.deck_detail.filter_all'), count: deck.totalCards },
              { id: 'DUE', label: t('vocab.deck_detail.filter_due'), count: deck.dueTodayCards || 0 },
              { id: 'LEARNING', label: t('vocab.deck_detail.filter_learning'), count: deck.learningCards || 0 },
              { id: 'MASTERED', label: t('vocab.deck_detail.filter_mastered'), count: deck.masteredCards || 0 },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleStatusChange(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                  status === tab.id
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                <span className="ml-1.5 text-xs opacity-90">({tab.count})</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 self-end lg:self-auto w-full lg:w-auto">
            {/* Ô tìm kiếm từ vựng */}
            <div className="relative flex-1 lg:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={keyword}
                onChange={handleKeywordChange}
                placeholder={t('vocab.deck_detail.search_placeholder')}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-400 font-medium shadow-xs"
              />
            </div>

            {/* Bộ chuyển đổi kiểu xem Grid / Table */}
            <div className="flex items-center p-1 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setDisplayMode('GRID')}
                className={`p-1.5 rounded-md text-sm font-bold transition-all ${
                  displayMode === 'GRID'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title={t('vocab.deck_detail.view_grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('TABLE')}
                className={`p-1.5 rounded-md text-sm font-bold transition-all ${
                  displayMode === 'TABLE'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title={t('vocab.deck_detail.view_table')}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Nội dung danh sách thẻ từ vựng */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-56 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          /* Trạng thái trống (Empty State) */
          <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-xl border border-dashed border-slate-300">
            <div className="w-16 h-16 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3 border border-orange-200">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">
              {keyword
                ? t('vocab.deck_detail.empty_search_title')
                : t('vocab.deck_detail.empty_cards_title')}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mb-5 leading-relaxed">
              {keyword
                ? t('vocab.deck_detail.empty_search_desc')
                : t('vocab.deck_detail.empty_cards_desc')}
            </p>
            <button
              type="button"
              onClick={onAddCardClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t('vocab.deck_detail.add_card_btn')}</span>
            </button>
          </div>
        ) : displayMode === 'GRID' ? (
          /* ========================================================
             4.1 DẠNG LƯỚI THẺ TỪ VỰNG RỘNG RÃI (CARDS GRID VIEW)
             ======================================================== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((card) => (
              <div
                key={card.id}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-400/80 transition-all duration-200 flex flex-col justify-between group relative"
              >
                <div>
                  {/* Hàng Header thẻ: Nút loa + Từ vựng + Loại từ (n) + Nút Sửa/Xóa */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => speakWord(card.customWord, deck.targetLanguage)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors shrink-0"
                        title={t('vocab.deck_detail.listen_audio')}
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <h3 className="text-xl font-black text-slate-900 group-hover:text-orange-600 transition-colors break-words">
                          {card.customWord}
                        </h3>
                        {card.pos && (
                          <span className="text-sm font-medium text-slate-500 italic lowercase">
                            ({formatPosShort(card.pos)})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Menu thao tác Sửa / Xóa thẻ từ vựng */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditCard(card)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-slate-100 transition-colors"
                        title={t('vocab.deck_detail.edit_card')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCard(card)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title={t('vocab.deck_detail.delete_card')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Phiên âm IPA nếu có (không viền) */}
                  {card.phonetic && (
                    <div className="mb-2">
                      <span className="text-sm font-mono text-slate-500 font-medium">
                        {card.phonetic}
                      </span>
                    </div>
                  )}

                  {/* Định nghĩa nghĩa tiếng Việt */}
                  <p className="text-base font-bold text-slate-800 leading-snug">
                    {card.customMeaning || t('vocab.deck_detail.no_meaning')}
                  </p>

                  {/* Câu ví dụ ngữ cảnh minh họa */}
                  {card.exampleSentence && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-sm text-slate-600 italic line-clamp-2 leading-relaxed">
                        "{card.exampleSentence}"
                      </p>
                    </div>
                  )}

                  {/* Ảnh minh họa nếu có */}
                  {card.customImageUrl && (
                    <div className="w-full h-40 rounded-lg overflow-hidden my-3 border border-slate-200 bg-slate-50">
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
                </div>

                {/* Phần Chân thẻ: Lịch ôn tập dự kiến & Số lần đã ôn */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                  <div>{renderScheduleText(card)}</div>
                  <span className="text-xs font-medium text-slate-500">
                    {t('vocab.deck_detail.review_count', { count: card.reviewCount || 0 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ========================================================
             4.2 DẠNG BẢNG TRA CỨU CHI TIẾT (TABLE VIEW)
             ======================================================== */
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3.5 px-4" style={{ width: '24%' }}>{t('vocab.deck_detail.table_word')}</th>
                    <th className="py-3.5 px-4" style={{ width: '14%' }}>{t('vocab.deck_detail.table_phonetic')}</th>
                    <th className="py-3.5 px-4" style={{ width: '10%' }}>{t('vocab.deck_detail.table_pos')}</th>
                    <th className="py-3.5 px-4" style={{ width: '28%' }}>{t('vocab.deck_detail.table_meaning')}</th>
                    <th className="py-3.5 px-4" style={{ width: '14%' }}>{t('vocab.deck_detail.table_schedule')}</th>
                    <th className="py-3.5 px-4 text-right" style={{ width: '10%' }}>{t('vocab.deck_detail.table_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cards.map((card) => (
                    <tr key={card.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Cột 1: Từ vựng & Phát âm & Thumbnail ảnh */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {card.customImageUrl && (
                            <img
                              src={card.customImageUrl}
                              alt={card.customWord}
                              className="w-11 h-11 object-cover rounded-lg border border-slate-200 shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => speakWord(card.customWord, deck.targetLanguage)}
                            title={t('vocab.deck_detail.listen_audio')}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors shrink-0"
                          >
                            <Volume2 className="w-5 h-5" />
                          </button>
                          <span className="font-bold text-slate-900 text-base">{card.customWord}</span>
                        </div>
                      </td>

                      {/* Cột 2: Phiên âm */}
                      <td className="py-4 px-4">
                        {card.phonetic ? (
                          <span className="font-mono text-sm text-slate-600">
                            {card.phonetic}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">---</span>
                        )}
                      </td>

                      {/* Cột 3: Loại từ (viết tắt chữ thường) */}
                      <td className="py-4 px-4">
                        {card.pos ? (
                          <span className="text-sm text-slate-600 italic lowercase">
                            {formatPosShort(card.pos)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">---</span>
                        )}
                      </td>

                      {/* Cột 4: Định nghĩa & Câu ví dụ */}
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-bold text-slate-800 text-base leading-snug">
                            {card.customMeaning || t('vocab.deck_detail.no_meaning')}
                          </p>
                          {card.exampleSentence && (
                            <p className="text-xs sm:text-sm text-slate-500 italic mt-1 leading-relaxed">
                              "{card.exampleSentence}"
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Cột 5: Kế hoạch ôn */}
                      <td className="py-4 px-4">
                        <div>
                          {renderScheduleText(card)}
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            {t('vocab.deck_detail.review_count', { count: card.reviewCount || 0 })}
                          </p>
                        </div>
                      </td>

                      {/* Cột 6: Thao tác (Sửa / Xóa, đã bỏ trạng thái) */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onEditCard(card)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-slate-100 transition-colors"
                            title={t('vocab.deck_detail.edit_card')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCard(card)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title={t('vocab.deck_detail.delete_card_from_deck')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </div>
  );
};

export default DeckDetailView;
