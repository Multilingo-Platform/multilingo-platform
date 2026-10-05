import React, { useEffect, useState } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './store';
import axiosClient from '../core/api/axiosClient';

import AudioUploader from '../components/common/AudioUploader';
import StudentExamView from '../features/exams/components/StudentExamView';

// --- CBT EXAM PAGES ---
import ExamStartPage from '../features/exam/pages/ExamStartPage';
import WorkspacePage from '../features/exam/pages/WorkspacePage';
import ExamResultPage from '../features/exam/pages/ExamResultPage';
import ExamReviewPage from '../features/exam/pages/ExamReviewPage';

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
import { SettingsPage } from '../features/auth/pages/SettingsPage';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';
import Flashcards from '../pages/student/Flashcards';

// Component Wrapper cho trang chủ (Landing Page)
const RootRoute = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  if (isAuthenticated) {
    return <UserLayout />;
  }

  // Nếu chưa đăng nhập, hiển thị PublicLayout (giao diện public)
  return <PublicLayout />;
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
  {
    path: '/flashcards',
    element: <Navigate to="/student/flashcards" replace />
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
        element: <Flashcards />
      },
      {
        path: 'settings',
        element: <SettingsPage />
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
  
  // --- CBT EXAM ROUTES (PROTECTED) ---
  {
    element: <Outlet />,
    children: [
      {
        path: '/exams/:examId/start',
        element: <UserLayout />,
        children: [{ index: true, element: <ExamStartPage /> }]
      },
      {
        path: '/student/exam/:examId',
        element: <UserLayout />,
        children: [{ index: true, element: <ExamStartPage /> }]
      },
      {
        path: '/attempts/:attemptId',
        element: <WorkspacePage />
      },
      {
        path: '/attempts/:attemptId/result',
        element: <UserLayout />,
        children: [{ index: true, element: <ExamResultPage /> }]
      },
      {
        path: '/attempts/:attemptId/review',
        element: <UserLayout />,
        children: [{ index: true, element: <ExamReviewPage /> }]
      }
    ]
  }
]);
