import React from 'react';
import { Search, RotateCcw, Plus } from 'lucide-react';

interface AdminDeckFilterBarProps {
  keyword: string;
  onKeywordChange: (val: string) => void;
  targetLanguage: string;
  onTargetLanguageChange: (val: string) => void;
  isPublicFilter: string;
  onIsPublicFilterChange: (val: string) => void;
  onReset: () => void;
  onCreateClick: () => void;
}

export const AdminDeckFilterBar: React.FC<AdminDeckFilterBarProps> = ({
  keyword,
  onKeywordChange,
  targetLanguage,
  onTargetLanguageChange,
  isPublicFilter,
  onIsPublicFilterChange,
  onReset,
  onCreateClick,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="Tìm kiếm theo tên bộ thẻ, mô tả..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-800 placeholder-gray-400"
            />
          </div>

          {/* Language filter */}
          <div className="sm:w-44">
            <select
              value={targetLanguage}
              onChange={(e) => onTargetLanguageChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-700"
            >
              <option value="ALL">Tất cả ngôn ngữ</option>
              <option value="en">Tiếng Anh (EN)</option>
              <option value="vi">Tiếng Việt (VI)</option>
              <option value="ja">Tiếng Nhật (JA)</option>
              <option value="ko">Tiếng Hàn (KO)</option>
              <option value="zh">Tiếng Trung (ZH)</option>
            </select>
          </div>

          {/* Public filter */}
          <div className="sm:w-44">
            <select
              value={isPublicFilter}
              onChange={(e) => onIsPublicFilterChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-700"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="true">🌐 Công khai (Public)</option>
              <option value="false">🔒 Riêng tư (Private)</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(keyword || targetLanguage !== 'ALL' || isPublicFilter !== 'ALL') && (
            <button
              type="button"
              onClick={onReset}
              title="Đặt lại bộ lọc"
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Đặt lại</span>
            </button>
          )}
        </div>

        {/* Action button */}
        <button
          type="button"
          onClick={onCreateClick}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow active:scale-95 shrink-0"
        >
          <Plus size={18} />
          <span>Tạo Bộ Thẻ Mới</span>
        </button>
      </div>
    </div>
  );
};
