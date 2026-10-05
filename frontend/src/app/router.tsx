import React, { useEffect, useState } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './store';
import axiosClient from '../core/api/axiosClient';

import AudioUploader from '../components/common/AudioUploader';
import StudentExamView from '../features/exams/components/StudentExamView';

// --- MEMBER 2 PAGES & LAYOUTS ---
import PublicLayout from '../components/layout/PublicLayout';
import UserLayout from '../components/layout/UserLayout';
import AdminLayout from '../components/layout/AdminLayout';
import OnboardingPage from '../features/onboarding/pages/student/OnboardingPage';
import ExamLibrary from '../features/exams/pages/student/ExamLibrary';
import TestHistory from '../features/history/pages/student/TestHistory';
import ExamManagement from '../features/exams/pages/admin/ExamManagement';
import ExamBuilderPage from '../features/exams/pages/admin/ExamBuilderPage';

import LandingPage from '../features/public/pages/LandingPage';
import LoginPage from '../features/auth/pages/LoginPage';
import RegisterPage from '../features/auth/pages/RegisterPage';

// Component Wrapper cho trang chủ (Landing Page)
const RootRoute = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  if (isAuthenticated) {
    return <UserLayout />;
  }

  // Nếu chưa đăng nhập, hiển thị PublicLayout (giao diện public)
  return <PublicLayout />;
};

// Component phụ cho Dev Route để lấy backend status
const DevTestRoute = () => {
  const [backendMessage, setBackendMessage] = useState<string>('Loading from backend...');

  useEffect(() => {
    axiosClient.get('/test/hello')
      .then((res: any) => {
        setBackendMessage(res.message || 'Connected successfully!');
      })
      .catch((err) => {
        console.error(err);
        setBackendMessage('Failed to connect to backend.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-indigo-600 mb-4 text-center">Dev Test Route</h1>
        <div className="bg-indigo-50 p-4 rounded text-indigo-700 font-medium mb-6 text-center">
          Backend Status: {backendMessage}
        </div>
        <nav className="flex justify-center gap-4 mb-8">
          <Link to="/dev/test-audio" className="text-indigo-600 hover:underline font-medium">Upload Audio</Link>
          <Link to="/dev/test-student" className="text-indigo-600 hover:underline font-medium">Student View</Link>
          <Link to="/onboarding" className="text-green-600 hover:underline font-bold">Go to App</Link>
        </nav>
      </div>
    </div>
  );
};

export const router = createBrowserRouter([
  // --- CHÍNH THỨC: MEMBER 2 ROUTES ---
  {
    path: '/',
    element: <RootRoute />,
    children: [
      {
        index: true,
        element: <LandingPage /> // Gọi Component LandingPage khi vào /
      },
      {
        path: 'exams', // URL sẽ là /exams (Nằm trong Public Layout)
        element: <ExamLibrary /> // Gọi Component hiển thị Đề Thi
      }
      // Các route public khác (như /about) sẽ nằm ở đây
    ]
  },
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/register',
    element: <RegisterPage />
  },
  {
    path: '/onboarding',
    element: <OnboardingPage />
  },

  // --- MÀN HÌNH STUDENT ---
  {
    path: '/student',
    element: <UserLayout />,
    // Thêm errorElement ở đây sau này: errorElement: <StudentErrorBoundary />,
    children: [
      {
        path: 'library',
        element: <ExamLibrary />,
      },
      {
        path: 'history',
        element: <TestHistory />,
      },
      {
        path: 'dashboard',
        element: <div className="container"><h1 style={{ fontSize: '2rem', marginTop: '2rem' }}>Tính năng của Thành viên 5 (Dashboard)</h1></div>
      },
      {
        path: 'flashcards',
        element: <div className="container"><h1 style={{ fontSize: '2rem', marginTop: '2rem' }}>Tính năng của Thành viên 5 (Flashcards)</h1></div>
      },
      {
        path: 'settings',
        element: <div className="container"><h1 style={{ fontSize: '2rem', marginTop: '2rem' }}>Tính năng của Thành viên 1 (Settings)</h1></div>
      }
    ]
  },

  // --- MÀN HÌNH ADMIN ---
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/admin/exams" replace />
      },
      {
        path: 'exams',
        element: <ExamManagement />,
      },
      {
        path: 'exams/create',
        element: <ExamBuilderPage />,
      },
      {
        path: 'dashboard',
        element: <div className="container"><h1 style={{ fontSize: '2rem', marginTop: '2rem' }}>Tính năng Admin Dashboard</h1></div>
      },
      {
        path: 'users',
        element: <div className="container"><h1 style={{ fontSize: '2rem', marginTop: '2rem' }}>Tính năng Quản lý Người dùng</h1></div>
      }
    ]
  },

  // --- DEV / TEST ROUTES (Tạm thời giữ lại) ---
  {
    path: '/dev',
    element: <Outlet />,
    children: [
      {
        index: true,
        element: <DevTestRoute />
      },
      {
        path: 'test-audio',
        element: <AudioUploader />
      },
      {
        path: 'test-student',
        element: <StudentExamView />
      }
    ]
  }
]);
