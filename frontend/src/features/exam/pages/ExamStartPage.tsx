import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ScopeModePicker from '../components/ScopeModePicker';
import { createAttempt } from '../api/attemptApi';
import type { CreateAttemptRequest } from '../types/api.types';

const ExamStartPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (req: CreateAttemptRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const workspace = await createAttempt(req);
      navigate(`/attempts/${workspace.attempt_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tạo phiên thi. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!examId) return <div>Exam ID không hợp lệ</div>;

  return (
    <div>
      <h1>Thiết lập phiên thi</h1>
      <ScopeModePicker
        examId={parseInt(examId, 10)}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
};

export default ExamStartPage;
