import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import UserLayout from './layouts/UserLayout';
import AdminLayout from './layouts/AdminLayout';

// Student / Public Pages
import LandingPage from './pages/student/LandingPage';
import AuthPage from './pages/student/AuthPage';
import ForgotPassword from './pages/student/ForgotPassword';
import OnboardingPage from './pages/student/OnboardingPage';
import StudentDashboard from './pages/student/Dashboard';
import ExamLibrary from './pages/student/ExamLibrary';
import TestHistory from './pages/student/TestHistory';
import MockTestEngine from './pages/student/MockTestEngine';
import ListeningPracticeEngine from './pages/student/ListeningPracticeEngine';
import WritingPracticeEngine from './pages/student/WritingPracticeEngine';
import ExamResult from './pages/student/ExamResult';
import Flashcards from './pages/student/Flashcards';
import FlashcardStudySession from './pages/student/FlashcardStudySession';
import DeckDetailView from './pages/student/flashcards/DeckDetailView';
import VocabSRSStudy from './pages/student/flashcards/VocabSRSStudy';
import VocabLearnQuiz from './pages/student/flashcards/VocabLearnQuiz';
import VocabTestMode from './pages/student/flashcards/VocabTestMode';
import VocabSpeedMatch from './pages/student/flashcards/VocabSpeedMatch';
import DictionaryView from './pages/student/DictionaryView';
import AnalyticsProgress from './pages/student/AnalyticsProgress';
import PricingCheckout from './pages/student/PricingCheckout';
import PaymentSuccess from './pages/student/PaymentSuccess';
import UserSettings from './pages/student/UserSettings';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import ExamManagement from './pages/admin/ExamManagement';
import AuditLogs from './pages/admin/AuditLogs';
import AdminBilling from './pages/admin/AdminBilling';
import SystemSettings from './pages/admin/SystemSettings';

// Prototype Tools
import ScreenFlowMap from './pages/prototype/ScreenFlowMap';
import { FigmaPrototypeBar, type DeviceMode } from './components/FigmaPrototypeBar';

import './index.css';
import './App.css';

function App() {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');

  return (
    <div className="premium-bg">
      <BrowserRouter>
        {/* Device Frame Wrapper for Figma Prototype Mode */}
        <div className={`device-wrapper mode-${deviceMode}`}>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>

            {/* Standalone Flow: Onboarding & Prototype Map */}
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/prototype-map" element={<ScreenFlowMap />} />

            {/* Focused Exam & Dedicated Vocabulary Study Engines (UC012.2 - UC012.5) */}
            <Route path="/student/exam/:id" element={<MockTestEngine />} />
            <Route path="/student/exam/:id/listening" element={<ListeningPracticeEngine />} />
            <Route path="/student/exam/:id/writing" element={<WritingPracticeEngine />} />
            <Route path="/student/flashcards/study" element={<FlashcardStudySession />} />
            <Route path="/student/flashcards/deck/:deckId/srs" element={<VocabSRSStudy />} />
            <Route path="/student/flashcards/deck/:deckId/learn" element={<VocabLearnQuiz />} />
            <Route path="/student/flashcards/deck/:deckId/test" element={<VocabTestMode />} />
            <Route path="/student/flashcards/deck/:deckId/match" element={<VocabSpeedMatch />} />

            {/* Student Logged In Layout */}
            <Route path="/student" element={<UserLayout />}>
              <Route path="dashboard" element={<StudentDashboard />} />
              <Route path="library" element={<ExamLibrary />} />
              <Route path="history" element={<TestHistory />} />
              <Route path="flashcards" element={<Flashcards />} />
              <Route path="flashcards/deck/:deckId" element={<DeckDetailView />} />
              <Route path="dictionary" element={<DictionaryView />} />
              <Route path="analytics" element={<AnalyticsProgress />} />
              <Route path="pricing" element={<PricingCheckout />} />
              <Route path="payment-success" element={<PaymentSuccess />} />
              <Route path="exam/:id/result" element={<ExamResult />} />
              <Route path="settings" element={<UserSettings />} />
            </Route>

            {/* Admin Portal Layout */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="exams" element={<ExamManagement />} />
              <Route path="audit" element={<AuditLogs />} />
              <Route path="billing" element={<AdminBilling />} />
              <Route path="settings" element={<SystemSettings />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {/* Global Figma Prototype Toolbar */}
        <FigmaPrototypeBar 
          deviceMode={deviceMode}
          onDeviceChange={setDeviceMode}
        />
      </BrowserRouter>
    </div>
  );
}

export default App;
