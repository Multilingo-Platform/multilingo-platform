import DOMPurify from 'dompurify';
import type {
  WorkspaceTextDocument,
  WorkspaceTextFormat,
  WorkspaceTextSource,
} from '../types/workspaceText.types';

const CONTENT_MEDIA_TAGS = ['audio', 'video', 'iframe', 'object', 'embed', 'source', 'track'];
/**
 * Non-display elements removed whole before canonical text is derived. This is the shared
 * canonical-text contract with the backend reader (`WorkspaceTextSourceReader`): both sides
 * parse raw HTML, drop these subtrees, keep every remaining text node in document order, decode
 * HTML5 character references the way a browser does and normalize line endings.
 */
const NON_DISPLAY_TAGS = [
  ...CONTENT_MEDIA_TAGS,
  'script',
  'style',
  'noscript',
  'svg',
  'math',
  'head',
  'title',
  'template',
  'noembed',
  'noframes',
  'plaintext',
  'xmp',
];
const NON_DISPLAY_SELECTOR = NON_DISPLAY_TAGS.join(',');

/** FNV-1a over UTF-16 code units; matches the backend content hash exactly. */
export function workspaceTextHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Plain authored text is never parsed as markup. Only line endings are made portable. */
export function normalizeWorkspacePlainText(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

export interface PreparedWorkspaceHtml {
  html: string;
  text: string;
}

/** Sanitizes HTML once and derives both the rendered markup and its exact text-node content. */
export function prepareWorkspaceHtml(rawHtml: string): PreparedWorkspaceHtml {
  const clean = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ['autoplay'],
    FORBID_TAGS: NON_DISPLAY_TAGS,
    FORBID_CONTENTS: NON_DISPLAY_TAGS,
  });
  const rendered = new DOMParser().parseFromString(clean, 'text/html');
  unwrapHighlightMarks(rendered);

  // Canonical text follows the raw snapshot markup so it never depends on DOMPurify's
  // version-specific allowlists; the backend reader applies the same explicit rules.
  const canonical = new DOMParser().parseFromString(rawHtml, 'text/html');
  canonical.querySelectorAll(NON_DISPLAY_SELECTOR).forEach((node) => node.remove());
  unwrapHighlightMarks(canonical);

  return {
    html: rendered.body.innerHTML,
    text: normalizeWorkspacePlainText(canonical.body.textContent ?? ''),
  };
}

function unwrapHighlightMarks(doc: Document) {
  doc.querySelectorAll('mark[data-hl-id]').forEach((mark) => {
    mark.replaceWith(...Array.from(mark.childNodes));
  });
}

/** Length-prefixed identity avoids collisions between ids that contain separators. */
export function workspaceTextSourceKey(source: WorkspaceTextSource): string {
  const keyPart = (value: string | undefined | null) =>
    value == null ? '0' : `${value.length}:${value}`;
  switch (source.kind) {
    case 'GROUP_INSTRUCTION':
    case 'GROUP_CONTENT':
      return `${source.kind}:${keyPart(source.groupId)}`;
    case 'QUESTION_TEXT':
      return `${source.kind}:${keyPart(source.questionId)}`;
    case 'OPTION_TEXT':
      return `${source.kind}:${keyPart(source.questionId)}:${keyPart(source.optionId)}`;
    default:
      return source.kind;
  }
}

/**
 * Builds one document per authored source in the part. Content HTML is sanitized; title,
 * instruction, question prompt and option text remain literal text. Answers, explanations,
 * feedback and other non-authored fields are never read.
 */
