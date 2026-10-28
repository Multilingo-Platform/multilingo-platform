import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceTextDocument,
  buildWorkspaceTextDocuments,
  isValidWorkspaceTextRange,
  verifyWorkspaceTextSelection,
  workspaceTextSourceKey,
} from '../utils/workspaceTextDocuments';
import type { WorkspaceTextSource } from '../types/workspaceText.types';

const CONTENT_HTML =
  '<p>Hello <b>world</b> &amp; friends.<script>alert("secret")</script></p>\n' +
  '<p><em>Second</em> line 前😀</p>';
const GROUP_HTML =
  '<p>Inline <b>bold</b> end</p>\n' +
  '<table><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>';

function workspacePart(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    partTitle: 'Reading Part 1',
    instruction: 'Read the passage.',
    contentHtml: CONTENT_HTML,
    questionGroups: [
      {
        group_id: 'g1',
        instruction: 'Choose the best answer.',
        context_html: GROUP_HTML,
        questions: [
          {
            question_id: 'q1',
            type: 'SINGLE_CHOICE',
            question_text: 'What is <b>literal</b> &amp; safe?',
            options: [
              { id: 'A', text: 'Authored <i>option</i> &amp; text' },
              { id: 'B', text: 'Second option' },
            ],
            correct_answer: 'A',
            explanation: 'private explanation',
            answer: 'private learner answer',
            ai_feedback: 'private feedback',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('workspace text documents', () => {
  it.each(['TRUE_FALSE_NOT_GIVEN', 'YES_NO_NOT_GIVEN'])('RD05-R04 derives %s tokens from type, independently of options and grading fields', (type) => {
    const tokens = type === 'TRUE_FALSE_NOT_GIVEN' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
    for (const options of [null, [], [{ id: 'private', text: 'private grading text' }]]) {
      const docs = buildWorkspaceTextDocuments({ id: 7, questions: [{ question_id: 'q1', type, options,
        correct_answer: 'private answer', explanation: 'private explanation' }] });
      expect(docs.map(doc => [doc.source.kind === 'OPTION_TEXT' ? doc.source.optionId : null, doc.text])).toEqual(tokens.map(token => [token, token]));
      expect(docs.map(doc => doc.text).join(' ')).not.toContain('private');
    }
  });

  it('RD05-R05 catalogs the visible MatchingInformation letters, not authored tooltip labels', () => {
    const docs = buildWorkspaceTextDocuments({ id: 7, questions: [{ question_id: 'q1', type: 'MATCHING_INFORMATION',
      options: [{ id: 'A', text: 'Paragraph alpha' }, { id: 'B', text: 'Paragraph beta' }] }] });
    expect(docs.map(doc => [doc.sourceKey, doc.text])).toEqual([
      ['OPTION_TEXT:2:q1:1:A', 'A'], ['OPTION_TEXT:2:q1:1:B', 'B'],
    ]);
  });

  it('builds only public title, instruction, content, question and authored option sources', () => {
    const documents = buildWorkspaceTextDocuments(workspacePart(), 7);

    expect(documents.map((document) => document.source.kind)).toEqual([
      'PART_TITLE',
      'PART_INSTRUCTION',
      'PART_CONTENT',
      'GROUP_INSTRUCTION',
      'GROUP_CONTENT',
      'QUESTION_TEXT',
      'OPTION_TEXT',
      'OPTION_TEXT',
    ]);
    expect(documents.every((document) => document.partId === 7)).toBe(true);
    expect(documents.map((document) => document.text).join('\n')).not.toContain('private explanation');
    expect(documents.map((document) => document.text).join('\n')).not.toContain('private learner answer');
    expect(documents.map((document) => document.text).join('\n')).not.toContain('private feedback');
    expect(documents.map((document) => document.text).join('\n')).not.toContain('correct_answer');
  });

  it('prepares the literal shared HTML fixture into stable sanitized text and hash', () => {
    const documents = buildWorkspaceTextDocuments(workspacePart(), 7);
    const partContent = documents.find((document) => document.source.kind === 'PART_CONTENT')!;
    const groupContent = documents.find((document) => document.source.kind === 'GROUP_CONTENT')!;

    expect(partContent).toMatchObject({
      format: 'HTML',
      text: 'Hello world & friends.\nSecond line 前😀',
      contentHash: '4zqk5o',
      sourceKey: 'PART_CONTENT',
    });
    expect(partContent.html).toContain('<b>world</b>');
    expect(partContent.html).not.toContain('<script');
    expect(partContent.text).not.toContain('secret');

    expect(groupContent).toMatchObject({
      format: 'HTML',
      text: 'Inline bold end\nCell 1Cell 2',
      contentHash: '1wrnvfl',
      sourceKey: 'GROUP_CONTENT:2:g1',
    });
    expect(groupContent.html).toContain('<table');

    expect(buildWorkspaceTextDocuments(workspacePart(), 7).find(
      (document) => document.source.kind === 'PART_CONTENT'
    )?.contentHash).toBe(partContent.contentHash);
  });

  it('keeps authored plain text literal instead of parsing it as HTML', () => {
    const documents = buildWorkspaceTextDocuments(workspacePart(), 7);
    const question = documents.find((document) => document.source.kind === 'QUESTION_TEXT')!;
    const option = documents.find((document) => document.source.kind === 'OPTION_TEXT')!;

    expect(question).toMatchObject({
      format: 'TEXT',
      html: null,
      text: 'What is <b>literal</b> &amp; safe?',
      contentHash: '1x5j9qy',
      sourceKey: 'QUESTION_TEXT:2:q1',
    });
    expect(option).toMatchObject({
      format: 'TEXT',
      html: null,
      text: 'Authored <i>option</i> &amp; text',
      contentHash: '9qyx1',
      sourceKey: 'OPTION_TEXT:2:q1:1:A',
    });
  });

  it('uses explicit source identity, including group-level option banks, without duplicate questions', () => {
    const part = workspacePart({
      questionGroups: [
        {
          group_id: 'g2',
          options: [{ option_id: 'C', content: 'Group option' }],
          questions: [{ questionId: 'q2', prompt: 'Group prompt', options: undefined }],
        },
      ],
      questions: [
        { question_id: 'q2', question_text: 'Flattened duplicate' },
        { question_id: 'q3', question_text: 'Standalone prompt', options: [{ id: 'D', text: 'Standalone option' }] },
      ],
    });

    const documents = buildWorkspaceTextDocuments(part, 7);
    const questionTexts = documents
      .filter((document) => document.source.kind === 'QUESTION_TEXT')
      .map((document) => document.text);

    expect(questionTexts).toEqual(['Group prompt', 'Standalone prompt']);
    expect(documents.some((document) => document.source.kind === 'OPTION_TEXT'
      && document.source.optionId === 'C')).toBe(true);
    expect(documents.filter((document) => document.source.kind === 'OPTION_TEXT'
      && document.source.optionId === 'D')).toHaveLength(1);

    const optionSource: WorkspaceTextSource = { kind: 'OPTION_TEXT', questionId: 'q2', optionId: 'C' };
    expect(buildWorkspaceTextDocument(part, 7, optionSource)?.sourceKey).toBe(workspaceTextSourceKey(optionSource));
  });

  it('validates UTF-16 ranges and rejects a selection split through a surrogate pair', () => {
    const part = workspacePart({
      questionGroups: [
        {
          group_id: 'g1',
          questions: [{ question_id: 'q1', question_text: 'Hello 😀 world' }],
        },
      ],
    });
    const question = buildWorkspaceTextDocument(part, 7, {
      kind: 'QUESTION_TEXT',
      questionId: 'q1',
    })!;

    expect(isValidWorkspaceTextRange(question, 6, 8)).toBe(true);
    expect(verifyWorkspaceTextSelection(question, 6, 8, '😀')).toBe(true);
    expect(isValidWorkspaceTextRange(question, 6, 7)).toBe(false);
    expect(isValidWorkspaceTextRange(question, 0, 99)).toBe(false);
    expect(verifyWorkspaceTextSelection(question, 0, 5, 'Wrong')).toBe(false);
  });

  it('shares canonical entity decoding and hidden-content rules with the backend', () => {
    const entityPart = workspacePart({
      contentHtml: '<p>one &apos;two&apos; &NoBreak; &NotEqualTilde;</p>',
    });
    const entity = buildWorkspaceTextDocuments(entityPart, 7)
      .find((document) => document.source.kind === 'PART_CONTENT')!;
    expect(entity).toMatchObject({
      text: "one 'two' \u2060 \u2242\u0338",
      contentHash: '12h39ft',
    });
    expect(verifyWorkspaceTextSelection(entity, 5, 8, 'two')).toBe(true);

    const legacyEntityPart = workspacePart({
      contentHtml: '<p>&amp;amp; &#65; &notanentity;</p>',
    });
    const legacyEntity = buildWorkspaceTextDocuments(legacyEntityPart, 7)
      .find((document) => document.source.kind === 'PART_CONTENT')!;
    expect(legacyEntity).toMatchObject({
      text: '&amp; A \u00acanentity;',
      contentHash: '152h2ce',
    });

    const stylePart = workspacePart({
      contentHtml: '<p>before</p><style>.secret {color:red}</style><p>after</p>',
    });
    const style = buildWorkspaceTextDocuments(stylePart, 7)
      .find((document) => document.source.kind === 'PART_CONTENT')!;
    expect(style).toMatchObject({ text: 'beforeafter', contentHash: 'cy95dg' });
    expect(style.text).not.toContain('secret');
    expect(style.html).not.toContain('<style');
    expect(verifyWorkspaceTextSelection(style, 6, 11, 'after')).toBe(true);

    const rawtextPart = workspacePart({
      contentHtml: '<p>before</p><script>const s = "</style>";</script><p>after</p>',
    });
    const rawtext = buildWorkspaceTextDocuments(rawtextPart, 7)
      .find((document) => document.source.kind === 'PART_CONTENT')!;
    expect(rawtext).toMatchObject({ text: 'beforeafter', contentHash: 'cy95dg' });

    const audioPart = workspacePart({ contentHtml: '<p>before</p><audio/>after' });
    const audio = buildWorkspaceTextDocuments(audioPart, 7)
      .find((document) => document.source.kind === 'PART_CONTENT')!;
    expect(audio).toMatchObject({ text: 'before', contentHash: 'fm3l1a' });
    expect(audio.text).not.toContain('after');

    const prePart = workspacePart({ contentHtml: '<pre>\nHello world</pre>' });
    const pre = buildWorkspaceTextDocuments(prePart, 7)
      .find((document) => document.source.kind === 'PART_CONTENT')!;
    expect(pre).toMatchObject({ text: 'Hello world', contentHash: 'os091j' });
    expect(verifyWorkspaceTextSelection(pre, 6, 11, 'world')).toBe(true);

    const scriptDelimiterPart = workspacePart({
      contentHtml: '<p>before</p><script>const x="</scriptx>"; hidden words;</script><p>after</p>',
    });
    const scriptDelimiter = buildWorkspaceTextDocuments(scriptDelimiterPart, 7)
      .find((document) => document.source.kind === 'PART_CONTENT')!;
    expect(scriptDelimiter).toMatchObject({ text: 'beforeafter', contentHash: 'cy95dg' });
    expect(scriptDelimiter.text).not.toContain('hidden words');
    expect(verifyWorkspaceTextSelection(scriptDelimiter, 6, 11, 'after')).toBe(true);

    const svgPart = workspacePart({ contentHtml: '<svg/><p>visible</p>' });
    const svg = buildWorkspaceTextDocuments(svgPart, 7)
      .find((document) => document.source.kind === 'PART_CONTENT')!;
    expect(svg).toMatchObject({ text: 'visible', contentHash: 'nktwgx' });
    expect(verifyWorkspaceTextSelection(svg, 0, 7, 'visible')).toBe(true);

    const lessThanDigitPart = workspacePart({ contentHtml: '<p>2 <3</p>' });
    const lessThanDigit = buildWorkspaceTextDocuments(lessThanDigitPart, 7)
      .find((document) => document.source.kind === 'PART_CONTENT')!;
    expect(lessThanDigit).toMatchObject({ text: '2 <3', contentHash: '16o7b8u' });
    expect(verifyWorkspaceTextSelection(lessThanDigit, 2, 4, '<3')).toBe(true);

    const plaintextPart = workspacePart({
      contentHtml: '<p>before</p><plaintext>hidden</plaintext>public',
    });
    const plaintext = buildWorkspaceTextDocuments(plaintextPart, 7)
      .find((document) => document.source.kind === 'PART_CONTENT')!;
    expect(plaintext).toMatchObject({ text: 'before', contentHash: 'fm3l1a' });
    expect(plaintext.text).not.toContain('public');
    expect(verifyWorkspaceTextSelection(plaintext, 0, 6, 'public')).toBe(false);
  });

  it('does not create a document from a missing or out-of-part source', () => {
    const part = workspacePart();
    expect(buildWorkspaceTextDocument(part, 7, {
      kind: 'QUESTION_TEXT',
      questionId: 'missing',
    })).toBeNull();
    expect(buildWorkspaceTextDocument(part, 7, {
      kind: 'OPTION_TEXT',
      questionId: 'q1',
      optionId: 'Z',
    })).toBeNull();
  });
});
