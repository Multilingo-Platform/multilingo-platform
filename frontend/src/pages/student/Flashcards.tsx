import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { vocabApi } from '../../core/api/vocabApi';
import type {
  DeckSummary,
  Flashcard,
  CreateDeckRequest,
  CreateFlashcardRequest,
} from '../../types/vocab';
import { DeckListView } from '../../components/vocab/DeckListView';
import { DeckDetailView } from '../../components/vocab/DeckDetailView';
import { SrsStudyView } from '../../components/vocab/SrsStudyView';
import { DeckModal } from '../../components/vocab/DeckModal';
import { CardModal } from '../../components/vocab/CardModal';
import { ConfirmDeleteCardModal } from '../../components/vocab/ConfirmDeleteCardModal';
import { ConfirmDeleteDeckModal } from '../../components/vocab/ConfirmDeleteDeckModal';

// Code-splitting Lazy Loading cho các chế độ học tập nâng cao để tối ưu kích thước bundle ban đầu
const QuizPracticeView = lazy(() =>
  import('../../components/vocab/QuizPracticeView').then((m) => ({ default: m.QuizPracticeView }))
);
const VocabTestView = lazy(() =>
  import('../../components/vocab/VocabTestView').then((m) => ({ default: m.VocabTestView }))
);
const MatchGameView = lazy(() =>
  import('../../components/vocab/MatchGameView').then((m) => ({ default: m.MatchGameView }))
);

/**
 * Kiểu dữ liệu xác định các chế độ hiển thị trên màn hình Sổ tay & Bộ thẻ từ vựng:
 * - 'DECKS_LIST': Xem danh sách tổng quan các bộ thẻ
 * - 'DECK_DETAIL': Xem danh sách các thẻ từ vựng trong 1 bộ thẻ cụ thể
 * - 'STUDY_MODE': Chế độ lật thẻ ôn tập Spaced Repetition (SRS)
 * - 'PRACTICE_MODE': Chế độ Luyện tập trắc nghiệm 4 đáp án
 * - 'TEST_MODE': Chế độ Thi thử kiểm tra từ vựng tính giờ
 * - 'MATCH_MODE': Chế độ Trò chơi Ghép từ tốc độ 60 giây
 */
type ViewMode = 'DECKS_LIST' | 'DECK_DETAIL' | 'STUDY_MODE' | 'PRACTICE_MODE' | 'TEST_MODE' | 'MATCH_MODE';

/**
 * Component Trang chính Quản lý Sổ tay & Bộ thẻ từ vựng (Flashcards.tsx).
 *
 * TÍNH NĂNG CHÍNH:
 * 1. Đóng vai trò là Controller điều phối trung tâm giữa các View: Danh sách Bộ thẻ -> Chi tiết Bộ thẻ -> Chế độ Ôn tập SRS.
 * 2. Kết nối và gọi các API Backend (thông qua vocabApi) để thực hiện đầy đủ các nghiệp vụ CRUD Bộ thẻ và Thẻ con.
 * 3. Quản lý trạng thái đóng/mở của các Modal (DeckModal, CardModal, ConfirmDeleteCardModal).
 * 4. Tự động đồng bộ số liệu (refresh) sau mỗi thao tác thêm, sửa, xóa.
 */
