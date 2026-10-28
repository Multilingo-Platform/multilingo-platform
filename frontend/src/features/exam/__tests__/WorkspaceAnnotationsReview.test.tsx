import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axiosClient from '../../../core/api/axiosClient';
import { createTestStore } from '../../../test-utils/renderWithStore';
import ExamReviewPage from '../pages/ExamReviewPage';
import { multiPartAttemptResultFixture, resultEnvelope } from './fixtures/attemptResult';
import { reviewEnvelope } from './fixtures/attemptReview';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PartReviewContent } from '../components/review/PartReviewContent';
import { attemptReviewFixture } from './fixtures/attemptReview';
import { buildWorkspaceTextDocuments } from '../utils/workspaceTextDocuments';
import { highlightArchiveKeyV1, highlightArchiveKeyV2 } from '../utils/highlightStorage';

const fixture = () => ({ ...attemptReviewFixture(), skill: 'WRITING', examData: { title: 'Review title', instruction: 'Part instruction', contentHtml: '<p>Part content</p>' } });
vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn() } }));
function seed(owner = '21', attempt = 42) {
  const review = fixture();
  const docs = buildWorkspaceTextDocuments({ title: review.partTitle, instruction: review.examData.instruction, content_html: review.examData.contentHtml,
    questionGroups: review.questionGroups.map(g => ({ ...g, questions: review.questions })), questions: review.questions }, 10);
  localStorage.setItem(highlightArchiveKeyV2(owner, attempt), JSON.stringify({ schemaVersion: 2, ownerId: owner, attemptId: attempt, updatedAt: new Date().toISOString(), documents: docs.map((doc, i) => ({ partId: 10, documentId: doc.sourceKey, contentHash: doc.contentHash, items: [{ id: `rd08-${doc.sourceKey}`, start: 0, end: Math.min(4, doc.text.length), text: 'ignored', color: ['green','purple','blue','pink','yellow'][i % 5] }] })) }));
  return review;
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('RD08 read-only source annotations', () => {
  it('loads submitted review through the page and clears annotations on permission failure', async () => {
    const review = seed();
    vi.mocked(axiosClient.get).mockImplementation(async (url) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(multiPartAttemptResultFixture(42)) as never;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(review) as never;
      throw { response: { status: 403, data: { code: 403, message: 'Forbidden' } } };
    });
    const store = createTestStore({ auth: { user: { id: '21' }, token: 'test-token', isAuthenticated: true } });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const view = render(<Provider store={store}><MemoryRouter initialEntries={['/attempts/42/review?partId=10']}><Routes><Route path="/attempts/:attemptId/review" element={<ExamReviewPage />} /></Routes></MemoryRouter></Provider>);
    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/ });
    await waitFor(() => expect(view.container.querySelector('mark')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Phần nghe tiếng Việt' }));
    await screen.findByRole('alert');
    expect(view.container.querySelector('mark')).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
  it('restores v2 colors on title, instruction, content, question and options without writes or tools', () => {
    const review = seed();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const view = render(<PartReviewContent reviewData={review as any} ownerId="21" />);
    for (const key of ['PART_TITLE','PART_INSTRUCTION','PART_CONTENT','GROUP_INSTRUCTION:2:g1','GROUP_CONTENT:2:g1','QUESTION_TEXT:2:q1','OPTION_TEXT:2:q1:1:A']) {
      expect(view.container.querySelector(`mark[data-hl-id="rd08-${key}"]`), key).not.toBeNull();
    }
    expect(view.container.querySelector('mark[data-hl-color="green"]')).not.toBeNull();
    for (const color of ['yellow','green','blue','pink','purple']) expect(view.container.querySelector(`mark[data-hl-color="${color}"]`)).not.toBeNull();
    const mark = view.container.querySelector('mark')!;
    fireEvent.click(mark); fireEvent.pointerUp(mark);
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(view.container.querySelector('mark[tabindex], mark[role="button"]')).toBeNull();
    expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  });
  it('clears marks across owner/attempt changes and ignores corrupt or mismatched archives', () => {
    const review = seed();
    const view = render(<PartReviewContent reviewData={review as any} ownerId="21" />);
    expect(view.container.querySelector('mark')).not.toBeNull();
    view.rerender(<PartReviewContent reviewData={review as any} ownerId="22" />);
    expect(view.container.querySelector('mark')).toBeNull();
    localStorage.setItem(highlightArchiveKeyV2('21', 43), '{broken');
    view.rerender(<PartReviewContent reviewData={{ ...review, attemptId: 43 } as any} ownerId="21" />);
    expect(view.container.querySelector('mark')).toBeNull();
  });
  it.each(['hash','part','owner','attempt','empty','missing'])('ignores %s archive without writing storage', reason => {
    const review = seed();
    const key = highlightArchiveKeyV2('21',42);
    const archive = JSON.parse(localStorage.getItem(key)!);
    if (reason === 'hash') archive.documents.forEach((doc: any) => doc.contentHash = 'other');
    if (reason === 'part') archive.documents.forEach((doc: any) => doc.partId = 99);
    if (reason === 'owner') archive.ownerId = 'other';
    if (reason === 'attempt') archive.attemptId = 99;
    if (reason === 'empty') archive.documents = [];
    localStorage.setItem(key,JSON.stringify(archive));
    if (reason === 'missing') localStorage.removeItem(key);
    const write = vi.spyOn(Storage.prototype,'setItem');
    render(<PartReviewContent reviewData={review as any} ownerId="21" />);
    expect(document.querySelector('mark')).toBeNull(); expect(write).not.toHaveBeenCalled();
  });
  it('reads legacy v1 as yellow and respects an authoritative empty v2 archive', () => {
    const review = seed();
    const key = highlightArchiveKeyV2('21',42);
    const archive = JSON.parse(localStorage.getItem(key)!);
    const doc = archive.documents.find((item: any) => item.documentId === 'PART_CONTENT');
    localStorage.removeItem(key);
    localStorage.setItem(highlightArchiveKeyV1('21',42),JSON.stringify({ ...archive, schemaVersion: 1, documents: [{...doc, documentId:'part', items: [{id:'legacy',start:0,end:4,text:'Part'}]}] }));
    const view = render(<PartReviewContent reviewData={review as any} ownerId="21" />);
    expect(view.container.querySelector('mark[data-hl-color="yellow"]')).not.toBeNull();
    view.unmount(); localStorage.setItem(key,JSON.stringify({...archive,documents:[]}));
    const next=render(<PartReviewContent reviewData={review as any} ownerId="21" />);
    expect(next.container.querySelector('mark')).toBeNull();
  });
  it('keeps HTML images sanitized while never annotating answers or explanations', () => {
    const review = seed();
    review.examData.contentHtml = '<p>Part content<img src="/chart.png" alt="chart" onerror="evil()"><script>evil()</script></p>';
    const view = render(<PartReviewContent reviewData={review as any} ownerId="21" />);
    expect(screen.getByRole('img', { name: 'chart' })).not.toHaveAttribute('onerror');
    expect(view.container.querySelector('script')).toBeNull();
    expect(view.container.querySelector('mark[data-hl-id="rd08-PART_CONTENT"]')).not.toBeNull();
    expect(view.container.querySelector('[data-review-source="ANSWER"], [data-review-source="EXPLANATION"]')).toBeNull();
    expect(screen.getByText(review.questions[0].explanation).querySelector('mark')).toBeNull();
  });
  it.each(['TRUE_FALSE_NOT_GIVEN','YES_NO_NOT_GIVEN'])('restores public %s tokens even when authored options are absent', type => {
    const review = fixture();
    const question = { ...review.questions[0], type, options: null };
    const doc = buildWorkspaceTextDocuments({ questions: [question] }, 10).find(item => item.source.kind === 'OPTION_TEXT')!;
    localStorage.setItem(highlightArchiveKeyV2('21',42),JSON.stringify({schemaVersion:2,ownerId:'21',attemptId:42,updatedAt:new Date().toISOString(),documents:[{partId:10,documentId:doc.sourceKey,contentHash:doc.contentHash,items:[{id:'token',start:0,end:doc.text.length,text:doc.text,color:'pink'}]}]}));
    const view=render(<PartReviewContent reviewData={{...review,questions:[question],questionGroups:[]} as any} ownerId="21" />);
    expect(view.container.querySelector('mark[data-hl-id="token"]')?.textContent).toBe(doc.text);
  });
  it.each([null, [], ['Paragraph C', 'Paragraph E']])('restores Matching Information option A when review options are %s', options => {
    const review = fixture();
    const question = {
      ...review.questions[0], type: 'MATCHING_INFORMATION', options,
      questionText: 'Which paragraph contains the information?',
      correctAnswer: 'B', userAnswer: 'A', verdict: 'WRONG',
    };
    const doc = buildWorkspaceTextDocuments({ questions: [question] }, 10)
      .find(item => item.source.kind === 'OPTION_TEXT' && item.source.optionId === 'A')!;
    localStorage.setItem(highlightArchiveKeyV2('21',42),JSON.stringify({schemaVersion:2,ownerId:'21',attemptId:42,updatedAt:new Date().toISOString(),documents:[{partId:10,documentId:doc.sourceKey,contentHash:doc.contentHash,items:[{id:'matching-a',start:0,end:1,text:'ignored',color:'pink'}]}]}));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');

    const view = render(<PartReviewContent reviewData={{...review,questions:[question],questionGroups:[]} as any} ownerId="21" />);

    const mark = view.container.querySelector('mark[data-hl-id="matching-a"]');
    expect(mark?.textContent).toBe('A');
    expect(mark).toHaveAttribute('data-hl-color', 'pink');
    const answerA = view.container.querySelector('[data-testid="review-option-id-q1-A"]');
    const answerB = view.container.querySelector('[data-testid="review-option-id-q1-B"]');
    expect(answerA).toHaveTextContent('A');
    expect(answerB).toHaveTextContent('B');
    expect(answerA?.closest('div.rounded-lg')?.querySelector('input')).toBeChecked();
    expect(answerB?.closest('div.rounded-lg')?.querySelector('input')).not.toBeChecked();
    expect(answerA?.closest('div.rounded-lg')).toHaveTextContent('Lựa chọn của bạn');
    expect(answerB?.closest('div.rounded-lg')).toHaveTextContent('Đáp án đúng');
    expect(view.container.querySelector('[data-testid="question-card-q1"]')).toHaveTextContent('Chưa chính xác');
    expect(view.container.querySelector('[role="note"]')).toBeNull();
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
