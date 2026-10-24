import React from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "./store";
import StudentExamView from "../features/exams/components/StudentExamView";

// --- CBT EXAM PAGES ---
import ExamStartPage from "../features/exam/pages/ExamStartPage";
import WorkspacePage from "../features/exam/pages/WorkspacePage";
import ExamResultPage from "../features/exam/pages/ExamResultPage";
import ExamReviewPage from "../features/exam/pages/ExamReviewPage";

// --- MEMBER 2 PAGES & LAYOUTS ---
import PublicLayout from "../components/layout/PublicLayout";
import UserLayout from "../components/layout/UserLayout";
import AdminLayout from "../components/layout/AdminLayout";
import OnboardingPage from "../features/onboarding/pages/student/OnboardingPage";
import ExamLibrary from "../features/exams/pages/student/ExamLibrary";
import TestHistory from "../features/history/pages/student/TestHistory";
import ExamManagement from "../features/exams/pages/admin/ExamManagement";
import ExamBuilderPage from "../features/exams/pages/admin/ExamBuilderPage";
import AdminPremiumPage from "../features/admin/premium/pages/AdminPremiumPage";
import AdminDashboardPage from "../features/admin/dashboard/pages/AdminDashboardPage";
import UserManagementPage from "../features/admin/users/pages/UserManagementPage";
import TrackingAnalyticsPage from "../features/admin/tracking/pages/TrackingAnalyticsPage";
import QuotaSettingsPage from "../features/admin/quotas/pages/QuotaSettingsPage";
import AuditLogPage from "../features/admin/audit/pages/AuditLogPage";
import TransactionReconciliationPage from "../features/admin/transactions/pages/TransactionReconciliationPage";

import LandingPage from "../features/public/pages/LandingPage";
import LoginPage from "../features/auth/pages/LoginPage";
import RegisterPage from "../features/auth/pages/RegisterPage";
import ForgotPasswordPage from "../features/auth/pages/ForgotPasswordPage";
import { SettingsPage } from "../features/auth/pages/SettingsPage";
import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import { FlashcardsPage } from "../features/vocab";
import PremiumUpgradePage from "../features/premium/pages/PremiumUpgradePage";
import PaymentResultPage from "../features/premium/pages/PaymentResultPage";
import PurchaseHistoryPage from "../features/premium/pages/PurchaseHistoryPage";
import StudentDashboardPage from "../features/student/dashboard/pages/StudentDashboardPage";

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
    path: "/",
    element: <RootRoute />,
    children: [
      {
        index: true,
        element: <LandingPage />, // Gọi Component LandingPage khi vào /
      },
      {
        path: "exams", // URL sẽ là /exams (Nằm trong Public Layout)
        element: <ExamLibrary />, // Gọi Component hiển thị Đề Thi
      },
      // Các route public khác (như /about) sẽ nằm ở đây
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/auth",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/onboarding",
    element: <OnboardingPage />,
  },
  {
    path: "/flashcards",
    element: <Navigate to="/student/flashcards" replace />,
  },

  // --- MÀN HÌNH STUDENT ---
  {
    path: "/student",
    element: <ProtectedRoute allowedRoles={["USER", "ADMIN"]} />,
    children: [
      {
        element: <UserLayout />,
        children: [
          {
            path: "library",
            element: <ExamLibrary />,
          },
          {
            path: "history",
            element: <TestHistory />,
          },
          {
            path: "dashboard",
            element: <StudentDashboardPage />,
          },
          {
            path: "flashcards",
            element: <FlashcardsPage />,
          },
          {
            path: "settings",
            element: <SettingsPage />,
          },
          {
            path: "premium",
            element: <PremiumUpgradePage />,
          },
          {
            path: "payment/result",
            element: <PaymentResultPage />,
          },
          {
            path: "purchase-history",
            element: <PurchaseHistoryPage />,
          },
        ],
      },
    ],
  },

  // --- MÀN HÌNH ADMIN ---
  {
    path: "/admin",
    element: <ProtectedRoute allowedRoles={["ADMIN"]} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/admin/dashboard" replace />,
          },
          {
            path: "dashboard",
            element: <AdminDashboardPage />,
          },
          {
            path: "users",
            element: <UserManagementPage />,
          },
          {
            path: "tracking",
            element: <TrackingAnalyticsPage />,
          },
          {
            path: "transactions",
            element: <TransactionReconciliationPage />,
          },
          {
            path: "quotas",
            element: <QuotaSettingsPage />,
          },
          {
            path: "settings",
            element: <QuotaSettingsPage />,
          },
          {
            path: "audit",
            element: <AuditLogPage />,
          },
          {
            path: "exams",
            element: <ExamManagement />,
          },
          {
            path: "exams/create",
            element: <ExamBuilderPage />,
          },
          {
            path: "exams/edit/:id",
            element: <ExamBuilderPage />,
          },
          {
            path: "premium",
            element: <AdminPremiumPage />,
          },
        ],
      },
    ],
  },

  // --- DEV / TEST ROUTES (Tạm thời giữ lại) ---

  // --- CBT EXAM ROUTES (PROTECTED) ---
  {
    element: <Outlet />,
    children: [
      {
        path: "/exams/:examId/start",
        element: <UserLayout />,
        children: [{ index: true, element: <ExamStartPage /> }],
      },
      {
        path: "/student/exam/:examId",
        element: <UserLayout />,
        children: [{ index: true, element: <ExamStartPage /> }],
      },
      {
        path: "/attempts/:attemptId",
        element: <WorkspacePage />,
      },
      {
        path: "/attempts/:attemptId/result",
        element: <UserLayout />,
        children: [{ index: true, element: <ExamResultPage /> }],
      },
      {
        path: "/attempts/:attemptId/review",
        element: <UserLayout />,
        children: [{ index: true, element: <ExamReviewPage /> }],
      },
    ],
  },
]);
