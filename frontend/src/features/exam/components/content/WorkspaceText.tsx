import React, { useMemo } from 'react';
import type { WorkspaceTextFormat, WorkspaceTextSource } from '../../types/workspaceText.types';
import {
  normalizeWorkspacePlainText,
  prepareWorkspaceHtml,
  workspaceTextHash,
  workspaceTextSourceKey,
} from '../../utils/workspaceTextDocuments';
import { useWorkspaceAnnotationContext } from '../../hooks/useWorkspaceAnnotations';
import { applyHighlights } from '../../utils/htmlHighlight';
import type { Highlight } from '../../utils/highlightUtils';

export interface WorkspaceTextProps {
  source: WorkspaceTextSource;
  format?: WorkspaceTextFormat;
  content: string;
  contentHash?: string | null;
  documentId?: string;
  highlights?: Highlight[];
  lang?: string | null;
  className?: string;
  as?: React.ElementType;
  testId?: string;
}

export const WorkspaceText: React.FC<WorkspaceTextProps> = ({
  source,
  format = 'TEXT',
  content,
  contentHash,
  documentId,
  highlights,
  lang,
  className,
  as,
  testId,
}) => {
  const context = useWorkspaceAnnotationContext();
  const effectiveLang = lang ?? context?.learningLanguage ?? undefined;
  const sourceKey = useMemo(() => workspaceTextSourceKey(source), [source]);
  const scopeId = documentId ?? sourceKey;

  const Tag = as ?? (format === 'HTML' ? 'div' : 'span');
  const prepared = useMemo(() => {
    if (format === 'HTML') return prepareWorkspaceHtml(content || '');
    const text = normalizeWorkspacePlainText(content || '');
    return { text, html: text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') };
  }, [content, format]);
  const hash = contentHash ?? workspaceTextHash(prepared.text);
  const activeHighlights = highlights ?? context?.getHighlights(source, hash) ?? [];
  const highlightedHtml = activeHighlights.length > 0 ? applyHighlights(prepared.html, activeHighlights) : prepared.html;
  const innerHtml = useMemo(() => ({ __html: highlightedHtml }), [highlightedHtml]);

  if (format === 'HTML' || activeHighlights.length > 0) {
    return (
      <Tag
        data-highlight-scope={scopeId}
        data-highlight-hash={hash}
        data-source-kind={source.kind}
        lang={effectiveLang}
        className={className}
        data-testid={testId ?? `workspace-text-${scopeId}`}
        dangerouslySetInnerHTML={innerHtml}
      />
    );
  }

  return (
    <Tag
      data-highlight-scope={scopeId}
      data-highlight-hash={hash}
      data-source-kind={source.kind}
      lang={effectiveLang}
      className={className}
      data-testid={testId ?? `workspace-text-${scopeId}`}
    >
      {prepared.text}
    </Tag>
  );
};

export default WorkspaceText;
