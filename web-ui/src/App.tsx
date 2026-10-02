import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import UserLayout from './layouts/UserLayout';
import AdminLayout from './layouts/AdminLayout';
import LandingPage from './pages/student/LandingPage';
import AuthPage from './pages/student/AuthPage';
import OnboardingPage from './pages/student/OnboardingPage';
import StudentDashboard from './pages/student/Dashboard';
import ExamLibrary from './pages/student/ExamLibrary';
import MockTestEngine from './pages/student/MockTestEngine';
import ExamResult from './pages/student/ExamResult';
import Flashcards from './pages/student/Flashcards';
import UserSettings from './pages/student/UserSettings';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import ExamManagement from './pages/admin/ExamManagement';
import './index.css';
import './App.css';

function App() {
  return (
    <div className="premium-bg">
      <BrowserRouter>
        <Routes>
          {/* Public Routes (Landing, Login) */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
          </Route>

          {/* Standalone Onboarding & Exam Engine */}
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/student/exam/:id" element={<MockTestEngine />} />

          {/* Student Routes (Logged In) */}
          <Route path="/student" element={<UserLayout />}>
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="library" element={<ExamLibrary />} />
            <Route path="flashcards" element={<Flashcards />} />
            <Route path="exam/:id/result" element={<ExamResult />} />
            <Route path="settings" element={<UserSettings />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="exams" element={<ExamManagement />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
