import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EssayRenderer from '../components/renderers/EssayRenderer';

describe('EssayRenderer multilingual length display', () => {
  it('uses CJK character count and does not show an implicit minimum for generic writing', () => {
    render(<EssayRenderer value="日本語、猫 42!" onChange={() => {}} questionText="日本語で書いてください" minWords={0} learningLanguage="ja-JP" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('lang', 'ja-JP');
    expect(screen.getByTestId('essay-word-count')).toHaveTextContent('6 ký tự');
    expect(screen.queryByText(/Yêu cầu tối thiểu/i)).not.toBeInTheDocument();
  });
});
