import React, { useState } from 'react';
import type { CreateAttemptRequest, TestMode, TestScope } from '../types/api.types';

interface ScopeModePickerProps {
  examId: number;
  onSubmit: (req: CreateAttemptRequest) => void;
  isLoading: boolean;
  error: string | null;
}

const ScopeModePicker: React.FC<ScopeModePickerProps> = ({ examId, onSubmit, isLoading, error }) => {
  const [scope, setScope] = useState<TestScope | ''>('');
  const [mode, setMode] = useState<TestMode | ''>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [partId, setPartId] = useState<string>('');

  const needsSection = scope === 'SINGLE_SKILL' || scope === 'SINGLE_PART';
  const needsPart = scope === 'SINGLE_PART';

  const isValid =
    scope !== '' &&
    mode !== '' &&
    (!needsSection || sectionId !== '') &&
    (!needsPart || partId !== '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !scope || !mode) return;
    onSubmit({
      exam_id: examId,
      test_scope: scope as TestScope,
      test_mode: mode as TestMode,
      section_id: needsSection && sectionId ? parseInt(sectionId, 10) : null,
      part_id: needsPart && partId ? parseInt(partId, 10) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Thiết lập phiên thi">
      <div>
        <label htmlFor="scope-select">Scope</label>
        <select
          id="scope-select"
          aria-label="scope"
          value={scope}
          onChange={e => { setScope(e.target.value as TestScope); setSectionId(''); setPartId(''); }}
        >
          <option value="">-- Chọn phạm vi --</option>
          <option value="FULL_EXAM">Toàn bộ đề</option>
          <option value="SINGLE_SKILL">Một kỹ năng</option>
          <option value="SINGLE_PART">Một phần</option>
        </select>
      </div>

      <div>
        <label htmlFor="mode-select">Mode</label>
        <select
          id="mode-select"
          aria-label="mode"
          value={mode}
          onChange={e => setMode(e.target.value as TestMode)}
        >
          <option value="">-- Chọn chế độ --</option>
          <option value="MOCK_TEST">Mock Test</option>
          <option value="PRACTICE">Practice</option>
        </select>
      </div>

      {needsSection && (
        <div>
          <label htmlFor="section-select">Section</label>
          <select
            id="section-select"
            aria-label="section"
            value={sectionId}
            onChange={e => { setSectionId(e.target.value); setPartId(''); }}
          >
            <option value="">-- Chọn kỹ năng --</option>
            <option value="1">Reading</option>
            <option value="2">Listening</option>
            <option value="3">Writing</option>
          </select>
        </div>
      )}

      {needsPart && (
        <div>
          <label htmlFor="part-select">Part</label>
          <select
            id="part-select"
            aria-label="part"
            value={partId}
            onChange={e => setPartId(e.target.value)}
          >
            <option value="">-- Chọn phần --</option>
            <option value="1">Part 1</option>
            <option value="2">Part 2</option>
            <option value="3">Part 3</option>
          </select>
        </div>
      )}

      {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}

      <button type="submit" disabled={!isValid || isLoading}>
        {isLoading ? 'Đang tạo...' : 'Bắt đầu'}
      </button>
    </form>
  );
};

export default ScopeModePicker;
