import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  Search,
  Filter,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import type { AdminTransaction } from '../../types/adminTypes';
import { exportTransactionsToExcel } from '../utils/excelExport';
import { alertUtil } from '../../../../utils/alert';

export const TransactionReconciliationPage = () => {
  const [txnRefSearch, setTxnRefSearch] = useState('');
  const [txnRefInput, setTxnRefInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['adminTransactions', txnRefSearch, statusFilter, page],
    queryFn: () =>
      adminApi.getTransactions({
        vnpTxnRef: txnRefSearch || undefined,
        status: statusFilter || undefined,
        page,
        size: 10,
      }),
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTxnRefSearch(txnRefInput.trim());
    setPage(0);
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const allTxns = await adminApi.getAllTransactionsForExport({
        vnpTxnRef: txnRefSearch || undefined,
        status: statusFilter || undefined,
      });

      if (!allTxns || allTxns.length === 0) {
        alertUtil.toast('Không có dữ liệu giao dịch nào để xuất', 'warning');
        return;
      }

      await exportTransactionsToExcel(allTxns);
      alertUtil.toast('Đã xuất báo cáo giao dịch Excel thành công!', 'success');
    } catch (err) {
      alertUtil.popup('Lỗi khi xuất file Excel. Vui lòng thử lại sau.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} />
            <span>Thành công</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} />
            <span>Chờ thanh toán</span>
          </span>
        );
      case 'FAILED':
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
            <XCircle size={12} />
            <span>Thất bại</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Đối Soát Giao Dịch VNPAY & Báo Cáo Tài Chính (UC16.2 & UC16.3)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tra cứu đơn hàng, đối soát mã giao dịch cổng VNPAY, theo dõi trạng thái thanh toán và xuất file Excel định kỳ.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-60 shrink-0"
        >
          <FileSpreadsheet size={16} />
          <span>{isExporting ? 'Đang xuất Excel...' : 'Xuất File Excel (.xlsx)'}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={txnRefInput}
              onChange={(e) => setTxnRefInput(e.target.value)}
              placeholder="Tìm theo mã đơn hàng (vnp_TxnRef)..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              Trạng thái:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="SUCCESS">Thành công (SUCCESS)</option>
              <option value="PENDING">Đang chờ (PENDING)</option>
              <option value="FAILED">Thất bại (FAILED)</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs"
          >
            Tìm kiếm
          </button>
        </form>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Mã Đơn (vnp_TxnRef)</th>
                <th className="py-3 px-4">Mã GD VNPAY</th>
                <th className="py-3 px-4">Học Viên</th>
                <th className="py-3 px-4">Gói Cước</th>
                <th className="py-3 px-4">Số Tiền (VND)</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4">Thời Gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Đang tải dữ liệu đối soát giao dịch...
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Không tìm thấy giao dịch nào.
                  </td>
                </tr>
              ) : (
                data?.items?.map((tx: AdminTransaction) => (
                  <tr key={tx.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-gray-800">
                      {tx.vnpTxnRef}
                    </td>

                    <td className="py-3 px-4 font-mono text-gray-500">
                      {tx.vnpTransactionNo || '-'}
                    </td>

                    <td className="py-3 px-4 text-gray-900 font-medium">
                      {tx.userEmail || `User #${tx.userId}`}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-700">
                        {tx.planName || 'VIP'}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-bold text-gray-900">
                      {new Intl.NumberFormat('vi-VN', {
                        style: 'currency',
                        currency: 'VND',
                      }).format(tx.amount)}
                    </td>

                    <td className="py-3 px-4">{getStatusBadge(tx.status)}</td>

                    <td className="py-3 px-4 text-gray-500 text-[11px]">
                      <div>
                        {new Date(tx.createdAt).toLocaleDateString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {tx.paidAt && (
                        <div className="text-[10px] text-emerald-600">
                          Thanh toán: {new Date(tx.paidAt).toLocaleTimeString('vi-VN')}
                        </div>
                      )}
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
              Trang {data.page + 1} / {data.totalPages} (Tổng {data.totalElements} giao dịch)
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
    </div>
  );
};
export default TransactionReconciliationPage;
