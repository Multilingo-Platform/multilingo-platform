import { configureStore } from '@reduxjs/toolkit';
import answerReducer from '../features/exam/store/answerSlice';

export const store = configureStore({
  reducer: {
    answers: answerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
