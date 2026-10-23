import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import ScopeModePicker from '../components/ScopeModePicker';
import { createAttempt } from '../api/attemptApi';
import { getExamStructure } from '../api/examApi';
import type {
  CreateAttemptRequest,
  LearnerExamStructure,
  TestMode,
  TestScope,
} from '../types/api.types';

const VALID_MODES: TestMode[] = ['MOCK_TEST', 'PRACTICE'];
const VALID_SCOPES: TestScope[] = ['FULL_EXAM', 'SINGLE_SKILL', 'SINGLE_PART'];

const ExamStartPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [structure, setStructure] = useState<LearnerExamStructure | null>(null);
  const [structureLoading, setStructureLoading] = useState(true);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDecimalString = !!examId && /^[1-9]\d*$/.test(examId);
  const parsedId = isDecimalString ? Number(examId) : null;
  const isValidExamId = parsedId !== null && Number.isSafeInteger(parsedId) && parsedId <= 2147483647;
  const numericExamId = isValidExamId ? parsedId : null;

  const rawMode = searchParams.get('mode');
  const rawScope = searchParams.get('scope');

  const initialMode: TestMode | undefined =
    rawMode && VALID_MODES.includes(rawMode as TestMode) ? (rawMode as TestMode) : undefined;
  const initialScope: TestScope | undefined =
    rawScope && VALID_SCOPES.includes(rawScope as TestScope) ? (rawScope as TestScope) : undefined;

  useEffect(() => {
    if (!isValidExamId || numericExamId === null) {
      setStructureLoading(false);
      return;
    }

    let isCancelled = false;
    setStructureLoading(true);
    setStructureError(null);

    getExamStructure(numericExamId)
      .then((data) => {
        if (!isCancelled) {
          setStructure(data);
          setStructureLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setStructureError(
            err instanceof Error ? err.message : 'Không thể tải cấu trúc đề thi. Vui lòng thử lại.'
          );
          setStructureLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isValidExamId, numericExamId, retryCount]);

  const handleRetry = () => {
    if (!isValidExamId || numericExamId === null) return;
    setRetryCount((c) => c + 1);
  };

  const handleSubmit = async (req: CreateAttemptRequest) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const workspace = await createAttempt(req);
      navigate(`/attempts/${workspace.attempt_id}`);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Không thể tạo phiên thi. Vui lòng thử lại.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isValidExamId || numericExamId === null) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div role="alert" style={{ color: '#ef4444', fontWeight: 600 }}>
          Exam ID không hợp lệ (Phải là số nguyên dương)
        </div>
      </div>
    );
  }

  if (structureLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div role="status" style={{ color: '#4b5563', fontWeight: 600 }}>
          Đang tải thông tin đề thi...
        </div>
      </div>
    );
  }

  if (structureError) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <div role="alert" style={{ color: '#ef4444', fontWeight: 600 }}>
          {structureError}
        </div>
        <button
          type="button"
          onClick={handleRetry}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            background: '#d97706',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  const totalSections = structure?.sections?.length || 0;
  const totalParts = structure?.sections?.reduce((acc, s) => acc + (s.parts?.length || 0), 0) || 0;

  return (
    <div className="w-full bg-slate-50 min-h-screen pt-8">
      {/* Main Form Container */}
      <main className="max-w-6xl mx-auto px-4 pb-12 w-full flex flex-col gap-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-amber-600 transition-colors w-fit" style={{ textDecoration: 'none' }}>
          ⬅ Quay lại Trang chủ
        </Link>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Overview & Rules */}
          <div className="lg:col-span-7 space-y-6">
            {/* Exam Overview Banner */}
            <div className="ed-card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <span className="badge-orange">
                  Mã đề: {structure?.code}
                </span>
                <span className="badge-green">
                  {structure?.type}
                </span>
                {structure?.examLanguage && (
                  <span className="badge-orange" aria-label="Ngôn ngữ đề">
                    Ngôn ngữ: {structure.examLanguage}
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>
                  Chuẩn Format CBT Quốc tế
                </span>
              </div>

              <h1 style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: '1.75rem',
                color: '#111827',
                marginBottom: '0.75rem',
                letterSpacing: '-0.01em',
              }}>
                {structure?.title}
              </h1>
              <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Bài thi trực tuyến theo chuẩn định dạng bài thi.
              </p>

              {/* Quick Info Grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem',
                padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', border: '1px solid #e5e7eb',
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>⏱️ Thời lượng</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
                    {structure?.durationMinutes ? `${structure.durationMinutes} phút` : 'Tính theo phạm vi đề'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>📖 Cấu trúc</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
                    {totalSections} kỹ năng ({totalParts} part)
                  </div>
                </div>
              </div>

              {totalSections === 0 && (
                <div role="status" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', color: '#6b7280', fontStyle: 'italic', textAlign: 'center' }}>
                  Đề thi chưa có phần thi nào.
                </div>
              )}
            </div>

            {/* Important Rules & Instructions */}
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '1rem',
              padding: '1.25rem 1.5rem',
              color: '#92400e',
              fontSize: '0.875rem',
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>💡</span> Lưu ý quan trọng khi làm bài:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <li><strong>Chế độ Mock Test (Toàn bộ đề):</strong> Không thể tạm dừng. Bạn phải làm bài theo trình tự. Sau khi hoàn thành một phần và chuyển tiếp, phần thi đó sẽ <strong>BỊ KHÓA</strong> vĩnh viễn và bạn không thể quay lại.</li>
                <li><strong>Autosave:</strong> Tự động lưu bài làm liên tục vào máy chủ đám mây.</li>
                <li><strong>Tra từ tại chỗ:</strong> Bôi đen từ vựng trong bài đọc để tra cứu phiên âm, nghĩa tiếng Việt và lưu Flashcard (chỉ khả dụng trong chế độ Practice).</li>
                <li><strong>Giữ nguyên tab:</strong> Bạn có thể tải lại trang (F5), bài làm và thời gian còn lại sẽ được khôi phục. Tải lại trang có thể làm gián đoạn bài một chút.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Settings Picker */}
          <div className="lg:col-span-5">
            <div className="ed-card lg:sticky lg:top-24 flex flex-col overflow-hidden" style={{ padding: '0', maxHeight: 'calc(100vh - 120px)' }}>
              {totalSections > 0 ? (
                <ScopeModePicker
                  examId={numericExamId}
                  sections={structure?.sections || []}
                  initialMode={initialMode}
                  initialScope={initialScope}
                  onSubmit={handleSubmit}
                  isLoading={isSubmitting}
                  error={submitError}
                />
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
                  Không thể bắt đầu vì đề thi chưa có cấu trúc phần thi.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExamStartPage;
