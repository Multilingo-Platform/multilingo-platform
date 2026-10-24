export type Highlight = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export function normalize(ranges: Highlight[]): Highlight[] {
  if (ranges.length === 0) return [];
  const sorted = ranges
    .filter(isValidRange)
    .map((range) => ({ ...range }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (sorted.length === 0) return [];
  const result: Highlight[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = result[result.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      if (current.start < last.end) last.text = last.text || current.text;
    } else {
      result.push({ ...current });
    }
  }
  return result;
}

function isValidRange(range: Highlight): boolean {
  return Boolean(
    range && typeof range.id === 'string' && range.id.length > 0 &&
    Number.isFinite(range.start) && Number.isInteger(range.start) && range.start >= 0 &&
    Number.isFinite(range.end) && Number.isInteger(range.end) && range.end > range.start &&
    typeof range.text === 'string'
  );
}

/** Validates ranges against the exact visible-text document and rebuilds debug text from it. */
export function normalizeAgainstText(ranges: Highlight[], documentText: string): Highlight[] {
  if (!Array.isArray(ranges) || typeof documentText !== 'string') return [];
  const splitsSurrogate = (offset: number) => offset > 0 && offset < documentText.length &&
    documentText.charCodeAt(offset - 1) >= 0xd800 && documentText.charCodeAt(offset - 1) <= 0xdbff &&
    documentText.charCodeAt(offset) >= 0xdc00 && documentText.charCodeAt(offset) <= 0xdfff;
  const valid = ranges.filter((range) =>
    isValidRange(range) && range.end <= documentText.length && !splitsSurrogate(range.start) && !splitsSurrogate(range.end)
  );
  return normalize(valid).map((range) => ({
    ...range,
    text: documentText.slice(range.start, range.end).slice(0, 50),
  }));
}

export function removeAt(ranges: Highlight[], offset: number): Highlight[] {
  return ranges.filter((r) => offset < r.start || offset >= r.end);
}

export interface HighlightNamespaceInput {
  /** Authenticated account id; prevents same-attempt IDs from leaking across users. */
  ownerId?: string | null;
  attemptId: number | string;
  partId: number | string;
  /** Reference document id; a missing group id collapses to a stable placeholder. */
  groupId: string | null | undefined;
  /** Content hash of the annotated document, so a changed document never reuses old ranges. */
  contentHash: string | null | undefined;
}

/**
 * Builds the highlight bucket key. Highlight ranges are plain text offsets, so they are only valid
 * for one document of one Part of one attempt: the namespace keeps a highlight made in one
 * reference document from ever leaking into another attempt, Part, group or content version.
 */
export function buildHighlightNamespace(input: HighlightNamespaceInput): string {
  const owner = input.ownerId == null || input.ownerId === '' ? '-' : String(input.ownerId);
  const attempt = String(input.attemptId);
  const part = String(input.partId);
  const group = input.groupId == null || input.groupId === '' ? '-' : String(input.groupId);
  const hash = input.contentHash == null || input.contentHash === '' ? '-' : String(input.contentHash);
  return `hl:${owner}:${attempt}:${part}:${group}:${hash}`;
}
