import React, { useRef, useEffect, useState } from 'react';

interface AudioPlayerProps {
  url: string;
  durationSeconds?: number;
  isActive: boolean;
}

/**
 * Controlled audio player.
 * Pauses automatically when isActive becomes false (e.g. Part switch).
 * Shows fallback text if audio fails to load.
 */
const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, isActive }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasError, setHasError] = useState(false);

  // Pause when this player becomes inactive (Part changed)
  useEffect(() => {
    if (!isActive && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isActive]);

  // Reset error state when URL changes
  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (hasError) {
    return (
      <div role="alert" style={{ color: '#c0392b', padding: '8px' }}>
        ⚠️ Không thể tải audio. Vui lòng thử lại hoặc liên hệ hỗ trợ.
      </div>
    );
  }

  return (
    <audio
      ref={audioRef}
      controls
      style={{ width: '100%' }}
      onError={() => setHasError(true)}
    >
      <source src={url} type="audio/mpeg" />
      Trình duyệt của bạn không hỗ trợ phát audio.
    </audio>
  );
};

export default AudioPlayer;
