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

const getPartBounds = (partTitle: string, examType: string) => {
  if (examType === 'IELTS_ACADEMIC') {
    if (partTitle.includes('Listening Part 1')) return { start: 1, end: 10 };
    if (partTitle.includes('Listening Part 2')) return { start: 11, end: 20 };
    if (partTitle.includes('Listening Part 3')) return { start: 21, end: 30 };
    if (partTitle.includes('Listening Part 4')) return { start: 31, end: 40 };
    if (partTitle.includes('Reading Passage 1')) return { start: 1, end: 13 };
    if (partTitle.includes('Reading Passage 2')) return { start: 14, end: 26 };
    if (partTitle.includes('Reading Passage 3')) return { start: 27, end: 40 };
  }
  if (examType === 'TOEIC_LISTENING_READING') {
    if (partTitle.includes('Part 1')) return { start: 1, end: 6 };
    if (partTitle.includes('Part 2')) return { start: 7, end: 31 };
    if (partTitle.includes('Part 3')) return { start: 32, end: 70 };
    if (partTitle.includes('Part 4')) return { start: 71, end: 100 };
    if (partTitle.includes('Part 5')) return { start: 101, end: 130 };
    if (partTitle.includes('Part 6')) return { start: 131, end: 146 };
    if (partTitle.includes('Part 7')) return { start: 147, end: 200 };
  }
  if (examType === 'VSTEP') {
    if (partTitle.includes('Nghe - Phần 1')) return { start: 1, end: 8 };
    if (partTitle.includes('Nghe - Phần 2')) return { start: 9, end: 20 };
    if (partTitle.includes('Nghe - Phần 3')) return { start: 21, end: 35 };
    if (partTitle.includes('Đọc - Phần 1')) return { start: 1, end: 10 };
    if (partTitle.includes('Đọc - Phần 2')) return { start: 11, end: 20 };
    if (partTitle.includes('Đọc - Phần 3')) return { start: 21, end: 30 };
    if (partTitle.includes('Đọc - Phần 4')) return { start: 31, end: 40 };
  }
  return null;
}

const getNextStartForPart = (part: ExamPart, bounds: {start: number, end: number} | null) => {
  let nextStart = bounds ? bounds.start : 1;
  let currentMax = nextStart - 1;
  part.question_groups.forEach(g => {
    g.questions.forEach(q => {
      const partsId = q.question_id.split('_');
      const num = parseInt(partsId[partsId.length - 1]);
      if (!isNaN(num) && num > currentMax) currentMax = num;
    });
  });
  return currentMax + 1;
};

