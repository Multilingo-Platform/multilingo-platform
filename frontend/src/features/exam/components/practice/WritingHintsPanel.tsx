import { useEffect, useId, useState } from 'react';
import { ChevronDown, LoaderCircle, Sparkles } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../../vocab/types/vocab.types';
import type { QuestionWritingHints, WritingHintsLanguageSelection } from '../../hooks/useWritingHints';
import type { WritingHintsResponse } from '../../types/api.types';

export interface WritingHintsPanelProps {
  questionId: string;
  taskNumber: number | string;
  state: QuestionWritingHints;
  busy: boolean;
  disabled: boolean;
  retryAfterSeconds: number | null;
  onGenerate(selection: WritingHintsLanguageSelection): void | Promise<void>;
  onRetry(): void | Promise<void>;
}

const EMPTY_SELECTION: WritingHintsLanguageSelection = { learningLanguage: null, hintLanguage: null };

function languageLabel(tag: string): string {
  return SUPPORTED_LANGUAGES.find((language) => language.code === tag)?.name ?? tag;
}

function buttonClass(extra = ''): string {
  return `inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${extra}`;
}

function HintsContent({ data, taskNumber }: { data: WritingHintsResponse; taskNumber: number | string }) {
  const contentId = useId();
  return (
    <section
      aria-labelledby={`${contentId}-title`}
      className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
      lang={data.hintLanguage}
    >
      <header className="mb-5 min-w-0 border-b border-slate-100 pb-4">
        <h3 id={`${contentId}-title`} className="break-words text-base font-semibold text-slate-900">
          Gợi ý Writing — Task {taskNumber}
        </h3>
        <div className="mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>Ngôn ngữ học: {languageLabel(data.learningLanguage)}</span>
          <span>Ngôn ngữ gợi ý: {languageLabel(data.hintLanguage)}</span>
        </div>
      </header>

      <div className="min-w-0 space-y-5">
        <section aria-labelledby={`${contentId}-outline`} className="min-w-0">
          <h4 id={`${contentId}-outline`} className="mb-2 text-sm font-semibold text-slate-900">Dàn ý</h4>
          <div className="space-y-4">
            {data.outline.map((section, sectionIndex) => (
              <section key={`${section.title}-${sectionIndex}`} className="min-w-0">
                <h5 className="break-words text-sm font-medium text-slate-800">{section.title}</h5>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 marker:text-amber-600">
                  {section.points.map((point, pointIndex) => (
                    <li key={`${pointIndex}-${point.slice(0, 24)}`} className="break-words">{point}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section aria-labelledby={`${contentId}-vocabulary`} className="min-w-0">
          <h4 id={`${contentId}-vocabulary`} className="mb-2 text-sm font-semibold text-slate-900">Từ vựng</h4>
          <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            {data.vocabulary.map((item, index) => (
              <div key={`${item.term}-${index}`} className="min-w-0 rounded-md border border-slate-200 bg-slate-50/70 p-3">
                <dt className="break-words text-sm font-semibold text-slate-900">{item.term}</dt>
                <dd className="mt-2 min-w-0 space-y-2 break-words text-sm leading-6 text-slate-700">
                  <p>{item.definition}</p>
                  <p>{item.explanation}</p>
                  <p><span className="font-medium text-slate-600">Ví dụ: </span>{item.example}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {data.limitations.length > 0 && (
          <section aria-labelledby={`${contentId}-limitations`} className="min-w-0 rounded-md border border-amber-200 bg-amber-50/70 p-3">
            <h4 id={`${contentId}-limitations`} className="mb-2 text-sm font-semibold text-amber-950">Lưu ý</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950 marker:text-amber-700">
              {data.limitations.map((limitation, index) => <li key={`${index}-${limitation.slice(0, 24)} `} className="break-words">{limitation}</li>)}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}

export function WritingHintsPanel({
  questionId: _questionId,
  taskNumber,
  state,
  busy,
  disabled,
  retryAfterSeconds,
  onGenerate,
  onRetry,
}: WritingHintsPanelProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState<WritingHintsLanguageSelection>(() => ({
    ...(state.lastSelection ?? EMPTY_SELECTION),
  }));
  const [confirming, setConfirming] = useState(false);
  const hasOperation = state.lastSelection !== null;
  const operationLearningLanguage = state.lastSelection?.learningLanguage ?? null;
  const operationHintLanguage = state.lastSelection?.hintLanguage ?? null;
  const readyToRetry = state.error?.action === 'retry' || state.error?.kind === 'pending' || state.error?.kind === 'rate-limited';
  const waiting = retryAfterSeconds !== null && retryAfterSeconds > 0;
  const actionBlocked = state.error !== null && ['quota', 'context', 'access', 'ended', 'conflict'].includes(state.error.kind);
  const canCreate = !disabled && !busy && !waiting && !actionBlocked;

  useEffect(() => {
    if (!hasOperation) return;
    setSelection((current) => (
      current.learningLanguage === operationLearningLanguage &&
      current.hintLanguage === operationHintLanguage
        ? current
        : { learningLanguage: operationLearningLanguage, hintLanguage: operationHintLanguage }
    ));
  }, [hasOperation, operationLearningLanguage, operationHintLanguage]);

  const setLanguage = (key: keyof WritingHintsLanguageSelection, value: string) => {
    setSelection((current) => ({ ...current, [key]: value || null }));
    setConfirming(false);
  };
  const requestNewHints = () => {
    if (!canCreate) return;
    if (hasOperation || state.data) {
      setConfirming(true);
      return;
    }
    void onGenerate({ ...selection });
  };
  const cancelNewHints = () => {
    setSelection({ ...(state.lastSelection ?? EMPTY_SELECTION) });
    setConfirming(false);
  };
  const confirmNewHints = () => {
    if (!canCreate) return;
    setConfirming(false);
    void onGenerate({ ...selection });
  };

  const toggleId = `${id}-toggle`;
  const panelId = `${id}-panel`;
  const learningId = `${id}-learning-language`;
  const hintId = `${id}-hint-language`;
  const confirmationId = `${id}-confirmation`;

  return (
    <div className="mt-4 min-w-0 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:p-4">
      <button
        id={toggleId}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-md text-left text-sm font-semibold text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
      >
        <span className="flex min-w-0 items-center gap-2 break-words">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <span>Gợi ý Writing — Task {taskNumber}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <div id={panelId} aria-labelledby={toggleId} hidden={!expanded} className="mt-3 min-w-0 space-y-4 border-t border-amber-200 pt-4">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor={learningId} className="block text-sm font-medium text-slate-800">Ngôn ngữ học</label>
              <select
                id={learningId}
                value={selection.learningLanguage ?? ''}
                disabled={disabled}
                onChange={(event) => setLanguage('learningLanguage', event.target.value)}
                className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">Theo ngôn ngữ học đã lưu</option>
                {SUPPORTED_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}
              </select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <label htmlFor={hintId} className="block text-sm font-medium text-slate-800">Ngôn ngữ gợi ý</label>
              <select
                id={hintId}
                value={selection.hintLanguage ?? ''}
                disabled={disabled}
                onChange={(event) => setLanguage('hintLanguage', event.target.value)}
                className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">Theo ngôn ngữ học</option>
                {SUPPORTED_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs leading-5 text-slate-600">Gợi ý chỉ hỗ trợ lập dàn ý và từ vựng cho bài viết này.</p>

          {state.phase === 'loading' && (
            <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700">
              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-amber-700" aria-hidden="true" />
              <span>Đang tạo gợi ý. Có thể tiếp tục viết bài.</span>
            </p>
          )}

          {state.error && (
            <div role="alert" className="space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
              <p className="break-words">{state.error.message}</p>
              {state.data && (
                <p className="break-words">Chưa tạo được bộ gợi ý mới. Đang hiển thị bộ trước.</p>
              )}
              {(state.error.kind === 'pending' || state.error.kind === 'rate-limited') && (
                <p className="break-words">
                  {state.error.kind === 'pending'
                    ? 'Yêu cầu trước có thể đã hoàn tất trên máy chủ.'
                    : 'Hãy đợi hết thời gian chờ trước khi thử lại.'}
                  {waiting && <> Thử lại sau {retryAfterSeconds} giây.</>}
                </p>
              )}
              {state.error.action === 'reload' && <p>Hãy tải lại trang để tiếp tục.</p>}
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            {state.error && readyToRetry && (
              <button
                type="button"
                onClick={() => { void onRetry(); }}
                disabled={!canCreate}
                className={buttonClass('border-amber-400 bg-white text-amber-900 hover:bg-amber-50')}
              >
                {busy && state.phase === 'loading' && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Thử lại
              </button>
            )}
            <button
              type="button"
              onClick={requestNewHints}
              disabled={!canCreate}
              className={buttonClass('border-amber-700 bg-amber-700 text-white hover:bg-amber-800')}
            >
              {busy && state.phase === 'loading' && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy && state.phase === 'loading'
                ? 'Đang tạo gợi ý…'
                : state.phase === 'error' && state.error?.action === 'change-language'
                ? 'Đổi ngôn ngữ và tạo gợi ý'
                : hasOperation || state.data ? 'Tạo gợi ý mới' : 'Tạo gợi ý'}
            </button>
          </div>

          {confirming && (
            <div role="group" aria-labelledby={confirmationId} className="min-w-0 space-y-3 rounded-md border border-amber-300 bg-white p-3 sm:p-4">
              <div className="space-y-1.5">
                <h4 id={confirmationId} className="text-sm font-semibold text-slate-900">Xác nhận tạo gợi ý mới</h4>
                <p className="break-words text-sm text-slate-700">Tạo mới thành công sẽ dùng thêm một lượt trong hạn mức.</p>
                <p className="break-words text-sm text-slate-700">Yêu cầu trước có thể đã hoàn tất trên máy chủ.</p>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <button type="button" onClick={confirmNewHints} disabled={!canCreate} aria-label="Xác nhận tạo gợi ý mới" className={buttonClass('border-amber-700 bg-amber-700 text-white hover:bg-amber-800')}>
                  Xác nhận tạo gợi ý mới
                </button>
                <button type="button" onClick={cancelNewHints} className={buttonClass('border-slate-300 bg-white text-slate-800 hover:bg-slate-50')}>
                  Hủy
                </button>
              </div>
            </div>
          )}

          {state.data && (
            <div className="min-w-0 space-y-3">
              <HintsContent data={state.data} taskNumber={taskNumber} />
              <p className="break-words text-xs leading-5 text-slate-600">Gợi ý tham khảo, không phải điểm chấm hoặc bài viết mẫu.</p>
            </div>
          )}
      </div>
    </div>
  );
}
