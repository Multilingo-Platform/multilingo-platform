import DOMPurify from 'dompurify';
import { formatHtmlContent } from '../../../utils/htmlUtils';

export interface ReadingHighlightDocument {
  partId: number;
  documentId: string;
  rawHtml: string;
}

export interface PreparedReadingDocument extends ReadingHighlightDocument {
  html: string;
  text: string;
  contentHash: string;
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Formats and sanitizes once, then derives offsets/hash from exactly that rendered passage. */
export function prepareReadingDocument(
  rawHtml: string,
  identity: Pick<ReadingHighlightDocument, 'partId' | 'documentId'> = { partId: 0, documentId: 'part' },
  options: { stripExecutableMedia?: boolean } = {}
): PreparedReadingDocument {
  const stripExecutableMedia = options.stripExecutableMedia ?? true;
  const formatted = formatHtmlContent(rawHtml);
  const clean = DOMPurify.sanitize(formatted, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ['autoplay'],
    ...(stripExecutableMedia
      ? { FORBID_TAGS: ['audio', 'video', 'iframe', 'object', 'embed', 'source', 'track'] }
      : {}),
  });
  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, 'text/html');
  doc.querySelectorAll('mark[data-hl-id]').forEach((mark) => {
    mark.replaceWith(...Array.from(mark.childNodes));
  });
  const html = doc.body.innerHTML;
  const text = doc.body.textContent ?? '';
  return {
    ...identity,
    rawHtml,
    html,
    text,
    contentHash: hashText(text),
  };
}
