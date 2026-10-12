import { describe, it, expect } from 'vitest';
import { formatHtmlContent } from '../htmlUtils';

describe('formatHtmlContent', () => {
  it('returns empty string for null, undefined or empty input', () => {
    expect(formatHtmlContent(null)).toBe('');
    expect(formatHtmlContent(undefined)).toBe('');
    expect(formatHtmlContent('   ')).toBe('');
  });

  it('converts plain text single newline to <br/> and double newline to <p>', () => {
    const input = 'Line 1\nLine 2\n\nLine 3';
    const output = formatHtmlContent(input);
    expect(output).toBe('<p>Line 1<br/>Line 2</p>\n<p>Line 3</p>');
  });

  it('preserves existing block HTML while converting un-tagged text with newlines', () => {
    const input = 'Intro line 1\nIntro line 2\n\n<p style="text-align: center;"><img src="test.jpg" /></p>\n\nOutro line 1\nOutro line 2';
    const output = formatHtmlContent(input);
    expect(output).toContain('<p>Intro line 1<br/>Intro line 2</p>');
    expect(output).toContain('<p style="text-align: center;"><img src="test.jpg" /></p>');
    expect(output).toContain('<p>Outro line 1<br/>Outro line 2</p>');
  });

  it('handles inline tags like <b> or <i> within un-tagged text', () => {
    const input = 'The <b>annual report</b>\nis now ready.';
    const output = formatHtmlContent(input);
    expect(output).toBe('<p>The <b>annual report</b><br/>is now ready.</p>');
  });

  it('converts newlines inside simple <p> tags into <br/>', () => {
    const input = '<p>Paragraph line 1\nParagraph line 2</p>';
    const output = formatHtmlContent(input);
    expect(output).toBe('<p>Paragraph line 1<br/>Paragraph line 2</p>');
  });
});