const ExamBuilder = ({ onSave, onCancel }: { onSave: (json: string) => void, onCancel: () => void }) => {
  const [examTitle, setExamTitle] = useState('Đề thi Mới');
  const [examType, setExamType] = useState('IELTS_ACADEMIC');
  const [parts, setParts] = useState<ExamPart[]>([]);
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [selectedSpecificPart, setSelectedSpecificPart] = useState('IELTS_L1');
  const [selectedSkill, setSelectedSkill] = useState('IELTS_LISTENING');
  const [wizardMode, setWizardMode] = useState<'START' | 'FULL' | 'SKILL' | 'PART' | 'BUILDER'>('START');

  // Local state for batch generation
  const [batchSettings, setBatchSettings] = useState<Record<string, { type: string; start: number; end: number }>>({});

  const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 6)}`;

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

  const createGenericGroup = (start: number, end: number, type: string = 'MULTIPLE_CHOICE') => {
    const qs = [];
    for (let i = start; i <= end; i++) {
      let defaultOptions: string[] | undefined = undefined;
      if (type === 'MULTIPLE_CHOICE') defaultOptions = ['A', 'B', 'C', 'D'];
      qs.push({
        question_id: `q_${String(i).padStart(3, '0')}`,
        type,
        question_text: `${i}. `,
        metadata: { correct_answer: '', explanation: '', options: defaultOptions }
      });
    }
    return [{
      group_id: generateId('group'),
      instruction: `Từ câu ${start} đến câu ${end}`,
      content_html: '',
      questions: qs
    }];
  };

  const addSpecificPart = (partKey: string) => {
    let newPart: ExamPart | null = null;
    switch(partKey) {
      case 'IELTS_L1': newPart = { part_title: 'Listening Part 1', instruction: 'Listen and answer questions 1-10', shared_audio: { url: '' }, question_groups: [] }; break;
      case 'IELTS_L2': newPart = { part_title: 'Listening Part 2', instruction: 'Listen and answer questions 11-20', shared_audio: { url: '' }, question_groups: [] }; break;
      case 'IELTS_L3': newPart = { part_title: 'Listening Part 3', instruction: 'Listen and answer questions 21-30', shared_audio: { url: '' }, question_groups: [] }; break;
      case 'IELTS_L4': newPart = { part_title: 'Listening Part 4', instruction: 'Listen and answer questions 31-40', shared_audio: { url: '' }, question_groups: [] }; break;
      case 'IELTS_R1': newPart = { part_title: 'Reading Passage 1', instruction: 'Read the passage and answer questions 1-13', question_groups: [] }; break;
      case 'IELTS_W1': newPart = { part_title: 'Writing Task 1', instruction: 'Write at least 150 words', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'WRITING_ESSAY', question_text: 'Describe the chart below.', metadata: { correct_answer: '', explanation: '' } }] }] }; break;
      case 'IELTS_W2': newPart = { part_title: 'Writing Task 2', instruction: 'Write at least 250 words', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'WRITING_ESSAY', question_text: 'Discuss both views and give your opinion.', metadata: { correct_answer: '', explanation: '' } }] }] }; break;
      case 'TOEIC_P1': newPart = { part_title: 'Part 1: Photographs', instruction: 'Questions 1-6', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 6, 1, 4) }; break;
      case 'TOEIC_P2': newPart = { part_title: 'Part 2: Question-Response', instruction: 'Questions 7-31', shared_audio: { url: '' }, question_groups: createToeicGroups(7, 1, 25, 3) }; break;
      case 'TOEIC_P3': newPart = { part_title: 'Part 3: Conversations', instruction: 'Questions 32-70', shared_audio: { url: '' }, question_groups: createToeicGroups(32, 13, 3, 4) }; break;
      case 'TOEIC_P4': newPart = { part_title: 'Part 4: Talks', instruction: 'Questions 71-100', shared_audio: { url: '' }, question_groups: createToeicGroups(71, 10, 3, 4) }; break;
      case 'TOEIC_P5': newPart = { part_title: 'Part 5: Incomplete Sentences', instruction: 'Questions 101-130', question_groups: createToeicGroups(101, 1, 30, 4) }; break;
      case 'TOEIC_P6': newPart = { part_title: 'Part 6: Text Completion', instruction: 'Questions 131-146', question_groups: createToeicGroups(131, 4, 4, 4) }; break;
      case 'TOEIC_P7': newPart = { part_title: 'Part 7: Reading Comprehension', instruction: 'Questions 147-200', question_groups: [] }; break;
      case 'TW_P1': newPart = { part_title: 'Part 1: Write a Sentence Based on a Picture', instruction: 'Questions 1-5', question_groups: createToeicWritPart1Groups() }; break;
      case 'TW_P2': newPart = { part_title: 'Part 2: Respond to a Written Request', instruction: 'Questions 6-7', question_groups: createToeicWritPart2Groups() }; break;
      case 'VSTEP_L': newPart = { part_title: 'Kỹ năng Nghe - Phần 1', instruction: 'Hướng dẫn phần nghe', shared_audio: { url: '' }, question_groups: [] }; break;
      case 'VSTEP_R': newPart = { part_title: 'Kỹ năng Đọc - Phần 1', instruction: 'Hướng dẫn phần đọc', question_groups: [] }; break;
      case 'VSTEP_W': newPart = { part_title: 'Kỹ năng Viết - Bài 1', instruction: 'Viết thư/email', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'WRITING_ESSAY', question_text: 'Viết luận.', metadata: { correct_answer: '', explanation: '' } }] }] }; break;
    }
    if (newPart) {
      setParts([...parts, newPart]);
      setActivePartIndex(parts.length);
    }
  };

  const addSkillTemplate = (skillKey: string) => {
    let newPartsToAdd: ExamPart[] = [];
    switch(skillKey) {
      case 'IELTS_LISTENING':
        newPartsToAdd.push({ part_title: 'Listening Part 1', instruction: 'Listen and answer questions 1-10', shared_audio: { url: '' }, question_groups: [] });
        newPartsToAdd.push({ part_title: 'Listening Part 2', instruction: 'Listen and answer questions 11-20', shared_audio: { url: '' }, question_groups: [] });
        newPartsToAdd.push({ part_title: 'Listening Part 3', instruction: 'Listen and answer questions 21-30', shared_audio: { url: '' }, question_groups: [] });
        newPartsToAdd.push({ part_title: 'Listening Part 4', instruction: 'Listen and answer questions 31-40', shared_audio: { url: '' }, question_groups: [] });
        break;
      case 'IELTS_READING':
        newPartsToAdd.push({ part_title: 'Reading Passage 1', instruction: 'Read the passage and answer questions 1-13', question_groups: [] });
        newPartsToAdd.push({ part_title: 'Reading Passage 2', instruction: 'Read the passage and answer questions 14-26', question_groups: [] });
        newPartsToAdd.push({ part_title: 'Reading Passage 3', instruction: 'Read the passage and answer questions 27-40', question_groups: [] });
        break;
      case 'IELTS_WRITING':
        newPartsToAdd.push({ part_title: 'Writing Task 1', instruction: 'Write at least 150 words', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'WRITING_ESSAY', question_text: 'Describe the chart below.', metadata: { correct_answer: '', explanation: '' } }] }] });
        newPartsToAdd.push({ part_title: 'Writing Task 2', instruction: 'Write at least 250 words', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'WRITING_ESSAY', question_text: 'Discuss both views and give your opinion.', metadata: { correct_answer: '', explanation: '' } }] }] });
        break;
      case 'TOEIC_LISTENING':
        newPartsToAdd.push({ part_title: 'Part 1: Photographs', instruction: 'Questions 1-6', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 6, 1, 4) });
        newPartsToAdd.push({ part_title: 'Part 2: Question-Response', instruction: 'Questions 7-31', shared_audio: { url: '' }, question_groups: createToeicGroups(7, 1, 25, 3) });
        newPartsToAdd.push({ part_title: 'Part 3: Conversations', instruction: 'Questions 32-70', shared_audio: { url: '' }, question_groups: createToeicGroups(32, 13, 3, 4) });
        newPartsToAdd.push({ part_title: 'Part 4: Talks', instruction: 'Questions 71-100', shared_audio: { url: '' }, question_groups: createToeicGroups(71, 10, 3, 4) });
        break;
      case 'TOEIC_READING':
        newPartsToAdd.push({ part_title: 'Part 5: Incomplete Sentences', instruction: 'Questions 101-130', question_groups: createToeicGroups(101, 1, 30, 4) });
        newPartsToAdd.push({ part_title: 'Part 6: Text Completion', instruction: 'Questions 131-146', question_groups: createToeicGroups(131, 4, 4, 4) });
        newPartsToAdd.push({ part_title: 'Part 7: Reading Comprehension', instruction: 'Questions 147-200', question_groups: [] });
        break;
      case 'VSTEP_LISTENING':
        newPartsToAdd.push({ part_title: 'Kỹ năng Nghe - Phần 1', instruction: 'Hướng dẫn phần nghe', shared_audio: { url: '' }, question_groups: [] });
        newPartsToAdd.push({ part_title: 'Kỹ năng Nghe - Phần 2', instruction: 'Hướng dẫn phần nghe', shared_audio: { url: '' }, question_groups: [] });
        newPartsToAdd.push({ part_title: 'Kỹ năng Nghe - Phần 3', instruction: 'Hướng dẫn phần nghe', shared_audio: { url: '' }, question_groups: [] });
        break;
      case 'VSTEP_READING':
        newPartsToAdd.push({ part_title: 'Kỹ năng Đọc - Phần 1', instruction: 'Hướng dẫn phần đọc', question_groups: [] });
        newPartsToAdd.push({ part_title: 'Kỹ năng Đọc - Phần 2', instruction: 'Hướng dẫn phần đọc', question_groups: [] });
        newPartsToAdd.push({ part_title: 'Kỹ năng Đọc - Phần 3', instruction: 'Hướng dẫn phần đọc', question_groups: [] });
        newPartsToAdd.push({ part_title: 'Kỹ năng Đọc - Phần 4', instruction: 'Hướng dẫn phần đọc', question_groups: [] });
        break;
      case 'VSTEP_WRITING':
        newPartsToAdd.push({ part_title: 'Kỹ năng Viết - Bài 1', instruction: 'Viết thư/email', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'WRITING_ESSAY', question_text: 'Viết thư/email.', metadata: { correct_answer: '', explanation: '' } }] }] });
        newPartsToAdd.push({ part_title: 'Kỹ năng Viết - Bài 2', instruction: 'Viết bài luận', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'WRITING_ESSAY', question_text: 'Viết luận.', metadata: { correct_answer: '', explanation: '' } }] }] });
        break;
    }
    
    if (newPartsToAdd.length > 0) {
      setParts([...parts, ...newPartsToAdd]);
      setActivePartIndex(parts.length);
    }
  };

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
      // TOEIC Listening (100 qs)
      newParts.push({ part_title: 'Part 1: Photographs', instruction: 'Questions 1-6', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 6, 1, 4) }); // 6 groups (1 pic each), 1 q each
      newParts.push({ part_title: 'Part 2: Question-Response', instruction: 'Questions 7-31', shared_audio: { url: '' }, question_groups: createToeicGroups(7, 1, 25, 3) }); // 1 group, 25 qs, 3 options
      newParts.push({ part_title: 'Part 3: Conversations', instruction: 'Questions 32-70', shared_audio: { url: '' }, question_groups: createToeicGroups(32, 13, 3, 4) }); // 13 groups, 3 qs each
      newParts.push({ part_title: 'Part 4: Talks', instruction: 'Questions 71-100', shared_audio: { url: '' }, question_groups: createToeicGroups(71, 10, 3, 4) }); // 10 groups, 3 qs each
      
      // TOEIC Reading (100 qs)
      newParts.push({ part_title: 'Part 5: Incomplete Sentences', instruction: 'Questions 101-130', question_groups: createToeicGroups(101, 1, 30, 4) }); // 1 group, 30 qs
      newParts.push({ part_title: 'Part 6: Text Completion', instruction: 'Questions 131-146', question_groups: createToeicGroups(131, 4, 4, 4) }); // 4 groups, 4 qs each
      newParts.push({ part_title: 'Part 7: Reading Comprehension', instruction: 'Questions 147-200', question_groups: [] });
    }
    else if (type === 'TOEIC_WRITING') {
      setExamType('TOEIC_WRITING');
      setExamTitle('TOEIC Writing Mock Test');

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
    setActivePartIndex(0);
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
    
    const bounds = getPartBounds(newParts[partIdx].part_title, examType);
    const nextStart = getNextStartForPart(newParts[partIdx], bounds);
    
    const defaultEnd = bounds ? (nextStart + 4 > bounds.end ? bounds.end : nextStart + 4) : nextStart + 4;
    
    setBatchSettings(prev => ({ ...prev, [groupId]: { type: 'MULTIPLE_CHOICE', start: nextStart, end: defaultEnd } }));
  };

  const batchGenerateQuestions = (partIdx: number, groupIdx: number, groupId: string) => {
    const settings = batchSettings[groupId];
    if (!settings) return;
    
    const bounds = getPartBounds(parts[partIdx].part_title, examType);
    const nextStart = getNextStartForPart(parts[partIdx], bounds);
    
    if (bounds && nextStart > bounds.end) {
      alert("Đã đủ số câu hỏi cho Part này.");
      return;
    }

    let end = settings.end;
    if (end < nextStart) end = nextStart;
    if (bounds && end > bounds.end) end = bounds.end;

    const count = end - nextStart + 1;
    if (count > 50) {
      alert("Không nên tạo quá 50 câu một lúc.");
      return;
    }
    
    const newQs: Question[] = [];
    for (let i = 0; i < count; i++) {
      let defaultOptions: string[] | undefined = undefined;
      if (settings.type === 'TRUE_FALSE_NOT_GIVEN') defaultOptions = ['TRUE', 'FALSE', 'NOT GIVEN'];
      else if (settings.type === 'YES_NO_NOT_GIVEN') defaultOptions = ['YES', 'NO', 'NOT GIVEN'];
      else if (settings.type.includes('MULTIPLE_CHOICE')) defaultOptions = ['A', 'B', 'C', 'D'];
      
      newQs.push({
        question_id: `q_${String(nextStart + i).padStart(3, '0')}`,
        type: settings.type,
        question_text: `Câu ${nextStart + i}`,
        metadata: { correct_answer: settings.type === 'MULTIPLE_CHOICE_MULTI' ? [] : '', explanation: '', options: defaultOptions }
      });
    }
    
    const newParts = [...parts];
    newParts[partIdx].question_groups[groupIdx].questions = [...newParts[partIdx].question_groups[groupIdx].questions, ...newQs];
    setParts(newParts);
  };


  const updateGroup = (partIdx: number, groupIdx: number, field: keyof QuestionGroup, value: any) => {
    const newParts = [...parts];
    newParts[partIdx].question_groups[groupIdx] = { ...newParts[partIdx].question_groups[groupIdx], [field]: value };
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

  if (wizardMode === 'START') {
    return (
      <div style={{ background: 'var(--bg-secondary)', padding: '3rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2rem' }}>Bắt đầu tạo Đề thi</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '900px' }}>
          
          <div className="ed-card flex-center" style={{ flexDirection: 'column', padding: '2rem', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', border: '2px solid transparent' }} onClick={() => setWizardMode('FULL')} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <AlignLeft size={32} color="var(--primary)" />
            </div>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>1. Tạo Full Đề</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Sinh toàn bộ cấu trúc chuẩn của một đề thi (IELTS, TOEIC...)</p>
          </div>

          <div className="ed-card flex-center" style={{ flexDirection: 'column', padding: '2rem', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', border: '2px solid transparent' }} onClick={() => setWizardMode('SKILL')} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Zap size={32} color="var(--primary)" />
            </div>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>2. Tạo 1 Kỹ năng</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Chỉ tạo toàn bộ phần Reading, Listening hoặc Writing</p>
          </div>

          <div className="ed-card flex-center" style={{ flexDirection: 'column', padding: '2rem', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', border: '2px solid transparent' }} onClick={() => setWizardMode('PART')} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Plus size={32} color="var(--primary)" />
            </div>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>3. Tạo 1 Part Lẻ</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Chỉ tạo 1 đoạn văn (Passage) hoặc 1 part trắc nghiệm nhỏ</p>
          </div>

        </div>
        
        {parts.length > 0 && (
          <button className="btn btn-outline" style={{ marginTop: '2rem' }} onClick={() => setWizardMode('BUILDER')}>
            Đóng & Quay lại Trình chỉnh sửa
          </button>
        )}
      </div>
    );
  }

  if (wizardMode === 'FULL') {
    return (
      <div style={{ background: 'var(--bg-secondary)', padding: '3rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>Chọn Loại Sườn Đề</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '400px' }}>
          <button className="btn btn-outline flex-center" style={{ padding: '1rem', background: 'white', fontSize: '1rem', justifyContent: 'center' }} onClick={() => { applyTemplate('IELTS'); setWizardMode('BUILDER'); }}>Full IELTS Academic</button>
          <button className="btn btn-outline flex-center" style={{ padding: '1rem', background: 'white', fontSize: '1rem', justifyContent: 'center' }} onClick={() => { applyTemplate('TOEIC'); setWizardMode('BUILDER'); }}>Full TOEIC L&R</button>
          <button className="btn btn-outline flex-center" style={{ padding: '1rem', background: 'white', fontSize: '1rem', justifyContent: 'center' }} onClick={() => { applyTemplate('VSTEP'); setWizardMode('BUILDER'); }}>Full VSTEP B1-C1</button>
          <button className="btn btn-outline flex-center" style={{ padding: '1rem', background: 'white', fontSize: '1rem', justifyContent: 'center' }} onClick={() => { applyTemplate('TOEIC_WRITING'); setWizardMode('BUILDER'); }}>Full TOEIC Writing</button>
        </div>
        <button className="btn" style={{ marginTop: '2rem' }} onClick={() => setWizardMode('START')}>Quay lại</button>
      </div>
    );
  }

  if (wizardMode === 'SKILL') {
    return (
      <div style={{ background: 'var(--bg-secondary)', padding: '3rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>Chọn Kỹ Năng Cần Thêm</h2>
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <select className="input-field" style={{ padding: '0.75rem', fontSize: '1rem', background: 'white' }} value={selectedSkill} onChange={e => setSelectedSkill(e.target.value)}>
            <option value="IELTS_LISTENING">IELTS - Listening (4 Parts)</option>
            <option value="IELTS_READING">IELTS - Reading (3 Passages)</option>
            <option value="IELTS_WRITING">IELTS - Writing (2 Tasks)</option>
            <option value="TOEIC_LISTENING">TOEIC - Listening (Part 1-4)</option>
            <option value="TOEIC_READING">TOEIC - Reading (Part 5-7)</option>
            <option value="VSTEP_LISTENING">VSTEP - Listening (3 Phần)</option>
            <option value="VSTEP_READING">VSTEP - Reading (4 Phần)</option>
            <option value="VSTEP_WRITING">VSTEP - Writing (2 Bài)</option>
          </select>
          <button className="btn btn-primary flex-center" style={{ padding: '0.75rem 1rem', fontSize: '1rem', justifyContent: 'center' }} onClick={() => { addSkillTemplate(selectedSkill); setWizardMode('BUILDER'); }}>
            <Plus size={18} /> Thêm Kỹ Năng Này
          </button>
        </div>
        <button className="btn" style={{ marginTop: '2rem' }} onClick={() => setWizardMode('START')}>Quay lại</button>
      </div>
    );
  }

  if (wizardMode === 'PART') {
    return (
      <div style={{ background: 'var(--bg-secondary)', padding: '3rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>Chọn Part Lẻ Cần Thêm</h2>
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <select className="input-field" style={{ padding: '0.75rem', fontSize: '1rem', background: 'white' }} value={selectedSpecificPart} onChange={e => setSelectedSpecificPart(e.target.value)}>
            <optgroup label="IELTS Academic">
              <option value="IELTS_L1">IELTS Listening Part 1</option>
              <option value="IELTS_L2">IELTS Listening Part 2</option>
              <option value="IELTS_L3">IELTS Listening Part 3</option>
              <option value="IELTS_L4">IELTS Listening Part 4</option>
              <option value="IELTS_R1">IELTS Reading Passage</option>
              <option value="IELTS_W1">IELTS Writing Task 1</option>
              <option value="IELTS_W2">IELTS Writing Task 2</option>
            </optgroup>
            <optgroup label="TOEIC Listening & Reading">
              <option value="TOEIC_P1">TOEIC Part 1: Photographs</option>
              <option value="TOEIC_P2">TOEIC Part 2: Question-Response</option>
              <option value="TOEIC_P3">TOEIC Part 3: Conversations</option>
              <option value="TOEIC_P4">TOEIC Part 4: Talks</option>
              <option value="TOEIC_P5">TOEIC Part 5: Incomplete Sentences</option>
              <option value="TOEIC_P6">TOEIC Part 6: Text Completion</option>
              <option value="TOEIC_P7">TOEIC Part 7: Reading Comprehension</option>
            </optgroup>
            <optgroup label="TOEIC Writing">
              <option value="TW_P1">TOEIC Writing Part 1: Write a Sentence</option>
              <option value="TW_P2">TOEIC Writing Part 2: Respond to Request</option>
            </optgroup>
            <optgroup label="VSTEP">
              <option value="VSTEP_L">VSTEP Kỹ năng Nghe (1 Phần)</option>
              <option value="VSTEP_R">VSTEP Kỹ năng Đọc (1 Phần)</option>
              <option value="VSTEP_W">VSTEP Kỹ năng Viết (1 Bài)</option>
            </optgroup>
          </select>
          <button className="btn btn-primary flex-center" style={{ padding: '0.75rem 1rem', fontSize: '1rem', justifyContent: 'center' }} onClick={() => { addSpecificPart(selectedSpecificPart); setWizardMode('BUILDER'); }}>
            <Plus size={18} /> Thêm Part Này
          </button>
        </div>
        <button className="btn" style={{ marginTop: '2rem' }} onClick={() => setWizardMode('START')}>Quay lại</button>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Trình tạo Đề thi Trực quan</h3>
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
          <p>Chưa có Part nào. Bấm <strong>"+ Thêm Kỹ Năng / Part"</strong> ở góc trên để thêm nội dung.</p>
        </div>
      ) : (
        <div>
          {/* TABS */}
          <div style={{ display: 'flex', overflowX: 'auto', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-light)' }}>
            {parts.map((tabPart, tabIndex) => (
              <button 
                key={tabIndex} 
                onClick={() => setActivePartIndex(tabIndex)}
                style={{ 
                  padding: '0.75rem 1.5rem', 
                  border: 'none', 
                  background: 'transparent',
                  borderBottom: activePartIndex === tabIndex ? '3px solid var(--primary)' : '3px solid transparent',
                  color: activePartIndex === tabIndex ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: activePartIndex === tabIndex ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {tabPart.part_title || `Part ${tabIndex + 1}`}
              </button>
            ))}
          </div>

          {/* ACTIVE TAB CONTENT */}
          {(() => {
            const pIndex = activePartIndex;
            const part = parts[pIndex];
            if (!part) return null;
            return (
              <div className="ed-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderLeft: '4px solid var(--primary)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
                  <button className="btn" style={{ padding: '0.25rem 0.5rem', color: 'var(--danger)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }} onClick={() => {
                    if (window.confirm('Bạn có chắc muốn xóa Part này?')) {
                      const newParts = [...parts];
                      newParts.splice(pIndex, 1);
                      setParts(newParts);
                      if (activePartIndex >= newParts.length) setActivePartIndex(Math.max(0, newParts.length - 1));
                    }
                  }}>
                    <Trash2 size={16} /> Xóa Part
                  </button>
                </div>
                
                {/* Part Settings */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1, maxWidth: '300px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Tiêu đề Part</label>
                    <input type="text" className="input-field" value={part.part_title} onChange={(e) => updatePart(pIndex, 'part_title', e.target.value)} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Hướng dẫn chung (Instruction)</label>
                    <input type="text" className="input-field" value={part.instruction || ''} onChange={e => updatePart(pIndex, 'instruction', e.target.value)} placeholder="VD: Listen to the conversation..." />
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
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
                    const isFixedStructure = isFixedWriting;
                    
                    const boundsForGroup = getPartBounds(part.part_title, examType);
                    const nextStartForGroup = getNextStartForPart(part, boundsForGroup);
                    const isPartFullForGroup = boundsForGroup && nextStartForGroup > boundsForGroup.end;
                    
                    return (
                    <div key={group.group_id} style={{ 
                      border: isWriting ? 'none' : '1px solid var(--border-light)', 
                      borderRadius: isWriting ? '0' : 'var(--radius-md)', 
                      padding: isWriting ? '0' : '1.5rem', 
                      marginBottom: '1.5rem', 
                      position: 'relative' 
                    }}>
                      {!isWriting && <span style={{ position: 'absolute', top: '-12px', left: '1rem', background: 'var(--bg-primary)', padding: '0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>GROUP {gIndex + 1} ({group.questions.length} CÂU)</span>}
                      
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

                        {/* ẨN TẠO NHANH NẾU LÀ KỸ NĂNG VIẾT HOẶC ĐÃ CÓ CÂU HỎI */}
                        {(!isWriting && group.questions.length === 0) && (
                          <div className="flex-center" style={{ gap: '1rem', background: 'white', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-light)', marginBottom: '1rem' }}>
                            {(() => {
                              if (isPartFullForGroup) return <span style={{ color: 'var(--text-muted)' }}>Đã tạo đủ số lượng câu hỏi cho Part này.</span>;

                              return (
                                <>
                                  <Settings size={18} color="var(--primary)" />
                                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--primary)' }}>Tạo Nhanh:</span>
                                  
                                  <select className="input-field" style={{ width: '200px', padding: '0.4rem', fontSize: '0.875rem' }} value={batchSettings[group.group_id]?.type || 'MULTIPLE_CHOICE'} onChange={e => setBatchSettings(prev => ({ ...prev, [group.group_id]: { ...prev[group.group_id], type: e.target.value } }))}>
                                    {QUESTION_TYPES.map(qt => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
                                  </select>
                                  
                                  <span style={{ fontSize: '0.875rem' }}>Từ câu: <strong style={{ color: 'var(--primary)' }}>{nextStartForGroup}</strong></span>
                                  
                                  <span style={{ fontSize: '0.875rem', marginLeft: '1rem' }}>Đến câu</span>
                                  {boundsForGroup ? (
                                    <select className="input-field" style={{ width: '60px', padding: '0.4rem', textAlign: 'center' }} value={batchSettings[group.group_id]?.end || nextStartForGroup} onChange={e => setBatchSettings(prev => ({ ...prev, [group.group_id]: { ...prev[group.group_id], end: parseInt(e.target.value) || nextStartForGroup } }))}>
                                      {Array.from({ length: boundsForGroup.end - nextStartForGroup + 1 }, (_, i) => nextStartForGroup + i).map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                  ) : (
                                    <input type="number" className="input-field" style={{ width: '60px', padding: '0.4rem', textAlign: 'center' }} value={batchSettings[group.group_id]?.end || (nextStartForGroup + 4)} onChange={e => setBatchSettings(prev => ({ ...prev, [group.group_id]: { ...prev[group.group_id], end: parseInt(e.target.value) || (nextStartForGroup + 4) } }))} min={nextStartForGroup} />
                                  )}
                                  
                                  <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => batchGenerateQuestions(pIndex, gIndex, group.group_id)}>
                                    Khởi tạo
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {/* Questions List */}
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                          {group.questions.map((q, qIndex) => (
                            <div key={qIndex} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: 'white', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', marginBottom: '0.75rem' }}>
                              {!isWriting && (
                                <div style={{ background: 'var(--primary)', color: 'white', width: '32px', height: '24px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
                                  {q.question_id.split('_')[1] || (qIndex + 1)}
                                </div>
                              )}
                              <div style={{ flex: 1 }}>
                                <select className="input-field" style={{ padding: '0.2rem', fontSize: '0.75rem', marginBottom: '0.25rem', width: '200px' }} value={q.type} onChange={e => updateQuestion(pIndex, gIndex, qIndex, 'type', e.target.value)}>
                                  {QUESTION_TYPES.map(qt => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
                                </select>
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


                  {(!part.part_title.toLowerCase().includes('writing task') && !part.part_title.toLowerCase().includes('kỹ năng viết')) && (
                    (() => {
                      const boundsForPart = getPartBounds(part.part_title, examType);
                      const nextStartForPart = getNextStartForPart(part, boundsForPart);
                      const isPartFull = boundsForPart && nextStartForPart > boundsForPart.end;
                      
                      if (isPartFull) {
                        return <div style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600, padding: '1rem' }}>✓ Đã tạo đủ số lượng câu hỏi cho Part này.</div>;
                      }

                      return (
                        <button className="btn btn-outline" style={{ width: '100%', borderStyle: 'dashed' }} onClick={() => addGroup(pIndex)}>
                          <Plus size={16} /> Thêm Nhóm câu hỏi / Đoạn văn mới
                        </button>
                      );
                    })()
                  )}
                </div>
            );
          })()}
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
