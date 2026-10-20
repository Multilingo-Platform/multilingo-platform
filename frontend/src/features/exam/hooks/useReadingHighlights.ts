import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';
import { useHighlightPersistence } from './useHighlightPersistence';
import { applyHighlights } from '../utils/htmlHighlight';
import { buildHighlightNamespace } from '../utils/highlightUtils';
import { prepareReadingDocument, type PreparedReadingDocument } from '../utils/readingHighlightDocument';
import type { ReferenceDoc } from '../components/workspace/ReferencePane';

interface Options {
  ownerId: string | null;
  attemptId: number | null;
  partId: number;
  contextRevision: number;
  enabled: boolean;
  partHtml: string;
  referenceDocs: ReferenceDoc[];
  useReferenceDocs: boolean;
}

export function useReadingHighlights({
  ownerId, attemptId, partId, contextRevision, enabled, partHtml, referenceDocs, useReferenceDocs,
}: Options) {
  const records = useSelector((state: RootState) => state.answers.highlights);
  const preparedPart = useMemo(() => partHtml
    ? prepareReadingDocument(partHtml, { partId, documentId: 'part' })
    : null, [partHtml, partId]);
  const preparedReferences = useMemo(() => referenceDocs.map((doc) => {
    const prepared: PreparedReadingDocument | null = doc.html
      ? prepareReadingDocument(doc.html, { partId, documentId: doc.groupId })
      : null;
    return {
      ...doc,
      html: prepared?.html ?? null,
      contentHash: prepared?.contentHash ?? null,
      text: prepared?.text ?? '',
    };
  }), [referenceDocs, partId]);
  const documents = useMemo(() => {
    if (useReferenceDocs) {
      return preparedReferences.filter((doc) => doc.contentHash).map((doc) => ({
        partId, documentId: doc.groupId, contentHash: doc.contentHash!, text: doc.text,
      }));
    }
    return preparedPart ? [{
      partId, documentId: 'part', contentHash: preparedPart.contentHash, text: preparedPart.text,
    }] : [];
  }, [partId, useReferenceDocs, preparedReferences, preparedPart]);
  const persistence = useHighlightPersistence({
    ownerId, attemptId, contextRevision, enabled: enabled && documents.length > 0, documents,
  });

  const namespaceFor = useCallback((documentId: string, contentHash?: string | null) => {
    const hash = contentHash ?? documents.find((document) => document.documentId === documentId)?.contentHash;
    if (!attemptId || !hash) return null;
    return buildHighlightNamespace({ ownerId: ownerId ?? 'memory-only', attemptId, partId, groupId: documentId, contentHash: hash });
  }, [documents, ownerId, attemptId, partId]);

  const renderedReferences = useMemo(() => preparedReferences.map((doc) => {
    const namespace = namespaceFor(doc.groupId, doc.contentHash);
    const stored = namespace ? records[namespace] : undefined;
    return {
      ...doc,
      namespace,
      html: doc.html && stored?.contentHash === doc.contentHash
        ? applyHighlights(doc.html, stored.items)
        : doc.html,
    };
  }), [preparedReferences, records, namespaceFor]);

  const partNamespace = preparedPart ? namespaceFor('part', preparedPart.contentHash) : null;
  const partRecord = partNamespace ? records[partNamespace] : undefined;
  const renderedPartHtml = preparedPart
    ? partRecord?.contentHash === preparedPart.contentHash
      ? applyHighlights(preparedPart.html, partRecord.items)
      : preparedPart.html
    : '';

  return {
    preparedPart,
    renderedPartHtml,
    renderedReferences,
    documents,
    namespaceFor,
    warning: persistence.warning,
    ready: persistence.ready,
    flush: persistence.flush,
  };
}
