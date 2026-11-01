import {
  DEFAULT_HIGHLIGHT_COLOR,
  isValidHighlightColor,
  type HighlightColor,
} from './highlightColors';

export type Highlight = {
  id: string;
  start: number;
  end: number;
  text: string;
  color?: HighlightColor;
};

export function normalize(ranges: Highlight[]): Highlight[] {
  if (!Array.isArray(ranges) || ranges.length === 0) return [];
  const sorted = ranges
    .filter(isValidRange)
    .map((range) => ({
      ...range,
      color: range.color ?? DEFAULT_HIGHLIGHT_COLOR,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (sorted.length === 0) return [];
  const result: Highlight[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = result[result.length - 1];

    if (current.color === last.color && current.start <= last.end) {
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
    range &&
      typeof range.id === 'string' &&
      range.id.length > 0 &&
      Number.isFinite(range.start) &&
      Number.isInteger(range.start) &&
      range.start >= 0 &&
      Number.isFinite(range.end) &&
      Number.isInteger(range.end) &&
      range.end > range.start &&
      typeof range.text === 'string' &&
      (range.color === undefined || isValidHighlightColor(range.color))
  );
}

function isSurrogateSplit(offset: number, text: string): boolean {
  return (
    offset > 0 &&
    offset < text.length &&
    text.charCodeAt(offset - 1) >= 0xd800 &&
    text.charCodeAt(offset - 1) <= 0xdbff &&
    text.charCodeAt(offset) >= 0xdc00 &&
    text.charCodeAt(offset) <= 0xdfff
  );
}

/** Validates ranges against the exact visible-text document and rebuilds debug text from it. */
export function normalizeAgainstText(ranges: Highlight[], documentText: string): Highlight[] {
  if (!Array.isArray(ranges) || typeof documentText !== 'string') return [];
  const valid = ranges.filter(
    (range) =>
      isValidRange(range) &&
      range.end <= documentText.length &&
      !isSurrogateSplit(range.start, documentText) &&
      !isSurrogateSplit(range.end, documentText)
  );
  return normalize(valid).map((range) => ({
    ...range,
    color: range.color ?? DEFAULT_HIGHLIGHT_COLOR,
    text: documentText.slice(range.start, range.end).slice(0, 50),
  }));
}

/**
 * Pure overlay function: applies a new highlight range over existing ranges.
 * Cuts old ranges at the selection boundaries, applies the new color to the intersecting
 * region, preserves non-overlapping regions and IDs, and merges only adjacent/overlapping
 * ranges of the same color. Does not mutate inputs.
 */
export function applyHighlightOverlay(
  existingRanges: Highlight[],
  newHighlight: Highlight,
  documentText: string
): Highlight[] {
  if (!Array.isArray(existingRanges) || typeof documentText !== 'string') return [];
  const normalizedExisting = normalizeAgainstText(existingRanges, documentText);

  if (!isValidRange(newHighlight)) return normalizedExisting;

  if (
    newHighlight.end > documentText.length ||
    isSurrogateSplit(newHighlight.start, documentText) ||
    isSurrogateSplit(newHighlight.end, documentText)
  ) {
    return normalizedExisting;
  }

  const newStart = newHighlight.start;
  const newEnd = newHighlight.end;
  const targetColor: HighlightColor = newHighlight.color ?? DEFAULT_HIGHLIGHT_COLOR;

  const pieces: Highlight[] = [];

  for (const existing of normalizedExisting) {
    // Case 1: No intersection
    if (existing.end <= newStart || existing.start >= newEnd) {
      pieces.push({ ...existing });
      continue;
    }

    // Case 2: existing is completely covered by newHighlight
    if (newStart <= existing.start && existing.end <= newEnd) {
      continue;
    }

    // Case 3: newHighlight is strictly inside existing
    if (existing.start < newStart && newEnd < existing.end) {
      pieces.push({
        id: existing.id,
        start: existing.start,
        end: newStart,
        color: existing.color,
        text: documentText.slice(existing.start, newStart).slice(0, 50),
      });
      pieces.push({
        id: `${existing.id}_r${newEnd}`,
        start: newEnd,
        end: existing.end,
        color: existing.color,
        text: documentText.slice(newEnd, existing.end).slice(0, 50),
      });
      continue;
    }

    // Case 4: existing overlaps newHighlight on the left
    if (existing.start < newStart && existing.end <= newEnd) {
      pieces.push({
        id: existing.id,
        start: existing.start,
        end: newStart,
        color: existing.color,
        text: documentText.slice(existing.start, newStart).slice(0, 50),
      });
      continue;
    }

    // Case 5: existing overlaps newHighlight on the right
    if (newStart <= existing.start && newEnd < existing.end) {
      pieces.push({
        id: existing.id,
        start: newEnd,
        end: existing.end,
        color: existing.color,
        text: documentText.slice(newEnd, existing.end).slice(0, 50),
      });
      continue;
    }
  }

  // Add the newly highlighted range
  pieces.push({
    id: newHighlight.id,
    start: newStart,
    end: newEnd,
    color: targetColor,
    text: documentText.slice(newStart, newEnd).slice(0, 50),
  });

  const normalized = normalizeAgainstText(pieces, documentText);
  const claimedExistingIds = new Set<string>();
  const usedIds = new Set<string>();

  return normalized.map((merged) => {
    let candidateId = merged.id;

    // When a newly selected range expands an existing cluster of the same color, keep the existing cluster id.
    // Only inherit an existing cluster id if the candidateId is the newHighlight id (not a preserved or split id).
    if (candidateId === newHighlight.id) {
      const matchingExisting = normalizedExisting
        .filter(
          (ex) =>
            ex.color === merged.color &&
            ex.start <= merged.end &&
            ex.end >= merged.start &&
            !claimedExistingIds.has(ex.id)
        )
        .sort((a, b) => a.start - b.start || a.end - b.end)[0];

      if (matchingExisting) {
        candidateId = matchingExisting.id;
        claimedExistingIds.add(matchingExisting.id);
      }
    } else {
      claimedExistingIds.add(candidateId);
    }

    let uniqueId = candidateId;
    if (usedIds.has(uniqueId)) {
      uniqueId = `${candidateId}_${merged.start}`;
    }
    let counter = 1;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${candidateId}_${merged.start}_${counter++}`;
    }
    usedIds.add(uniqueId);

    return { ...merged, id: uniqueId };
  });
}

/**
 * Cuts out a sub-range [start, end) from existing highlights.
 * Preserves the outer unselected portions and their IDs.
 */
export function deleteHighlightFromRange(
  existingRanges: Highlight[],
  delStart: number,
  delEnd: number,
  documentText: string
): Highlight[] {
  if (!Array.isArray(existingRanges) || typeof documentText !== 'string') return [];
  const normalizedExisting = normalizeAgainstText(existingRanges, documentText);
  if (!Number.isInteger(delStart) || !Number.isInteger(delEnd) || delStart < 0 || delEnd <= delStart) {
    return normalizedExisting;
  }

  if (
    delEnd > documentText.length ||
    isSurrogateSplit(delStart, documentText) ||
    isSurrogateSplit(delEnd, documentText)
  ) {
    return normalizedExisting;
  }

  const pieces: Highlight[] = [];

  for (const existing of normalizedExisting) {
    // No intersection
    if (existing.end <= delStart || existing.start >= delEnd) {
      pieces.push({ ...existing });
      continue;
    }

    // Completely deleted
    if (delStart <= existing.start && existing.end <= delEnd) {
      continue;
    }

    // Deleted range strictly inside existing
    if (existing.start < delStart && delEnd < existing.end) {
      pieces.push({
        id: existing.id,
        start: existing.start,
        end: delStart,
        color: existing.color,
        text: documentText.slice(existing.start, delStart).slice(0, 50),
      });
      pieces.push({
        id: `${existing.id}_r${delEnd}`,
        start: delEnd,
        end: existing.end,
        color: existing.color,
        text: documentText.slice(delEnd, existing.end).slice(0, 50),
      });
      continue;
    }

    // Overlaps left
    if (existing.start < delStart && existing.end <= delEnd) {
      pieces.push({
        id: existing.id,
        start: existing.start,
        end: delStart,
        color: existing.color,
        text: documentText.slice(existing.start, delStart).slice(0, 50),
      });
      continue;
    }

    // Overlaps right
    if (delStart <= existing.start && delEnd < existing.end) {
      pieces.push({
        id: existing.id,
        start: delEnd,
        end: existing.end,
        color: existing.color,
        text: documentText.slice(delEnd, existing.end).slice(0, 50),
      });
      continue;
    }
  }

  const normalized = normalizeAgainstText(pieces, documentText);
  const usedIds = new Set<string>();
  return normalized.map((h) => {
    let id = h.id;
    if (usedIds.has(id)) {
      id = `${id}_${h.start}`;
    }
    let counter = 1;
    while (usedIds.has(id)) {
      id = `${h.id}_${h.start}_${counter++}`;
    }
    usedIds.add(id);
    return { ...h, id };
  });
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
