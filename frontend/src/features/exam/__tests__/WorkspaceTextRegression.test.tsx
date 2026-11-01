import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WorkspaceText from '../components/content/WorkspaceText';
import QuestionCard from '../components/workspace/QuestionCard';
import type { Question } from '../types/exam.types';
import { buildWorkspaceTextDocuments, workspaceTextHash } from '../utils/workspaceTextDocuments';

afterEach(cleanup);

describe('RD05 canonical plain-text line endings', () => {
  it.each(['\r\n', '\r'] as const)('renders authored text with canonical %j offsets without parsing markup', (lineEnding) => {
    const content = `First line${lineEnding}chosen words <b>literal</b>`;
    const view = render(<WorkspaceText source={{kind:'PART_INSTRUCTION'}} content={content} />);
    const scope = view.container.firstElementChild!;
    expect(scope.textContent).toBe('First line\nchosen words <b>literal</b>');
    expect(scope.getAttribute('data-highlight-hash')).toBe(workspaceTextHash('First line\nchosen words <b>literal</b>'));
    expect(scope.querySelector('b')).toBeNull();
  });
});

describe('RD05-R01 HTML trust boundary', () => {
  it.each(['plain', 'highlighted', 'pre-marked'] as const)('sanitizes %s authored HTML and preserves stable generated marks', (variant) => {
    const raw = '<p>safe</p><script>alert(1)</script><img src="bad" onerror="alert(1)"><a href="javascript:alert(1)">link</a>';
    const content = variant === 'pre-marked' ? raw.replace('safe', '<mark data-hl-id="untrusted" onclick="alert(1)">safe</mark>') : raw;
    const highlights = variant === 'plain' ? [] : [{ id: 'stored-id', start: 0, end: 4, text: 'safe', color: 'green' as const }];
    const props = { source: { kind: 'PART_CONTENT' as const }, format: 'HTML' as const, content, highlights };
    const view = render(<WorkspaceText {...props} />);
    const scope = view.container.firstElementChild!;
    expect(scope.querySelector('script, [onerror], [onclick], [href^="javascript:"]')).toBeNull();
    expect(scope.textContent).toBe('safelink');
    expect(scope.getAttribute('data-highlight-hash')).toBe(workspaceTextHash('safelink'));
    expect(scope.querySelector('[data-hl-id="untrusted"]')).toBeNull();
    const mark = scope.querySelector('mark');
    if (variant !== 'plain') {
      expect(mark?.getAttribute('data-hl-id')).toBe('stored-id');
      expect(mark?.textContent).toBe('safe');
      view.rerender(<WorkspaceText {...props} />);
      expect(scope.querySelector('mark')).toBe(mark);
    }
  });
});

describe('RD05-R03 parent renderer source identity', () => {
  it.each(['MULTIPLE_CHOICE', 'TRUE_FALSE_NOT_GIVEN', 'MATCHING_HEADINGS', 'MATCHING_INFORMATION', 'FILL_IN_THE_BLANK', 'ESSAY'] as const)('%s keeps two question identities aligned with the document catalog', (type) => {
    const options = type === 'TRUE_FALSE_NOT_GIVEN'
      ? ['TRUE', 'FALSE', 'NOT GIVEN'].map(id => ({ id, text: id }))
      : [{ id: 'A', text: 'Identical option' }];
    const questions = ['q1', 'q2'].map(question_id => ({ question_id, type, question_text: 'Identical prompt', options, media: null } as Question));
    const view = render(<>{questions.map(question => <QuestionCard key={question.question_id} question={question} partId={7}
      questionNumber={null} value={null} flagged={false} disabled={false} onAnswer={vi.fn()} onToggleFlag={vi.fn()} />)}</>);
    const catalog = buildWorkspaceTextDocuments({ id: 7, questions });
    const keys = new Set(catalog.map(doc => doc.sourceKey));
    for (const node of view.container.querySelectorAll('[data-highlight-scope]')) {
      expect(keys.has(node.getAttribute('data-highlight-scope')!)).toBe(true);
    }
    for (const id of ['q1', 'q2']) {
      const card = view.container.querySelector(`[data-question-id="${id}"]`)!;
      const scopes = Array.from(card.querySelectorAll('[data-highlight-scope]'), node => node.getAttribute('data-highlight-scope')!);
      expect(scopes.every(scope => scope.includes(`2:${id}`))).toBe(true);
      if (['MULTIPLE_CHOICE', 'TRUE_FALSE_NOT_GIVEN', 'MATCHING_HEADINGS', 'MATCHING_INFORMATION'].includes(type)) {
        expect(scopes.some(scope => scope.startsWith('OPTION_TEXT:'))).toBe(true);
      }
    }
  });
});
