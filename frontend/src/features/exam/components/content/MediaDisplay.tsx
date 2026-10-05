import React from 'react';
import type { SharedMedia } from '../../types/exam.types';

interface MediaDisplayProps {
  media: SharedMedia | null;
  alt?: string;
}

const MediaDisplay: React.FC<MediaDisplayProps> = ({ media, alt = 'Exam image' }) => {
  if (!media) return null;
  const size = media.display_config?.size_preset === 'large' ? '100%' : '60%';
  const align = media.display_config?.alignment ?? 'center';
  return (
    <div style={{ textAlign: align as React.CSSProperties['textAlign'] }}>
      <img src={media.url} alt={alt} style={{ maxWidth: size }} />
    </div>
  );
};

export default MediaDisplay;
