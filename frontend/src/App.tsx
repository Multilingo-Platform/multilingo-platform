import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';
import axiosClient from './api/axiosClient';
import AudioUploader from './components/AudioUploader';
import StudentExamView from './components/StudentExamView';

// --- MEMBER 2 PAGES & LAYOUTS ---
import UserLayout from './layouts/UserLayout';
import AdminLayout from './layouts/AdminLayout';
import OnboardingPage from './pages/student/OnboardingPage';
import ExamLibrary from './pages/student/ExamLibrary';
import TestHistory from './pages/student/TestHistory';
import ExamManagement from './pages/admin/ExamManagement';
import ExamBuilderPage from './pages/admin/ExamBuilderPage';

function App() {
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
    <>
      <Routes>
        {/* --- DEV / TEST ROUTES (Tạm thời giữ lại) --- */}
        <Route path="/dev" element={
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
        } />
        <Route path="/dev/test-audio" element={<AudioUploader />} />
        <Route path="/dev/test-student" element={<StudentExamView />} />

        {/* --- CHÍNH THỨC: MEMBER 2 ROUTES --- */}
        <Route path="/" element={<Navigate to="/onboarding" replace />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Màn hình Student */}
        <Route path="/student" element={<UserLayout />}>
          <Route path="library" element={<ExamLibrary />} />
          <Route path="history" element={<TestHistory />} />
          <Route path="dashboard" element={<div className="container"><h1 style={{fontSize: '2rem', marginTop: '2rem'}}>Tính năng của Thành viên 5 (Dashboard)</h1></div>} />
          <Route path="flashcards" element={<div className="container"><h1 style={{fontSize: '2rem', marginTop: '2rem'}}>Tính năng của Thành viên 5 (Flashcards)</h1></div>} />
          <Route path="settings" element={<div className="container"><h1 style={{fontSize: '2rem', marginTop: '2rem'}}>Tính năng của Thành viên 1 (Settings)</h1></div>} />
        </Route>

        {/* Màn hình Admin */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="" element={<Navigate to="/admin/exams" replace />} />
          <Route path="exams" element={<ExamManagement />} />
          <Route path="exams/create" element={<ExamBuilderPage />} />
          <Route path="dashboard" element={<div className="container"><h1 style={{fontSize: '2rem', marginTop: '2rem'}}>Tính năng Admin Dashboard</h1></div>} />
          <Route path="users" element={<div className="container"><h1 style={{fontSize: '2rem', marginTop: '2rem'}}>Tính năng Quản lý Người dùng</h1></div>} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
