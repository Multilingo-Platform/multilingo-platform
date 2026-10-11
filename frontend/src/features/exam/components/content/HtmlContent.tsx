import React, { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

export interface HtmlContentProps {
  html: string | null;
  className?: string;
  forbidAutoplay?: boolean;
}

/**
 * Renders HTML content safely using DOMPurify to prevent XSS.
 * When forbidAutoplay is true (default), removes autoplay from any embedded
 * media (audio/video), sets controls, and pauses playback upon unmount.
 * Returns null when html prop is null or empty.
 */
const HtmlContent: React.FC<HtmlContentProps> = ({
  html,
  className,
  forbidAutoplay = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (forbidAutoplay && el) {
      const mediaElements = el.querySelectorAll<HTMLMediaElement>('audio, video');
      mediaElements.forEach((m) => {
        m.autoplay = false;
        m.removeAttribute('autoplay');
        if (!m.hasAttribute('controls')) {
          m.setAttribute('controls', '');
        }
      });
    }

    return () => {
      if (el) {
        const mediaElements = el.querySelectorAll<HTMLMediaElement>('audio, video');
        mediaElements.forEach((m) => {
          try {
            m.pause();
            m.currentTime = 0;
          } catch {}
        });
      }
    };
  }, [html, forbidAutoplay]);

  if (!html) return null;

  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: forbidAutoplay ? ['autoplay'] : [],
  });

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
};

export default HtmlContent;
