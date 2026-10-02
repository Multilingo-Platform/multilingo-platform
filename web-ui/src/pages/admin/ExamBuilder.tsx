import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Save, AlignLeft, Settings, Image, Music, Zap } from 'lucide-react';

interface QuestionMetadata {
  options?: string[];
  correct_answer: string | string[];
  explanation?: string;
}

interface Question {
  question_id: string;
  type: string;
  question_text: string;
  metadata: QuestionMetadata;
}

interface QuestionGroup {
  group_id: string;
  instruction: string;
  content_html: string;
  shared_audio?: { url: string; duration_seconds?: number };
  shared_media?: { type: 'image'; url: string; display_config?: { size_preset: string; alignment: string } };
  questions: Question[];
}

interface ExamPart {
  part_title: string;
  instruction: string;
  shared_audio?: { url: string; duration_seconds?: number };
  shared_content_html?: string;
  question_groups: QuestionGroup[];
}

const QUESTION_TYPES = [
  { value: 'MULTIPLE_CHOICE', label: 'Trắc nghiệm 1 Đáp án' },
  { value: 'MULTIPLE_CHOICE_MULTI', label: 'Trắc nghiệm Nhiều Đáp án' },
  { value: 'FILL_IN_THE_BLANKS', label: 'Điền vào chỗ trống' },
  { value: 'TRUE_FALSE_NOT_GIVEN', label: 'True / False / Not Given' },
  { value: 'YES_NO_NOT_GIVEN', label: 'Yes / No / Not Given' },
  { value: 'MATCHING_HEADINGS', label: 'Matching Headings' },
  { value: 'MATCHING_FEATURES', label: 'Matching Features' },
  { value: 'MAP_LABELING', label: 'Map Labeling' },
  { value: 'DIAGRAM_LABELING', label: 'Diagram Labeling' },
  { value: 'ESSAY', label: 'Viết tự luận (Essay)' }
];

