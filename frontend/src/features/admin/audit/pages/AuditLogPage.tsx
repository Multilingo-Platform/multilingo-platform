import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Code,
  Tag,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import type { AuditLogItem } from '../../types/adminTypes';
import { JsonSnapshotModal } from '../components/JsonSnapshotModal';

export const AuditLogPage = () => {
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [page, setPage] = useState(0);

  // Selected log for snapshot modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminAuditLogs', actionFilter, entityTypeFilter, page],
    queryFn: () =>
      adminApi.getAuditLogs({
        action: actionFilter || undefined,
        entityType: entityTypeFilter || undefined,
        page,
        size: 10,
      }),
  });

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'LOCK_USER':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'UNLOCK_USER':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'UPDATE_QUOTA':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'EXPORT_TRANSACTIONS':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Nhật Ký Kiểm Toán An Ninh
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi mọi thao tác nhạy cảm của Admin kèm bản chụp JSON dữ liệu cũ và mới để phục vụ điều tra an ninh và đối soát.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
            Hành động:
          </span>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            className="text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Tất cả hành động</option>
            <option value="LOCK_USER">LOCK_USER (Khóa tài khoản)</option>
            <option value="UNLOCK_USER">UNLOCK_USER (Mở khóa)</option>
            <option value="UPDATE_QUOTA">UPDATE_QUOTA (Cập nhật quota)</option>
            <option value="EXPORT_TRANSACTIONS">EXPORT_TRANSACTIONS (Xuất Excel)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
            Loại thực thể:
          </span>
          <select
            value={entityTypeFilter}
            onChange={(e) => {
              setEntityTypeFilter(e.target.value);
              setPage(0);
            }}
            className="text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Tất cả thực thể</option>
            <option value="USER">USER (Người dùng)</option>
            <option value="USER_QUOTA">USER_QUOTA (Định mức AI)</option>
            <option value="TRANSACTION">TRANSACTION (Giao dịch)</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Thời Gian</th>
                <th className="py-3 px-4">Người Thực Hiện</th>
                <th className="py-3 px-4">Hành Động</th>
                <th className="py-3 px-4">Đối Tượng (Entity)</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Chi Tiết Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    Đang tải nhật ký kiểm toán...
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    Không có bản ghi nhật ký kiểm toán nào.
                  </td>
                </tr>
              ) : (
                data?.items?.map((item: AuditLogItem) => (
                  <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4 text-gray-600 font-mono text-[11px]">
                      {new Date(item.createdAt).toLocaleDateString('vi-VN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {item.userEmail || `Admin #${item.userId || 'System'}`}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeClass(
                          item.action
                        )}`}
                      >
                        {item.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-gray-700">
                      <span className="font-semibold text-gray-900">
                        {item.entityType}
                      </span>
                      {item.entityId && (
                        <span className="text-gray-500 ml-1">
                          (ID: {item.entityId})
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-gray-500 text-[11px]">
                      {item.ipAddress || '127.0.0.1'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(item)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors font-semibold"
                      >
                        <Code size={13} />
                        <span>Xem JSON</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Trang {data.page + 1} / {data.totalPages} (Tổng {data.totalElements} bản ghi)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={data.page === 0}
                className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={data.last}
                className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot Modal */}
      <JsonSnapshotModal
        log={selectedLog}
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
};
export default AuditLogPage;
