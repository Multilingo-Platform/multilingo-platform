import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WritingHintsFailure, WritingHintsResponse } from '../types/api.types';
import type { QuestionWritingHints, WritingHintsLanguageSelection } from '../hooks/useWritingHints';
import { validWritingHintsEn } from './fixtures/writingHints';
import { classifyWritingHintsError } from '../utils/writingHintsErrors';

// Import at render time so the new component's first RED run reports a missing feature,
// then the same behavioral assertions run against the production panel.
async function renderPanel(overrides: Partial<PanelProps> = {}) {
  const { WritingHintsPanel } = await import('../components/practice/WritingHintsPanel');
  const props: PanelProps = { ...panelProps(), ...overrides };
  return { ...render(<WritingHintsPanel {...props} />), props };
}

interface PanelProps {
  questionId: string;
  taskNumber: number | string;
  state: QuestionWritingHints;
  busy: boolean;
  disabled: boolean;
  retryAfterSeconds: number | null;
  learningLanguage: string | null;
  defaultExplanationLanguage: string | null;
  supportedExplanationLanguages: readonly string[];
  onGenerate(selection: WritingHintsLanguageSelection): void | Promise<void>;
  onRetry(): void | Promise<void>;
}

const defaults: WritingHintsLanguageSelection = { learningLanguage: null, hintLanguage: null };
const readyResponse: WritingHintsResponse = structuredClone(validWritingHintsEn);
const idle: QuestionWritingHints = { phase: 'idle', data: null, error: null, lastSelection: null };
const noop = vi.fn();

function panelProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    questionId: 'writing-task-1', taskNumber: 1, state: idle, busy: false,
    disabled: false, retryAfterSeconds: null, learningLanguage: 'en', defaultExplanationLanguage: 'vi',
    supportedExplanationLanguages: ['en', 'vi', 'ko', 'zh', 'ja', 'fr', 'de', 'es'],
    onGenerate: noop, onRetry: noop, ...overrides,
  };
}
function state(phase: QuestionWritingHints['phase'], overrides: Partial<QuestionWritingHints> = {}): QuestionWritingHints {
  return { phase, data: null, error: null, lastSelection: null, ...overrides };
}
function failure(kind: WritingHintsFailure['kind'], action: WritingHintsFailure['action'] = 'retry'): WritingHintsFailure {
  return { kind, action, retryAt: null, message: 'Thông báo lỗi an toàn.' };
}

