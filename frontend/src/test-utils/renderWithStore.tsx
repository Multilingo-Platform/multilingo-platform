import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer from '../features/exam/store/answerSlice';

export function createTestStore(preloadedState?: any) {
  return configureStore({
    reducer: { answers: answerReducer },
    preloadedState,
  });
}

export function renderWithStore(children: React.ReactNode, preloadedState?: any) {
  const store = createTestStore(preloadedState);
  return { store, element: <Provider store={store}>{children}</Provider> };
}
