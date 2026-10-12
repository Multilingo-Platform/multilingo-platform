/**
 * Smartly formats passage content to ensure line breaks (Enter) and paragraphs are preserved,
 * while safely preserving existing HTML tags (such as images, tables, headings, bold, italic).
 */
export function formatHtmlContent(content: string | null | undefined): string {
  if (!content || !content.trim()) return '';

  const trimmed = content.trim();

  // If content has NO tags at all, split by paragraphs and replace newlines with <br/>
  if (!/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed
      .split(/\n\s*\n/)
      .map((p: string) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('\n');
  }

  // Regex to match existing block-level HTML tags
  const blockRegex = /(<(?:p|div|h[1-6]|ul|ol|blockquote|table|pre)[^>]*>[\s\S]*?<\/(?:p|div|h[1-6]|ul|ol|blockquote|table|pre)>|<hr\s*\/?>)/gi;

  const parts = trimmed.split(blockRegex);
  const formattedParts = parts.map((part: string) => {
    if (!part || !part.trim()) return '';

    // If it's a block tag match, preserve it, but convert raw \n inside <p> or <div> into <br/>
    if (blockRegex.test(part)) {
      blockRegex.lastIndex = 0;
      if (/^<(?:p|div)[^>]*>[\s\S]*?<\/(?:p|div)>$/i.test(part.trim())) {
        return part.replace(/(>)([^<]+)(<)/g, (_, open, text, close) => {
          return `${open}${text.replace(/\n/g, '<br/>')}${close}`;
        });
      }
      return part;
    }
    blockRegex.lastIndex = 0;

    // It's a text/inline segment between or outside blocks
    const cleanSegment = part.trim();
    if (!cleanSegment) return '';

    return cleanSegment
      .split(/\n\s*\n/)
      .map((p: string) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('\n');
  });

  return formattedParts.filter(Boolean).join('\n');
}
