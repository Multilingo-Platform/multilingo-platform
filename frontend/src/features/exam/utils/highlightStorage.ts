import { normalize, normalizeAgainstText, type Highlight } from './highlightUtils';

export interface HighlightDocumentArchive {
  partId: number;
  documentId: string;
  contentHash: string;
  items: Highlight[];
}

export interface HighlightArchive {
  schemaVersion: 1;
  ownerId: string;
  attemptId: number;
  updatedAt: string;
  documents: HighlightDocumentArchive[];
}

const PREFIX = 'exam_highlights_v1_';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function highlightArchiveKey(ownerId: string, attemptId: number): string {
  return `${PREFIX}${ownerId}_${attemptId}`;
}

function isValidItem(item: unknown): item is Highlight {
  if (!item || typeof item !== 'object') return false;
  const record = item as Record<string, unknown>;
  return typeof record.id === 'string' && record.id.length > 0 &&
    Number.isInteger(record.start) && Number.isInteger(record.end) &&
    (record.start as number) >= 0 && (record.end as number) > (record.start as number) &&
    typeof record.text === 'string';
}

function parseArchive(raw: string | null, ownerId: string, attemptId: number): HighlightArchive | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<HighlightArchive>;
    if (
      value.schemaVersion !== 1 || value.ownerId !== ownerId || value.attemptId !== attemptId ||
      typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) ||
      !Array.isArray(value.documents)
    ) return null;
    const documents: HighlightDocumentArchive[] = [];
    for (const rawDocument of value.documents) {
      if (!rawDocument || typeof rawDocument !== 'object') continue;
      const doc = rawDocument as Partial<HighlightDocumentArchive>;
      if (!Number.isInteger(doc.partId) || (doc.partId as number) <= 0 ||
          typeof doc.documentId !== 'string' || !doc.documentId ||
          typeof doc.contentHash !== 'string' || !doc.contentHash ||
          !Array.isArray(doc.items) || !doc.items.every(isValidItem)) continue;
      const items = normalize(doc.items);
      documents.push({ partId: doc.partId as number, documentId: doc.documentId, contentHash: doc.contentHash, items });
    }
    return { schemaVersion: 1, ownerId, attemptId, updatedAt: value.updatedAt, documents };
  } catch {
    return null;
  }
}

export function readHighlightArchive(ownerId: string, attemptId: number): { archive: HighlightArchive | null; failed: boolean } {
  if (!ownerId || !Number.isSafeInteger(attemptId) || attemptId < 1) return { archive: null, failed: true };
  try {
    const archive = parseArchive(localStorage.getItem(highlightArchiveKey(ownerId, attemptId)), ownerId, attemptId);
    return { archive, failed: false };
  } catch {
    return { archive: null, failed: true };
  }
}

export function writeHighlightArchive(archive: HighlightArchive): boolean {
  try {
    localStorage.setItem(highlightArchiveKey(archive.ownerId, archive.attemptId), JSON.stringify(archive));
    return true;
  } catch {
    return false;
  }
}

export function pruneExpiredHighlightArchives(ownerId: string, now = Date.now()): boolean {
  if (!ownerId) return false;
  try {
    const prefix = `${PREFIX}${ownerId}_`;
    const expired: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const archive = parseArchive(localStorage.getItem(key), ownerId, Number(key.slice(prefix.length)));
      if (archive && now - Date.parse(archive.updatedAt) > MAX_AGE_MS) expired.push(key);
    }
    expired.forEach((key) => localStorage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}

export function findArchivedHighlights(
  archive: HighlightArchive | null,
  partId: number,
  documentId: string,
  contentHash: string,
  documentText: string
): Highlight[] {
  const document = archive?.documents.find((item) =>
    item.partId === partId && item.documentId === documentId && item.contentHash === contentHash
  );
  return document ? normalizeAgainstText(document.items, documentText) : [];
}

export const HIGHLIGHT_ARCHIVE_SCHEMA_VERSION = 1 as const;
