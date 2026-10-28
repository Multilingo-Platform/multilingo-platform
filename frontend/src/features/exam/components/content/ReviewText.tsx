import { createContext, useContext } from 'react';
import type { WorkspaceTextDocument, WorkspaceTextSource } from '../../types/workspaceText.types';
import type { HighlightArchive } from '../../utils/highlightStorage';
import { findArchivedHighlights } from '../../utils/highlightStorage';
import { normalizeWorkspacePlainText, prepareWorkspaceHtml, workspaceTextHash, workspaceTextSourceKey } from '../../utils/workspaceTextDocuments';
import { applyHighlights } from '../../utils/htmlHighlight';
import { prepareReadingDocument } from '../../utils/readingHighlightDocument';
import type { ReactNode } from 'react';

const ReviewAnnotationsContext = createContext<{ partId: number; documents: WorkspaceTextDocument[]; archive: HighlightArchive | null } | null>(null);
export function ReviewAnnotationsProvider({ children, ...value }: { partId: number; documents: WorkspaceTextDocument[]; archive: HighlightArchive | null; children: ReactNode }) {
  return <ReviewAnnotationsContext.Provider value={value}>{children}</ReviewAnnotationsContext.Provider>;
}

/** Static review projection: no selection scope, listeners, persistence writer or focus target. */
export function ReviewText({ source, content, html = false, className, testId }: {
  source: WorkspaceTextSource; content: string; html?: boolean; className?: string; testId?: string;
}) {
  const context = useContext(ReviewAnnotationsContext);
  const prepared = html ? prepareWorkspaceHtml(content) : { text: normalizeWorkspacePlainText(content), html: '' };
  const sourceKey = workspaceTextSourceKey(source);
  const hash = workspaceTextHash(prepared.text);
  const document = context?.documents.find(doc => doc.sourceKey === sourceKey && doc.contentHash === hash && doc.text === prepared.text);
  const legacyId = source.kind === 'PART_CONTENT' ? 'part' : source.kind === 'GROUP_CONTENT' ? source.groupId : null;
  const archiveId = context?.archive?.documents.some(doc => doc.partId === context.partId && doc.documentId === sourceKey) ? sourceKey : legacyId ?? sourceKey;
  let highlights = document && context ? findArchivedHighlights(context.archive, context.partId, archiveId, hash, prepared.text) : [];
  let markup = html ? prepared.html : prepared.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (document && context && html && legacyId && archiveId === legacyId) {
    const legacy = prepareReadingDocument(content, { partId: context.partId, documentId: legacyId });
    const saved = findArchivedHighlights(context.archive, context.partId, legacyId, legacy.contentHash, legacy.text);
    if (saved.length) { markup = legacy.html; highlights = saved; }
  }
  const Tag = html ? 'div' : 'span';
  return <Tag className={className} data-testid={testId} data-review-source={sourceKey}
    dangerouslySetInnerHTML={{ __html: applyHighlights(markup, highlights) }} />;
}
