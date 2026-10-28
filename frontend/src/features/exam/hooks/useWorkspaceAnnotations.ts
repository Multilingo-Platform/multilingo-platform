import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';
import type { WorkspaceTextDocument, WorkspaceTextSource } from '../types/workspaceText.types';
import {
  buildWorkspaceTextDocuments,
  workspaceTextSourceKey,
} from '../utils/workspaceTextDocuments';
import { useHighlightPersistence, type HighlightPersistenceDocument } from './useHighlightPersistence';
import { buildHighlightNamespace, type Highlight } from '../utils/highlightUtils';

export interface WorkspaceAnnotationContextValue {
  getHighlights: (source: WorkspaceTextSource, contentHash?: string | null) => Highlight[];
  namespaceFor: (source: WorkspaceTextSource, contentHash?: string | null) => string | null;
  learningLanguage?: string | null;
  documents?: WorkspaceTextDocument[];
}

export const WorkspaceAnnotationsContext = createContext<WorkspaceAnnotationContextValue | null>(null);

export function useWorkspaceAnnotationContext() {
  return useContext(WorkspaceAnnotationsContext);
}

export interface UseWorkspaceAnnotationsOptions {
  ownerId: string | null;
  attemptId: number | null;
  partId: number;
  contextRevision: number;
  enabled: boolean;
  currentPart: unknown;
  learningLanguage?: string | null;
  /** Already-prepared Reading passages retain their historical archive identity/offsets. */
  legacyDocuments?: HighlightPersistenceDocument[];
}

export function useWorkspaceAnnotations({
  ownerId,
  attemptId,
  partId,
  contextRevision,
  enabled,
  currentPart,
  learningLanguage = 'en',
  legacyDocuments,
}: UseWorkspaceAnnotationsOptions) {
  const records = useSelector((state: RootState) => state.answers.highlights);

  const documents = useMemo<WorkspaceTextDocument[]>(() => {
    if (!currentPart || !partId) return [];
    try {
      return buildWorkspaceTextDocuments(currentPart, partId);
    } catch {
      return [];
    }
  }, [currentPart, partId]);

  const persistenceDocuments = useMemo<HighlightPersistenceDocument[]>(() => {
    const current: HighlightPersistenceDocument[] = [];
    for (const doc of documents) {
      current.push({
        partId: doc.partId,
        documentId: doc.sourceKey,
        contentHash: doc.contentHash,
        text: doc.text,
      });
      if (doc.source.kind === 'GROUP_CONTENT' && doc.source.groupId) {
        current.push({
          partId: doc.partId,
          documentId: doc.source.groupId,
          contentHash: doc.contentHash,
          text: doc.text,
        });
      } else if (doc.source.kind === 'PART_CONTENT') {
        current.push({
          partId: doc.partId,
          documentId: 'part',
          contentHash: doc.contentHash,
          text: doc.text,
        });
      }
    }
    return [...current, ...(legacyDocuments ?? [])];
  }, [documents, legacyDocuments]);

  const namespaceForDocument = useCallback((documentId: string, contentHash?: string | null) => {
    const doc = persistenceDocuments.find(item => item.documentId === documentId &&
      (contentHash == null || item.contentHash === contentHash));
    if (!attemptId || !doc) return null;
    return buildHighlightNamespace({ ownerId: ownerId ?? 'memory-only', attemptId, partId,
      groupId: doc.documentId, contentHash: doc.contentHash });
  }, [persistenceDocuments, ownerId, attemptId, partId]);

  const persistence = useHighlightPersistence({
    ownerId,
    attemptId,
    contextRevision,
    enabled: enabled && persistenceDocuments.length > 0,
    documents: persistenceDocuments,
  });

  const namespaceFor = useCallback(
    (source: WorkspaceTextSource, contentHash?: string | null) => {
      const sourceKey = workspaceTextSourceKey(source);
      const hash = contentHash ?? documents.find((d) => d.sourceKey === sourceKey)?.contentHash;
      return namespaceForDocument(sourceKey, hash);
    },
    [documents, namespaceForDocument]
  );

  const getHighlights = useCallback(
    (source: WorkspaceTextSource, contentHash?: string | null): Highlight[] => {
      const sourceKey = workspaceTextSourceKey(source);
      const doc = documents.find((d) => d.sourceKey === sourceKey);
      const hash = contentHash ?? doc?.contentHash;
      if (!hash) return [];

      const namespace = namespaceFor(source, hash);
      const record = namespace ? records[namespace] : undefined;
      if (record && record.contentHash === hash) {
        return record.items;
      }

      // Backward-compatibility fallback for legacy R1 reading passages
      if (source.kind === 'PART_CONTENT') {
        const legacyNs = buildHighlightNamespace({
          ownerId: ownerId ?? 'memory-only',
          attemptId: attemptId ?? 0,
          partId,
          groupId: 'part',
          contentHash: hash,
        });
        const legacyRec = records[legacyNs];
        if (legacyRec && legacyRec.contentHash === hash) return legacyRec.items;
      } else if (source.kind === 'GROUP_CONTENT') {
        const legacyNs = buildHighlightNamespace({
          ownerId: ownerId ?? 'memory-only',
          attemptId: attemptId ?? 0,
          partId,
          groupId: source.groupId,
          contentHash: hash,
        });
        const legacyRec = records[legacyNs];
        if (legacyRec && legacyRec.contentHash === hash) return legacyRec.items;
      }

      return [];
    },
    [documents, records, namespaceFor, ownerId, attemptId, partId]
  );

  const contextValue = useMemo<WorkspaceAnnotationContextValue>(() => ({
    getHighlights,
    namespaceFor,
    learningLanguage,
    documents,
  }), [getHighlights, namespaceFor, learningLanguage, documents]);

  return {
    documents,
    getHighlights,
    namespaceFor,
    namespaceForDocument,
    selectionDocuments: persistenceDocuments,
    contextValue,
    ready: persistence.ready,
    warning: persistence.warning,
    flush: persistence.flush,
  };
}
