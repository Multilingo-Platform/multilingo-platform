import { useState } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  X,
  FileSpreadsheet,
  Layers
} from 'lucide-react';

interface ExamImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (examTitle: string) => void;
}

export const ExamImportModal = ({ isOpen, onClose, onSuccess }: ExamImportModalProps) => {
  const [fileSelected, setFileSelected] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSimulateUpload = (filename: string) => {
    setFileSelected(filename);
    setIsValidating(true);
    setTimeout(() => {
      setIsValidating(false);
      setValidationResult({
        title: 'Cambridge IELTS 19 - Academic Test 1',
        examCode: 'IELTS-CAM-19-TEST-1',
        type: 'IELTS',
        sections: [
          { skill: 'LISTENING', parts: 4, questions: 40, status: 'VALID' },
          { skill: 'READING', parts: 3, questions: 40, status: 'VALID' },
          { skill: 'WRITING', parts: 2, tasks: 2, status: 'VALID' },
        ],
        totalQuestions: 82,
        isValid: true
      });
    }, 800);
  };

  const handleConfirmImport = () => {
    onSuccess(validationResult?.title || 'Đề thi mới');
    onClose();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1.5rem' }}>
      <div className="ed-card slide-up" style={{ width: '100%', maxWidth: 620, background: 'white', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-elevated)' }}>
        
        {/* Header */}
        <div className="flex-between" style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UploadCloud size={20} color="var(--primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Import Đề Thi Từ File Chuẩn (UC14.4)
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Hỗ trợ file cấu trúc JSONB hoặc bảng tính Excel</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.75rem' }}>
          
          {/* Dropzone */}
          {!fileSelected ? (
            <div>
              <div 
                onClick={() => handleSimulateUpload('cambridge_ielts_19_test1.json')}
                style={{
                  border: '2px dashed rgba(99, 102, 241, 0.4)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  background: 'var(--primary-light)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '1.5rem'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'scale(1.01)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <UploadCloud size={46} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>
                  Kéo thả file đề thi vào đây, hoặc click để chọn file
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Hỗ trợ định dạng: <strong>.json</strong> (Khuyến nghị cấu trúc đa cấp) hoặc <strong>.xlsx</strong>
                </p>
              </div>

              {/* Sample Files Download */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  Chưa có định dạng file chuẩn?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={() => alert('Đang tải file mẫu: exam_template.json')}
                    className="btn btn-outline" 
                    style={{ fontSize: '0.78rem', padding: '4px 10px', gap: 4 }}
                  >
                    <Download size={13} /> Mẫu .JSON
                  </button>
                  <button 
                    onClick={() => alert('Đang tải file mẫu: exam_template.xlsx')}
                    className="btn btn-outline" 
                    style={{ fontSize: '0.78rem', padding: '4px 10px', gap: 4 }}
                  >
                    <Download size={13} /> Mẫu .XLSX
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* File Validated View */
            <div className="slide-up">
              {isValidating ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ width: 40, height: 40, border: '3px solid var(--border-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                  Đang phân tích cấu trúc cây câu hỏi và kiểm tra tính toàn vẹn dữ liệu...
                </div>
              ) : (
                validationResult && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem', background: '#ecfdf5', borderRadius: 12, border: '1px solid #a7f3d0', marginBottom: '1.25rem' }}>
                      <CheckCircle2 size={24} color="#10b981" />
                      <div>
                        <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.95rem' }}>
                          File Hợp Lệ 100% - Cấu Trúc Toàn Vẹn
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#047857' }}>
                          Tệp: <code>{fileSelected}</code>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 12, marginBottom: '1.5rem', fontSize: '0.88rem' }}>
                      <div className="flex-between" style={{ marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Tên đề thi nhận diện:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{validationResult.title}</strong>
                      </div>
                      <div className="flex-between" style={{ marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Mã Đề:</span>
                        <code style={{ color: 'var(--primary)' }}>{validationResult.examCode}</code>
                      </div>
                      <div className="flex-between" style={{ marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Số lượng kỹ năng & Phần thi:</span>
                        <span>{validationResult.sections.length} phần ({validationResult.totalQuestions} câu hỏi)</span>
                      </div>
                      <div className="flex-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Đáp án đúng & Lời giải:</span>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>Đã bao gồm đầy đủ</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline" onClick={() => setFileSelected(null)}>
                        Chọn File Khác
                      </button>
                      <button className="btn btn-primary" onClick={handleConfirmImport}>
                        Xác Nhận Nạp Vào Ngân Hàng Đề Thi
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
