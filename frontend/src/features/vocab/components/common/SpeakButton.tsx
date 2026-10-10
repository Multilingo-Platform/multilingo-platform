import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { speakWord } from '../../../../utils/speech';

export interface SpeakButtonProps {
  text: string;
  langCode?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SpeakButton: React.FC<SpeakButtonProps> = ({
  text,
  langCode = 'en',
  className = '',
  size = 'md',
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text || text.trim() === '') return;

    setIsSpeaking(true);
    speakWord(text, langCode);

    // Hiệu ứng nhấp nháy phát âm trong 1s
    setTimeout(() => {
      setIsSpeaking(false);
    }, 1000);
  };

  const sizeClasses = {
    sm: 'p-1.5 h-7 w-7 text-xs',
    md: 'p-2 h-9 w-9 text-sm',
    lg: 'p-3 h-11 w-11 text-base',
  }[size];

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  }[size];

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Phát âm (Pronounce)"
      aria-label={`Phát âm từ ${text}`}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-200 
        ${
          isSpeaking
            ? 'bg-amber-100 text-amber-600 scale-110 shadow-sm animate-pulse'
            : 'text-slate-500 hover:text-amber-600 hover:bg-slate-100'
        } ${sizeClasses} ${className}`}
    >
      <Volume2 size={iconSizes} className={isSpeaking ? 'animate-bounce' : ''} />
    </button>
  );
};
