import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import EssayRenderer from '../components/renderers/EssayRenderer';
import { SubmitConfirmModal } from '../components/modals/SubmitConfirmModal';
import { useState } from 'react';
import AudioPlayer from '../components/AudioPlayer';
import LanguageSwitcher from '../../../components/common/LanguageSwitcher';

afterEach(async () => { await i18n.changeLanguage('vi'); });

describe('TV3 locale changes during input and submission', () => {
  it('translates controls while preserving the composing editor and its raw value', async () => {
    await i18n.changeLanguage('vi');
    const onChange = vi.fn();
    function Editor() {
      const [value, setValue] = useState('日本語 e\u0301 😀');
      return <EssayRenderer value={value} onChange={v => { setValue(v); onChange(v); }} learningLanguage="ja" questionText="日本語の課題" />;
    }
    render(<Editor />);
    const input = screen.getByRole('textbox');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '日本語の作文 e\u0301 😀' } });
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input).toHaveValue('日本語の作文 e\u0301 😀');
    expect(input).toHaveAttribute('placeholder', 'Write your essay here...');
    expect(onChange).toHaveBeenCalledOnce();
    fireEvent.compositionEnd(input);
  });

  it('updates a pending submit dialog without resubmitting or resetting its selected language', async () => {
    await i18n.changeLanguage('vi');
    const confirm = vi.fn();
    const change = vi.fn();
    render(<SubmitConfirmModal total={1} answered={1} isLoading onConfirm={confirm}
      feedbackLanguage={{ value: 'ja', defaultLanguage: 'vi', supportedLanguages: ['vi', 'ja'], onChange: change }} />);
    const selector = screen.getByRole('combobox');
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Confirm exam submission');
    expect(screen.getByRole('combobox')).toBe(selector);
    expect(selector).toHaveValue('ja');
    expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
    expect(confirm).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  });

  it('keeps an active audio element and playback position when the UI locale changes', async () => {
    await i18n.changeLanguage('vi');
    render(<><LanguageSwitcher /><AudioPlayer url="https://media.test/listening.mp3" isActive variant="practice" /></>);
    const audio = document.querySelector('audio')!;
    Object.defineProperty(audio, 'paused', { configurable: true, value: false });
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 18.25 });
    const originalSrc = audio.getAttribute('src');

    fireEvent.click(screen.getByRole('button', { name: 'VIE' }));
    fireEvent.click(screen.getByRole('button', { name: /English.*ENG/i }));

    expect(i18n.language).toBe('en');
    expect(document.querySelector('audio')).toBe(audio);
    expect(audio).toHaveAttribute('src', originalSrc);
    expect(audio.currentTime).toBe(18.25);
    expect(audio.paused).toBe(false);
  });
});
