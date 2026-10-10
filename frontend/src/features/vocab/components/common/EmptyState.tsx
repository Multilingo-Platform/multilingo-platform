import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Layers } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Layers,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-white rounded-lg border border-dashed border-slate-300 ${className}`}
    >
      <div className="w-14 h-14 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 max-w-md mb-6 font-medium">{description}</p>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md font-bold text-sm text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
