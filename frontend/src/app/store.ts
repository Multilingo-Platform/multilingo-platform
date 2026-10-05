import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import answerReducer from '../features/exam/store/answerSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    answers: answerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
