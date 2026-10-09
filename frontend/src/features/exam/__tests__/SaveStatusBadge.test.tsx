import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer from '../store/answerSlice';
import { SaveStatusBadge } from '../components/SaveStatusBadge';

function renderBadge(
  saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'conflict',
  onReload?: () => void
) {
  const store = configureStore({
    reducer: { answers: answerReducer },
    preloadedState: {
      answers: {
        attemptId: 1,
        version: 1,
        answers: {},
        isDirty: false,
        lastSavedAt: null,
        saveStatus,
        pendingVersion: 0,
        flags: {},
        highlights: {},
      },
    },
  });
  return render(
    <Provider store={store}>
      <SaveStatusBadge onReload={onReload} />
    </Provider>
  );
}

describe('SaveStatusBadge', () => {
  it('không render gì khi saveStatus là idle', () => {
    const { container } = renderBadge('idle');
    expect(container.firstChild).toBeNull();
  });

  it('render Đang lưu... khi saveStatus là saving', () => {
    renderBadge('saving');
    expect(screen.getByText(/đang lưu/i)).toBeInTheDocument();
  });

  it('render Đã lưu khi saveStatus là saved', () => {
    renderBadge('saved');
    expect(screen.getByText(/đã lưu/i)).toBeInTheDocument();
  });

  it('render Đang thử lại... khi saveStatus là error', () => {
    renderBadge('error');
    expect(screen.getByText(/đang thử lại/i)).toBeInTheDocument();
  });

  it('render role="alert", thông báo phiên đã thay đổi và nút Tải lại bản mới nhất khi saveStatus là conflict', () => {
    const onReload = vi.fn();
    renderBadge('conflict', onReload);

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent(/phiên.*thay đổi/i);
    expect(screen.queryByText(/đang thử lại/i)).toBeNull();

    const reloadBtn = screen.getByRole('button', { name: /tải lại bản mới nhất/i });
    expect(reloadBtn).toBeInTheDocument();

    fireEvent.click(reloadBtn);
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
