import { DEFAULT_HIGHLIGHT_COLOR, isValidHighlightColor } from './highlightColors';
import { normalize, normalizeAgainstText, type Highlight } from './highlightUtils';

export interface HighlightDocumentArchive {
  partId: number;
  documentId: string;
  contentHash: string;
  items: Highlight[];
}

export interface HighlightArchiveV1 {
  schemaVersion: 1;
  ownerId: string;
  attemptId: number;
  updatedAt: string;
  documents: HighlightDocumentArchive[];
}

export interface HighlightArchiveV2 {
  schemaVersion: 2;
  ownerId: string;
  attemptId: number;
  updatedAt: string;
  documents: HighlightDocumentArchive[];
}

export type HighlightArchive = HighlightArchiveV2;

export const HIGHLIGHT_ARCHIVE_SCHEMA_VERSION = 2 as const;

const PREFIX_V1 = 'exam_highlights_v1_';
const PREFIX_V2 = 'exam_highlights_v2_';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function highlightArchiveKey(ownerId: string, attemptId: number): string {
  return highlightArchiveKeyV2(ownerId, attemptId);
}

export function highlightArchiveKeyV1(ownerId: string, attemptId: number): string {
  return `${PREFIX_V1}${ownerId}_${attemptId}`;
}

export function highlightArchiveKeyV2(ownerId: string, attemptId: number): string {
  return `${PREFIX_V2}${ownerId}_${attemptId}`;
}

function isValidItem(item: unknown): item is Highlight {
  if (!item || typeof item !== 'object') return false;
  const record = item as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    Number.isInteger(record.start) &&
    Number.isInteger(record.end) &&
    (record.start as number) >= 0 &&
    (record.end as number) > (record.start as number) &&
    typeof record.text === 'string' &&
    (record.color === undefined || isValidHighlightColor(record.color))
  );
}

function parseArchiveV2(raw: string | null, ownerId: string, attemptId: number): HighlightArchiveV2 | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<HighlightArchiveV2>;
    if (
      value.schemaVersion !== 2 ||
      value.ownerId !== ownerId ||
      value.attemptId !== attemptId ||
      typeof value.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.updatedAt)) ||
      !Array.isArray(value.documents)
    ) {
      return null;
    }
    const documents: HighlightDocumentArchive[] = [];
    for (const rawDocument of value.documents) {
      if (!rawDocument || typeof rawDocument !== 'object') continue;
      const doc = rawDocument as Partial<HighlightDocumentArchive>;
      if (
        !Number.isInteger(doc.partId) ||
        (doc.partId as number) <= 0 ||
        typeof doc.documentId !== 'string' ||
        !doc.documentId ||
        typeof doc.contentHash !== 'string' ||
        !doc.contentHash ||
        !Array.isArray(doc.items) ||
        !doc.items.every(isValidItem)
      ) {
        continue;
      }
      const items = normalize(
        doc.items.map((it) => ({
          ...it,
          color: it.color ?? DEFAULT_HIGHLIGHT_COLOR,
        }))
      );
      documents.push({
        partId: doc.partId as number,
        documentId: doc.documentId,
        contentHash: doc.contentHash,
        items,
      });
    }
    return { schemaVersion: 2, ownerId, attemptId, updatedAt: value.updatedAt, documents };
  } catch {
    return null;
  }
}

function parseArchiveV1(raw: string | null, ownerId: string, attemptId: number): HighlightArchiveV1 | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<HighlightArchiveV1>;
    if (
      value.schemaVersion !== 1 ||
      value.ownerId !== ownerId ||
      value.attemptId !== attemptId ||
      typeof value.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.updatedAt)) ||
      !Array.isArray(value.documents)
    ) {
      return null;
    }
    const documents: HighlightDocumentArchive[] = [];
    for (const rawDocument of value.documents) {
      if (!rawDocument || typeof rawDocument !== 'object') continue;
      const doc = rawDocument as Partial<HighlightDocumentArchive>;
      if (
        !Number.isInteger(doc.partId) ||
        (doc.partId as number) <= 0 ||
        typeof doc.documentId !== 'string' ||
        !doc.documentId ||
        typeof doc.contentHash !== 'string' ||
        !doc.contentHash ||
        !Array.isArray(doc.items) ||
        !doc.items.every(isValidItem)
      ) {
        continue;
      }
      const items = normalize(
        doc.items.map((it) => ({
          ...it,
          color: DEFAULT_HIGHLIGHT_COLOR,
        }))
      );
      documents.push({
        partId: doc.partId as number,
        documentId: doc.documentId,
        contentHash: doc.contentHash,
        items,
      });
    }
    return { schemaVersion: 1, ownerId, attemptId, updatedAt: value.updatedAt, documents };
  } catch {
    return null;
  }
}

