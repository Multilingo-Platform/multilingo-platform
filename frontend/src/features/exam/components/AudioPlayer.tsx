import { examMessage as em, useExamLocale } from '../i18n/examMessages';
import React, { useEffect, useRef, useState } from 'react';

export type AudioPlayerVariant = 'native' | 'practice' | 'server';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface AudioPlayerProps {
  url: string;
  isActive: boolean;
  /**
   * 'native' (default) keeps browser controls; 'practice' adds rewind/speed for listening practice;
   * 'server' hides native controls, seek, replay and download for the Mock timeline.
   */
  variant?: AudioPlayerVariant;
  /** Practice playback rate. */
  speed?: number;
  /** Practice: whether the 10s rewind control is enabled. */
  canRewind?: boolean;
  /** Server: autoplay was rejected; show a safe continue action. */
  blocked?: boolean;
  /** Exposes the single media element to the playback controller. */
  mediaRef?: (element: HTMLAudioElement | null) => void;
  onRewind?: () => void;
  onSpeedChange?: (rate: number) => void;
  onResume?: () => void;
}

/**
 * Controlled audio player bound to a single media element.
 * Stops the previous source before switching URL, and never exposes native
 * download/seek/replay controls while the Mock server owns the timeline.
 */
const AudioPlayer: React.FC<AudioPlayerProps> = ({
  url,
  isActive,
  variant = 'native',
  speed = 1,
  canRewind = false,
  blocked = false,
  mediaRef,
  onRewind,
  onSpeedChange,
  onResume,
}) => {
  useExamLocale();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasError, setHasError] = useState(false);
  const [stalled, setStalled] = useState(false);

  // Stop the previous source before switching URL/Part.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const previous = el.getAttribute('src');
    if (previous === url) return;
    if (previous !== null) {
      el.pause();
      el.currentTime = 0;
      el.removeAttribute('src');
      el.load();
    }
    el.src = url;
    setHasError(false);
    setStalled(false);
  }, [url]);

  // Bind after the source is committed, including callback handoffs with an unchanged URL.
  useEffect(() => {
    mediaRef?.(audioRef.current);
    return () => { mediaRef?.(null); };
  }, [url, mediaRef]);

  // Pause when this player is no longer the active Part.
  useEffect(() => {
    if (!isActive && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isActive]);

  // Native control policy and playback rate.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (variant === 'server') {
      el.removeAttribute('controls');
      el.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
      el.setAttribute('disablepictureinpicture', '');
    } else {
      el.setAttribute('controls', '');
      el.removeAttribute('controlsList');
      el.removeAttribute('disablepictureinpicture');
    }
    el.playbackRate = variant === 'practice' ? speed : 1;
  }, [variant, speed, url]);

  return (
    <div className="exam-audio-player" style={{ width: '100%' }}>
      <audio
        ref={audioRef}
        style={{ width: '100%', display: hasError ? 'none' : undefined }}
        onError={() => setHasError(true)}
        onWaiting={() => setStalled(true)}
        onStalled={() => setStalled(true)}
        onPlaying={() => setStalled(false)}
        onCanPlay={() => setStalled(false)}
        onContextMenu={variant === 'server' ? event => event.preventDefault() : undefined}
      >
        {em("Trình duyệt của bạn không hỗ trợ phát audio.")}</audio>

      {hasError && (
        <div role="alert" style={{ color: '#c0392b', padding: '8px' }}>
          {em("⚠️ Không thể tải audio. Vui lòng thử lại hoặc liên hệ hỗ trợ.")}</div>
      )}

      {!hasError && stalled && (
        <div role="status" style={{ padding: '4px 8px', color: '#64748b' }}>
          {em("Đang tải audio…")}</div>
      )}

      {!hasError && variant === 'practice' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
          <button type="button" onClick={() => onRewind?.()} disabled={!canRewind} aria-label={em("Tua lại 10 giây")}>
            {em("⟲ Tua lại 10 giây")}</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span>{em("Tốc độ phát")}</span>
            <select
              aria-label={em("Tốc độ phát")}
              value={String(speed)}
              onChange={event => onSpeedChange?.(Number(event.target.value))}
            >
              {SPEED_OPTIONS.map(rate => (
                <option key={rate} value={String(rate)}>{rate}x</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!hasError && variant === 'server' && blocked && (
        <div role="alert" style={{ padding: '8px', color: '#92400e' }}>
          <span>{em("Trình duyệt đã chặn tự động phát.")}</span>{' '}
          <button type="button" onClick={() => onResume?.()}>{em("Tiếp tục phát")}</button>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
