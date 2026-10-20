import React from 'react';
import { render, act, fireEvent, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AudioPlayer from '../components/AudioPlayer';

// Mock HTMLMediaElement methods (jsdom doesn't implement them)
beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
});
afterEach(() => cleanup());

function audioOf(container: HTMLElement): HTMLAudioElement {
  const audio = container.querySelector('audio');
  expect(audio, 'expected exactly one media element').not.toBeNull();
  return audio as HTMLAudioElement;
}

describe('AudioPlayer', () => {
  it('TC_WS_AUDIO_01: renders exactly one media element with the given source', () => {
    const { container } = render(<AudioPlayer url="http://cdn/test.mp3" isActive={true} />);
    expect(container.querySelectorAll('audio')).toHaveLength(1);
    expect(audioOf(container).getAttribute('src')).toBe('http://cdn/test.mp3');
  });

  it('TC_WS_AUDIO_02: shows fallback text when onerror fires', () => {
    const { container, getByText } = render(
      <AudioPlayer url="http://bad/broken.mp3" isActive={true} />
    );
    act(() => { audioOf(container).dispatchEvent(new Event('error')); });
    expect(getByText(/không thể tải audio/i)).toBeTruthy();
  });

  it('TC_WS_AUDIO_03: pause() called when isActive changes false', () => {
    const { rerender } = render(
      <AudioPlayer url="http://cdn/test.mp3" isActive={true} />
    );
    const pauseMock = window.HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>;
    pauseMock.mockClear();
    rerender(<AudioPlayer url="http://cdn/test.mp3" isActive={false} />);
    expect(pauseMock).toHaveBeenCalledOnce();
  });

  it('TC_WS_AUDIO_04: stops the previous source before switching URL', () => {
    const { rerender, container } = render(<AudioPlayer url="http://cdn/a.mp3" isActive={true} />);
    const audio = audioOf(container);
    audio.currentTime = 5;
    const pauseSpy = vi.spyOn(audio, 'pause');
    const loadSpy = vi.spyOn(audio, 'load');
    rerender(<AudioPlayer url="http://cdn/b.mp3" isActive={true} />);
    expect(pauseSpy).toHaveBeenCalled();
    expect(loadSpy).toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
    expect(audioOf(container).getAttribute('src')).toBe('http://cdn/b.mp3');
  });

  it('TC_WS_AUDIO_05: Practice exposes rewind-10s and speed controls and applies the rate', () => {
    const onRewind = vi.fn();
    const onSpeedChange = vi.fn();
    const { container, getByRole, getByLabelText } = render(
      <AudioPlayer
        url="http://cdn/practice.mp3"
        isActive={true}
        variant="practice"
        speed={1.5}
        canRewind={true}
        onRewind={onRewind}
        onSpeedChange={onSpeedChange}
      />
    );
    fireEvent.click(getByRole('button', { name: /tua lại 10 giây/i }));
    expect(onRewind).toHaveBeenCalledOnce();
    fireEvent.change(getByLabelText(/tốc độ phát/i), { target: { value: '2' } });
    expect(onSpeedChange).toHaveBeenCalledWith(2);
    expect(audioOf(container).playbackRate).toBe(1.5);
  });

  it('TC_WS_AUDIO_06: Mock/server mode hides native controls, seek, replay and download', () => {
    const { container, queryByRole } = render(
      <AudioPlayer url="http://cdn/server.mp3" isActive={true} variant="server" />
    );
    const audio = audioOf(container);
    expect(audio.controls).toBe(false);
    expect(audio.hasAttribute('controls')).toBe(false);
    expect(audio.getAttribute('controlslist')).toContain('nodownload');
    expect(queryByRole('button', { name: /tua lại/i })).toBeNull();
    expect(queryByRole('combobox')).toBeNull();
  });

  it('TC_WS_AUDIO_07: blocked autoplay shows a safe continue action', () => {
    const onResume = vi.fn();
    render(
      <AudioPlayer url="http://cdn/server.mp3" isActive={true} variant="server" blocked={true} onResume={onResume} />
    );
    expect(screen.getByText(/chặn tự động phát/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục/i }));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it('TC_WS_AUDIO_08: stalled media shows buffering and recovers without losing the element', () => {
    const { container, queryByRole } = render(
      <AudioPlayer url="http://cdn/server.mp3" isActive={true} variant="server" />
    );
    const audio = audioOf(container);
    act(() => { audio.dispatchEvent(new Event('waiting')); });
    expect(queryByRole('status')).not.toBeNull();
    act(() => { audio.dispatchEvent(new Event('playing')); });
    expect(queryByRole('status')).toBeNull();
    expect(container.querySelectorAll('audio')).toHaveLength(1);
  });

  it('TC_WS_AUDIO_09: recovers from a load error when the URL changes', () => {
    const { rerender, container, queryByText } = render(
      <AudioPlayer url="http://bad/a.mp3" isActive={true} />
    );
    act(() => { audioOf(container).dispatchEvent(new Event('error')); });
    expect(queryByText(/không thể tải audio/i)).not.toBeNull();
    rerender(<AudioPlayer url="http://good/b.mp3" isActive={true} />);
    expect(queryByText(/không thể tải audio/i)).toBeNull();
    expect(container.querySelectorAll('audio')).toHaveLength(1);
    expect(audioOf(container).getAttribute('src')).toBe('http://good/b.mp3');
  });

  it('TC_WS_AUDIO_10: does not crash when url changes', () => {
    const { rerender } = render(<AudioPlayer url="http://cdn/a.mp3" isActive={true} />);
    expect(() => rerender(<AudioPlayer url="http://cdn/b.mp3" isActive={true} />)).not.toThrow();
  });

  it('TWR-F6: hands the same element to a replacement callback without resetting the source', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container, rerender, unmount } = render(<AudioPlayer url="https://media.test/one.mp3" isActive mediaRef={first} />);
    const audio = audioOf(container);
    audio.currentTime = 8;
    const load = vi.mocked(audio.load);
    load.mockClear();
    rerender(<AudioPlayer url="https://media.test/one.mp3" isActive mediaRef={second} />);
    expect(first).toHaveBeenLastCalledWith(null);
    expect(second).toHaveBeenLastCalledWith(audio);
    expect(audio.currentTime).toBe(8);
    expect(load).not.toHaveBeenCalled();
    unmount();
    expect(second).toHaveBeenLastCalledWith(null);
  });

});
