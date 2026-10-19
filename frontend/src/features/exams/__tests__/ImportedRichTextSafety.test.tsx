import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import RichTextEditor from '../../../components/common/RichTextEditor';

it('sanitizes imported rich text at preview without changing the stored source', () => {
  const onChange = vi.fn();
  const { container } = render(<RichTextEditor value={'<p>Đoạn đọc</p><img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">Link</a>'} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: /xem trước/i }));
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('[onerror]')).toBeNull();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(screen.getByText('Đoạn đọc')).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});
