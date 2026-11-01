import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HtmlContent from '../components/content/HtmlContent';

describe('HtmlContent', () => {
  it('preserves an in-progress passage selection through identical HTML rerenders', () => {
    const html = '<p>Before <b>selected words</b> after</p>';
    const { container, rerender } = render(<HtmlContent html={html} prepared />);
    const text = container.querySelector('b')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 2);
    range.setEnd(text, 8);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // Timer, selection state and presentation changes must not rewrite passage DOM.
    for (let tick = 0; tick < 5; tick++) {
      rerender(<HtmlContent html={html} prepared className={`tick-${tick}`} />);
      expect(container.querySelector('b')!.firstChild).toBe(text);
      expect(selection.toString()).toBe('lected');
      expect(selection.anchorNode).toBe(text);
      expect(selection.anchorOffset).toBe(2);
    }
    rerender(<HtmlContent html='<p>New <b>passage</b></p>' prepared />);
    expect(container.textContent).toBe('New passage');
    expect(container.querySelector('b')!.firstChild).not.toBe(text);
    selection.removeAllRanges();
  });

  it('updates sanitizer policy and supports empty-to-content transitions', () => {
    const { container, rerender } = render(<HtmlContent html={null} />);
    rerender(<HtmlContent html='<p>Safe</p><audio src="/test.mp3"></audio>' stripMedia prepared />);
    expect(container.querySelector('audio')).toBeNull();
    expect(container.textContent).toBe('Safe');
    rerender(<HtmlContent html={null} />);
    expect(container.firstChild).toBeNull();
  });
  it('TC_WS_HTML_01: strips <script> tags (XSS)', () => {
    const { container } = render(
      <HtmlContent html="<p>safe</p><script>window.__xss=1</script>" />
    );
    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
  });

  it('TC_WS_HTML_02: strips onerror event handler', () => {
    const { container } = render(
      <HtmlContent html='<img src="x" onerror="window.__xss=2" />' />
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('onerror')).toBeNull();
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
  });

  it('TC_WS_HTML_03: renders valid HTML structure', () => {
    const { container } = render(
      <HtmlContent html="<h3>Title</h3><p>Para with <strong>bold</strong></p>" />
    );
    expect(container.querySelector('h3')?.textContent).toBe('Title');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('TC_WS_HTML_04: null renders nothing without crashing', () => {
    const { container } = render(<HtmlContent html={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies className to wrapper', () => {
    const { container } = render(<HtmlContent html="<p>test</p>" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });

  it('TC_WS_HTML_05: strips autoplay attribute from <video> and <audio>, sets autoplay=false, and ensures controls', () => {
    const { container } = render(
      <HtmlContent html='<div><video autoplay muted controls src="/test.mp4"></video><audio autoplay src="/test.mp3"></audio></div>' />
    );

    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.autoplay).toBe(false);
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.hasAttribute('controls')).toBe(true);

    const audio = container.querySelector('audio') as HTMLAudioElement;
    expect(audio).toBeInTheDocument();
    expect(audio.autoplay).toBe(false);
    expect(audio.hasAttribute('autoplay')).toBe(false);
    expect(audio.hasAttribute('controls')).toBe(true);
  });

  it('TC_WS_HTML_06: pauses active media on unmount', () => {
    const pauseSpy = vi.fn();
    window.HTMLMediaElement.prototype.pause = pauseSpy;

    const { unmount } = render(
      <HtmlContent html='<video controls src="/test.mp4"></video>' />
    );

    unmount();
    expect(pauseSpy).toHaveBeenCalled();
  });
});