export function buildWorkspaceTextDocuments(
  part: unknown,
  explicitPartId?: number,
): WorkspaceTextDocument[] {
  if (!isRecord(part)) throw new Error('Workspace part is invalid');
  const partId = resolvePartId(part, explicitPartId);
  const documents: WorkspaceTextDocument[] = [];
  const add = (source: WorkspaceTextSource, raw: string, format: WorkspaceTextFormat) => {
    if (!raw || !raw.trim()) return;
    if (format === 'TEXT') {
      const text = normalizeWorkspacePlainText(raw);
      if (!text.trim()) return;
      documents.push({
        partId,
        source,
        sourceKey: workspaceTextSourceKey(source),
        format,
        html: null,
        text,
        contentHash: workspaceTextHash(text),
      });
      return;
    }
    const prepared = prepareWorkspaceHtml(raw);
    if (!prepared.text.trim()) return;
    documents.push({
      partId,
      source,
      sourceKey: workspaceTextSourceKey(source),
      format,
      html: prepared.html,
      text: prepared.text,
      contentHash: workspaceTextHash(prepared.text),
    });
  };

  const partTitle = firstText(part, ['part_title', 'partTitle', 'title', 'content.part_title', 'content.partTitle']);
  if (partTitle) add({ kind: 'PART_TITLE' }, partTitle, 'TEXT');
  const partInstruction = firstText(part, ['instruction', 'content.instruction']);
  if (partInstruction) add({ kind: 'PART_INSTRUCTION' }, partInstruction, 'TEXT');
  const partContent = firstText(part, [
    'content_html',
    'contentHtml',
    'content.shared_content_html',
    'content.content_html',
    'content.contentHtml',
  ]);
  if (partContent) add({ kind: 'PART_CONTENT' }, partContent, 'HTML');

  const groups = firstArray(part, ['question_groups', 'questionGroups', 'content.question_groups', 'content.questionGroups']);
  const seenQuestions = new Set<string>();
  for (const group of groups) {
    if (!isRecord(group)) continue;
    const groupId = asId(group.group_id ?? group.groupId);
    if (groupId && isValidWorkspaceTextId(groupId)) {
      const groupInstruction = firstText(group, ['instruction', 'content.instruction']);
      if (groupInstruction) {
        add({ kind: 'GROUP_INSTRUCTION', groupId }, groupInstruction, 'TEXT');
      }
      const groupContent = firstText(group, [
        'context_html',
        'content_html',
        'contextHtml',
        'contentHtml',
        'content.context_html',
        'content.contentHtml',
      ]);
      if (groupContent) add({ kind: 'GROUP_CONTENT', groupId }, groupContent, 'HTML');
    }
    const groupOptions = firstArray(group, ['options', 'content.options']);
    for (const question of firstArray(group, ['questions', 'content.questions'])) {
      addQuestion(question, groupOptions, seenQuestions, add);
    }
  }

  const partQuestions = firstArray(part, ['questions', 'content.questions']);
  for (const question of partQuestions) {
    addQuestion(question, null, seenQuestions, add);
  }
  return documents;
}

export function buildWorkspaceTextDocument(
  part: unknown,
  partId: number,
  source: WorkspaceTextSource,
): WorkspaceTextDocument | null {
  const sourceKey = workspaceTextSourceKey(source);
  return buildWorkspaceTextDocuments(part, partId)
    .find((document) => document.sourceKey === sourceKey) ?? null;
}

/** UTF-16 range validation; a range may never start or end inside a surrogate pair. */
export function isValidWorkspaceTextRange(
  document: WorkspaceTextDocument,
  start: number,
  end: number,
): boolean {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
  if (start < 0 || end <= start || end > document.text.length) return false;
  return !splitsSurrogate(document.text, start) && !splitsSurrogate(document.text, end);
}

export function verifyWorkspaceTextSelection(
  document: WorkspaceTextDocument,
  start: number,
  end: number,
  selectedText: string,
): boolean {
  return Boolean(
    selectedText &&
    isValidWorkspaceTextRange(document, start, end) &&
    document.text.slice(start, end) === selectedText,
  );
}

