import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  BookOpen,
  Plus,
  Trash2,
  Layers,
  Globe,
  Lock,
  Calendar,
  User,
  Copy,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { adminVocabApi } from '../api/adminVocabApi';
import type { AdminDeckDetail, AdminFlashcard, CreateCardPayload } from '../types/adminVocab.types';
import { alertUtil } from '../../../../utils/alert';

interface AdminDeckDetailDrawerProps {
  deckId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDeckDetailDrawer: React.FC<AdminDeckDetailDrawerProps> = ({
  deckId,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();

  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [word, setWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [pos, setPos] = useState('noun');
  const [meaning, setMeaning] = useState('');
  const [example, setExample] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [level, setLevel] = useState('B1');
  const [cardError, setCardError] = useState<string | null>(null);

  const { data: deck, isLoading } = useQuery({
    queryKey: ['adminDeckDetail', deckId],
    queryFn: () => (deckId ? adminVocabApi.getDeckDetail(deckId) : null),
    enabled: !!deckId && isOpen,
  });

  const addCardMutation = useMutation({
    mutationFn: (payload: CreateCardPayload) => {
      if (!deckId) throw new Error('Không tìm thấy ID bộ thẻ');
      return adminVocabApi.addCard(deckId, payload);
    },
    onSuccess: () => {
      alertUtil.toast('Đã thêm thẻ từ vựng vào bộ thẻ', 'success');
      // Reset form
      setWord('');
      setPhonetic('');
      setMeaning('');
      setExample('');
      setImageUrl('');
      setIsAddCardOpen(false);
      setCardError(null);
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['adminDeckDetail', deckId] });
      queryClient.invalidateQueries({ queryKey: ['adminDecks'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể thêm thẻ từ vựng';
      setCardError(msg);
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (cardId: number) => adminVocabApi.deleteCard(cardId),
    onSuccess: () => {
      alertUtil.toast('Đã xóa thẻ từ vựng thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminDeckDetail', deckId] });
      queryClient.invalidateQueries({ queryKey: ['adminDecks'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa thẻ từ vựng';
      alertUtil.popup(msg, 'error', 'Lỗi thao tác');
    },
  });

  if (!isOpen || !deckId) return null;

  const handleAddCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) {
      setCardError('Vui lòng nhập từ vựng');
      return;
    }
    if (!meaning.trim()) {
      setCardError('Vui lòng nhập nghĩa của từ');
      return;
    }

    addCardMutation.mutate({
      customWord: word.trim(),
      phonetic: phonetic.trim() || undefined,
      pos: pos || undefined,
      customMeaning: meaning.trim(),
      exampleSentence: example.trim() || undefined,
      customImageUrl: imageUrl.trim() || undefined,
      level: level || undefined,
    });
  };

  const handleDeleteCard = async (card: AdminFlashcard) => {
    const isConfirmed = await alertUtil.confirm(
      `Bạn có chắc muốn xóa thẻ "${card.customWord}" khỏi bộ thẻ này?`,
      'Xóa Thẻ',
      'Hủy'
    );
    if (isConfirmed) {
      deleteCardMutation.mutate(card.id);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 z-[1050] overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 line-clamp-1">
                {deck?.name || 'Chi Tiết Bộ Thẻ'}
              </h3>
              <span className="text-xs text-gray-500 font-mono">Mã ID: #{deckId}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="py-20 text-center text-sm text-gray-400 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span>Đang tải dữ liệu bộ thẻ...</span>
            </div>
          ) : deck ? (
            <>
              {/* Overview Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 block">Số thẻ từ vựng</span>
                  <div className="text-lg font-bold text-gray-800 flex items-center gap-1.5 mt-0.5">
                    <Layers size={17} className="text-orange-500" />
                    <span>{deck.cards?.length ?? deck.totalCards}</span>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 block">Lượt sao chép</span>
                  <div className="text-lg font-bold text-gray-800 flex items-center gap-1.5 mt-0.5">
                    <Copy size={17} className="text-blue-500" />
                    <span>{deck.clonesCount || 0}</span>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 block">Trạng thái</span>
                  <div className="mt-1">
                    {deck.isPublic ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Globe size={12} />
                        <span>Công khai</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                        <Lock size={12} />
                        <span>Riêng tư</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 block">Ngôn ngữ</span>
                  <span className="text-xs font-bold text-gray-700 mt-1 block">
                    {deck.targetLanguage?.toUpperCase()} / {deck.sourceLanguage?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Description & Metadata */}
              <div className="p-4 bg-gray-50/60 rounded-xl border border-gray-100 text-xs space-y-2">
                <div>
                  <span className="font-semibold text-gray-700">Mô tả: </span>
                  <span className="text-gray-600">
                    {deck.description || 'Không có mô tả chi tiết'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-gray-500 pt-1 border-t border-gray-200/60">
                  <div className="flex items-center gap-1">
                    <User size={13} className="text-gray-400" />
                    <span>Người tạo: <strong className="text-gray-700">{deck.ownerName || 'Hệ thống'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={13} className="text-gray-400" />
                    <span>Ngày tạo: {formatDate(deck.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Cards Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">
                      Danh Sách Thẻ Từ Vựng ({deck.cards?.length || 0})
                    </h4>
                    <p className="text-xs text-gray-500">
                      Các thẻ từ vựng hiện có trong bộ thẻ này
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddCardOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 font-medium text-xs rounded-lg transition-colors border border-orange-200"
                  >
                    <Plus size={14} />
                    <span>{isAddCardOpen ? 'Đóng form' : 'Thêm thẻ mới'}</span>
                    {isAddCardOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Inline Add Card Form */}
                {isAddCardOpen && (
                  <form
                    onSubmit={handleAddCardSubmit}
                    className="p-4 bg-orange-50/40 rounded-xl border border-orange-200 space-y-3 animate-in fade-in duration-150"
                  >
                    <div className="font-semibold text-xs text-orange-800">
                      Thêm Thẻ Từ Vựng Mới Vào Bộ Thẻ
                    </div>

                    {cardError && (
                      <div className="p-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
                        {cardError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-700 uppercase mb-1">
                          Từ vựng <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={word}
                          onChange={(e) => setWord(e.target.value)}
                          placeholder="VD: accomplish, persistent..."
                          className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 uppercase mb-1">
                          Loại từ (POS)
                        </label>
                        <select
                          value={pos}
                          onChange={(e) => setPos(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                          <option value="noun">Danh từ (n)</option>
                          <option value="verb">Động từ (v)</option>
                          <option value="adjective">Tính từ (adj)</option>
                          <option value="adverb">Phó từ (adv)</option>
                          <option value="idiom">Thành ngữ (idiom)</option>
                          <option value="phrase">Cụm từ (phrase)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 uppercase mb-1">
                          Phiên âm IPA
                        </label>
                        <input
                          type="text"
                          value={phonetic}
                          onChange={(e) => setPhonetic(e.target.value)}
                          placeholder="/əˈkʌm.plɪʃ/"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 uppercase mb-1">
                          Cấp độ (CEFR)
                        </label>
                        <select
                          value={level}
                          onChange={(e) => setLevel(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                          <option value="A1">A1 - Căn bản</option>
                          <option value="A2">A2 - Sơ cấp</option>
                          <option value="B1">B1 - Trung cấp</option>
                          <option value="B2">B2 - Trung cao</option>
                          <option value="C1">C1 - Cao cấp</option>
                          <option value="C2">C2 - Thông thạo</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 uppercase mb-1">
                        Giải nghĩa tiếng Việt <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={meaning}
                        onChange={(e) => setMeaning(e.target.value)}
                        placeholder="VD: hoàn thành, đạt được mục tiêu..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 uppercase mb-1">
                        Câu ví dụ (Example sentence)
                      </label>
                      <textarea
                        value={example}
                        onChange={(e) => setExample(e.target.value)}
                        placeholder="The students accomplished their mission with great confidence."
                        rows={2}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 uppercase mb-1">
                        Đường dẫn ảnh minh họa (URL)
                      </label>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddCardOpen(false)}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={addCardMutation.isPending}
                        className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {addCardMutation.isPending ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Đang lưu...</span>
                          </>
                        ) : (
                          <span>Lưu thẻ từ</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Cards List */}
                {(!deck.cards || deck.cards.length === 0) ? (
                  <div className="py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs">
                    Bộ thẻ này hiện chưa có từ vựng nào. Hãy bấm &quot;Thêm thẻ mới&quot; ở trên để bổ sung.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {deck.cards.map((card) => (
                      <div
                        key={card.id}
                        className="p-3.5 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-xs transition-all flex items-start justify-between gap-3 group"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 text-sm">
                              {card.customWord}
                            </span>
                            {card.phonetic && (
                              <span className="text-xs text-gray-400 font-mono">
                                {card.phonetic}
                              </span>
                            )}
                            {card.pos && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                                {card.pos}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-gray-700">
                            {card.customMeaning}
                          </div>

                          {card.exampleSentence && (
                            <div className="text-xs text-gray-400 italic">
                              &ldquo;{card.exampleSentence}&rdquo;
                            </div>
                          )}

                          {card.customImageUrl && (
                            <div className="pt-1 flex items-center gap-1 text-[11px] text-blue-500">
                              <ImageIcon size={12} />
                              <a
                                href={card.customImageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline truncate max-w-xs"
                              >
                                Xem ảnh minh họa
                              </a>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteCard(card)}
                          title="Xóa thẻ từ này"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-70 group-hover:opacity-100 shrink-0"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
