import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { useStore } from 'react-redux';
import type { RootState } from '../../../app/store';
import type { WorkspaceResponse, WritingHintsFailure, WritingHintsRequest, WritingHintsResponse } from '../types/api.types';
import type { Question } from '../types/exam.types';
import { generateWritingHints } from '../api/attemptApi';
import { canonicalizeLanguageTag, createWritingHintsRequestId, validateWritingHintsRequest } from '../api/writingHintsContract';
import { classifyWritingHintsError } from '../utils/writingHintsErrors';

export interface WritingHintsLanguageSelection {
  learningLanguage: string | null;
  hintLanguage: string | null;
}
export interface QuestionWritingHints {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  data: WritingHintsResponse | null;
  error: WritingHintsFailure | null;
  lastSelection: WritingHintsLanguageSelection | null;
}
export interface WritingHintsController {
  busy: boolean;
  retryAfterSeconds: number | null;
  blockedError: WritingHintsFailure | null;
  getHints(questionId: string): QuestionWritingHints;
  generate(questionId: string, selection: WritingHintsLanguageSelection): Promise<void>;
  retry(questionId: string): Promise<void>;
  suspend(): void;
}
export interface UseWritingHintsOptions {
  workspace: WorkspaceResponse | null;
  partId: number | null;
  questions: readonly Question[];
  isLocked: () => boolean;
  ownerId?: number | null;
}

interface HintsOperation {
  readonly attemptId: number;
  readonly payload: WritingHintsRequest;
  readonly selection: WritingHintsLanguageSelection;
  readonly defaultHintLanguage: string | null;
}
interface HintsEntry {
  operation: HintsOperation | null;
  value: QuestionWritingHints;
}
interface Flight {
  key: string;
  partId: number;
  questionId: string;
  epoch: number;
  abortController: AbortController;
}

function idleHints(): QuestionWritingHints {
  return { phase: 'idle', data: null, error: null, lastSelection: null };
}
function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function keyFor(partId: number, questionId: string): string {
  return JSON.stringify([partId, questionId]);
}
function snapshotLearningLanguage(workspace: WorkspaceResponse | null): string | null {
  if (!workspace || workspace.languageContext?.policyVersion !== 'TV3_LANG_V1') return null;
  const contextLanguage = canonicalizeLanguageTag(workspace.languageContext.examLanguage);
  const snapshotLanguage = canonicalizeLanguageTag(
    workspace.exam_snapshot?.examLanguage ?? workspace.exam_snapshot?.exam_language,
  );
  return contextLanguage && contextLanguage === snapshotLanguage ? contextLanguage : null;
}

// Match the workspace's canonical grouped content before its flat compatibility view.
// Only recorded IDs establish membership; question numbers/order never grant access.
function snapshotQuestions(part: unknown): unknown[] {
  if (!record(part)) return [];
  const nested = record(part.content) ? part.content.question_groups : undefined;
  const groups = Array.isArray(part.questionGroups) && part.questionGroups.length > 0
    ? part.questionGroups : nested;
  if (Array.isArray(groups) && groups.length > 0) {
    return groups.flatMap(group => record(group) && Array.isArray(group.questions) ? group.questions : []);
  }
  return Array.isArray(part.questions) ? part.questions : [];
}
function snapshotQuestionId(question: unknown): string | null {
  if (!record(question)) return null;
  const id = question.question_id ?? question.questionId ?? question.id;
  if (typeof id === 'string') return id;
  return positiveId(id) ? String(id) : null;
}

function eligible(options: UseWritingHintsOptions, state: RootState['answers'], questionId: string): boolean {
  const ws = options.workspace;
  const partId = options.partId;
  if (!ws || !positiveId(ws.attempt_id) || !positiveId(partId) || state.attemptId !== ws.attempt_id ||
    ws.test_mode !== 'PRACTICE' || ws.status !== 'IN_PROGRESS' || state.isLocked || options.isLocked() ||
    !snapshotLearningLanguage(ws)) return false;
  const sections = ws.exam_snapshot?.sections;
  if (!Array.isArray(sections) || !Array.isArray(ws.lockedSections)) return false;
  const matches = sections.flatMap(section => Array.isArray(section.parts)
    ? section.parts.filter(part => part.id === partId).map(part => ({ section, part })) : []);
  if (matches.length !== 1) return false;
  const { section, part } = matches[0];
  if (!positiveId(section.id) || sections.filter(candidate => candidate.id === section.id).length !== 1 ||
    (section.skill_type ?? (section as any).name)?.toUpperCase() !== 'WRITING' || ws.lockedSections.includes(section.id)) return false;
  const selected = options.questions.filter(question => question.question_id === questionId);
  const recorded = snapshotQuestions(part);
  const ids = recorded.map(snapshotQuestionId);
  if (ids.some(id => id === null) || new Set(ids).size !== ids.length) return false;
  const questions = recorded.filter(question => snapshotQuestionId(question) === questionId);
  return selected.length === 1 && selected[0].type === 'ESSAY' && questions.length === 1 &&
    record(questions[0]) && questions[0].type === 'ESSAY';
}

