import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useDispatch, useSelector } from 'react-redux';
import { authApi } from '../features/auth/api/authApi';
import { updateUser, logout } from '../features/auth/store/authSlice';
import type { RootState } from './store';
import './App.css';

function App() {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    if (token) {
      authApi.getMyInfo()
        .then((res: any) => {
          const userData = res?.data?.id ? res.data : (res?.id ? res : res?.data);
          if (userData && (userData.id || userData.email || userData.fullName)) {
            dispatch(updateUser(userData));
          }
        })
        .catch((err: any) => {
          console.error('Không thể đồng bộ thông tin người dùng:', err);
          if (err?.response?.status === 401) {
            dispatch(logout());
          }
        });
    }
  }, [token, dispatch]);

  return (
    <RouterProvider router={router} />
  );
}

export default App;
