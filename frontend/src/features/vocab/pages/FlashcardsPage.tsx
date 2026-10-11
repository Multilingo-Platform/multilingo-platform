import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { vocabApi } from '../api/vocabApi';
import type {
  DeckSummary,
  Flashcard,
  CreateDeckRequest,
  CreateFlashcardRequest,
} from '../types/vocab.types';
import { alertUtil } from '../../../utils/alert';
import { DeckListView } from '../components/deck/DeckListView';
import { DeckDetailView } from '../components/deck/DeckDetailView';
import { DeckModal } from '../components/deck/DeckModal';
import { CardModal } from '../components/card/CardModal';

// Chặng 2: Sử dụng SrsStudyView chuẩn mới trong features/vocab/modes/srs/
const SrsStudyView = lazy(() =>
  import('../modes/srs/SrsStudyView').then((m) => ({ default: m.SrsStudyView }))
);
const QuizPracticeView = lazy(() =>
  import('../../../components/vocab/QuizPracticeView').then((m) => ({ default: m.QuizPracticeView }))
);
const VocabTestView = lazy(() =>
  import('../../../components/vocab/VocabTestView').then((m) => ({ default: m.VocabTestView }))
);
const MatchGameView = lazy(() =>
  import('../../../components/vocab/MatchGameView').then((m) => ({ default: m.MatchGameView }))
);

type ViewMode = 'DECKS_LIST' | 'DECK_DETAIL' | 'STUDY_MODE' | 'PRACTICE_MODE' | 'TEST_MODE' | 'MATCH_MODE';

/**
 * Component FlashcardsPage (Trang điều phối trung tâm của Module Từ Vựng)
 *
 * TÍNH NĂNG ĐỒNG BỘ URL & LỊCH SỬ DUYỆT (BROWSER HISTORY SYNC):
 * 1. Sử dụng useSearchParams để đồng bộ trạng thái xem (`deckId`, `mode`) vào URL trình duyệt:
 *    - Danh mục bộ thẻ: `/student/flashcards`
 *    - Chi tiết bộ thẻ: `/student/flashcards?deckId=12`
 *    - Chế độ ôn tập/luyện tập: `/student/flashcards?deckId=12&mode=study`
 * 2. Hỗ trợ đầy đủ phím quay lại của trình duyệt (Browser Back button):
 *    - Đang ở trang chi tiết bấm Back trình duyệt ➔ Quay lại trang danh mục từ vựng.
 *    - Đang ở chế độ học bấm Back trình duyệt ➔ Quay lại trang chi tiết bộ thẻ.
 *    - Không bị nhảy thoát sang trang trước đó (như Lịch sử làm bài).
 * 3. Hỗ trợ F5 tải lại trang vẫn giữ nguyên màn hình chi tiết hoặc phòng ôn tập hiện tại.
 */
