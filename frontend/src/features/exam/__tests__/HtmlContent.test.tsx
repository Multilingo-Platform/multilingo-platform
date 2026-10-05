import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HtmlContent from '../components/content/HtmlContent';

describe('HtmlContent', () => {
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
});