export function readHighlightArchive(
  ownerId: string,
  attemptId: number
): { archive: HighlightArchiveV2 | null; failed: boolean } {
  if (!ownerId || !Number.isSafeInteger(attemptId) || attemptId < 1) {
    return { archive: null, failed: true };
  }
  try {
    // 1. Try reading Schema 2 (priority when key exists, even if empty documents)
    const v2Raw = localStorage.getItem(highlightArchiveKeyV2(ownerId, attemptId));
    if (v2Raw !== null) {
      const v2Archive = parseArchiveV2(v2Raw, ownerId, attemptId);
      if (v2Archive) {
        return { archive: v2Archive, failed: false };
      }
      // If key had schemaVersion 1 stored under it, migrate to yellow
      const v1FromV2 = parseArchiveV1(v2Raw, ownerId, attemptId);
      if (v1FromV2) {
        const migrated: HighlightArchiveV2 = {
          schemaVersion: 2,
          ownerId: v1FromV2.ownerId,
          attemptId: v1FromV2.attemptId,
          updatedAt: v1FromV2.updatedAt,
          documents: v1FromV2.documents.map((doc) => ({
            ...doc,
            items: doc.items.map((it) => ({
              ...it,
              color: DEFAULT_HIGHLIGHT_COLOR,
            })),
          })),
        };
        return { archive: migrated, failed: false };
      }
      return { archive: null, failed: false };
    }

    // 2. If Schema 2 not present, fallback to Schema 1 and migrate to yellow
    const v1Raw = localStorage.getItem(highlightArchiveKeyV1(ownerId, attemptId));
    if (v1Raw !== null) {
      const v1Archive = parseArchiveV1(v1Raw, ownerId, attemptId);
      if (v1Archive) {
        const migrated: HighlightArchiveV2 = {
          schemaVersion: 2,
          ownerId: v1Archive.ownerId,
          attemptId: v1Archive.attemptId,
          updatedAt: v1Archive.updatedAt,
          documents: v1Archive.documents.map((doc) => ({
            ...doc,
            items: doc.items.map((it) => ({
              ...it,
              color: DEFAULT_HIGHLIGHT_COLOR,
            })),
          })),
        };
        return { archive: migrated, failed: false };
      }
    }

    return { archive: null, failed: false };
  } catch {
    return { archive: null, failed: true };
  }
}

export function writeHighlightArchive(archive: HighlightArchiveV2 | HighlightArchiveV1): boolean {
  try {
    const v2Archive: HighlightArchiveV2 = {
      schemaVersion: 2,
      ownerId: archive.ownerId,
      attemptId: archive.attemptId,
      updatedAt: archive.updatedAt || new Date().toISOString(),
      documents: archive.documents.map((doc) => ({
        ...doc,
        items: normalize(
          doc.items.map((it) => ({
            ...it,
            color: it.color ?? DEFAULT_HIGHLIGHT_COLOR,
          }))
        ),
      })),
    };
    localStorage.setItem(
      highlightArchiveKeyV2(archive.ownerId, archive.attemptId),
      JSON.stringify(v2Archive)
    );
    // Backward compatibility: also sync v1 key for legacy readers/tests
    const v1Archive: HighlightArchiveV1 = {
      schemaVersion: 1,
      ownerId: archive.ownerId,
      attemptId: archive.attemptId,
      updatedAt: v2Archive.updatedAt,
      documents: v2Archive.documents.map((doc) => ({
        partId: doc.partId,
        documentId: doc.documentId,
        contentHash: doc.contentHash,
        items: doc.items.map((it) => ({
          id: it.id,
          start: it.start,
          end: it.end,
          text: it.text,
        })),
      })),
    };
    localStorage.setItem(
      highlightArchiveKeyV1(archive.ownerId, archive.attemptId),
      JSON.stringify(v1Archive)
    );
    return true;
  } catch {
    return false;
  }
}

export function pruneExpiredHighlightArchives(ownerId: string, now = Date.now()): boolean {
  if (!ownerId) return false;
  try {
    const prefixV1 = `${PREFIX_V1}${ownerId}_`;
    const prefixV2 = `${PREFIX_V2}${ownerId}_`;
    const expired: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (key.startsWith(prefixV2)) {
        const attemptId = Number(key.slice(prefixV2.length));
        const archive = parseArchiveV2(localStorage.getItem(key), ownerId, attemptId);
        if (archive && now - Date.parse(archive.updatedAt) > MAX_AGE_MS) expired.push(key);
      } else if (key.startsWith(prefixV1)) {
        const attemptId = Number(key.slice(prefixV1.length));
        const archive = parseArchiveV1(localStorage.getItem(key), ownerId, attemptId);
        if (archive && now - Date.parse(archive.updatedAt) > MAX_AGE_MS) expired.push(key);
      }
    }
    expired.forEach((key) => localStorage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}

export function findArchivedHighlights(
  archive: HighlightArchiveV2 | HighlightArchiveV1 | null,
  partId: number,
  documentId: string,
  contentHash: string,
  documentText: string
): Highlight[] {
  const document = archive?.documents.find(
    (item) => item.partId === partId && item.documentId === documentId && item.contentHash === contentHash
  );
  return document ? normalizeAgainstText(document.items, documentText) : [];
}
