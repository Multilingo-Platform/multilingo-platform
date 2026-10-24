import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExplanationLanguageSelect } from '../components/practice/ExplanationLanguageSelect';

describe('ExplanationLanguageSelect', () => {
  it('keeps the default choice and exposes canonical region/script options', () => {
    const onChange = vi.fn();
    render(<ExplanationLanguageSelect
      value={null}
      defaultLanguage="vi"
      supportedLanguages={['vi', 'zh-Hans-CN', 'fre', 'en_US']}
      onChange={onChange}
    />);

    const select = screen.getByRole('combobox', { name: 'Ngôn ngữ giải thích' });
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: /Mặc định \(Tiếng Việt\)/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /zh-Hans-CN/ })).toHaveValue('zh-Hans-CN');
    expect(screen.queryByRole('option', { name: 'fre' })).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'zh-Hans-CN' } });
    expect(onChange).toHaveBeenCalledWith('zh-Hans-CN');
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
