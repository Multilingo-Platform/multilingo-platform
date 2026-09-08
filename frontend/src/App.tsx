import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import axiosClient from './api/axiosClient';
import AudioUploader from './components/AudioUploader';
import StudentExamView from './components/StudentExamView';

function App() {
  const [backendMessage, setBackendMessage] = useState<string>('Loading from backend...');

  useEffect(() => {
    // Test API connection
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
        <h1 className="text-3xl font-bold text-indigo-600 mb-4 text-center">
          Mock Test Platform
        </h1>
        <p className="text-gray-600 mb-6 text-center">
          TailwindCSS, Redux Toolkit, React Router, and Axios are successfully configured!
        </p>
        
        <div className="bg-indigo-50 p-4 rounded text-indigo-700 font-medium mb-6 text-center">
          <p className="text-sm text-gray-500 mb-1">Backend Connection Status:</p>
          {backendMessage}
        </div>

        <nav className="flex justify-center gap-4 mb-8">
          <Link to="/" className="text-indigo-600 hover:underline font-medium">Home</Link>
          <Link to="/test-audio" className="text-indigo-600 hover:underline font-medium">1. Admin Upload Audio</Link>
          <Link to="/test-student" className="text-indigo-600 hover:underline font-medium">2. Student View</Link>
        </nav>

        <Routes>
          <Route path="/" element={<div className="text-gray-400 text-sm text-center">Home Route Active</div>} />
          <Route path="/test-audio" element={<AudioUploader />} />
          <Route path="/test-student" element={<StudentExamView />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