const ExamBuilder = ({ onSave, onCancel }: { onSave: (json: string) => void, onCancel: () => void }) => {
  const [examTitle, setExamTitle] = useState('Đề thi Mới');
  const [examType, setExamType] = useState('IELTS_ACADEMIC');
  const [parts, setParts] = useState<ExamPart[]>([]);
  const [expandedParts, setExpandedParts] = useState<Record<string, boolean>>({});

  // Local state for batch generation
  const [batchSettings, setBatchSettings] = useState<Record<string, { type: string; start: number; end: number }>>({});

  const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 6)}`;

  // --- FULL TEMPLATE GENERATORS ---
  const applyTemplate = (type: 'IELTS' | 'TOEIC' | 'TOEIC_WRITING' | 'VSTEP') => {
    if (parts.length > 0 && !window.confirm(`Áp dụng Template ${type} sẽ xóa toàn bộ nội dung hiện tại. Bạn có chắc chắn?`)) return;

    const newParts: ExamPart[] = [];
    
    if (type === 'IELTS') {
      setExamType('IELTS_ACADEMIC');
      setExamTitle('IELTS Academic Mock Test');
      
      // Listening
      newParts.push({ part_title: 'Listening Part 1', instruction: 'Listen and answer questions 1-10', shared_audio: { url: '' }, question_groups: [] });
      newParts.push({ part_title: 'Listening Part 2', instruction: 'Listen and answer questions 11-20', shared_audio: { url: '' }, question_groups: [] });
      newParts.push({ part_title: 'Listening Part 3', instruction: 'Listen and answer questions 21-30', shared_audio: { url: '' }, question_groups: [] });
      newParts.push({ part_title: 'Listening Part 4', instruction: 'Listen and answer questions 31-40', shared_audio: { url: '' }, question_groups: [] });
      
      // Reading
      newParts.push({ part_title: 'Reading Passage 1', instruction: 'Read the passage and answer questions 1-13', question_groups: [] });
      newParts.push({ part_title: 'Reading Passage 2', instruction: 'Read the passage and answer questions 14-26', question_groups: [] });
      newParts.push({ part_title: 'Reading Passage 3', instruction: 'Read the passage and answer questions 27-40', question_groups: [] });
      
      // Writing
      newParts.push({ 
        part_title: 'Writing Task 1', 
        instruction: 'Write at least 150 words', 
        question_groups: [
          { group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: 'q_w_001', type: 'WRITING_ESSAY', question_text: 'Describe the chart below.', metadata: { correct_answer: '', explanation: '' } }] }
        ] 
      });
      newParts.push({ 
        part_title: 'Writing Task 2', 
        instruction: 'Write at least 250 words', 
        question_groups: [
          { group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: 'q_w_002', type: 'WRITING_ESSAY', question_text: 'Discuss both views and give your opinion.', metadata: { correct_answer: '', explanation: '' } }] }
        ] 
      });
    } 
    else if (type === 'TOEIC') {
      setExamType('TOEIC_LISTENING_READING');
      setExamTitle('TOEIC L&R Mock Test');
      
      const createToeicQuestions = (start: number, end: number, optionsCount: number = 4) => {
        const qs: Question[] = [];
        const options = optionsCount === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
        for (let i = start; i <= end; i++) {
          qs.push({
            question_id: `q_${String(i).padStart(3, '0')}`,
            type: 'MULTIPLE_CHOICE',
            question_text: `Question ${i}`,
            metadata: { options, correct_answer: '', explanation: '' }
          });
        }
        return qs;
      };

      const createToeicGroups = (start: number, groupsCount: number, qsPerGroup: number, optionsCount: number = 4) => {
        const groups: QuestionGroup[] = [];
        let currentQ = start;
        for (let i = 0; i < groupsCount; i++) {
          groups.push({
            group_id: generateId('group'),
            instruction: '',
            content_html: '',
            questions: createToeicQuestions(currentQ, currentQ + qsPerGroup - 1, optionsCount)
          });
          currentQ += qsPerGroup;
        }
        return groups;
      };

      // TOEIC Listening (100 qs)
      newParts.push({ part_title: 'Part 1: Photographs', instruction: 'Questions 1-6', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 6, 1, 4) }); // 6 groups (1 pic each), 1 q each
      newParts.push({ part_title: 'Part 2: Question-Response', instruction: 'Questions 7-31', shared_audio: { url: '' }, question_groups: createToeicGroups(7, 1, 25, 3) }); // 1 group, 25 qs, 3 options
      newParts.push({ part_title: 'Part 3: Conversations', instruction: 'Questions 32-70', shared_audio: { url: '' }, question_groups: createToeicGroups(32, 13, 3, 4) }); // 13 groups, 3 qs each
      newParts.push({ part_title: 'Part 4: Talks', instruction: 'Questions 71-100', shared_audio: { url: '' }, question_groups: createToeicGroups(71, 10, 3, 4) }); // 10 groups, 3 qs each
      
      // TOEIC Reading (100 qs)
      newParts.push({ part_title: 'Part 5: Incomplete Sentences', instruction: 'Questions 101-130', question_groups: createToeicGroups(101, 1, 30, 4) }); // 1 group, 30 qs
      newParts.push({ part_title: 'Part 6: Text Completion', instruction: 'Questions 131-146', question_groups: createToeicGroups(131, 4, 4, 4) }); // 4 groups, 4 qs each
      newParts.push({ part_title: 'Part 7: Reading Comprehension', instruction: 'Questions 147-200', question_groups: [] }); // User adds groups manually
    }
    else if (type === 'TOEIC_WRITING') {
      setExamType('TOEIC_WRITING');
      setExamTitle('TOEIC Writing Mock Test');
      
      const createToeicWritPart1Groups = () => {
        const groups = [];
        for(let i=1; i<=5; i++) {
          groups.push({ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: `q_tw_00${i}`, type: 'WRITING_ESSAY', question_text: 'Words to use: ...', metadata: { correct_answer: '', explanation: '' } }] });
        }
        return groups;
      };

      const createToeicWritPart2Groups = () => {
        const groups = [];
        for(let i=6; i<=7; i++) {
          groups.push({ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: `q_tw_00${i}`, type: 'WRITING_ESSAY', question_text: 'Directions: Respond to the email...', metadata: { correct_answer: '', explanation: '' } }] });
        }
        return groups;
      };

      newParts.push({ part_title: 'Part 1: Write a Sentence Based on a Picture', instruction: 'Questions 1-5', question_groups: createToeicWritPart1Groups() });
      newParts.push({ part_title: 'Part 2: Respond to a Written Request', instruction: 'Questions 6-7', question_groups: createToeicWritPart2Groups() });
      newParts.push({ part_title: 'Part 3: Write an Opinion Essay', instruction: 'Question 8', question_groups: [
        { group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: 'q_tw_008', type: 'WRITING_ESSAY', question_text: 'Write an essay...', metadata: { correct_answer: '', explanation: '' } }] }
      ] });
    }
    else if (type === 'VSTEP') {
      setExamType('VSTEP');
      setExamTitle('Đánh giá Năng lực Tiếng Việt (VSTEP)');
      
      // Listening
      newParts.push({ part_title: 'Kỹ năng Nghe - Phần 1', instruction: 'Hướng dẫn phần 1', shared_audio: { url: '' }, question_groups: [] });
      newParts.push({ part_title: 'Kỹ năng Nghe - Phần 2', instruction: 'Hướng dẫn phần 2', shared_audio: { url: '' }, question_groups: [] });
      newParts.push({ part_title: 'Kỹ năng Nghe - Phần 3', instruction: 'Hướng dẫn phần 3', shared_audio: { url: '' }, question_groups: [] });
      
      // Reading
      newParts.push({ part_title: 'Kỹ năng Đọc - Phần 1', instruction: 'Hướng dẫn phần đọc 1', question_groups: [] });
      newParts.push({ part_title: 'Kỹ năng Đọc - Phần 2', instruction: 'Hướng dẫn phần đọc 2', question_groups: [] });
      newParts.push({ part_title: 'Kỹ năng Đọc - Phần 3', instruction: 'Hướng dẫn phần đọc 3', question_groups: [] });
      newParts.push({ part_title: 'Kỹ năng Đọc - Phần 4', instruction: 'Hướng dẫn phần đọc 4', question_groups: [] });
      
      // Writing
      newParts.push({ 
        part_title: 'Kỹ năng Viết - Bài 1', 
        instruction: 'Viết thư/email', 
        question_groups: [
          { group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: 'q_w_001', type: 'WRITING_ESSAY', question_text: 'Viết thư.', metadata: { correct_answer: '', explanation: '' } }] }
        ] 
      });
      newParts.push({ 
        part_title: 'Kỹ năng Viết - Bài 2', 
        instruction: 'Viết bài luận', 
        question_groups: [
          { group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: 'q_w_002', type: 'WRITING_ESSAY', question_text: 'Viết luận.', metadata: { correct_answer: '', explanation: '' } }] }
        ] 
      });
    }

    setParts(newParts);
    // Expand only the first part to not clutter the screen
    setExpandedParts({ 0: true });
  };

  const togglePart = (partIdx: number) => setExpandedParts(prev => ({ ...prev, [partIdx]: !prev[partIdx] }));

  const addPart = () => {
    setParts([...parts, { part_title: `Part ${parts.length + 1}`, instruction: '', question_groups: [] }]);
    setExpandedParts(prev => ({ ...prev, [parts.length]: true }));
  };

  const updatePart = (partIdx: number, field: keyof ExamPart, value: any) => {
    const newParts = [...parts];
    newParts[partIdx] = { ...newParts[partIdx], [field]: value };
    setParts(newParts);
  };

  const addGroup = (partIdx: number) => {
    const newParts = [...parts];
    const groupId = generateId('group');
    newParts[partIdx].question_groups.push({
      group_id: groupId,
      instruction: '',
      content_html: '',
      questions: []
    });
    setParts(newParts);
    setBatchSettings(prev => ({ ...prev, [groupId]: { type: 'MULTIPLE_CHOICE', start: 1, end: 5 } }));
  };

  const updateGroup = (partIdx: number, groupIdx: number, field: keyof QuestionGroup, value: any) => {
    const newParts = [...parts];
    newParts[partIdx].question_groups[groupIdx] = { ...newParts[partIdx].question_groups[groupIdx], [field]: value };
    setParts(newParts);
  };

  const batchGenerateQuestions = (partIdx: number, groupIdx: number, groupId: string) => {
    const settings = batchSettings[groupId];
    if (!settings) return;
    
    if (settings.end < settings.start) {
      alert("Số kết thúc phải lớn hơn hoặc bằng số bắt đầu.");
      return;
    }

    const count = settings.end - settings.start + 1;
    if (count > 50) {
      alert("Không nên tạo quá 50 câu một lúc.");
      return;
    }

    const newQuestions: Question[] = [];
    for (let i = settings.start; i <= settings.end; i++) {
      let defaultOptions: string[] | undefined = undefined;
      
      if (settings.type === 'TRUE_FALSE_NOT_GIVEN') defaultOptions = ['TRUE', 'FALSE', 'NOT GIVEN'];
      else if (settings.type === 'YES_NO_NOT_GIVEN') defaultOptions = ['YES', 'NO', 'NOT GIVEN'];
      else if (settings.type.includes('MULTIPLE_CHOICE')) defaultOptions = ['A', 'B', 'C', 'D'];

      newQuestions.push({
        question_id: `q_${String(i).padStart(3, '0')}`,
        type: settings.type,
        question_text: `${i}. `,
        metadata: {
          options: defaultOptions,
          correct_answer: settings.type === 'MULTIPLE_CHOICE_MULTI' ? [] : '',
          explanation: ''
        }
      });
    }

    const newParts = [...parts];
    newParts[partIdx].question_groups[groupIdx].questions = [
      ...newParts[partIdx].question_groups[groupIdx].questions,
      ...newQuestions
    ];
    setParts(newParts);
  };

  const updateQuestion = (partIdx: number, groupIdx: number, qIdx: number, field: keyof Question, value: any) => {
    const newParts = [...parts];
    newParts[partIdx].question_groups[groupIdx].questions[qIdx] = { 
      ...newParts[partIdx].question_groups[groupIdx].questions[qIdx], 
      [field]: value 
    };
    setParts(newParts);
  };

  const updateQuestionMetadata = (partIdx: number, groupIdx: number, qIdx: number, field: keyof QuestionMetadata, value: any) => {
    const newParts = [...parts];
    const q = newParts[partIdx].question_groups[groupIdx].questions[qIdx];
    q.metadata = { ...q.metadata, [field]: value };
    setParts(newParts);
  };

  const handleSave = () => {
    const finalJson = {
      exam_title: examTitle,
      exam_type: examType,
      parts: parts
    };
    onSave(JSON.stringify(finalJson, null, 2));
  };

  return (
    <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Trình tạo Đề thi Trực quan (Schema v2)</h3>
        <div className="flex-center" style={{ gap: '0.5rem' }}>
          <button className="btn btn-outline flex-center" style={{ gap: '0.5rem', padding: '0.6rem 1rem', cursor: 'pointer' }} onClick={() => applyTemplate('IELTS')}>
            <Zap size={16} /> Sườn IELTS
          </button>
          <button className="btn btn-outline flex-center" style={{ gap: '0.5rem', padding: '0.6rem 1rem', cursor: 'pointer' }} onClick={() => applyTemplate('TOEIC')}>
            <Zap size={16} /> Sườn TOEIC L&R
          </button>
          <button className="btn btn-outline flex-center" style={{ gap: '0.5rem', padding: '0.6rem 1rem', cursor: 'pointer' }} onClick={() => applyTemplate('TOEIC_WRITING')}>
            <Zap size={16} /> Sườn TOEIC Writing
          </button>
          <button className="btn badge-orange flex-center" style={{ gap: '0.5rem', padding: '0.6rem 1rem', cursor: 'pointer', border: 'none' }} onClick={() => applyTemplate('VSTEP')}>
            <Zap size={16} /> Sườn VSTEP
          </button>
        </div>
      </div>

      <div className="ed-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Tên đề thi</label>
            <input type="text" className="input-field" value={examTitle} onChange={e => setExamTitle(e.target.value)} />
          </div>
          <div style={{ width: '200px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Loại đề thi</label>
            <select className="input-field" value={examType} onChange={e => setExamType(e.target.value)}>
              <option value="IELTS_ACADEMIC">IELTS Academic</option>
              <option value="TOEIC_LISTENING">TOEIC Listening</option>
              <option value="TOEIC_READING">TOEIC Reading</option>
              <option value="VSTEP">VSTEP (Tiếng Việt)</option>
            </select>
          </div>
        </div>
      </div>

      {parts.length === 0 ? (
        <div className="flex-center" style={{ padding: '4rem', border: '2px dashed var(--border-dark)', borderRadius: 'var(--radius-md)', flexDirection: 'column', color: 'var(--text-muted)' }}>
          <AlignLeft size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>Chưa có Part nào. Bấm <strong>"+ Thêm Part"</strong> để bắt đầu.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {parts.map((part, pIndex) => (
            <div key={pIndex} className="ed-card" style={{ overflow: 'hidden', borderLeft: '4px solid var(--primary)' }}>
              <div 
                className="flex-between" 
                style={{ background: 'var(--bg-tertiary)', padding: '1rem 1.5rem', cursor: 'pointer', borderBottom: expandedParts[pIndex] ? '1px solid var(--border-light)' : 'none' }}
                onClick={() => togglePart(pIndex)}
              >
                <div className="flex-center" style={{ gap: '0.5rem' }}>
                  {expandedParts[pIndex] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <input type="text" value={part.part_title} onChange={(e) => updatePart(pIndex, 'part_title', e.target.value)} onClick={e => e.stopPropagation()} style={{ background: 'transparent', border: 'none', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', outline: 'none', width: '300px' }} />
                </div>
                <button className="btn" style={{ padding: '0.25rem', color: 'var(--danger)', background: 'transparent', border: 'none' }} onClick={(e) => { e.stopPropagation(); setParts(parts.filter((_, i) => i !== pIndex)); }}>
                  <Trash2 size={18} />
                </button>
              </div>

              {expandedParts[pIndex] && (
                <div style={{ padding: '1.5rem', background: 'var(--bg-primary)' }}>
                  
                  {/* Part Settings */}
                  <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Hướng dẫn chung (Instruction)</label>
                      <input type="text" className="input-field" value={part.instruction || ''} onChange={e => updatePart(pIndex, 'instruction', e.target.value)} placeholder="VD: Listen to the conversation..." />
                    </div>
                    
                    {/* CHỈ HIỆN AUDIO NẾU LÀ KỸ NĂNG NGHE */}
                    {(part.part_title.toLowerCase().includes('listen') || part.part_title.toLowerCase().includes('nghe')) && (
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}><Music size={14} color="var(--primary)" /> Shared Audio URL</label>
                        <input type="text" className="input-field" value={part.shared_audio?.url || ''} onChange={e => updatePart(pIndex, 'shared_audio', { url: e.target.value, duration_seconds: 0 })} placeholder="Nhập Link Mp3 cho Part này..." />
                      </div>
                    )}
                  </div>

                  {/* CHỈ HIỆN BÀI ĐỌC CHUNG NẾU LÀ IELTS READING PASSAGE HOẶC VSTEP ĐỌC */}
                  {(part.part_title.toLowerCase().includes('passage') || (examType === 'VSTEP' && part.part_title.toLowerCase().includes('đọc'))) && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}><AlignLeft size={14} color="var(--primary)" /> Nội dung Bài Đọc (Shared Reading Passage)</label>
                      <textarea className="input-field" rows={6} value={part.shared_content_html || ''} onChange={e => updatePart(pIndex, 'shared_content_html', e.target.value)} placeholder="<p>Nhập mã HTML của toàn bộ bài đọc IELTS/VSTEP tại đây...</p>"></textarea>
                    </div>
                  )}

                  {/* Question Groups */}
                  {part.question_groups.map((group, gIndex) => {
                    const isWriting = part.part_title.toLowerCase().includes('writ') || part.part_title.toLowerCase().includes('viết') || part.part_title.toLowerCase().includes('write');
                    const isFixedWriting = part.part_title.toLowerCase().includes('writing task') || part.part_title.toLowerCase().includes('kỹ năng viết');
                    const isFixedToeicPart = examType === 'TOEIC_LISTENING_READING' && !part.part_title.includes('Part 7');
                    const isFixedStructure = isFixedWriting || isFixedToeicPart;
                    
                    return (
                    <div key={group.group_id} style={{ 
                      border: isFixedWriting ? 'none' : '1px solid var(--border-light)', 
                      borderRadius: isFixedWriting ? '0' : 'var(--radius-md)', 
                      padding: isFixedWriting ? '0' : '1.5rem', 
                      marginBottom: '1.5rem', 
                      position: 'relative' 
                    }}>
                      {!isFixedWriting && <span style={{ position: 'absolute', top: '-12px', left: '1rem', background: 'var(--bg-primary)', padding: '0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>GROUP {gIndex + 1} ({group.questions.length} CÂU)</span>}
                      
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Instruction</label>
                          <input type="text" className="input-field" value={group.instruction || ''} onChange={e => updateGroup(pIndex, gIndex, 'instruction', e.target.value)} placeholder="Choose the correct letter..." />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}><Image size={14} color="var(--accent)" /> Shared Image (VD: Bản đồ/Biểu đồ)</label>
                          <input type="text" className="input-field" value={group.shared_media?.url || ''} onChange={e => updateGroup(pIndex, gIndex, 'shared_media', { type: 'image', url: e.target.value, display_config: { size_preset: 'medium', alignment: 'center' } })} placeholder="Nhập Link Ảnh..." />
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Content HTML (Đoạn văn / Đề bài)</label>
                        <textarea className="input-field" rows={3} value={group.content_html || ''} onChange={e => updateGroup(pIndex, gIndex, 'content_html', e.target.value)} placeholder="<p>Nhập HTML đoạn văn tại đây...</p>"></textarea>
                      </div>

                      <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                        
                        {/* ẨN TẠO NHANH NẾU LÀ KỸ NĂNG VIẾT */}
                        {!isWriting && (
                          <div className="flex-center" style={{ gap: '1rem', background: 'white', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-light)', marginBottom: '1rem' }}>
                            <Settings size={18} color="var(--primary)" />
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--primary)' }}>Tạo Nhanh:</span>
                            
                            <select className="input-field" style={{ width: '200px', padding: '0.4rem', fontSize: '0.875rem' }} value={batchSettings[group.group_id]?.type || 'MULTIPLE_CHOICE'} onChange={e => setBatchSettings(prev => ({ ...prev, [group.group_id]: { ...prev[group.group_id], type: e.target.value } }))}>
                              {QUESTION_TYPES.map(qt => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
                            </select>
                            
                            <span style={{ fontSize: '0.875rem' }}>Từ câu</span>
                            <input type="number" className="input-field" style={{ width: '60px', padding: '0.4rem', textAlign: 'center' }} value={batchSettings[group.group_id]?.start || 1} onChange={e => setBatchSettings(prev => ({ ...prev, [group.group_id]: { ...prev[group.group_id], start: parseInt(e.target.value) || 1 } }))} />
                            <span style={{ fontSize: '0.875rem' }}>Đến câu</span>
                            <input type="number" className="input-field" style={{ width: '60px', padding: '0.4rem', textAlign: 'center' }} value={batchSettings[group.group_id]?.end || 5} onChange={e => setBatchSettings(prev => ({ ...prev, [group.group_id]: { ...prev[group.group_id], end: parseInt(e.target.value) || 5 } }))} />
                            
                            <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => batchGenerateQuestions(pIndex, gIndex, group.group_id)}>
                              Khởi tạo
                            </button>
                          </div>
                        )}

                        {/* Questions List */}
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                          {group.questions.map((q, qIndex) => (
                            <div key={qIndex} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: 'white', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', marginBottom: '0.75rem' }}>
                              {!isFixedWriting && (
                                <div style={{ background: 'var(--primary)', color: 'white', width: '32px', height: '24px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
                                  {q.question_id.split('_')[1] || (qIndex + 1)}
                                </div>
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>{q.type.replace(/_/g, ' ')}</div>
                                <input type="text" className="input-field" value={q.question_text} onChange={e => updateQuestion(pIndex, gIndex, qIndex, 'question_text', e.target.value)} placeholder={isWriting ? "Yêu cầu bài viết..." : "Nội dung câu hỏi..."} style={{ marginBottom: '0.5rem', padding: '0.4rem 0.75rem' }} />
                                
                                {q.metadata.options && q.metadata.options.length > 0 && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    {q.metadata.options.map((opt, oIdx) => (
                                      <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem', width: '20px' }}>{String.fromCharCode(65 + oIdx)}.</div>
                                        <input type="text" className="input-field" value={opt} onChange={(e) => {
                                            const newOpts = [...(q.metadata.options || [])]; newOpts[oIdx] = e.target.value;
                                            updateQuestionMetadata(pIndex, gIndex, qIndex, 'options', newOpts);
                                          }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} />
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {!isWriting && (
                                  <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--success)' }}>Đáp án đúng:</span>
                                    <input type="text" className="input-field" value={typeof q.metadata.correct_answer === 'string' ? q.metadata.correct_answer : (q.metadata.correct_answer || []).join(', ')} onChange={(e) => {
                                        // If it's multi-select, split by comma, else store string
                                        const val = e.target.value;
                                        const parsedVal = q.type === 'MULTIPLE_CHOICE_MULTI' ? val.split(',').map(v => v.trim()) : val;
                                        updateQuestionMetadata(pIndex, gIndex, qIndex, 'correct_answer', parsedVal);
                                      }} style={{ padding: '0.25rem 0.5rem', flex: 1, borderColor: 'var(--success)' }} placeholder="Nhập đáp án đúng..." />
                                  </div>
                                )}
                                <div style={{ marginTop: '0.5rem' }}>
                                  <input type="text" className="input-field" value={q.metadata.explanation || ''} onChange={e => updateQuestionMetadata(pIndex, gIndex, qIndex, 'explanation', e.target.value)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }} placeholder="Nhập lời giải thích (Explanation)..." />
                                </div>
                              </div>
                              {!isFixedStructure && (
                                <button className="btn" style={{ padding: '0.25rem', color: 'var(--danger)', background: 'transparent', border: 'none' }} onClick={() => {
                                  const newGroups = [...parts][pIndex].question_groups;
                                  newGroups[gIndex].questions.splice(qIndex, 1);
                                  setParts([...parts]);
                                }}>
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {!isFixedStructure && (
                        <button className="btn" style={{ position: 'absolute', top: '-12px', right: '1rem', padding: '0.1rem 0.5rem', color: 'var(--danger)', background: 'var(--bg-primary)', border: 'none' }} onClick={() => {
                          const newParts = [...parts];
                          newParts[pIndex].question_groups.splice(gIndex, 1);
                          setParts(newParts);
                        }}>
                          <Trash2 size={14} /> Xóa Group
                        </button>
                      )}
                    </div>
                    );
                  })}

                  {(!part.part_title.toLowerCase().includes('writing task') && !part.part_title.toLowerCase().includes('kỹ năng viết') && !(examType === 'TOEIC_LISTENING_READING' && !part.part_title.includes('Part 7'))) && (
                    <button className="btn btn-outline" style={{ width: '100%', borderStyle: 'dashed' }} onClick={() => addGroup(pIndex)}>
                      <Plus size={16} /> Thêm Nhóm câu hỏi / Đoạn văn mới
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          <button className="btn btn-outline flex-center" style={{ width: '100%', padding: '1rem', borderStyle: 'dashed', justifyContent: 'center' }} onClick={addPart}>
            <Plus size={18} /> Thêm Part mới
          </button>
        </div>
      )}

      <div className="flex-center" style={{ gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid var(--border-light)' }}>
        <button className="btn btn-outline" onClick={onCancel}>Hủy</button>
        <button className="btn btn-primary" onClick={handleSave}><Save size={18} /> Xuất cấu trúc JSON chuẩn</button>
      </div>
    </div>
  );
};

export default ExamBuilder;
