import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createTestStore } from '../../../test-utils/renderWithStore';
import i18n from '../../../i18n';
import axiosClient from '../../../core/api/axiosClient';
import ExamStartPage from '../pages/ExamStartPage';
import WorkspacePage from '../pages/WorkspacePage';
import { ExamResultPage } from '../pages/ExamResultPage';
import ExamReviewPage from '../pages/ExamReviewPage';
import { lifecycleEnvelope, lifecycleExamStructure, lifecycleWorkspace, lifecycleResult, lifecycleReview,
  lifecycleWritingFeedback, LIFECYCLE_WRITING_PART_ID as partId } from './fixtures/tv3Regression';
import { validWritingHintsFr } from './fixtures/writingHints';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
const http=vi.mocked(axiosClient);
const languages=['en','vi','ko','zh','ja','fr','de','es'];
const cases=languages.flatMap(language=>['vi','en'].map(locale=>[language,locale] as const));
async function flush(){await act(async()=>{await Promise.resolve();});}
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();vi.useFakeTimers();window.scrollTo=vi.fn();Element.prototype.scrollIntoView=vi.fn();});
afterEach(async()=>{vi.useRealTimers();await i18n.changeLanguage('vi');});

describe('multilingual real frontend lifecycle',()=>{
  it.each(cases)('%s source with %s UI preserves input through autosave/resume, Hints, submit and review',async(language,locale)=>{
    await i18n.changeLanguage(locale);
    const ui=()=>i18n.language==='en';
    const server:any=lifecycleWorkspace({mode:'PRACTICE',essay:'SERVER_A'});
    Object.assign(server.examSnapshot,{type:'LANGUAGE_PRACTICE',examLanguage:language});
    server.languageContext={policyVersion:'TV3_LANG_V1',examLanguage:language,defaultExplanationLanguage:'vi',supportedExplanationLanguages:languages};
    const structure={...lifecycleExamStructure(),type:'LANGUAGE_PRACTICE',examLanguage:language};
    const result=lifecycleResult();
    let finishAutosave: (() => void) | undefined;
    http.get.mockImplementation(async(url)=>{
      if(String(url).endsWith('/structure'))return lifecycleEnvelope(structure) as never;
      if(String(url).endsWith('/workspace'))return lifecycleEnvelope(structuredClone(server)) as never;
      if(String(url).endsWith('/result'))return lifecycleEnvelope(result) as never;
      if(String(url).includes('/review/'))return lifecycleEnvelope(lifecycleReview()) as never;
      if(String(url).endsWith('/writing-feedback'))return lifecycleEnvelope(lifecycleWritingFeedback()) as never;
      throw new Error('Unexpected GET');
    });
    http.post.mockImplementation(async(url,body:any)=>{
      if(url==='/v1/attempts')return lifecycleEnvelope(server) as never;
      if(String(url).endsWith('/writing-hints'))return lifecycleEnvelope({...structuredClone(validWritingHintsFr),...body,attemptId:77,learningLanguage:language,hintLanguage:'fr'}) as never;
      if(String(url).endsWith('/submit'))return lifecycleEnvelope({attemptId:77,status:'COMPLETED',redirectUrl:'/attempts/77/result'}) as never;
      throw new Error('Unexpected POST');
    });
    http.put.mockImplementation(async(_url,body:any)=>new Promise(resolve=>{
      finishAutosave=()=>{
        server.version=body.version+1;server.savedAnswers=body.answers;server.saved_answers=body.answers;
        resolve(lifecycleEnvelope({version:server.version}) as never);
      };
    }));
    function mount(route:string){
      const store=createTestStore();
      return {...render(<Provider store={store}><MemoryRouter initialEntries={[route]}><Routes>
        <Route path="/exams/:examId/start" element={<ExamStartPage/>}/>
        <Route path="/attempts/:attemptId" element={<WorkspacePage/>}/>
        <Route path="/attempts/:attemptId/result" element={<ExamResultPage/>}/>
        <Route path="/attempts/:attemptId/review" element={<ExamReviewPage/>}/>
      </Routes></MemoryRouter></Provider>),store};
    }
    let view=mount('/exams/1/start');await flush();
    fireEvent.click(screen.getByText(ui()?'Full exam':'Toàn bộ đề'));
    fireEvent.click(screen.getByText('Practice'));
    fireEvent.click(screen.getByRole('button',{name:ui()?/start exam/i:/bắt đầu/i}));await flush();
    const input=screen.getByRole('textbox');
    expect(input).toHaveValue('SERVER_A');
    const essay='日本語 한국어 水 tiếng Việt e\u0301 😀 '+language;
    fireEvent.compositionStart(input);fireEvent.change(input,{target:{value:essay}});
    await act(async()=>{await i18n.changeLanguage(locale==='vi'?'en':'vi');});
    expect(screen.getByRole('textbox')).toBe(input);expect(input).toHaveValue(essay);
    fireEvent.compositionEnd(input);
    await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});
    expect(http.put).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox')).toBe(input);expect(input).toHaveValue(essay);
    await act(async()=>{await i18n.changeLanguage(locale);});
    expect(screen.getByRole('textbox')).toBe(input);expect(input).toHaveValue(essay);
    expect(http.put).toHaveBeenCalledOnce();
    expect(finishAutosave).toBeDefined();
    await act(async()=>{finishAutosave?.();await Promise.resolve();});
    expect((http.put.mock.calls[0][1] as any).answers[0].answers[0].answer).toBe(essay);
    view.unmount();view=mount('/attempts/77');await flush();
    expect(screen.getByRole('textbox')).toHaveValue(essay);
    expect(view.store.getState().answers.version).toBe(8);
    fireEvent.click(screen.getByRole('button',{name:/writing hints/i}));
    expect(screen.getByLabelText(ui()?'Learning language':'Ngôn ngữ học')).toHaveValue(language);
    fireEvent.change(screen.getByLabelText(ui()?'Explanation language':'Ngôn ngữ giải thích'),{target:{value:'fr'}});
    fireEvent.click(screen.getByRole('button',{name:ui()?'Generate hints':'Tạo gợi ý'}));await flush();
    const hintCalls=()=>http.post.mock.calls.filter(([url])=>String(url).endsWith('/writing-hints'));
    expect(hintCalls()).toHaveLength(1);expect(hintCalls()[0][1]).toMatchObject({learningLanguage:language,hintLanguage:'fr'});
    await act(async()=>{await i18n.changeLanguage(locale);});
    expect(hintCalls()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:ui()?/^(?:🚀\s*)?submit$/i:/^(?:🚀\s*)?nộp bài$/i}));await flush();
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(ui()?'Explanation language':'Ngôn ngữ giải thích'),{target:{value:'fr'}});
    fireEvent.click(screen.getByRole('button',{name:ui()?/submit now/i:/nộp bài ngay/i}));await flush();
    const submission=http.post.mock.calls.find(([url])=>String(url).endsWith('/submit'));
    expect(submission?.[1]).toMatchObject({baseVersion:8,feedbackLanguage:'fr',finalAnswers:[{part_id:partId,answers:[{question_id:'essay',answer:essay}]}]});
    expect(http.get.mock.calls.some(([url])=>String(url).endsWith('/result'))).toBe(true);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link',{name:ui()?'View answers and explanations':'Xem bài làm và lời giải'}));await flush();
    expect(http.get.mock.calls.some(([url])=>String(url).includes('/review/'))).toBe(true);
    expect(http.put).toHaveBeenCalledOnce();view.unmount();
  });
});
