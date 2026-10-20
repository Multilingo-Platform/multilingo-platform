import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector, useStore } from 'react-redux';
import type { RootState } from '../../../app/store';
import type { DictionaryLookupFailure, DictionaryLookupRequest, DictionaryLookupResponse, WorkspaceResponse } from '../types/api.types';
import type { SelectionState } from './useTextSelection';
import { lookupPracticeDictionary } from '../api/dictionaryLookupApi';
import { DictionaryLookupContractError } from '../api/dictionaryLookupContract';
import { buildDictionaryLookupRequest } from '../utils/dictionarySelection';

type Phase = 'idle' | 'loading' | 'ready' | 'error';
interface Operation { readonly attemptId: number; readonly key: string; readonly request: DictionaryLookupRequest; readonly selection: SelectionState; }
export interface UsePracticeDictionaryOptions {
  workspace: WorkspaceResponse | null;
  partId: number | null;
  isLocked: () => boolean;
}
export interface PracticeDictionaryController {
  phase: Phase;
  data: DictionaryLookupResponse | null;
  error: DictionaryLookupFailure | null;
  lookup(selection: SelectionState): Promise<void>;
  retry(): Promise<void>;
  cancel(): void;
}

function record(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function contextKey(options: UsePracticeDictionaryOptions, state: RootState['answers']): string {
  return JSON.stringify([options.workspace?.attempt_id ?? null, options.partId, state.attemptId, state.contextRevision]);
}
function validScope(options: UsePracticeDictionaryOptions, selection: SelectionState, state: RootState['answers']): boolean {
  const workspace = options.workspace;
  if (!workspace || workspace.test_mode !== 'PRACTICE' || workspace.status !== 'IN_PROGRESS' ||
      workspace.attempt_id !== state.attemptId || state.isLocked || options.isLocked() ||
      !workspace.lockedSections || !Array.isArray(workspace.exam_snapshot?.sections) ||
      selection.contextRevision !== state.contextRevision || !Number.isSafeInteger(options.partId) || !options.partId) return false;
  const matches = workspace.exam_snapshot.sections.flatMap(section => Array.isArray(section.parts)
    ? section.parts.filter(part => (part.part_id ?? part.partId ?? part.id) === options.partId).map(part => ({ section, part })) : []);
  if (matches.length !== 1) return false;
  const { section, part } = matches[0];
  const sectionId = section.section_id ?? section.sectionId ?? section.id;
  const skill = section.skill_type ?? (section as unknown as Record<string, unknown>).name;
  if (String(skill).toUpperCase() !== 'READING' || workspace.lockedSections.includes(sectionId)) return false;
  const rawPart = part as unknown as Record<string, any>;
  if (selection.documentId === 'part') return Boolean(rawPart.contentHtml || rawPart.content_html || rawPart.context_html || rawPart.passage ||
    (record(rawPart.content) && (rawPart.content.content_html || rawPart.content.context_html)));
  const nested = record(rawPart.content) ? rawPart.content.question_groups : undefined;
  const groups = Array.isArray(rawPart.question_groups) ? rawPart.question_groups
    : Array.isArray(rawPart.questionGroups) ? rawPart.questionGroups : Array.isArray(nested) ? nested : [];
  return groups.filter((group: unknown) => record(group) && String(group.group_id ?? group.groupId ?? '') === selection.documentId).length === 1;
}
function classify(error: unknown): DictionaryLookupFailure {
  if (error instanceof DictionaryLookupContractError) return { kind: 'contract', message: error.message, retryAfterSeconds: null, retryable: true };
  const response = (error as any)?.response;
  const status = response?.status;
  const code = response?.data?.code;
  const retryAfter = Number(response?.headers?.['retry-after']);
  if (status === 429) return {
    kind: code === 429 ? 'quota' : 'rate-limited',
    message: code === 429 ? 'Bạn đã dùng hết lượt tra từ hôm nay.' : 'Vui lòng đợi một chút rồi thử lại.',
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null, retryable: code !== 429,
  };
  if (status === 403 || status === 404) return { kind: 'access', message: 'Không thể tra từ trong đoạn này.', retryAfterSeconds: null, retryable: false };
  if (status === 409) return { kind: 'ended', message: 'Phiên thi đã thay đổi. Hãy tải lại trước khi tra tiếp.', retryAfterSeconds: null, retryable: false };
  if (status === 422) return { kind: 'context', message: 'Không xác minh được đoạn văn. Hãy chọn lại từ trong bài đọc.', retryAfterSeconds: null, retryable: false };
  if (status === 503) return { kind: 'disabled', message: 'Tra từ AI hiện chưa khả dụng.', retryAfterSeconds: null, retryable: true };
  return { kind: 'request', message: 'Chưa tra được từ. Bạn có thể thử lại.', retryAfterSeconds: null, retryable: true };
}

export function usePracticeDictionary(options: UsePracticeDictionaryOptions): PracticeDictionaryController {
  const store = useStore<RootState>();
  const live = useRef(options);
  live.current = options;
  const reduxContext = useSelector((state: RootState) => JSON.stringify([state.answers.attemptId, state.answers.contextRevision]));
  const locked = options.isLocked();
  const [state, setState] = useState<{ phase: Phase; data: DictionaryLookupResponse | null; error: DictionaryLookupFailure | null }>({ phase: 'idle', data: null, error: null });
  const epoch = useRef(0);
  const flight = useRef<{ operation: Operation; controller: AbortController } | null>(null);
  const lastOperation = useRef<Operation | null>(null);

  const cancel = useCallback(() => {
    epoch.current += 1;
    const current = flight.current;
    flight.current = null;
    current?.controller.abort();
    lastOperation.current = null;
    setState({ phase: 'idle', data: null, error: null });
  }, []);

  const currentKey = contextKey(options, store.getState().answers);
  useEffect(() => {
    cancel();
    // The selected Part/account/attempt/hydration context changed; result data is not reusable.
  }, [currentKey, reduxContext, locked, cancel]);
  useEffect(() => () => {
    epoch.current += 1;
    const current = flight.current;
    flight.current = null;
    current?.controller.abort();
    lastOperation.current = null;
  }, []);

  const run = useCallback(async (operation: Operation) => {
    if (flight.current || contextKey(live.current, store.getState().answers) !== operation.key) return;
    const currentState = store.getState().answers;
    if (!validScope(live.current, operation.selection, currentState)) return;
    const controller = new AbortController();
    const ticket = { operation, controller };
    const requestEpoch = ++epoch.current;
    flight.current = ticket;
    lastOperation.current = operation;
    setState({ phase: 'loading', data: null, error: null });
    try {
      const data = await lookupPracticeDictionary(operation.attemptId, operation.request, { signal: controller.signal });
      if (flight.current !== ticket || requestEpoch !== epoch.current || contextKey(live.current, store.getState().answers) !== operation.key ||
          !validScope(live.current, operation.selection, store.getState().answers)) return;
      setState({ phase: 'ready', data, error: null });
    } catch (error) {
      if (flight.current !== ticket || requestEpoch !== epoch.current || controller.signal.aborted) return;
      setState({ phase: 'error', data: null, error: classify(error) });
    } finally {
      if (flight.current === ticket && requestEpoch === epoch.current) flight.current = null;
    }
  }, [store]);

  const lookup = useCallback(async (selection: SelectionState) => {
    const running = flight.current?.operation.selection;
    if (running && running.contextKey === selection.contextKey && running.contextRevision === selection.contextRevision &&
        running.documentId === selection.documentId && running.contentHash === selection.contentHash &&
        running.start === selection.start && running.end === selection.end && running.text === selection.text) return;
    if (flight.current) cancel();
    const current = live.current;
    const answers = store.getState().answers;
    const key = contextKey(current, answers);
    if (!validScope(current, selection, answers)) {
      lastOperation.current = null;
      setState({ phase: 'error', data: null, error: {
        kind: 'context', message: 'Không thể tra từ trong đoạn này. Hãy chọn lại từ trong bài đọc.',
        retryAfterSeconds: null, retryable: false,
      } });
      return;
    }
    try {
      const request = buildDictionaryLookupRequest(selection, current.partId!);
      const operation: Operation = { attemptId: current.workspace!.attempt_id, key, request, selection };
      await run(operation);
    } catch (error) {
      setState({ phase: 'error', data: null, error: classify(error) });
    }
  }, [cancel, run, store]);

  const retry = useCallback(async () => {
    const operation = lastOperation.current;
    if (operation && live.current.workspace?.attempt_id === operation.attemptId && contextKey(live.current, store.getState().answers) === operation.key) {
      await run(operation);
    }
  }, [run, store]);

  return { ...state, lookup, retry, cancel };
}