function splitsSurrogate(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return false;
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

/** Public answer-control tokens are determined by type, never by grading keys/options. */
export function canonicalQuestionOptionTokens(type: unknown): string[] | null {
  if (type === 'TRUE_FALSE_NOT_GIVEN') return ['TRUE', 'FALSE', 'NOT GIVEN'];
  if (type === 'YES_NO_NOT_GIVEN') return ['YES', 'NO', 'NOT GIVEN'];
  return null;
}

/** The letters already displayed by MatchingInformation, with their snapshot source identity. */
export function matchingInformationChoices(options: unknown): { optionId: string; letter: string; label: string | null }[] {
  const hasOptions = Array.isArray(options) && options.length > 0;
  const values = hasOptions ? options : ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  return values.map((option, index) => {
    const fallback = String.fromCharCode(65 + index);
    if (typeof option === 'string') {
      const label = option.trim();
      const match = label.match(/^[A-Z]$/i) || label.match(/^(?:Section|Paragraph|Đoạn)\s*([A-Z])/i);
      const letter = match ? (match[1] || match[0]).toUpperCase() : fallback;
      return { optionId: letter, letter, label: hasOptions ? label || null : null };
    }
    const optionId = isRecord(option) ? asId(option.id ?? option.option_id ?? option.optionId) || fallback : fallback;
    return { optionId, letter: optionId.trim().toUpperCase(), label: firstText(option, ['text', 'content', 'option_text', 'optionText']) };
  });
}

function addQuestion(
  value: unknown,
  groupOptions: unknown[] | null,
  seenQuestions: Set<string>,
  add: (source: WorkspaceTextSource, raw: string, format: WorkspaceTextFormat) => void,
) {
  if (!isRecord(value)) return;
  const questionId = asId(value.question_id ?? value.questionId);
  if (!questionId || !isValidWorkspaceTextId(questionId) || seenQuestions.has(questionId)) return;
  seenQuestions.add(questionId);

  const prompt = firstText(value, ['question_text', 'questionText', 'prompt', 'content.question_text', 'content.prompt']);
  if (prompt) add({ kind: 'QUESTION_TEXT', questionId }, prompt, 'TEXT');

  const canonicalTokens = canonicalQuestionOptionTokens(value.type);
  if (canonicalTokens) {
    for (const token of canonicalTokens) add({ kind: 'OPTION_TEXT', questionId, optionId: token }, token, 'TEXT');
    return;
  }

  const ownOptions = firstArray(value, ['options', 'content.options']);
  const options = ownOptions.length > 0 ? ownOptions : (groupOptions ?? []);
  if (value.type === 'MATCHING_INFORMATION') {
    // WorkspacePage assigns positional ids to string options before rendering controls.
    const renderedOptions = options.map((option, index) => typeof option === 'string'
      ? { id: String.fromCharCode(65 + index), text: option } : option);
    for (const choice of matchingInformationChoices(renderedOptions)) {
      if (isValidWorkspaceTextId(choice.optionId)) {
        add({ kind: 'OPTION_TEXT', questionId, optionId: choice.optionId }, choice.letter, 'TEXT');
      }
    }
    return;
  }
  const seenOptions = new Set<string>();
  for (const option of options) {
    if (!isRecord(option)) continue;
    const optionId = asId(option.id ?? option.option_id ?? option.optionId);
    if (!optionId || !isValidWorkspaceTextId(optionId) || seenOptions.has(optionId)) continue;
    seenOptions.add(optionId);
    const optionText = firstText(option, ['text', 'content', 'option_text', 'optionText']);
    if (!optionText) continue;
    add({ kind: 'OPTION_TEXT', questionId, optionId }, optionText, 'TEXT');
  }
}

function resolvePartId(part: Record<string, unknown>, explicitPartId?: number): number {
  const candidate = explicitPartId ?? part.id ?? part.part_id ?? part.partId;
  const parsed = typeof candidate === 'number' ? candidate : Number(candidate);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('Workspace part id is invalid');
  return parsed;
}

function isValidWorkspaceTextId(value: string): boolean {
  return value.trim().length > 0 && value === value.trim() && value.length <= 128
    && !hasControlCharacter(value);
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

function asId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  return null;
}

function firstArray(node: unknown, paths: string[]): unknown[] {
  for (const path of paths) {
    const value = valueAt(node, path);
    if (Array.isArray(value)) return value;
  }
  return [];
}

function firstText(node: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const value = valueAt(node, path);
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

function valueAt(node: unknown, path: string): unknown {
  let current = node;
  for (const segment of path.split('.')) {
    if (!isRecord(current)) return null;
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
