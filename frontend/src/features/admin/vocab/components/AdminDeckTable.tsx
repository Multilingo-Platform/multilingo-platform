import React from 'react';
import {
  Eye,
  Edit2,
  Trash2,
  Globe,
  Lock,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Copy,
  Layers,
} from 'lucide-react';
import type { AdminDeck, PageResponse } from '../types/adminVocab.types';

interface AdminDeckTableProps {
  data: PageResponse<AdminDeck> | undefined;
  isLoading: boolean;
  currentPage: number;
  onPageChange: (newPage: number) => void;
  onViewDetail: (deck: AdminDeck) => void;
  onEdit: (deck: AdminDeck) => void;
  onTogglePublic: (deck: AdminDeck) => void;
  onDelete: (deck: AdminDeck) => void;
  isToggling?: boolean;
}

export const AdminDeckTable: React.FC<AdminDeckTableProps> = ({
  data,
  isLoading,
  currentPage,
  onPageChange,
  onViewDetail,
  onEdit,
  onTogglePublic,
  onDelete,
  isToggling = false,
}) => {
  const items = data?.items || [];
  const totalElements = data?.totalElements || 0;
  const totalPages = data?.totalPages || 0;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('vi-VN', {
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

  const getLangBadge = (lang?: string) => {
    const l = (lang || 'en').toLowerCase();
    switch (l) {
      case 'en':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">🇬🇧 Tiếng Anh</span>;
      case 'vi':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">🇻🇳 Tiếng Việt</span>;
      case 'ja':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">🇯🇵 Tiếng Nhật</span>;
      case 'ko':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-50 text-pink-700 border border-pink-200">🇰🇷 Tiếng Hàn</span>;
      case 'zh':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">🇨🇳 Tiếng Trung</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">{lang?.toUpperCase()}</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-600 font-semibold text-xs uppercase tracking-wider">
              <th className="py-3.5 px-4 w-12 text-center">ID</th>
              <th className="py-3.5 px-4">Tên & Mô tả bộ thẻ</th>
              <th className="py-3.5 px-4">Ngôn ngữ</th>
              <th className="py-3.5 px-4">Người tạo</th>
              <th className="py-3.5 px-4 text-center">Số thẻ</th>
              <th className="py-3.5 px-4 text-center">Bản sao</th>
              <th className="py-3.5 px-4 text-center">Trạng thái</th>
              <th className="py-3.5 px-4">Thời gian</th>
              <th className="py-3.5 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <span>Đang tải danh sách bộ thẻ từ vựng...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <div className="max-w-xs mx-auto flex flex-col items-center justify-center text-gray-400">
                    <BookOpen size={44} className="text-gray-300 stroke-[1.5] mb-2" />
                    <p className="font-semibold text-gray-600 text-base">Không tìm thấy bộ thẻ nào</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Thử thay đổi từ khóa tìm kiếm hoặc bấm &quot;Tạo Bộ Thẻ Mới&quot; để thêm bộ thẻ đầu tiên.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((deck) => (
                <tr
                  key={deck.id}
                  className="hover:bg-orange-50/30 transition-colors group"
                >
                  {/* ID */}
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-gray-400 font-medium">
                    #{deck.id}
                  </td>

                  {/* Name & Description */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col max-w-sm">
                      <span className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-1">
                        {deck.name}
                      </span>
                      {deck.description ? (
                        <span className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                          {deck.description}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 italic mt-0.5">
                          Chưa có mô tả
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Language */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getLangBadge(deck.targetLanguage)}
                  </td>

                  {/* Creator */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col text-xs">
                      <span className="font-medium text-gray-800">
                        {deck.ownerName || 'Hệ thống'}
                      </span>
                      {deck.ownerEmail && (
                        <span className="text-gray-400 truncate max-w-[150px]">
                          {deck.ownerEmail}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Total Cards */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <Layers size={13} />
                      <span>{deck.totalCards} thẻ</span>
                    </span>
                  </td>

                  {/* Clones Count */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Copy size={13} className="text-gray-400" />
                      <span>{deck.clonesCount}</span>
                    </span>
                  </td>

                  {/* Status & Toggle */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => onTogglePublic(deck)}
                      title={deck.isPublic ? 'Bấm để chuyển sang Riêng tư' : 'Bấm để Công khai cho mọi người'}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        deck.isPublic
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {deck.isPublic ? (
                        <>
                          <Globe size={13} className="text-emerald-600" />
                          <span>Công khai</span>
                        </>
                      ) : (
                        <>
                          <Lock size={13} className="text-gray-500" />
                          <span>Riêng tư</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Dates */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-xs text-gray-500">
                    <div>{formatDate(deck.createdAt)}</div>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewDetail(deck)}
                        title="Xem danh sách từ vựng & Chi tiết"
                        className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      >
                        <Eye size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(deck)}
                        title="Chỉnh sửa thông tin bộ thẻ"
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(deck)}
                        title="Xóa bộ thẻ"
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 0 && (
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            Hiển thị{' '}
            <span className="font-semibold text-gray-700">
              {items.length > 0 ? currentPage * (data?.size || 10) + 1 : 0}
            </span>{' '}
            -{' '}
            <span className="font-semibold text-gray-700">
              {Math.min((currentPage + 1) * (data?.size || 10), totalElements)}
            </span>{' '}
            trên tổng số{' '}
            <span className="font-semibold text-gray-700">{totalElements}</span> bộ thẻ
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 0}
              onClick={() => onPageChange(currentPage - 1)}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 font-medium text-gray-700">
              Trang {currentPage + 1} / {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => onPageChange(currentPage + 1)}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Trang tiếp"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