const Flashcards: React.FC = () => {
  // --- Quản lý Chế độ hiển thị và Bộ thẻ đang chọn ---
  const [viewMode, setViewMode] = useState<ViewMode>('DECKS_LIST');
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);

  // --- Quản lý Danh sách dữ liệu từ Backend ---
  const [decks, setDecks] = useState<DeckSummary[]>([]);          // Danh sách các bộ thẻ
  const [cards, setCards] = useState<Flashcard[]>([]);              // Danh sách các thẻ trong bộ thẻ đang chọn
  const [loadingDecks, setLoadingDecks] = useState(false);          // Loading khi fetch decks
  const [loadingCards, setLoadingCards] = useState(false);          // Loading khi fetch cards

  // Tự động tìm bộ thẻ đang chọn từ mảng decks; tự đồng bộ khi decks thay đổi mà không gây re-render loop
  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || null;

  // --- Quản lý Trạng thái hiển thị Modal ---
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);    // Mở modal tạo/sửa bộ thẻ
  const [editingDeck, setEditingDeck] = useState<DeckSummary | null>(null); // Dữ liệu bộ thẻ đang sửa

  const [isCardModalOpen, setIsCardModalOpen] = useState(false);    // Mở modal tạo/sửa thẻ từ vựng
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null); // Dữ liệu thẻ đang sửa

  const [deletingCard, setDeletingCard] = useState<Flashcard | null>(null); // Dữ liệu thẻ đang chờ xác nhận xóa
  const [isDeletingCard, setIsDeletingCard] = useState(false);

  const [deletingDeck, setDeletingDeck] = useState<DeckSummary | null>(null); // Dữ liệu bộ thẻ đang chờ xác nhận xóa
  const [isDeletingDeck, setIsDeletingDeck] = useState(false);

  /**
   * 1. Tải danh sách toàn bộ bộ thẻ từ vựng của người dùng từ Backend API
   */
  const fetchDecks = useCallback(async () => {
    try {
      setLoadingDecks(true);
      const data = await vocabApi.getDecks();
      setDecks(data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách bộ thẻ:', err);
    } finally {
      setLoadingDecks(false);
    }
  }, []);

  /**
   * 2. Tải danh sách thẻ từ vựng trong bộ thẻ đang chọn (hỗ trợ lọc từ khóa và trạng thái)
   */
  const fetchCards = useCallback(async (deckId: number, keyword?: string, status?: string) => {
    try {
      setLoadingCards(true);
      const isDue = status === 'DUE';
      const apiStatus = isDue ? 'ALL' : status;
      const data = await vocabApi.getCardsInDeck(deckId, keyword, apiStatus);

      if (isDue) {
        const now = Date.now();
        // Lọc các thẻ cần ôn: chưa MASTERED và (đã tới hạn nextReviewDate hoặc trạng thái LEARNING)
        setCards(
          data.filter((c) => {
            if (c.status === 'MASTERED') return false;
            if (c.nextReviewDate) {
              return new Date(c.nextReviewDate).getTime() <= now + 60 * 1000;
            }
            return c.status === 'LEARNING' || c.status === 'NEW';
          })
        );
      } else {
        setCards(data);
      }
    } catch (err) {
      console.error(`Lỗi khi tải danh sách thẻ của deck #${deckId}:`, err);
    } finally {
      setLoadingCards(false);
    }
  }, []);

  // Gọi fetchDecks khi component được render lần đầu tiên
  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  // ========================================================
  // CÁC HÀM XỬ LÝ SỰ KIỆN LIÊN QUAN ĐẾN BỘ THẺ (DECK HANDLERS)
  // ========================================================

  /**
   * Người dùng click vào 1 bộ thẻ để xem chi tiết danh sách từ vựng
   */
  const handleSelectDeck = (deck: DeckSummary) => {
    setSelectedDeckId(deck.id);
    setViewMode('DECK_DETAIL');
    fetchCards(deck.id);
  };

  /**
   * Người dùng click vào nút 'Ôn tập ngay (SRS)' của bộ thẻ
   */
  const handleStudyDeck = (deck: DeckSummary) => {
    setSelectedDeckId(deck.id);
    setViewMode('STUDY_MODE');
    fetchCards(deck.id);
  };

  /**
   * Mở modal tạo mới bộ thẻ
   */
  const handleOpenCreateDeck = () => {
    setEditingDeck(null);
    setIsDeckModalOpen(true);
  };

  /**
   * Mở modal chỉnh sửa thông tin bộ thẻ
   */
  const handleOpenEditDeck = (deck: DeckSummary) => {
    setEditingDeck(deck);
    setIsDeckModalOpen(true);
  };

  /**
   * Xử lý lưu bộ thẻ (Tạo mới hoặc Cập nhật)
   */
  const handleSaveDeck = async (data: CreateDeckRequest) => {
    if (editingDeck) {
      // Gọi API cập nhật bộ thẻ
      await vocabApi.updateDeck(editingDeck.id, data);
    } else {
      // Gọi API tạo mới bộ thẻ
      await vocabApi.createDeck(data);
    }
    // Tải lại danh sách bộ thẻ sau khi lưu thành công
    await fetchDecks();
  };

  /**
   * Mở modal xác nhận xóa an toàn một bộ thẻ
   */
  const handleDeleteDeck = (deck: DeckSummary) => {
    setDeletingDeck(deck);
  };

  /**
   * Thực thi xóa bộ thẻ khi người dùng bấm 'Xác nhận xóa' trên ConfirmDeleteDeckModal
   */
  const handleConfirmDeleteDeck = async () => {
    if (!deletingDeck) return;

    try {
      setIsDeletingDeck(true);
      const targetDeckId = deletingDeck.id;
      await vocabApi.deleteDeck(targetDeckId);
      setDeletingDeck(null);
      await fetchDecks();
      // Nếu đang xem chi tiết bộ thẻ bị xóa thì quay về danh sách
      if (selectedDeckId === targetDeckId) {
        setViewMode('DECKS_LIST');
        setSelectedDeckId(null);
      }
    } catch (err) {
      console.error('Lỗi khi xóa bộ thẻ:', err);
      alert('Không thể xóa bộ thẻ. Vui lòng thử lại!');
    } finally {
      setIsDeletingDeck(false);
    }
  };

  // ========================================================
  // CÁC HÀM XỬ LÝ SỰ KIỆN LIÊN QUAN ĐẾN THẺ CON (CARD HANDLERS)
  // ========================================================

  /**
   * Mở modal thêm từ vựng mới vào bộ thẻ đang chọn
   */
  const handleOpenAddCard = () => {
    setEditingCard(null);
    setIsCardModalOpen(true);
  };

  /**
   * Mở modal chỉnh sửa một thẻ từ vựng
   */
  const handleOpenEditCard = (card: Flashcard) => {
    setEditingCard(card);
    setIsCardModalOpen(true);
  };

  /**
   * Xử lý lưu thẻ từ vựng (Thêm mới hoặc Cập nhật)
   */
  const handleSaveCard = async (data: CreateFlashcardRequest) => {
    if (!selectedDeck) return;

    if (editingCard) {
      // Chỉnh sửa thẻ từ vựng đã có
      await vocabApi.updateCard(editingCard.id, {
        customWord: data.customWord,
        customMeaning: data.customMeaning || '',
        exampleSentence: data.exampleSentence,
        customImageUrl: data.customImageUrl,
        phonetic: data.phonetic,
        pos: data.pos,
        level: data.level,
      });
    } else {
      // Thêm thẻ từ vựng mới vào bộ thẻ hiện tại
      await vocabApi.addCard(selectedDeck.id, data);
    }

    // Tải lại danh sách thẻ và cập nhật lại thống kê của các bộ thẻ
    await fetchCards(selectedDeck.id);
    await fetchDecks();
  };

  /**
   * Mở modal xác nhận xóa an toàn một thẻ từ vựng (UC012.6)
   */
  const handleOpenDeleteCard = (card: Flashcard) => {
    setDeletingCard(card);
  };

  /**
   * Thực thi xóa thẻ khi học viên bấm 'Xác nhận xóa' trên ConfirmDeleteCardModal
   */
  const handleConfirmDeleteCard = async () => {
    if (!deletingCard || !selectedDeck) return;

    try {
      setIsDeletingCard(true);
      await vocabApi.deleteCard(deletingCard.id);
      setDeletingCard(null);
      await fetchCards(selectedDeck.id);
      await fetchDecks();
    } catch (err) {
      console.error('Lỗi khi xóa thẻ từ vựng:', err);
      alert('Không thể xóa thẻ từ vựng. Vui lòng thử lại!');
    } finally {
      setIsDeletingCard(false);
    }
  };

  /**
   * Xử lý khi người dùng gõ tìm kiếm hoặc chọn lọc trạng thái trong màn hình chi tiết
   */
  const handleFilterCards = (keyword: string, status: string) => {
    if (selectedDeck) {
      fetchCards(selectedDeck.id, keyword, status);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* ========================================================
          RENDER CHẾ ĐỘ TƯƠNG ỨNG THEO viewMode
         ======================================================== */}

      {/* 1. MÀN HÌNH DANH SÁCH BỘ THẺ */}
      {viewMode === 'DECKS_LIST' && (
        <DeckListView
          decks={decks}
          loading={loadingDecks}
          onSelectDeck={handleSelectDeck}
          onStudyDeck={handleStudyDeck}
          onCreateClick={handleOpenCreateDeck}
          onEditDeck={handleOpenEditDeck}
          onDeleteDeck={handleDeleteDeck}
        />
      )}

      {/* 2. MÀN HÌNH CHI TIẾT BỘ THẺ & QUẢN LÝ THẺ CON */}
      {viewMode === 'DECK_DETAIL' && selectedDeck && (
        <DeckDetailView
          deck={selectedDeck}
          cards={cards}
          loading={loadingCards}
          onBack={() => {
            setViewMode('DECKS_LIST');
            setSelectedDeckId(null);
          }}
          onStudyClick={() => setViewMode('STUDY_MODE')}
          onQuizClick={() => setViewMode('PRACTICE_MODE')}
          onTestClick={() => setViewMode('TEST_MODE')}
          onMatchGameClick={() => setViewMode('MATCH_MODE')}
          onAddCardClick={handleOpenAddCard}
          onEditCard={handleOpenEditCard}
          onDeleteCard={handleOpenDeleteCard}
          onFilterChange={handleFilterCards}
        />
      )}

      {/* 3. MÀN HÌNH CHẾ ĐỘ ÔN TẬP FLASHCARD SRS */}
      {viewMode === 'STUDY_MODE' && selectedDeck && (
        <SrsStudyView
          deck={selectedDeck}
          cards={cards}
          onBack={() => setViewMode('DECK_DETAIL')}
          onFinish={() => {
            fetchDecks();
          }}
        />
      )}

      {/* 4. MÀN HÌNH CHẾ ĐỘ LUYỆN TẬP TRẮC NGHIỆM (Lazy Loaded) */}
      {viewMode === 'PRACTICE_MODE' && selectedDeck && (
        <Suspense fallback={<div className="vocab-loading-spinner-box">Đang tải phòng luyện tập...</div>}>
          <QuizPracticeView
            deck={selectedDeck}
            cards={cards}
            onBack={() => setViewMode('DECK_DETAIL')}
          />
        </Suspense>
      )}

      {/* 5. MÀN HÌNH CHẾ ĐỘ THI THỬ TÍNH GIỜ (Lazy Loaded) */}
      {viewMode === 'TEST_MODE' && selectedDeck && (
        <Suspense fallback={<div className="vocab-loading-spinner-box">Đang tải phòng thi thử...</div>}>
          <VocabTestView
            deck={selectedDeck}
            cards={cards}
            onBack={() => setViewMode('DECK_DETAIL')}
          />
        </Suspense>
      )}

      {/* 6. MÀN HÌNH CHẾ ĐỘ GHÉP TỪ TỐC ĐỘ (Lazy Loaded) */}
      {viewMode === 'MATCH_MODE' && selectedDeck && (
        <Suspense fallback={<div className="vocab-loading-spinner-box">Đang chuẩn bị trò chơi ghép từ...</div>}>
          <MatchGameView
            deck={selectedDeck}
            cards={cards}
            onBack={() => setViewMode('DECK_DETAIL')}
          />
        </Suspense>
      )}

      {/* ========================================================
          CÁC MODAL HỘP THOẠI (DIALOGS)
         ======================================================== */}

      {/* Modal Tạo mới / Chỉnh sửa Bộ thẻ */}
      <DeckModal
        isOpen={isDeckModalOpen}
        onClose={() => setIsDeckModalOpen(false)}
        onSubmit={handleSaveDeck}
        initialData={editingDeck}
      />

      {/* Modal Thêm mới / Chỉnh sửa Thẻ từ vựng */}
      {selectedDeck && (
        <CardModal
          isOpen={isCardModalOpen}
          onClose={() => setIsCardModalOpen(false)}
          onSubmit={handleSaveCard}
          initialData={editingCard}
          targetLanguage={selectedDeck.targetLanguage}
          sourceLanguage={selectedDeck.sourceLanguage}
        />
      )}

      {/* Modal Xác nhận Xóa 1 thẻ từ vựng an toàn theo UC012.6 */}
      <ConfirmDeleteCardModal
        isOpen={Boolean(deletingCard)}
        card={deletingCard}
        onClose={() => setDeletingCard(null)}
        onConfirm={handleConfirmDeleteCard}
        isDeleting={isDeletingCard}
      />

      {/* Modal Xác nhận Xóa bộ thẻ an toàn */}
      <ConfirmDeleteDeckModal
        isOpen={Boolean(deletingDeck)}
        deck={deletingDeck}
        onClose={() => !isDeletingDeck && setDeletingDeck(null)}
        onConfirm={handleConfirmDeleteDeck}
        isDeleting={isDeletingDeck}
      />
    </div>
  );
};

export default Flashcards;