export function useWritingHints(options: UseWritingHintsOptions): WritingHintsController {
  const store = useStore<RootState>();
  const live = useRef(options);
  live.current = options;
  const [, redraw] = useReducer((version: number) => version + 1, 0);
  const mounted = useRef(false);
  const entries = useRef(new Map<string, HintsEntry>());
  const flight = useRef<Flight | null>(null);
  const epoch = useRef(0);
  const context = useRef<string | null>(null);
  const previousPart = useRef<number | null>(options.partId);
  const blocked = useRef<WritingHintsFailure | null>(null);
  const retryAt = useRef<number | null>(null);

  const contextKey = useCallback(() => {
    const state = store.getState().answers;
    const language = live.current.workspace?.languageContext;
    return JSON.stringify([live.current.ownerId ?? null, live.current.workspace?.attempt_id ?? null, state.attemptId, state.contextRevision,
      language?.policyVersion ?? null, language?.examLanguage ?? null, language?.defaultExplanationLanguage ?? null,
      language?.supportedExplanationLanguages ?? null]);
  }, [store]);
  const publish = useCallback(() => { if (mounted.current) redraw(); }, []);
  const clearContext = useCallback(() => {
    epoch.current += 1;
    entries.current.clear();
    context.current = null;
    blocked.current = null;
    retryAt.current = null;
  }, []);
  const cancelFlight = useCallback(() => {
    const current = flight.current;
    if (!current) return;
    // Invalidate before abort: the old catch/finally cannot free a replacement flight.
    flight.current = null;
    const entry = entries.current.get(current.key);
    if (entry?.value.phase === 'loading') {
      entry.value = {
        ...entry.value, phase: 'error',
        error: classifyWritingHintsError({ name: 'CanceledError' }, Date.now()),
      };
    }
    current.abortController.abort();
    publish();
  }, [publish]);

  const synchronize = useCallback(() => {
    const nextContext = contextKey();
    if (context.current !== nextContext) {
      cancelFlight();
      clearContext();
      context.current = nextContext;
      publish();
    }
    if (previousPart.current !== live.current.partId) {
      cancelFlight();
      previousPart.current = live.current.partId;
    }
    const ws = live.current.workspace;
    if (ws && (ws.status !== 'IN_PROGRESS' || ws.test_mode !== 'PRACTICE')) {
      cancelFlight();
      if (entries.current.size > 0) { entries.current.clear(); publish(); }
    }
    const active = flight.current;
    if (active && !eligible(live.current, store.getState().answers, active.questionId)) cancelFlight();
  }, [cancelFlight, clearContext, contextKey, publish, store]);

  useLayoutEffect(() => {
    mounted.current = true;
    synchronize();
    const unsubscribe = store.subscribe(synchronize);
    return () => {
      mounted.current = false;
      unsubscribe();
      cancelFlight();
      clearContext();
    };
  }, [cancelFlight, clearContext, store, synchronize]);
  useLayoutEffect(() => { synchronize(); });

  // This timer updates only the displayed backoff; it never sends requests.
  const deadline = retryAt.current;
  useEffect(() => {
    if (deadline === null) return;
    const update = () => {
      if (retryAt.current !== deadline) return;
      if (Date.now() >= deadline) retryAt.current = null;
      publish();
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deadline, publish]);

  const run = useCallback(async (questionId: string, selection: WritingHintsLanguageSelection | null) => {
    if (!mounted.current) return;
    synchronize();
    const current = live.current;
    const ws = current.workspace;
    const partId = current.partId;
    if (flight.current || blocked.current || (retryAt.current !== null && Date.now() < retryAt.current) ||
      !eligible(current, store.getState().answers, questionId) || !ws || partId === null) return;
    const key = keyFor(partId, questionId);
    const previous = entries.current.get(key);
    let operation = selection === null ? previous?.operation : null;
    if (selection === null && (!operation || (previous?.value.error &&
      previous.value.error.action !== 'retry' && previous.value.error.kind !== 'rate-limited'))) return;

    // Set the mutex before preparation/UUID and before the first await.
    const active: Flight = { key, partId, questionId, epoch: epoch.current, abortController: new AbortController() };
    flight.current = active;
    try {
      if (selection !== null) {
        const sourceLanguage = snapshotLearningLanguage(ws);
        const invalidLanguage = [selection.learningLanguage, selection.hintLanguage]
          .some(language => language !== null && canonicalizeLanguageTag(language) === null);
        const requestedLearning = selection.learningLanguage ? canonicalizeLanguageTag(selection.learningLanguage) : sourceLanguage;
        if (invalidLanguage || !sourceLanguage || requestedLearning !== sourceLanguage) {
          entries.current.set(key, {
            operation: null,
            value: {
              phase: 'error', data: previous?.value.data ?? null,
              error: classifyWritingHintsError({ response: { status: 422, data: { code: 1607 } } }, Date.now()),
              lastSelection: { ...selection },
            },
          });
          return;
        }
        const payload = validateWritingHintsRequest(ws.attempt_id, {
          partId, questionId, requestId: createWritingHintsRequestId(),
          learningLanguage: selection.learningLanguage, hintLanguage: selection.hintLanguage,
        });
        operation = Object.freeze({
          attemptId: ws.attempt_id, payload,
          selection: Object.freeze({ learningLanguage: payload.learningLanguage ?? null, hintLanguage: payload.hintLanguage ?? null }),
          defaultHintLanguage: canonicalizeLanguageTag(ws.languageContext?.defaultExplanationLanguage) ?? sourceLanguage,
        });
      }
      if (!operation) return;
      entries.current.set(key, {
        operation,
        value: { phase: 'loading', data: previous?.value.data ?? null, error: null, lastSelection: { ...operation.selection } },
      });
      publish();
      const response = await generateWritingHints(operation.attemptId, operation.payload, {
        signal: active.abortController.signal, defaultHintLanguage: operation.defaultHintLanguage,
      });
      synchronize();
      if (!mounted.current || flight.current !== active || epoch.current !== active.epoch) return;
      entries.current.set(key, {
        operation,
        value: { phase: 'ready', data: response, error: null, lastSelection: { ...operation.selection } },
      });
    } catch (error) {
      synchronize();
      if (!mounted.current || flight.current !== active || epoch.current !== active.epoch) return;
      const failure = classifyWritingHintsError(error, Date.now());
      if (failure.retryAt !== null) retryAt.current = failure.retryAt;
      if (['access', 'ended', 'conflict', 'quota', 'context'].includes(failure.kind)) blocked.current = failure;
      if (['access', 'ended', 'conflict'].includes(failure.kind)) entries.current.clear();
      entries.current.set(key, {
        operation: ['access', 'ended', 'conflict'].includes(failure.kind) ? null : operation ?? null,
        value: {
          phase: 'error', data: ['access', 'ended', 'conflict'].includes(failure.kind) ? null : previous?.value.data ?? null,
          error: failure, lastSelection: operation ? { ...operation.selection } : previous?.value.lastSelection ?? null,
        },
      });
    } finally {
      if (flight.current === active) { flight.current = null; publish(); }
    }
  }, [publish, store, synchronize]);

  const generate = useCallback((questionId: string, selection: WritingHintsLanguageSelection) => run(questionId, selection), [run]);
  const retry = useCallback((questionId: string) => run(questionId, null), [run]);
  const suspend = useCallback(() => { cancelFlight(); }, [cancelFlight]);
  const getHints = useCallback((questionId: string): QuestionWritingHints => {
    if (!mounted.current || context.current !== contextKey() || live.current.partId === null) return idleHints();
    return entries.current.get(keyFor(live.current.partId, questionId))?.value ?? idleHints();
  }, [contextKey]);

  const matchesContext = context.current === contextKey();
  const remaining = retryAt.current === null ? 0 : Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000));
  return {
    busy: matchesContext && flight.current !== null,
    retryAfterSeconds: matchesContext && remaining > 0 ? remaining : null,
    blockedError: matchesContext ? blocked.current : null,
    getHints, generate, retry, suspend,
  };
}
