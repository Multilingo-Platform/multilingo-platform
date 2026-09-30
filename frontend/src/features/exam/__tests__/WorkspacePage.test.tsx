import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer from '../store/answerSlice';
import WorkspacePage from '../pages/WorkspacePage';

vi.mock('../hooks/useWorkspace', () => ({
  default: () => ({
    workspace: {
      attempt_id: 1,
      status: 'IN_PROGRESS',
      test_mode: 'MOCK_TEST',
      deadline: new Date(Date.now() + 3600_000).toISOString(),
      exam_snapshot: { title: 'IELTS Test', sections: [] },
      version: 0,
      saved_answers: [],
    },
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

function renderPage() {
  const store = configureStore({
    reducer: { answers: answerReducer },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/attempts/1']}>
        <Routes>
          <Route path="/attempts/:attemptId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('WorkspacePage', () => {
  it('renders Timer when mode is MOCK_TEST', () => {
    renderPage();
    expect(screen.getByText(/:\d{2}$/)).toBeDefined();
  });

  it('does not crash with empty sections', () => {
    expect(() => renderPage()).not.toThrow();
  });
});
