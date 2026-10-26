import React, { useRef, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { formatHtmlContent } from '../../../../utils/htmlUtils';

export interface HtmlContentProps {
  html: string | null;
  className?: string;
  forbidAutoplay?: boolean;
  /**
   * Removes embedded executable media (audio/video/iframe/object/embed/source/track) entirely.
   * Used by the reading reference pane, which must never mount a second native player or an
   * inline frame; images and text are preserved.
   */
  stripMedia?: boolean;
  /** Input has already passed the shared reading-document formatter; still sanitize it. */
  prepared?: boolean;
}

/**
 * Renders HTML content safely using DOMPurify to prevent XSS.
 * When forbidAutoplay is true (default), removes autoplay from any embedded
 * media (audio/video), sets controls, and pauses playback upon unmount.
 * When stripMedia is true, embedded media is removed before rendering instead.
 * Returns null when html prop is null or empty.
 */
const HtmlContent: React.FC<HtmlContentProps> = ({
  html,
  className,
  forbidAutoplay = true,
  stripMedia = false,
  prepared = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const clean = useMemo(() => DOMPurify.sanitize(prepared ? (html ?? '') : formatHtmlContent(html ?? ''), {
    USE_PROFILES: { html: true },
    FORBID_ATTR: forbidAutoplay ? ['autoplay'] : [],
    ...(stripMedia
      ? { FORBID_TAGS: ['audio', 'video', 'iframe', 'object', 'embed', 'source', 'track'] }
      : {}),
  }), [html, prepared, forbidAutoplay, stripMedia]);
  // React must receive the same innerHTML object while content is unchanged:
  // replacing passage text nodes also resets the browser's live selection anchor.
  const innerHtml = useMemo(() => ({ __html: clean }), [clean]);

  useEffect(() => {
    const el = containerRef.current;
    if (forbidAutoplay && !stripMedia && el) {
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
  }, [html, forbidAutoplay, stripMedia]);

  if (!html) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={innerHtml}
    />
  );
};

export default HtmlContent;
