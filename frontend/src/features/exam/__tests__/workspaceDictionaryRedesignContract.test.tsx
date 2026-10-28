import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axiosClient from '../../../core/api/axiosClient';
import { createTestStore } from '../../../test-utils/renderWithStore';
import WorkspacePage from '../pages/WorkspacePage';
import { PartReviewContent } from '../components/review/PartReviewContent';
import { attemptReviewFixture } from './fixtures/attemptReview';
import { buildWorkspaceTextDocuments } from '../utils/workspaceTextDocuments';
import { buildDictionaryLookupV3Request } from '../utils/dictionarySelection';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const http = vi.mocked(axiosClient);
const rectDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');

beforeEach(() => {
  vi.clearAllMocks(); http.post.mockReset(); localStorage.clear();
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect(30, 60, 80, 20) });
});
afterEach(() => {
  cleanup(); window.getSelection()?.removeAllRanges(); vi.useRealTimers();
  vi.restoreAllMocks();
  if (rectDescriptor) Object.defineProperty(Range.prototype, 'getBoundingClientRect', rectDescriptor);
  else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
});

function pointer(target: Node, type: string, pointerType = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, button: 0 });
  Object.defineProperties(event, { pointerType: { value: pointerType }, pointerId: { value: 1 }, isPrimary: { value: true } });
  fireEvent(target, event);
}
function select(node: Node, start: number, end: number) {
  const range = document.createRange(); range.setStart(node, start); range.setEnd(node, end);
  const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  fireEvent(document, new Event('selectionchange'));
}
async function open(mode: 'PRACTICE' | 'MOCK_TEST', shape: 'group' | 'part' = 'group', skill = 'READING', questionOverrides: Record<string, unknown> = {}, partOverrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  const groups = [{ group_id: 'g1', ...(shape === 'group' ? { content_html: '<p>Before <b>chosen words</b> after.</p>' } : {}),
    questions: [{ question_id: 'q1', type: skill === 'WRITING' ? 'ESSAY' : 'SINGLE_CHOICE', question_text: 'Choose.', options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }], ...questionOverrides }] }];
  http.get.mockResolvedValue({ success: true, data: {
    attempt_id: 42, status: 'IN_PROGRESS', test_scope: 'FULL_EXAM', test_mode: mode,
    startTime: now, serverTime: now, deadline: mode === 'MOCK_TEST' ? new Date(Date.now() + 3600000).toISOString() : null,
    gracePeriodSeconds: 15, lockedSections: [], version: 7, saved_answers: [],
    dictionaryLanguage: { policyVersion: 'NATIVE_PROFILE_V1', available: true, nativeLanguage: 'vi' },
    languageContext: { policyVersion: 'TV3_LANG_V1', examLanguage: 'en', defaultExplanationLanguage: 'vi', supportedExplanationLanguages: ['en', 'vi'] },
    exam_snapshot: { exam_id: 1, code: 'READING', title: 'Reading', type: shape === 'group' && skill !== 'WRITING' ? 'TOEIC_LR' : 'IELTS_ACADEMIC', examLanguage: 'en', sections: [{
      id: 2, name: skill, durationMinutes: 60, parts: [{ id: 7, partNumber: 7, title: 'Reading passage',
        ...(shape === 'part' ? { content_html: '<p>Before <b>chosen words</b> after.</p>' } : {}), questionGroups: groups, ...partOverrides }],
    }] },
  } } as never);
  const store = createTestStore({ auth: { user: { id: '21' }, token: 'test-token', isAuthenticated: true } });
  const page = render(<Provider store={store}><MemoryRouter initialEntries={['/attempts/42']}>
    <Routes>
      <Route path="/attempts/:attemptId" element={<WorkspacePage />} />
      <Route path="/attempts/:attemptId/result" element={<p>Confirmed result</p>} />
    </Routes>
  </MemoryRouter></Provider>);
  if (partOverrides.instruction) await waitFor(() => expect(page.container.querySelector('[data-source-kind="PART_INSTRUCTION"]')).not.toBeNull());
  else await screen.findAllByText(/^Choose\./);
  const scope = page.container.querySelector('[data-highlight-scope]')! as HTMLElement;
  return { page, store, scope };
}

