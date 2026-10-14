import React from 'react';
import { X, Code, Copy, Check } from 'lucide-react';
import type { AuditLogItem } from '../../types/adminTypes';

interface JsonSnapshotModalProps {
  log: AuditLogItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const JsonSnapshotModal: React.FC<JsonSnapshotModalProps> = ({
  log,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !log) return null;

  const jsonString = JSON.stringify(log.details || {}, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/75">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Code size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Bản Chụp Snapshot JSON (Audit #{log.id})
              </h3>
              <span className="text-[11px] text-gray-500">
                Hành động: {log.action} | Thực thể: {log.entityType} ({log.entityId || 'N/A'})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
          >
            <X size={18} />
          </button>
        </div>

        {/* JSON Viewer */}
        <div className="p-4 flex-1 overflow-auto bg-slate-900 text-slate-100 font-mono text-xs">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép JSON'}</span>
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-all leading-relaxed p-2 select-all">
            {jsonString}
          </pre>
        </div>

        {/* Footer Meta */}
        <div className="p-3 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 flex justify-between items-center">
          <span>
            Thực hiện bởi: {log.userEmail || `User #${log.userId || 'System'}`} ({log.ipAddress || '127.0.0.1'})
          </span>
          <span>{new Date(log.createdAt).toLocaleString('vi-VN')}</span>
        </div>
      </div>
    </div>
  );
};
