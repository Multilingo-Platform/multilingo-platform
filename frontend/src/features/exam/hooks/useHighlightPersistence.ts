import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../app/store';
import { restoreHighlightRecords } from '../store/answerSlice';
import { buildHighlightNamespace, normalizeAgainstText, type Highlight } from '../utils/highlightUtils';
import {
  findArchivedHighlights,
  highlightArchiveKey,
  pruneExpiredHighlightArchives,
  readHighlightArchive,
  writeHighlightArchive,
  type HighlightArchive,
  type HighlightDocumentArchive,
} from '../utils/highlightStorage';

export interface HighlightPersistenceDocument {
  partId: number;
  documentId: string;
  contentHash: string;
  text: string;
}

export interface UseHighlightPersistenceOptions {
  ownerId: string | null;
  attemptId: number | null;
  contextRevision: number;
  enabled: boolean;
  documents: HighlightPersistenceDocument[];
}

interface HighlightPersistenceScope {
  ownerId: string;
  attemptId: number;
  documents: HighlightPersistenceDocument[];
}

export function useHighlightPersistence({
  ownerId,
  attemptId,
  contextRevision,
  enabled,
  documents,
}: UseHighlightPersistenceOptions) {
  const dispatch = useDispatch<AppDispatch>();
  const records = useSelector((state: RootState) => state.answers.highlights);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const archiveRef = useRef<HighlightArchive | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<(scope?: HighlightPersistenceScope) => boolean>(() => false);
  const contextKey = ownerId && attemptId ? highlightArchiveKey(ownerId, attemptId) : null;

  useEffect(() => {
    setReady(false);
    setWarning(null);
    archiveRef.current = null;
    if (!enabled || !ownerId || !attemptId || !contextKey) return;

    const cleanupOk = pruneExpiredHighlightArchives(ownerId);
    const loaded = readHighlightArchive(ownerId, attemptId);
    const previousScope = ownerId && attemptId ? { ownerId, attemptId, documents } : null;
    archiveRef.current = loaded.archive;
    const restored: Record<string, { contentHash: string; items: Highlight[] }> = {};
    for (const doc of documents) {
      const items = findArchivedHighlights(loaded.archive, doc.partId, doc.documentId, doc.contentHash, doc.text);
      if (items.length > 0) {
        const namespace = buildHighlightNamespace({
          ownerId,
          attemptId, partId: doc.partId, groupId: doc.documentId, contentHash: doc.contentHash,
        });
        restored[namespace] = { contentHash: doc.contentHash, items };
      }
    }
    dispatch(restoreHighlightRecords({ attemptId, contextRevision, highlights: restored }));
    setWarning(loaded.failed || !cleanupOk ? 'Không thể đọc hoặc dọn dữ liệu highlight trên thiết bị.' : null);
    setReady(true);
    return () => {
      // Flush the previous authenticated attempt/part before the next effect switches scope.
      // The delayed writer is canceled by the next render, so cleanup is its last safe boundary.
      if (previousScope) flushRef.current(previousScope);
    };
  }, [enabled, ownerId, attemptId, contextRevision, contextKey, documents, dispatch]);

  const flush = useCallback((scope: HighlightPersistenceScope = {
    ownerId: ownerId ?? '', attemptId: attemptId ?? 0, documents,
  }) => {
    if (!scope.ownerId || !scope.attemptId || !ready) return false;
    const previous = archiveRef.current;
    const merged = new Map<string, HighlightDocumentArchive>();
    for (const doc of previous?.documents ?? []) {
      merged.set(`${doc.partId}\u0000${doc.documentId}`, doc);
    }
    for (const doc of scope.documents) {
      const key = `${doc.partId}\u0000${doc.documentId}`;
      const namespace = buildHighlightNamespace({
        ownerId: scope.ownerId,
        attemptId: scope.attemptId, partId: doc.partId, groupId: doc.documentId, contentHash: doc.contentHash,
      });
      const current = records[namespace];
      const items = current?.contentHash === doc.contentHash
        ? normalizeAgainstText(current.items, doc.text)
        : findArchivedHighlights(previous, doc.partId, doc.documentId, doc.contentHash, doc.text);
      if (items.length > 0) merged.set(key, { partId: doc.partId, documentId: doc.documentId, contentHash: doc.contentHash, items });
      else merged.delete(key);
    }
    const archive: HighlightArchive = {
      schemaVersion: 1,
      ownerId: scope.ownerId,
      attemptId: scope.attemptId,
      updatedAt: new Date().toISOString(),
      documents: Array.from(merged.values()),
    };
    const saved = writeHighlightArchive(archive);
    if (saved) archiveRef.current = archive;
    setWarning(saved ? null : 'Không lưu được highlight trên thiết bị này.');
    return saved;
  }, [ownerId, attemptId, ready, documents, records]);

  useEffect(() => {
    if (!ready || !enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flush();
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [ready, enabled, records, documents, flush]);

  flushRef.current = flush;
  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flushRef.current();
    };
    const flushOnPageHide = () => flushRef.current();
    document.addEventListener('visibilitychange', flushWhenHidden);
    window.addEventListener('pagehide', flushOnPageHide);
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.removeEventListener('pagehide', flushOnPageHide);
      if (timerRef.current) clearTimeout(timerRef.current);
      flushRef.current();
    };
  }, []);

  return { ready, warning, flush };
}
