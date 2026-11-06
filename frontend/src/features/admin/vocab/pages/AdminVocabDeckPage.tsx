import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Layers } from 'lucide-react';
import { adminVocabApi } from '../api/adminVocabApi';
import type {
  AdminDeck,
  CreateDeckPayload,
  UpdateDeckPayload,
} from '../types/adminVocab.types';
import { AdminDeckFilterBar } from '../components/AdminDeckFilterBar';
import { AdminDeckTable } from '../components/AdminDeckTable';
import { AdminDeckModal } from '../components/AdminDeckModal';
import { AdminDeckDetailDrawer } from '../components/AdminDeckDetailDrawer';
import { alertUtil } from '../../../../utils/alert';

export const AdminVocabDeckPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters & Pagination State
  const [keyword, setKeyword] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('ALL');
  const [isPublicFilter, setIsPublicFilter] = useState('ALL');
  const [page, setPage] = useState(0);

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<AdminDeck | null>(null);
  const [drawerDeckId, setDrawerDeckId] = useState<number | null>(null);

  // Query Decks
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['adminDecks', keyword, targetLanguage, isPublicFilter, page],
    queryFn: () =>
      adminVocabApi.getDecks({
        keyword: keyword || undefined,
        targetLanguage: targetLanguage === 'ALL' ? undefined : targetLanguage,
        isPublic:
          isPublicFilter === 'ALL'
            ? undefined
            : isPublicFilter === 'true',
        page,
        size: 10,
      }),
  });

  // Mutations
  const createDeckMutation = useMutation({
    mutationFn: (payload: CreateDeckPayload) => adminVocabApi.createDeck(payload),
    onSuccess: () => {
      alertUtil.toast('Đã tạo bộ thẻ từ vựng mới thành công', 'success');
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['adminDecks'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể tạo bộ thẻ';
      alertUtil.popup(msg, 'error', 'Lỗi thao tác');
    },
  });

  const updateDeckMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateDeckPayload }) =>
      adminVocabApi.updateDeck(id, payload),
    onSuccess: () => {
      alertUtil.toast('Đã cập nhật thông tin bộ thẻ thành công', 'success');
      setIsModalOpen(false);
      setEditingDeck(null);
      queryClient.invalidateQueries({ queryKey: ['adminDecks'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật bộ thẻ';
      alertUtil.popup(msg, 'error', 'Lỗi thao tác');
    },
  });

  const togglePublicMutation = useMutation({
    mutationFn: (id: number) => adminVocabApi.togglePublic(id),
    onSuccess: (updated) => {
      alertUtil.toast(
        updated.isPublic
          ? `Đã công khai bộ thẻ "${updated.name}"`
          : `Đã chuyển bộ thẻ "${updated.name}" về chế độ riêng tư`,
        'success'
      );
      queryClient.invalidateQueries({ queryKey: ['adminDecks'] });
      if (drawerDeckId) {
        queryClient.invalidateQueries({ queryKey: ['adminDeckDetail', drawerDeckId] });
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể thay đổi trạng thái công khai';
      alertUtil.popup(msg, 'error', 'Lỗi thao tác');
    },
  });

  const deleteDeckMutation = useMutation({
    mutationFn: (id: number) => adminVocabApi.deleteDeck(id),
    onSuccess: () => {
      alertUtil.toast('Đã xóa bộ thẻ và các thẻ từ vựng liên thuộc', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminDecks'] });
      if (drawerDeckId) {
        setDrawerDeckId(null);
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể xóa bộ thẻ';
      alertUtil.popup(msg, 'error', 'Lỗi thao tác');
    },
  });

  // Handlers
  const handleResetFilters = () => {
    setKeyword('');
    setTargetLanguage('ALL');
    setIsPublicFilter('ALL');
    setPage(0);
  };

  const handleOpenCreateModal = () => {
    setEditingDeck(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (deck: AdminDeck) => {
    setEditingDeck(deck);
    setIsModalOpen(true);
  };

  const handleModalSubmit = (payload: CreateDeckPayload | UpdateDeckPayload) => {
    if (editingDeck) {
      updateDeckMutation.mutate({ id: editingDeck.id, payload });
    } else {
      createDeckMutation.mutate(payload as CreateDeckPayload);
    }
  };

  const handleTogglePublic = async (deck: AdminDeck) => {
    const actionText = deck.isPublic ? 'chuyển sang Riêng tư' : 'Công khai cho toàn bộ học viên';
    const isConfirmed = await alertUtil.confirm(
      `Bạn có chắc chắn muốn ${actionText} đối với bộ thẻ "${deck.name}"?`,
      'Xác nhận',
      'Hủy'
    );
    if (isConfirmed) {
      togglePublicMutation.mutate(deck.id);
    }
  };

  const handleDeleteDeck = async (deck: AdminDeck) => {
    const isConfirmed = await alertUtil.confirm(
      `CẢNH BÁO: Bạn có chắc chắn muốn xóa bộ thẻ "${deck.name}"? Toàn bộ các thẻ từ vựng con bên trong cũng sẽ bị xóa vĩnh viễn!`,
      'Xóa Vĩnh Viễn',
      'Hủy'
    );
    if (isConfirmed) {
      deleteDeckMutation.mutate(deck.id);
    }
  };

  // Quick stat computations
  const totalDecksCount = data?.totalElements || 0;
  const currentItems = data?.items || [];
  const publicDecksCount = currentItems.filter((d) => d.isPublic).length;
  const totalCardsInPage = currentItems.reduce((acc, curr) => acc + (curr.totalCards || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-orange-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <BookOpen size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Quản Trị Bộ Thẻ Từ Vựng
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Quản lý kho học liệu từ vựng hệ thống, phân quyền công khai, chỉnh sửa thông tin và quản lý danh sách từ vựng con.
              </p>
            </div>
          </div>
        </div>

        {/* Top Badges / Indicators */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3.5 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold flex items-center gap-1.5">
            <Layers size={14} />
            <span>Tổng cộng: {totalDecksCount} bộ thẻ</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <AdminDeckFilterBar
        keyword={keyword}
        onKeywordChange={(val) => {
          setKeyword(val);
          setPage(0);
        }}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(val) => {
          setTargetLanguage(val);
          setPage(0);
        }}
        isPublicFilter={isPublicFilter}
        onIsPublicFilterChange={(val) => {
          setIsPublicFilter(val);
          setPage(0);
        }}
        onReset={handleResetFilters}
        onCreateClick={handleOpenCreateModal}
      />

      {/* Table */}
      <AdminDeckTable
        data={data}
        isLoading={isLoading || isFetching}
        currentPage={page}
        onPageChange={(newPage) => setPage(newPage)}
        onViewDetail={(deck) => setDrawerDeckId(deck.id)}
        onEdit={handleOpenEditModal}
        onTogglePublic={handleTogglePublic}
        onDelete={handleDeleteDeck}
        isToggling={togglePublicMutation.isPending}
      />

      {/* Create / Edit Modal */}
      <AdminDeckModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingDeck(null);
        }}
        onSubmit={handleModalSubmit}
        initialData={editingDeck}
        isLoading={createDeckMutation.isPending || updateDeckMutation.isPending}
      />

      {/* Detail & Cards Management Drawer */}
      <AdminDeckDetailDrawer
        deckId={drawerDeckId}
        isOpen={!!drawerDeckId}
        onClose={() => setDrawerDeckId(null)}
      />
    </div>
  );
};

export default AdminVocabDeckPage;
