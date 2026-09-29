import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useWorkspace from '../hooks/useWorkspace';

const WorkspacePage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const id = parseInt(attemptId ?? '0', 10);
  const { workspace, loading, error, retry } = useWorkspace(id);

  if (loading) {
    return <div role="status" aria-live="polite">Đang tải phiên thi...</div>;
  }

  if (error) {
    return (
      <div role="alert">
        <p>{error}</p>
        <button onClick={retry}>Thử lại</button>
        <button onClick={() => navigate('/')}>Về trang chủ</button>
      </div>
    );
  }

  if (!workspace) return null;

  if (workspace.status === 'COMPLETED') {
    navigate(`/attempts/${id}/result`);
    return null;
  }

  return (
    <div>
      <h1>{workspace.exam_snapshot.title}</h1>
      {/* WorkspaceShell will render question content here */}
      <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '400px' }}>
        {JSON.stringify(workspace.exam_snapshot, null, 2)}
      </pre>
    </div>
  );
};

export default WorkspacePage;