describe('RD09 workspace Dictionary lifecycle with HTTP boundaries faked', () => {
  it.each(['PRACTICE','MOCK_TEST'] as const)('R2-F03 aligns Part instruction DOM selection with catalog in %s', async mode => {
    const authored = 'First line\r\nchosen words <b>literal</b>';
    const {page,store}=await open(mode,'group','READING',{}, {instruction:authored});
    const instruction=page.container.querySelector('[data-source-kind="PART_INSTRUCTION"]')!;
    expect(instruction.textContent).toBe('First line\nchosen words <b>literal</b>');
    const before=store.getState().answers;
    pointer(instruction.firstChild!,'pointerdown');
    select(instruction.firstChild!,11,17);
    pointer(instruction.firstChild!,'pointerup');
    expect(instruction.querySelector('mark')?.textContent).toBe('chosen');
    const instructionDoc=buildWorkspaceTextDocuments({instruction:authored},7).find(doc=>doc.source.kind==='PART_INSTRUCTION')!;
    expect(instruction).toHaveAttribute('data-highlight-hash',instructionDoc.contentHash);
    if(mode==='PRACTICE') {
      const lookup=buildDictionaryLookupV3Request({rect:new DOMRect(),text:'chosen',start:11,end:17,
        documentId:instructionDoc.sourceKey,contentHash:instructionDoc.contentHash,scopeText:instructionDoc.text,contextKey:'ctx',contextRevision:1},7,'en',[instructionDoc]);
      expect(lookup.source).toEqual({kind:'PART_INSTRUCTION'});
      expect(lookup.contextText).toBe('First line chosen words <b>literal</b>');
    }
    fireEvent.click(instruction.querySelector('mark')!,{detail:1});
    expect(store.getState().answers).toMatchObject({answers:before.answers,pendingVersion:before.pendingVersion,isDirty:false,version:before.version});
    expect(http.put).not.toHaveBeenCalled();
    if(mode==='MOCK_TEST') { expect(http.post).not.toHaveBeenCalled(); expect(http.get.mock.calls.some(([url])=>String(url).includes('/vocab/'))).toBe(false); }
  });
  it.each(['PRACTICE','MOCK_TEST'] as const)('R2-F02 annotates authored Part metadata and restores it in %s', async mode => {
    for (const [skill, partNumber, kind] of [['READING',5,'PART_INSTRUCTION'], ['LISTENING',1,'PART_INSTRUCTION'], ['READING',7,'PART_TITLE']] as const) {
      localStorage.clear();
      const overrides = { partNumber, title: 'Authored title', instruction: 'Authored instruction' };
      const { page, store } = await open(mode, 'group', skill, {}, overrides);
      const scope = page.container.querySelector(`[data-source-kind="${kind}"]`)!;
      expect(scope, `${skill} ${kind}`).not.toBeNull();
      const before = store.getState().answers;
      const text = scope.firstChild!;
      pointer(text,'pointerdown'); select(text,0,8); pointer(text,'pointerup');
      expect(scope.querySelector('mark')).toHaveTextContent('Authored');
      fireEvent.click(screen.getByRole('button',{name:'Hồng'}));
      expect(scope.querySelector('mark')).toHaveAttribute('data-hl-color','pink');
      expect(store.getState().answers).toMatchObject({answers:before.answers,pendingVersion:before.pendingVersion,isDirty:false,version:before.version});
      expect(http.put).not.toHaveBeenCalled();
      expect(http.post).not.toHaveBeenCalled();
      if (mode === 'MOCK_TEST') {
        expect(screen.queryByRole('button',{name:'Tra từ AI'})).toBeNull();
        expect(http.get.mock.calls.some(([url]) => String(url).includes('/vocab/'))).toBe(false);
      }
      page.unmount();
      const reloaded = await open(mode, 'group', skill, {}, overrides);
      expect(reloaded.page.container.querySelector(`[data-source-kind="${kind}"] mark[data-hl-color="pink"]`)).toHaveTextContent('Authored');
      reloaded.page.unmount();
      const review = render(<PartReviewContent ownerId="21" reviewData={{...attemptReviewFixture(42,7),
        partTitle:overrides.title,examData:{title:overrides.title,instruction:overrides.instruction}} as any} />);
      expect(review.container.querySelector(`[data-review-source="${kind}"] mark[data-hl-color="pink"]`)).toHaveTextContent('Authored');
      review.unmount();
    }
  });
  it.each(['PRACTICE','MOCK_TEST'] as const)('selects an option, recolors and preserves answers in %s', async mode => {
    const {page,store}=await open(mode);
    const scope=page.container.querySelector('[data-source-kind="OPTION_TEXT"]')!;
    const text=scope.firstChild!;
    const before=store.getState().answers;
    pointer(text,'pointerdown'); select(text,0,6); pointer(text,'pointerup');
    const mark=scope.querySelector('mark')!;
    expect(mark.textContent).toBe('Option');
    fireEvent.click(mark,{detail:1});
    fireEvent.click(screen.getByRole('button',{name:'Xanh lá'}));
    expect(scope.querySelector('mark')).toHaveAttribute('data-hl-color','green');
    expect(store.getState().answers).toMatchObject({answers:before.answers,pendingVersion:before.pendingVersion,isDirty:false,version:before.version});
    if(mode==='MOCK_TEST') {
      expect(screen.queryByRole('button',{name:'Tra từ AI'})).toBeNull();
      expect(http.post).not.toHaveBeenCalled();
      expect(http.get.mock.calls.some(([url]) => String(url).includes('/vocab/'))).toBe(false);
    } else {
      http.get.mockResolvedValue({success:true,data:[{id:3,userId:21,name:'Native deck',targetLanguage:'en',sourceLanguage:'vi',isPublic:false}]} as never);
      http.post.mockImplementation(async(url,body:any)=> {
        if(String(url).includes('dictionary-lookups')) return {success:true,data:{requestId:body.requestId,attemptId:42,partId:7,source:body.source,selectedText:body.selectedText,sourceContext:body.contextText,policyVersion:'NATIVE_PROFILE_V1',definition:{schemaVersion:2,learningLanguage:'en',meaningLanguage:'vi',meaning:'nghĩa',phonetic:null,partOfSpeech:null,example:'Option A',exampleTranslation:'Lựa chọn A'}}} as never;
        return {success:true,data:{id:12,deckId:3,customWord:'Option',customMeaning:'nghĩa',exampleSentence:'Option A'}} as never;
      });
      fireEvent.click(screen.getByRole('button',{name:'Tra từ AI'}));
      await screen.findByRole('option',{name:'Native deck'});
      fireEvent.click(screen.getByRole('button',{name:/Lưu Flashcard/i}));
      await screen.findByText('Đã lưu vào bộ thẻ.');
      expect(http.post.mock.calls[0][1]).toMatchObject({source:{kind:'OPTION_TEXT',questionId:'q1',optionId:'A'}});
      expect(http.post.mock.calls.map(c=>c[0])).toEqual(['/v3/attempts/42/dictionary-lookups','/v1/vocab/decks/3/cards']);
    }
    expect(http.put).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    fireEvent.click(screen.getByRole('radio',{name:/Option B/}),{detail:0});
    expect(store.getState().answers.answers[7].q1).toBe('B');
  });
});
