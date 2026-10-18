export type Highlight = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export function normalize(ranges: Highlight[]): Highlight[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const result: Highlight[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = result[result.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      last.text = last.text + ' ' + current.text;
    } else {
      result.push({ ...current });
    }
  }
  return result;
}

export function removeAt(ranges: Highlight[], offset: number): Highlight[] {
  return ranges.filter((r) => offset < r.start || offset >= r.end);
}

export interface HighlightNamespaceInput {
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
  const attempt = String(input.attemptId);
  const part = String(input.partId);
  const group = input.groupId == null || input.groupId === '' ? '-' : String(input.groupId);
  const hash = input.contentHash == null || input.contentHash === '' ? '-' : String(input.contentHash);
  return `hl:${attempt}:${part}:${group}:${hash}`;
}
