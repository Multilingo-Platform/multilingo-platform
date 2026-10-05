import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AudioPlayer from '../components/AudioPlayer';

// Mock HTMLMediaElement methods (jsdom doesn't implement them)
beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
});

describe('AudioPlayer', () => {
  it('TC_WS_AUDIO_01: renders audio element with correct src', () => {
    const { container } = render(
      <AudioPlayer url="http://cdn/test.mp3" isActive={true} />
    );
    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.querySelector('source')?.getAttribute('src')).toBe('http://cdn/test.mp3');
  });

  it('TC_WS_AUDIO_02: shows fallback text when onerror fires', () => {
    const { container, getByText } = render(
      <AudioPlayer url="http://bad/broken.mp3" isActive={true} />
    );
    const audio = container.querySelector('audio')!;
    act(() => { audio.dispatchEvent(new Event('error')); });
    expect(getByText(/không thể tải audio/i)).toBeTruthy();
  });

  it('TC_WS_AUDIO_03: pause() called when isActive changes false', () => {
    const { rerender, container } = render(
      <AudioPlayer url="http://cdn/test.mp3" isActive={true} />
    );
    const audio = container.querySelector('audio')!;
    const pauseSpy = vi.spyOn(audio, 'pause');
    rerender(<AudioPlayer url="http://cdn/test.mp3" isActive={false} />);
    expect(pauseSpy).toHaveBeenCalledOnce();
  });

  it('does not crash when url changes', () => {
    const { rerender } = render(<AudioPlayer url="http://cdn/a.mp3" isActive={true} />);
    expect(() => rerender(<AudioPlayer url="http://cdn/b.mp3" isActive={true} />)).not.toThrow();
  });
});
