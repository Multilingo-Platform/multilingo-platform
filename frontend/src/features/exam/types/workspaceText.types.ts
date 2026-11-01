/** Stable identity of one authored, selectable workspace text source. */
export type WorkspaceTextKind =
  | 'PART_TITLE'
  | 'PART_INSTRUCTION'
  | 'PART_CONTENT'
  | 'GROUP_INSTRUCTION'
  | 'GROUP_CONTENT'
  | 'QUESTION_TEXT'
  | 'OPTION_TEXT';

export type WorkspaceTextSource =
  | { kind: 'PART_TITLE' | 'PART_INSTRUCTION' | 'PART_CONTENT' }
  | { kind: 'GROUP_INSTRUCTION' | 'GROUP_CONTENT'; groupId: string }
  | { kind: 'QUESTION_TEXT'; questionId: string }
  | { kind: 'OPTION_TEXT'; questionId: string; optionId: string };

export type WorkspaceTextFormat = 'TEXT' | 'HTML';

/**
 * One text document in the workspace source catalog. `TEXT` documents must be rendered as text
 * nodes; only `HTML` documents carry sanitized markup. `contentHash` is derived from `text`, so a
 * changed source can never silently reuse old ranges.
 */
export interface WorkspaceTextDocument {
  partId: number;
  source: WorkspaceTextSource;
  sourceKey: string;
  format: WorkspaceTextFormat;
  html: string | null;
  text: string;
  contentHash: string;
}