describe('WritingHintsPanel (TV3-19-04, AC-03–05, AC-07)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('starts collapsed with an accessible disclosure; opening it never requests hints', async () => {
    const { container } = await renderPanel();
    const toggle = screen.getByRole('button', { name: /writing hints/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(container.querySelector(`#${CSS.escape(panelId!)}`)).toHaveAttribute('hidden');
    expect(screen.queryByRole('combobox', { name: 'Ngôn ngữ học' })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector(`#${CSS.escape(panelId!)}`)).not.toHaveAttribute('hidden');
    expect(document.getElementById(panelId!)).toBeInTheDocument();
    expect(screen.getByLabelText('Ngôn ngữ học')).toHaveValue('en');
    expect(screen.getByLabelText('Ngôn ngữ giải thích')).toHaveValue('');
    expect(screen.getByRole('button', { name: /^tạo gợi ý$/i })).toBeEnabled();
    expect(noop).not.toHaveBeenCalled();
  });

  it('shows snapshot learning language read-only and offers eight explanation choices', async () => {
    await renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    const learning = screen.getByLabelText('Ngôn ngữ học') as HTMLSelectElement;
    const hint = screen.getByLabelText('Ngôn ngữ giải thích') as HTMLSelectElement;
    expect(learning).toBeDisabled();
    expect(Array.from(learning.options).map(option => option.value)).toEqual(['en']);
    expect(Array.from(hint.options).map(option => option.value)).toEqual(['', 'en', 'vi', 'ko', 'zh', 'ja', 'fr', 'de', 'es']);
    expect(within(hint).getByRole('option', { name: /mặc định/i })).toBeInTheDocument();
  });

  it('keeps first generation explicit and sends only the current language selection to its callback', async () => {
    const onGenerate = vi.fn();
    await renderPanel({ onGenerate });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    fireEvent.change(screen.getByLabelText('Ngôn ngữ giải thích'), { target: { value: 'vi' } });
    expect(onGenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^tạo gợi ý$/i }));
    expect(onGenerate).toHaveBeenCalledExactlyOnceWith({ learningLanguage: 'en', hintLanguage: 'vi' });
  });

  it('shows a short accessible status during loading while keeping both language controls available', async () => {
    const loading = state('loading', { lastSelection: defaults });
    await renderPanel({ state: loading, busy: true });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Đang tạo gợi ý. Có thể tiếp tục viết bài.');
    expect(screen.getByLabelText('Ngôn ngữ học')).toBeDisabled();
    expect(screen.getByLabelText('Ngôn ngữ giải thích')).toBeEnabled();
    expect(screen.getByRole('button', { name: /đang tạo gợi ý/i })).toBeDisabled();
  });

  it('explains a non-retriable error with an announced safe message and offers no retry control', async () => {
    await renderPanel({ state: state('error', { error: failure('quota', 'none') }) });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Thông báo lỗi an toàn.');
    expect(screen.queryByRole('button', { name: /thử lại/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^tạo gợi ý$/i })).toBeDisabled();
  });

  it('announces the classified quota reason alongside prior hints without retry or fake countdown', async () => {
    const onGenerate = vi.fn();
    const onRetry = vi.fn();
    const quota = classifyWritingHintsError({
      response: { status: 429, data: { code: 429, message: 'BACKEND_SENTINEL_QUOTA' } },
    }, 1700000000000);
    await renderPanel({
      state: state('error', { data: readyResponse, error: quota, lastSelection: defaults }),
      onGenerate, onRetry,
    });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Hạn mức sử dụng gợi ý AI của bạn đã hết hoặc chưa khả dụng.');
    expect(alert).toHaveTextContent('Chưa tạo được bộ gợi ý mới. Đang hiển thị bộ trước.');
    expect(alert).not.toHaveTextContent('BACKEND_SENTINEL_QUOTA');
    expect(alert).not.toHaveTextContent(/\d+\s*giây/);
    expect(screen.queryByRole('button', { name: /thử lại/i })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: /writing hints/i })).toBeInTheDocument();
    const create = screen.getByRole('button', { name: /^tạo gợi ý mới$/i });
    expect(create).toBeDisabled();
    fireEvent.click(create);
    expect(onGenerate).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it.each([1607, 1608])('announces the classified language reason %s with prior hints and requires confirmation', async (code) => {
    const onGenerate = vi.fn();
    const onRetry = vi.fn();
    const language = classifyWritingHintsError({
      response: { status: 422, data: { code, message: 'BACKEND_SENTINEL_LANGUAGE' } },
    }, 1700000000000);
    await renderPanel({
      state: state('error', {
        data: readyResponse, error: language,
        lastSelection: { learningLanguage: 'en', hintLanguage: 'en' },
      }),
      onGenerate, onRetry,
    });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Ngôn ngữ yêu cầu không hợp lệ hoặc chưa được hỗ trợ. Vui lòng chọn ngôn ngữ khác.');
    expect(alert).toHaveTextContent('Chưa tạo được bộ gợi ý mới. Đang hiển thị bộ trước.');
    expect(alert).not.toHaveTextContent('BACKEND_SENTINEL_LANGUAGE');
    expect(screen.queryByRole('button', { name: /thử lại/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ngôn ngữ giải thích'), { target: { value: 'vi' } });
    expect(screen.getByRole('region', { name: /writing hints/i })).toHaveAttribute('lang', 'en');
    expect(onGenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^đổi ngôn ngữ và tạo gợi ý$/i }));
    expect(screen.getByRole('group', { name: 'Xác nhận tạo gợi ý mới' })).toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^xác nhận tạo gợi ý mới$/i }));
    expect(onGenerate).toHaveBeenCalledExactlyOnceWith({ learningLanguage: 'en', hintLanguage: 'vi' });
    expect(onRetry).not.toHaveBeenCalled();
  });

  it.each(['ready', 'error'] as const)('preserves edited languages when the same operation settles as %s', async (phase) => {
    const { WritingHintsPanel } = await import('../components/practice/WritingHintsPanel');
    const onGenerate = vi.fn();
    const onRetry = vi.fn();
    const operation = { learningLanguage: 'en', hintLanguage: 'en' };
    const props = panelProps({
      state: state('loading', { lastSelection: operation }), busy: true, onGenerate, onRetry,
    });
    const { rerender } = await renderPanel(props);
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    fireEvent.change(screen.getByLabelText('Ngôn ngữ giải thích'), { target: { value: 'vi' } });
    expect(onGenerate).not.toHaveBeenCalled();
    const error = phase === 'error' ? classifyWritingHintsError(new Error('Network Error'), 1700000000000) : null;
    rerender(<WritingHintsPanel {...props} busy={false} state={state(phase, {
      data: readyResponse, error, lastSelection: { ...operation },
    })} />);
    expect(screen.getByLabelText('Ngôn ngữ học')).toHaveValue('en');
    expect(screen.getByLabelText('Ngôn ngữ giải thích')).toHaveValue('vi');
    expect(screen.getByRole('region', { name: /writing hints/i })).toHaveAttribute('lang', 'en');
    expect(onGenerate).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
    if (phase === 'error') {
      fireEvent.click(screen.getByRole('button', { name: /^thử lại$/i }));
      expect(onRetry).toHaveBeenCalledExactlyOnceWith();
      expect(onGenerate).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Ngôn ngữ học')).toHaveValue('en');
    }
    fireEvent.click(screen.getByRole('button', { name: /^tạo gợi ý mới$/i }));
    expect(onGenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^xác nhận tạo gợi ý mới$/i }));
    expect(onGenerate).toHaveBeenCalledExactlyOnceWith({ learningLanguage: 'en', hintLanguage: 'vi' });
    expect(operation).toEqual({ learningLanguage: 'en', hintLanguage: 'en' });
  });

  it('restores selection when the operation language values actually change', async () => {
    const { WritingHintsPanel } = await import('../components/practice/WritingHintsPanel');
    const onGenerate = vi.fn();
    const props = panelProps({
      state: state('ready', { data: readyResponse, lastSelection: { learningLanguage: 'en', hintLanguage: 'en' } }),
      onGenerate,
    });
    const { rerender } = await renderPanel(props);
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    fireEvent.change(screen.getByLabelText('Ngôn ngữ giải thích'), { target: { value: 'fr' } });
    rerender(<WritingHintsPanel {...props} state={state('loading', {
      data: readyResponse, lastSelection: { learningLanguage: 'de', hintLanguage: null },
    })} busy />);
    expect(screen.getByLabelText('Ngôn ngữ học')).toHaveValue('en');
    expect(screen.getByLabelText('Ngôn ngữ giải thích')).toHaveValue('');
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it.each([
    ['pending', 4], ['rate-limited', 2],
  ] as const)('shows %s backoff and blocks manual retry at %i seconds', async (kind, seconds) => {
    await renderPanel({ state: state('error', { error: failure(kind, kind === 'pending' ? 'retry' : 'none') }), retryAfterSeconds: seconds });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(`${seconds} giây`);
    const retry = screen.getByRole('button', { name: /thử lại/i });
    expect(retry).toBeDisabled();
    expect(noop).not.toHaveBeenCalled();
  });

  it('retries the prior operation only when the learner clicks retry and the cooldown is over', async () => {
    const onRetry = vi.fn();
    const prior = { learningLanguage: 'en', hintLanguage: 'vi' };
    await renderPanel({ state: state('error', { error: failure('request'), lastSelection: prior }), onRetry });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    expect(screen.getByLabelText('Ngôn ngữ học')).toHaveValue('en');
    expect(screen.getByLabelText('Ngôn ngữ giải thích')).toHaveValue('vi');
    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));
    expect(onRetry).toHaveBeenCalledExactlyOnceWith();
  });

  it('requires explicit confirmation before replacing an existing hints operation', async () => {
    const onGenerate = vi.fn();
    const prior = { learningLanguage: 'en', hintLanguage: 'vi' };
    const existing = state('ready', { data: readyResponse, lastSelection: prior });
    await renderPanel({ state: existing, onGenerate });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    fireEvent.click(screen.getByRole('button', { name: /tạo gợi ý mới/i }));
    const confirmation = screen.getByRole('group', { name: 'Xác nhận tạo gợi ý mới' });
    expect(within(confirmation).getByText('Tạo mới thành công sẽ dùng thêm một lượt trong hạn mức.')).toBeInTheDocument();
    expect(screen.getByText('Tạo mới thành công sẽ dùng thêm một lượt trong hạn mức.')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu trước có thể đã hoàn tất trên máy chủ.')).toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /xác nhận tạo gợi ý mới/i }));
    expect(onGenerate).toHaveBeenCalledExactlyOnceWith(prior);
  });

  it('shows inline language-change confirmation, keyboard-focusable actions and does not POST until confirmed', async () => {
    const onGenerate = vi.fn();
    const existing = state('ready', { data: readyResponse, lastSelection: { learningLanguage: 'en', hintLanguage: 'vi' } });
    await renderPanel({ state: existing, onGenerate });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    fireEvent.change(screen.getByLabelText('Ngôn ngữ giải thích'), { target: { value: 'de' } });
    const previousContent = screen.getByRole('region', { name: /writing hints/i });
    expect(previousContent).toHaveAttribute('lang', 'en');
    expect(within(previousContent).getByText('Ngôn ngữ gợi ý: Tiếng Anh (English)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /tạo gợi ý mới/i }));
    const confirm = screen.getByRole('button', { name: /xác nhận tạo gợi ý mới/i });
    const cancel = screen.getByRole('button', { name: /hủy/i });
    expect(confirm.tagName).toBe('BUTTON');
    confirm.focus();
    expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(confirm, { key: 'Enter', code: 'Enter' });
    confirm.click(); // jsdom needs the native button activation associated with Enter explicitly.
    fireEvent.keyUp(confirm, { key: 'Enter', code: 'Enter' });
    expect(onGenerate).toHaveBeenCalledExactlyOnceWith({ learningLanguage: 'en', hintLanguage: 'de' });
    expect(cancel.tagName).toBe('BUTTON');
  });

  it('cancels confirmation without a request and restores the previous operation selection', async () => {
    const onGenerate = vi.fn();
    const previous: WritingHintsLanguageSelection = { learningLanguage: 'en', hintLanguage: 'vi' };
    await renderPanel({ state: state('ready', { data: readyResponse, lastSelection: previous }), onGenerate });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    fireEvent.change(screen.getByLabelText('Ngôn ngữ giải thích'), { target: { value: 'fr' } });
    fireEvent.click(screen.getByRole('button', { name: /tạo gợi ý mới/i }));
    fireEvent.click(screen.getByRole('button', { name: /hủy/i }));
    expect(screen.getByLabelText('Ngôn ngữ học')).toHaveValue('en');
    expect(screen.getByLabelText('Ngôn ngữ giải thích')).toHaveValue('vi');
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('renders outline, vocabulary, limitations and prior hints as text when a new operation failed', async () => {
    const rich: WritingHintsResponse = {
      ...readyResponse,
      hintLanguage: 'fr',
      outline: readyResponse.outline.map((section, index) => index === 0
        ? { ...section, title: '<img src=x onerror=alert(1)>', points: [...section.points, '<script>bad()</script>'] }
        : section),
      vocabulary: readyResponse.vocabulary.map((item, index) => index === 0
        ? { ...item, definition: '<b>support text</b>', example: 'long ' + 'x'.repeat(1900) }
        : item),
      limitations: [...readyResponse.limitations, '<svg onload=alert(1)>'],
    };
    const existing = state('error', { data: rich, error: failure('request'), lastSelection: { learningLanguage: 'en', hintLanguage: 'vi' } });
    const { container } = await renderPanel({ state: existing });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa tạo được bộ gợi ý mới. Đang hiển thị bộ trước.');
    const region = screen.getByRole('region', { name: /writing hints/i });
    expect(region).toHaveAttribute('lang', 'fr');
    expect(within(region).getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
    expect(within(region).getByText('<script>bad()</script>')).toBeInTheDocument();
    expect(within(region).getByText('<b>support text</b>')).toBeInTheDocument();
    expect(within(region).getByText('<svg onload=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('script, img, b, svg[onload]')).toBeNull();
    expect(screen.getByText(/x{100,}/)).toBeInTheDocument();
    for (const section of rich.outline.slice(1)) {
      expect(within(region).getByRole('heading', { name: section.title })).toBeInTheDocument();
      for (const point of section.points) expect(within(region).getByText(point)).toBeInTheDocument();
    }
    for (const item of rich.vocabulary.slice(1)) {
      expect(within(region).getByText(item.term)).toBeInTheDocument();
      expect(within(region).getByText(item.definition)).toBeInTheDocument();
      expect(within(region).getByText(item.explanation)).toBeInTheDocument();
      expect(within(region).getByText(item.example)).toBeInTheDocument();
    }
    expect(within(region).getByText(readyResponse.limitations[0])).toBeInTheDocument();
    expect(screen.getByText('Gợi ý tham khảo, không phải điểm chấm hoặc bài viết mẫu.')).toBeInTheDocument();
  });

  it('labels generated content from response metadata and falls back to canonical language tags', async () => {
    const resolved: WritingHintsResponse = { ...readyResponse, learningLanguage: 'pt-BR', hintLanguage: 'pt-BR' };
    await renderPanel({ state: state('ready', { data: resolved, lastSelection: defaults }) });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    const region = screen.getByRole('region', { name: /writing hints/i });
    expect(region).toHaveAttribute('lang', 'pt-BR');
    expect(within(region).getByText('Ngôn ngữ học: pt-BR')).toBeInTheDocument();
    expect(within(region).getByText('Ngôn ngữ gợi ý: pt-BR')).toBeInTheDocument();
  });

  it('disables actions during busy, cooldown and external lock without disabling disclosure', async () => {
    const { WritingHintsPanel } = await import('../components/practice/WritingHintsPanel');
    const { rerender } = await renderPanel({ busy: true });
    fireEvent.click(screen.getByRole('button', { name: /writing hints/i }));
    expect(screen.getByRole('button', { name: /^tạo gợi ý$/i })).toBeDisabled();
    expect(screen.getByLabelText('Ngôn ngữ học')).toBeDisabled();
    rerender(<WritingHintsPanel {...panelProps({ retryAfterSeconds: 5 })} />);
    expect(screen.getByRole('button', { name: /writing hints/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^tạo gợi ý$/i })).toBeDisabled();
    rerender(<WritingHintsPanel {...panelProps({ disabled: true })} />);
    expect(screen.getByRole('button', { name: /^tạo gợi ý$/i })).toBeDisabled();
    expect(screen.getByLabelText('Ngôn ngữ học')).toBeDisabled();
    expect(screen.getByRole('button', { name: /writing hints/i })).toBeEnabled();
  });
});