export const FlashcardsPage: React.FC = () => {
  // Đồng bộ trạng thái màn hình và ID bộ thẻ qua URL Query Parameters
  const [searchParams, setSearchParams] = useSearchParams();

  // Đọc deckId và mode từ URL
  const deckIdParam = searchParams.get('deckId');
  const modeParam = searchParams.get('mode');

  // ID của bộ thẻ đang chọn (null nếu đang ở danh sách bộ thẻ)
  const selectedDeckId = deckIdParam ? Number(deckIdParam) : null;

  // Tự động xác định chế độ màn hình (ViewMode) dựa trên URL
  const viewMode: ViewMode = useMemo(() => {
    if (!selectedDeckId) return 'DECKS_LIST';
    switch (modeParam) {
      case 'study':
        return 'STUDY_MODE';
      case 'practice':
      case 'quiz':
        return 'PRACTICE_MODE';
      case 'test':
        return 'TEST_MODE';
      case 'match':
        return 'MATCH_MODE';
      default:
        return 'DECK_DETAIL';
    }
  }, [selectedDeckId, modeParam]);

  // Danh sách các bộ thẻ lấy từ Backend
  const [decks, setDecks] = useState<DeckSummary[]>([]);

  // Danh sách các thẻ từ vựng thuộc bộ thẻ đang chọn
  const [cards, setCards] = useState<Flashcard[]>([]);

  // Trạng thái loading khi fetch dữ liệu từ API
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);

  // Tự động tìm đối tượng bộ thẻ hiện tại từ mảng decks
  const selectedDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId) || null,
    [decks, selectedDeckId]
  );

  // --- Quản lý Trạng Thái Modal Bộ Thẻ (DeckModal) ---
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<DeckSummary | null>(null);

  // --- Quản lý Trạng Thái Modal Thẻ Từ Vựng (CardModal) ---
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);

  /**
   * 1. Lấy danh sách toàn bộ bộ thẻ của người dùng từ API Backend
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
   * 2. Lấy danh sách thẻ từ vựng trong bộ thẻ (hỗ trợ lọc từ khóa và trạng thái)
   */
  const fetchCards = useCallback(async (deckId: number, keyword?: string, status?: string) => {
    try {
      setLoadingCards(true);
      const isDue = status === 'DUE';
      const apiStatus = isDue ? 'ALL' : status;
      const data = await vocabApi.getCardsInDeck(deckId, keyword, apiStatus);

      if (isDue) {
        const now = Date.now();
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
      console.error(`Lỗi khi tải thẻ của bộ #${deckId}:`, err);
    } finally {
      setLoadingCards(false);
    }
  }, []);

  // Tải danh sách bộ thẻ lần đầu khi vào trang
  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  // Tự động tải danh sách thẻ từ vựng mỗi khi selectedDeckId thay đổi (hoặc khi quay lại bộ thẻ)
  useEffect(() => {
    if (selectedDeckId) {
      fetchCards(selectedDeckId);
    }
  }, [selectedDeckId, fetchCards]);

  // ==========================================
  // Xử Lý Sự Kiện Bộ Thẻ (Deck Handlers)
  // ==========================================
  const handleSelectDeck = (deck: DeckSummary) => {
    setSearchParams({ deckId: String(deck.id) });
  };

  const handleStudyDeck = (deck: DeckSummary) => {
    setSearchParams({ deckId: String(deck.id), mode: 'study' });
  };

  const handleOpenCreateDeck = () => {
    setEditingDeck(null);
    setIsDeckModalOpen(true);
  };

  const handleOpenEditDeck = (deck: DeckSummary) => {
    setEditingDeck(deck);
    setIsDeckModalOpen(true);
  };

  const handleSaveDeck = async (data: CreateDeckRequest) => {
    try {
      if (editingDeck) {
        await vocabApi.updateDeck(editingDeck.id, data);
        alertUtil.toast('Cập nhật bộ thẻ thành công', 'success');
      } else {
        await vocabApi.createDeck(data);
        alertUtil.toast('Tạo bộ thẻ mới thành công', 'success');
      }
      await fetchDecks();
    } catch (err: any) {
      console.error('Lỗi khi lưu bộ thẻ:', err);
      alertUtil.toast(err?.response?.data?.message || 'Không thể lưu bộ thẻ', 'error');
      throw err;
    }
  };

  const handleDeleteDeck = async (deck: DeckSummary) => {
    const isConfirmed = await alertUtil.confirm(
      `Bạn có chắc chắn muốn xóa bộ thẻ "${deck.name}"? Toàn bộ từ vựng bên trong sẽ bị xóa vĩnh viễn.`,
      'Xóa bộ thẻ',
      'Hủy'
    );
    if (!isConfirmed) return;

    try {
      await vocabApi.deleteDeck(deck.id);
      alertUtil.toast('Đã xóa bộ thẻ thành công', 'success');
      await fetchDecks();
      if (selectedDeckId === deck.id) {
        setSearchParams({});
      }
    } catch (err: any) {
      console.error('Lỗi khi xóa bộ thẻ:', err);
      alertUtil.toast(err?.response?.data?.message || 'Có lỗi xảy ra khi xóa bộ thẻ', 'error');
    }
  };

  // ==========================================
  // Xử Lý Sự Kiện Thẻ Từ Vựng (Card Handlers)
  // ==========================================
  const handleOpenAddCard = () => {
    setEditingCard(null);
    setIsCardModalOpen(true);
  };

  const handleOpenEditCard = (card: Flashcard) => {
    setEditingCard(card);
    setIsCardModalOpen(true);
  };

  const handleSaveCard = async (data: CreateFlashcardRequest) => {
    if (!selectedDeck) return;

    try {
      if (editingCard) {
        await vocabApi.updateCard(editingCard.id, {
          customWord: data.customWord,
          customMeaning: data.customMeaning || '',
          exampleSentence: data.exampleSentence,
          customImageUrl: data.customImageUrl,
          phonetic: data.phonetic,
          pos: data.pos,
          level: data.level,
        });
        alertUtil.toast('Cập nhật từ vựng thành công', 'success');
      } else {
        await vocabApi.addCard(selectedDeck.id, data);
        alertUtil.toast('Thêm từ vựng mới thành công', 'success');
      }

      await fetchCards(selectedDeck.id);
      await fetchDecks();
    } catch (err: any) {
      console.error('Lỗi khi lưu thẻ:', err);
      alertUtil.toast(err?.response?.data?.message || 'Không thể lưu từ vựng', 'error');
      throw err;
    }
  };

  const handleDeleteCard = async (card: Flashcard) => {
    if (!selectedDeck) return;
    const isConfirmed = await alertUtil.confirm(
      `Bạn có chắc chắn muốn xóa thẻ từ "${card.customWord}"?`,
      'Xóa thẻ',
      'Hủy'
    );
    if (!isConfirmed) return;

    try {
      await vocabApi.deleteCard(card.id);
      alertUtil.toast('Đã xóa thẻ từ vựng thành công', 'success');
      await fetchCards(selectedDeck.id);
      await fetchDecks();
    } catch (err: any) {
      console.error('Lỗi khi xóa thẻ:', err);
      alertUtil.toast(err?.response?.data?.message || 'Có lỗi xảy ra khi xóa thẻ', 'error');
    }
  };

  const handleFilterCards = useCallback(
    (keyword: string, status: string) => {
      if (selectedDeckId) {
        fetchCards(selectedDeckId, keyword, status);
      }
    },
    [selectedDeckId, fetchCards]
  );

  return (
    <div className="container py-6">
      {/* 1. Màn hình Danh sách Bộ thẻ */}
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

      {/* 2. Màn hình Chi tiết Bộ thẻ */}
      {viewMode === 'DECK_DETAIL' && (
        selectedDeck ? (
          <DeckDetailView
            deck={selectedDeck}
            cards={cards}
            loading={loadingCards}
            onBack={() => setSearchParams({})}
            onEditDeck={() => handleOpenEditDeck(selectedDeck)}
            onStudyClick={() => setSearchParams({ deckId: String(selectedDeck.id), mode: 'study' })}
            onQuizClick={() => setSearchParams({ deckId: String(selectedDeck.id), mode: 'quiz' })}
            onTestClick={() => setSearchParams({ deckId: String(selectedDeck.id), mode: 'test' })}
            onMatchGameClick={() => setSearchParams({ deckId: String(selectedDeck.id), mode: 'match' })}
            onAddCardClick={handleOpenAddCard}
            onEditCard={handleOpenEditCard}
            onDeleteCard={handleDeleteCard}
            onFilterChange={handleFilterCards}
          />
        ) : loadingDecks ? (
          <div className="flex items-center justify-center p-12 text-slate-500 font-semibold">
            Đang tải thông tin bộ thẻ...
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-600 font-semibold gap-3">
            <p>Không tìm thấy thông tin bộ thẻ này hoặc bộ thẻ đã bị xóa.</p>
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-xs transition-colors"
            >
              Quay lại danh sách bộ thẻ
            </button>
          </div>
        )
      )}

      {/* 3. Chế độ Ôn Flashcard SRS */}
      {viewMode === 'STUDY_MODE' && (
        selectedDeck ? (
          <Suspense fallback={<div className="p-12 text-center text-slate-600 font-semibold">Đang tải phòng ôn tập...</div>}>
            <SrsStudyView
              deck={selectedDeck}
              onBack={() => {
                fetchDecks();
                setSearchParams({ deckId: String(selectedDeck.id) });
              }}
              onFinish={() => {
                fetchDecks();
              }}
            />
          </Suspense>
        ) : (
          <div className="p-12 text-center text-slate-600 font-semibold">Đang tải...</div>
        )
      )}

      {/* 4. Chế độ Ghép từ & Trắc nghiệm */}
      {viewMode === 'PRACTICE_MODE' && (
        selectedDeck ? (
          <Suspense fallback={<div className="p-12 text-center text-slate-600 font-semibold">Đang tải phòng luyện tập...</div>}>
            <QuizPracticeView
              deck={selectedDeck as unknown as import('../../../types/vocab').DeckSummary}
              cards={cards as unknown as import('../../../types/vocab').Flashcard[]}
              onBack={() => setSearchParams({ deckId: String(selectedDeck.id) })}
            />
          </Suspense>
        ) : (
          <div className="p-12 text-center text-slate-600 font-semibold">Đang tải...</div>
        )
      )}

      {/* 5. Chế độ Thi thử tính giờ */}
      {viewMode === 'TEST_MODE' && (
        selectedDeck ? (
          <Suspense fallback={<div className="p-12 text-center text-slate-600 font-semibold">Đang tải phòng thi thử...</div>}>
            <VocabTestView
              deck={selectedDeck as unknown as import('../../../types/vocab').DeckSummary}
              cards={cards as unknown as import('../../../types/vocab').Flashcard[]}
              onBack={() => setSearchParams({ deckId: String(selectedDeck.id) })}
            />
          </Suspense>
        ) : (
          <div className="p-12 text-center text-slate-600 font-semibold">Đang tải...</div>
        )
      )}

      {/* 6. Chế độ Ghép thẻ tốc độ 60s */}
      {viewMode === 'MATCH_MODE' && (
        selectedDeck ? (
          <Suspense fallback={<div className="p-12 text-center text-slate-600 font-semibold">Đang chuẩn bị trò chơi...</div>}>
            <MatchGameView
              deck={selectedDeck as unknown as import('../../../types/vocab').DeckSummary}
              cards={cards as unknown as import('../../../types/vocab').Flashcard[]}
              onBack={() => setSearchParams({ deckId: String(selectedDeck.id) })}
            />
          </Suspense>
        ) : (
          <div className="p-12 text-center text-slate-600 font-semibold">Đang tải...</div>
        )
      )}

      {/* MODALS */}
      <DeckModal
        isOpen={isDeckModalOpen}
        onClose={() => setIsDeckModalOpen(false)}
        onSubmit={handleSaveDeck}
        initialData={editingDeck}
      />

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
    </div>
  );
};

export default FlashcardsPage;
