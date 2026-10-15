import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Save, AlignLeft, Settings, Image, Music, Zap, CheckCircle, FileText, Upload, Download, Edit3, ArrowUp } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import MediaUploadButton from '../../../../components/common/MediaUploadButton';
import RichTextEditor from '../../../../components/common/RichTextEditor';
import Swal from 'sweetalert2';
import './ExamBuilder.css';
import axiosClient from '../../../../core/api/axiosClient';
import { addEditorOption, removeEditorOption, toEditorParts } from '../../utils/examContentMapping';

interface QuestionMetadata {
  options?: string[];
  correct_answer?: string | string[] | null;
  explanation?: string;
  correct_option_index?: number;
  correct_option_indices?: number[];
  [key: string]: any;
}

interface Question {
  question_id: string;
  type: string;
  question_text: string;
  metadata: QuestionMetadata;
  media?: { type: string; url: string; [key: string]: unknown };
}

export interface QuestionGroup {
  group_id: string;
  instruction: string;
  content_html: string;
  shared_audio?: { url: string; duration_seconds?: number };
  shared_media?: { type: 'image'; url: string; display_config?: { size_preset: string; alignment: string } };
  shared_images?: string[];
  questions: Question[];
}

export interface ExamPart {
  partNumber?: number;
  [key: string]: any;
  part_title: string;
  instruction: string;
  shared_audio?: { url: string; duration_seconds?: number };
  shared_content_html?: string;
  question_groups: QuestionGroup[];
}

export function deduplicatePartAndGroupInstructions(parts: ExamPart[]): ExamPart[] {
  return parts.map(part => {
    let partInstruction = (part.instruction || '').trim();
    const groups = part.question_groups || [];

    // If part instruction is missing, but all groups share the exact same non-empty instruction:
    if (!partInstruction && groups.length > 0) {
      const firstGroupInstr = (groups[0].instruction || '').trim();
      if (firstGroupInstr && groups.every(g => (g.instruction || '').trim() === firstGroupInstr)) {
        partInstruction = firstGroupInstr;
      }
    }

    const updatedGroups = groups.map(g => {
      const groupInstr = (g.instruction || '').trim();
      // If group instruction matches part instruction, clear it from group
      if (partInstruction && groupInstr === partInstruction) {
        return { ...g, instruction: '' };
      }
      return g;
    });

    return {
      ...part,
      instruction: partInstruction,
      question_groups: updatedGroups
    };
  });
}

export interface ExcelColumnMap {
  part: number;
  partInstruction: number;
  group: number;
  type: number;
  groupInstruction: number;
  legacyInstruction: number;
  passage: number;
  question: number;
  optA: number;
  optB: number;
  optC: number;
  optD: number;
  correct: number;
  explanation: number;
  partMedia: number;
  groupMedia: number;
  qMedia: number;
}

export function detectExcelColumns(headers: (string | undefined)[]): ExcelColumnMap {
  const colMap: ExcelColumnMap = {
    part: -1,
    partInstruction: -1,
    group: -1,
    type: -1,
    groupInstruction: -1,
    legacyInstruction: -1,
    passage: -1,
    question: -1,
    optA: -1,
    optB: -1,
    optC: -1,
    optD: -1,
    correct: -1,
    explanation: -1,
    partMedia: -1,
    groupMedia: -1,
    qMedia: -1,
  };

  for (let i = 0; i < headers.length; i++) {
    const colNumber = i + 1;
    const headerText = headers[i];
    const text = (headerText || '').toLowerCase().trim();
    if (!text) continue;

    if (
      text.includes('hướng dẫn chung') ||
      (text.includes('part') && text.includes('instruction')) ||
      (text.includes('hướng dẫn') && text.includes('phần'))
    ) {
      colMap.partInstruction = colNumber;
    } else if (
      text.includes('hướng dẫn riêng') ||
      (text.includes('group') && text.includes('instruction')) ||
      (text.includes('hướng dẫn') && text.includes('nhóm'))
    ) {
      colMap.groupInstruction = colNumber;
    } else if (text.includes('hướng dẫn') || text.includes('instruction')) {
      colMap.legacyInstruction = colNumber;
    } else if (
      text.includes('audio') ||
      (text.includes('chung') && text.includes('phần')) ||
      (text.includes('media') && text.includes('part'))
    ) {
      colMap.partMedia = colNumber;
    } else if (
      text.includes('đính kèm chung') ||
      (text.includes('media') && text.includes('group')) ||
      (text.includes('chung') && text.includes('nhóm'))
    ) {
      colMap.groupMedia = colNumber;
    } else if (
      text.includes('đính kèm riêng') ||
      (text.includes('media') && text.includes('câu')) ||
      text.includes('qmedia')
    ) {
      colMap.qMedia = colNumber;
    } else if (
      text.includes('nội dung nhóm') ||
      text.includes('văn bản') ||
      text.includes('đoạn văn') ||
      text.includes('passage') ||
      text.includes('prompt') ||
      (text.includes('nội dung') && !text.includes('câu hỏi') && !text.includes('question'))
    ) {
      colMap.passage = colNumber;
    } else if (
      !text.includes('hướng dẫn') &&
      !text.includes('nội dung') &&
      !text.includes('đính kèm') &&
      !text.includes('media') &&
      (text.includes('nhóm') || text.includes('group'))
    ) {
      colMap.group = colNumber;
    } else if (
      !text.includes('hướng dẫn') &&
      !text.includes('audio') &&
      !text.includes('file') &&
      !text.includes('media') &&
      (text.includes('phần') || text.includes('part'))
    ) {
      colMap.part = colNumber;
    } else if (
      text.includes('loại câu hỏi') ||
      text.includes('question type') ||
      text === 'type' ||
      text.includes('(type)')
    ) {
      colMap.type = colNumber;
    } else if (
      text.includes('câu hỏi') ||
      text.includes('question text') ||
      text === 'question' ||
      text.includes('(question')
    ) {
      colMap.question = colNumber;
    } else if (
      text.includes('lựa chọn a') ||
      text.includes('option a') ||
      text === 'a' ||
      text === 'opta'
    ) {
      colMap.optA = colNumber;
    } else if (
      text.includes('lựa chọn b') ||
      text.includes('option b') ||
      text === 'b' ||
      text === 'optb'
    ) {
      colMap.optB = colNumber;
    } else if (
      text.includes('lựa chọn c') ||
      text.includes('option c') ||
      text === 'c' ||
      text === 'optc'
    ) {
      colMap.optC = colNumber;
    } else if (
      text.includes('lựa chọn d') ||
      text.includes('option d') ||
      text === 'd' ||
      text === 'optd'
    ) {
      colMap.optD = colNumber;
    } else if (
      text.includes('đáp án đúng') ||
      text.includes('đáp án') ||
      text.includes('correct') ||
      text.includes('(key)') ||
      text === 'key'
    ) {
      colMap.correct = colNumber;
    } else if (
      text.includes('giải thích') ||
      text.includes('explanation')
    ) {
      colMap.explanation = colNumber;
    }
  }

  const is16Col = colMap.partInstruction > 0 || colMap.groupInstruction > 0 || headers.length >= 16;
  if (is16Col) {
    if (colMap.part === -1) colMap.part = 1;
    if (colMap.partInstruction === -1) colMap.partInstruction = 2;
    if (colMap.group === -1) colMap.group = 3;
    if (colMap.type === -1) colMap.type = 4;
    if (colMap.groupInstruction === -1) colMap.groupInstruction = 5;
    if (colMap.passage === -1) colMap.passage = 6;
    if (colMap.question === -1) colMap.question = 7;
    if (colMap.optA === -1) colMap.optA = 8;
    if (colMap.optB === -1) colMap.optB = 9;
    if (colMap.optC === -1) colMap.optC = 10;
    if (colMap.optD === -1) colMap.optD = 11;
    if (colMap.correct === -1) colMap.correct = 12;
    if (colMap.explanation === -1) colMap.explanation = 13;
    if (colMap.partMedia === -1) colMap.partMedia = 14;
    if (colMap.groupMedia === -1) colMap.groupMedia = 15;
    if (colMap.qMedia === -1) colMap.qMedia = 16;
  } else {
    if (colMap.part === -1) colMap.part = 1;
    if (colMap.group === -1) colMap.group = 2;
    if (colMap.type === -1) colMap.type = 3;
    if (colMap.legacyInstruction === -1 && colMap.partInstruction === -1 && colMap.groupInstruction === -1) {
      colMap.legacyInstruction = 4;
    }
    if (colMap.passage === -1) colMap.passage = 5;
    if (colMap.question === -1) colMap.question = 6;
    if (colMap.optA === -1) colMap.optA = 7;
    if (colMap.optB === -1) colMap.optB = 8;
    if (colMap.optC === -1) colMap.optC = 9;
    if (colMap.optD === -1) colMap.optD = 10;
    if (colMap.correct === -1) colMap.correct = 11;
    if (colMap.explanation === -1) colMap.explanation = 12;
    if (colMap.partMedia === -1) colMap.partMedia = 13;
    if (colMap.groupMedia === -1) colMap.groupMedia = 14;
    if (colMap.qMedia === -1) colMap.qMedia = 15;
  }

  return colMap;
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

export const EXAM_TYPE_OPTIONS: Record<string, string> = {
  'IELTS_ACADEMIC': 'IELTS Academic',
  'IELTS_GENERAL': 'IELTS General',
  'TOEIC_LR': 'TOEIC (Listening & Reading)',
  'TOEIC_WRITING': 'TOEIC Writing',
  'NLTV_B1_C1': 'NLTV (B1 - C1)',
  'NLTV_A1_A2': 'NLTV (A1 - A2)',
  'OTHER': 'Khác (Other)'
};

export const normalizeExamType = (raw: string): string => {
  if (!raw) return 'IELTS_ACADEMIC';
  const clean = raw.trim().toUpperCase();
  if (
    clean === 'TOEIC' ||
    clean === 'TOEIC_LR' ||
    clean === 'TOEIC_LISTENING_READING' ||
    clean.includes('TOEIC (LISTENING & READING)') ||
    clean.includes('LISTENING & READING') ||
    clean.includes('L&R')
  ) {
    return 'TOEIC_LR';
  }
  if (clean === 'TOEIC_WRITING' || clean.includes('TOEIC WRITING')) {
    return 'TOEIC_WRITING';
  }
  if (clean === 'IELTS_GENERAL' || clean.includes('GENERAL')) {
    return 'IELTS_GENERAL';
  }
  if (clean === 'IELTS' || clean === 'IELTS_ACADEMIC' || clean.includes('ACADEMIC')) {
    return 'IELTS_ACADEMIC';
  }
  if (clean === 'NLTV' || clean === 'NLTV_B1_C1' || clean.includes('B1 - C1') || clean.includes('B1_C1')) {
    return 'NLTV_B1_C1';
  }
  if (clean === 'NLTV_A1_A2' || clean.includes('A1 - A2') || clean.includes('A1_A2')) {
    return 'NLTV_A1_A2';
  }
  if (clean === 'OTHER') return 'OTHER';
  return clean;
};

const getPartBounds = (partTitle: string, examType: string) => {
  if (examType.startsWith('IELTS')) {
    if (partTitle.includes('Listening Part 1')) return { start: 1, end: 10 };
    if (partTitle.includes('Listening Part 2')) return { start: 11, end: 20 };
    if (partTitle.includes('Listening Part 3')) return { start: 21, end: 30 };
    if (partTitle.includes('Listening Part 4')) return { start: 31, end: 40 };
    if (partTitle.includes('Reading Passage 1')) return { start: 1, end: 13 };
    if (partTitle.includes('Reading Passage 2')) return { start: 14, end: 26 };
    if (partTitle.includes('Reading Passage 3')) return { start: 27, end: 40 };
  }
  if (examType.startsWith('TOEIC') && !examType.includes('WRITING')) {
    if (partTitle.includes('Part 1')) return { start: 1, end: 6 };
    if (partTitle.includes('Part 2')) return { start: 7, end: 31 };
    if (partTitle.includes('Part 3')) return { start: 32, end: 70 };
    if (partTitle.includes('Part 4')) return { start: 71, end: 100 };
    if (partTitle.includes('Part 5')) return { start: 101, end: 130 };
    if (partTitle.includes('Part 6')) return { start: 131, end: 146 };
    if (partTitle.includes('Part 7')) return { start: 147, end: 200 };
  }
  if (examType.startsWith('NLTV')) {
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

const getMaxGroupsForPart = (partTitle: string, examType: string) => {
  if (examType.startsWith('TOEIC') && !examType.includes('WRITING')) {
    if (partTitle.includes('Part 1')) return 6;
    if (partTitle.includes('Part 2')) return 1;
    if (partTitle.includes('Part 3')) return 13;
    if (partTitle.includes('Part 4')) return 10;
    if (partTitle.includes('Part 5')) return 1;
    if (partTitle.includes('Part 6')) return 4;
    if (partTitle.includes('Part 7')) return 15;
  }
  if (examType.startsWith('TOEIC_WRITING')) {
    if (partTitle.includes('Part 1')) return 5;
    if (partTitle.includes('Part 2')) return 2;
    if (partTitle.includes('Part 3')) return 1;
  }
  if (examType.startsWith('NLTV')) {
    if (partTitle.includes('Nghe - Phần 1')) return 8;
    if (partTitle.includes('Nghe - Phần 2')) return 3;
    if (partTitle.includes('Nghe - Phần 3')) return 3;
    if (partTitle.includes('Đọc - Phần 1')) return 1;
    if (partTitle.includes('Đọc - Phần 2')) return 1;
    if (partTitle.includes('Đọc - Phần 3')) return 1;
    if (partTitle.includes('Đọc - Phần 4')) return 1;
    if (partTitle.includes('Viết - Bài 1')) return 1;
    if (partTitle.includes('Viết - Bài 2')) return 1;
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

const ExamBuilder = ({ initialData, onSave, onCancel }: { initialData?: any, onSave: (json: string) => void, onCancel: () => void }) => {
  const [examTitle, setExamTitle] = useState('Đề thi Mới');
  const [examType, setExamType] = useState('IELTS_ACADEMIC');
  const [isPublished, setIsPublished] = useState(true);
  const [parts, setParts] = useState<ExamPart[]>([]);
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [selectedSpecificPart, setSelectedSpecificPart] = useState('IELTS_L1');
  const [selectedSkill, setSelectedSkill] = useState('IELTS_LISTENING');
  const [wizardMode, setWizardMode] = useState<'START' | 'FULL' | 'SKILL' | 'PART' | 'BUILDER'>('START');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importController = useRef<AbortController | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importIssues, setImportIssues] = useState<Array<{ sheet: string | null; cell: string | null; questionId: string | null; message: string }>>([]);
  const [saving, setSaving] = useState(false);
  const saveMutex = useRef(false);
  useEffect(() => () => { importController.current?.abort(); }, []);
  const importNotice = <>
    {importing && <p role="status">Đang kiểm tra file Excel…</p>}
    {importError && <p role="alert">{importError}</p>}
    {importIssues.length > 0 && <div role="alert">
      <p>Cần hoàn thiện {importIssues.length} vấn đề trước khi xuất bản. Dữ liệu hiện chỉ là bản nháp.</p>
      <ul>{importIssues.slice(0, 50).map((issue, index) => <li key={index}>
        {[issue.sheet, issue.cell, issue.questionId].filter(Boolean).join(' — ')}: {issue.message}
      </li>)}</ul>
      {importIssues.length > 50 && <p>Hiển thị 50 vấn đề đầu tiên. Các vấn đề còn lại cần được kiểm tra trong báo cáo preview.</p>}
    </div>}
  </>;

  useEffect(() => {
    if (initialData) {
      setExamTitle(initialData.title || 'Đề thi Mới');
      const rawType = initialData.type || 'IELTS_ACADEMIC';
      const normalizedType = normalizeExamType(rawType);
      setExamType(normalizedType);
      
      const publishedState = initialData.published !== undefined ? initialData.published : initialData.isPublished;
      setIsPublished(publishedState !== false);
      if (normalizedType === 'TOEIC_LR') {
        const mapped = toEditorParts(initialData);
        setParts(mapped);
        if (mapped.length) setWizardMode('BUILDER');
        return;
      }
      
      const loadedParts: ExamPart[] = [];
      initialData.sections?.forEach((s: any) => {
        s.parts?.forEach((p: any) => {
          loadedParts.push({
            part_title: p.contentData?.part_title || '',
            instruction: p.contentData?.instruction || '',
            shared_audio: p.contentData?.shared_audio,
            shared_content_html: p.contentData?.shared_content_html,
            question_groups: (p.contentData?.question_groups || []).map((g: any) => ({
              ...g,
              shared_images: g.shared_images || (g.shared_media?.url ? [g.shared_media.url] : [])
            }))
          });
        });
      });
      const cleanedParts = deduplicatePartAndGroupInstructions(loadedParts);
      setParts(cleanedParts);
      if (cleanedParts.length > 0) {
        setWizardMode('BUILDER');
      }
    }
  }, [initialData]);

  // Local state for batch generation
  const [batchSettings, setBatchSettings] = useState<Record<string, { type: string; start: number; end: number }>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = (e?: Event) => {
      const adminMain = document.querySelector('.admin-main');
      const targetScroll = e?.target && (e.target as HTMLElement).scrollTop !== undefined 
        ? (e.target as HTMLElement).scrollTop 
        : 0;
      const scrollTop = Math.max(
        window.pageYOffset || 0,
        window.scrollY || 0,
        document.documentElement.scrollTop || 0,
        document.body.scrollTop || 0,
        adminMain ? adminMain.scrollTop : 0,
        targetScroll
      );
      setShowScrollTop(scrollTop > 200);
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const adminMain = document.querySelector('.admin-main');
    if (adminMain) {
      adminMain.scrollTo({ top: 0, behavior: 'smooth' });
    }
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 6)}`;

  const createToeicQuestions = (start: number, end: number, optionsCount: number = 4) => {
    const qs: Question[] = [];
    const options = optionsCount === 3 ? ['', '', ''] : ['', '', '', ''];
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

  // Helper reserved for future generic question group creation:
  // const _createGenericGroup = (start: number, end: number, type: string = 'MULTIPLE_CHOICE') => { ... }

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
      case 'NLTV_L': newPart = { part_title: 'Kỹ năng Nghe - Phần 1', instruction: 'Hướng dẫn phần nghe', shared_audio: { url: '' }, question_groups: [] }; break;
      case 'NLTV_R': newPart = { part_title: 'Kỹ năng Đọc - Phần 1', instruction: 'Hướng dẫn phần đọc', question_groups: [] }; break;
      case 'NLTV_W': newPart = { part_title: 'Kỹ năng Viết - Bài 1', instruction: 'Viết thư/email', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'WRITING_ESSAY', question_text: 'Viết luận.', metadata: { correct_answer: '', explanation: '' } }] }] }; break;
    }
    if (newPart) {
      if (parts.length === 0) {
        setExamType(partKey);
      }
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
        newPartsToAdd.push({ part_title: 'Part 7: Reading Comprehension', instruction: 'Questions 147-200', question_groups: [
          ...createToeicGroups(147, 4, 2, 4),
          ...createToeicGroups(155, 3, 3, 4),
          ...createToeicGroups(164, 3, 4, 4),
          ...createToeicGroups(176, 5, 5, 4)
        ] });
        break;
      case 'NLTV_LISTENING':
        newPartsToAdd.push({ part_title: 'Kỹ năng Nghe - Phần 1', instruction: 'Hướng dẫn phần nghe', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 8, 1, 4) });
        newPartsToAdd.push({ part_title: 'Kỹ năng Nghe - Phần 2', instruction: 'Hướng dẫn phần nghe', shared_audio: { url: '' }, question_groups: createToeicGroups(9, 3, 4, 4) });
        newPartsToAdd.push({ part_title: 'Kỹ năng Nghe - Phần 3', instruction: 'Hướng dẫn phần nghe', shared_audio: { url: '' }, question_groups: createToeicGroups(21, 3, 5, 4) });
        break;
      case 'NLTV_READING':
        newPartsToAdd.push({ part_title: 'Kỹ năng Đọc - Phần 1', instruction: 'Hướng dẫn phần đọc', question_groups: createToeicGroups(1, 1, 10, 4) });
        newPartsToAdd.push({ part_title: 'Kỹ năng Đọc - Phần 2', instruction: 'Hướng dẫn phần đọc', question_groups: createToeicGroups(11, 1, 10, 4) });
        newPartsToAdd.push({ part_title: 'Kỹ năng Đọc - Phần 3', instruction: 'Hướng dẫn phần đọc', question_groups: createToeicGroups(21, 1, 10, 4) });
        newPartsToAdd.push({ part_title: 'Kỹ năng Đọc - Phần 4', instruction: 'Hướng dẫn phần đọc', question_groups: createToeicGroups(31, 1, 10, 4) });
        break;
      case 'NLTV_WRITING':
        newPartsToAdd.push({ part_title: 'Kỹ năng Viết - Bài 1', instruction: 'Viết thư/email', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'WRITING_ESSAY', question_text: 'Viết thư/email.', metadata: { correct_answer: '', explanation: '' } }] }] });
        newPartsToAdd.push({ part_title: 'Kỹ năng Viết - Bài 2', instruction: 'Viết bài luận', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'WRITING_ESSAY', question_text: 'Viết luận.', metadata: { correct_answer: '', explanation: '' } }] }] });
        break;
    }
    
    if (newPartsToAdd.length > 0) {
      if (parts.length === 0) {
        setExamType(skillKey);
      }
      setParts([...parts, ...newPartsToAdd]);
      setActivePartIndex(parts.length);
    }
  };

  // --- FULL TEMPLATE GENERATORS ---
  const applyTemplate = (type: 'IELTS' | 'TOEIC' | 'TOEIC_WRITING' | 'NLTV') => {
    if (parts.length > 0 && !window.confirm(`Áp dụng Template ${type} sẽ xóa toàn bộ nội dung hiện tại. Bạn có chắc chắn?`)) return;

    const newParts: ExamPart[] = [];
    
    if (type === 'IELTS') {
      setExamType('IELTS_ACADEMIC');
      setExamTitle('IELTS Academic Mock Test');
      
      // Listening
      newParts.push({ part_title: 'Listening Part 1', instruction: 'Listen and answer questions 1-10', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 1, 10, 4) });
      newParts.push({ part_title: 'Listening Part 2', instruction: 'Listen and answer questions 11-20', shared_audio: { url: '' }, question_groups: createToeicGroups(11, 1, 10, 4) });
      newParts.push({ part_title: 'Listening Part 3', instruction: 'Listen and answer questions 21-30', shared_audio: { url: '' }, question_groups: createToeicGroups(21, 1, 10, 4) });
      newParts.push({ part_title: 'Listening Part 4', instruction: 'Listen and answer questions 31-40', shared_audio: { url: '' }, question_groups: createToeicGroups(31, 1, 10, 4) });
      
      // Reading
      newParts.push({ part_title: 'Reading Passage 1', instruction: 'Read the passage and answer questions 1-13', question_groups: createToeicGroups(1, 1, 13, 4) });
      newParts.push({ part_title: 'Reading Passage 2', instruction: 'Read the passage and answer questions 14-26', question_groups: createToeicGroups(14, 1, 13, 4) });
      newParts.push({ part_title: 'Reading Passage 3', instruction: 'Read the passage and answer questions 27-40', question_groups: createToeicGroups(27, 1, 14, 4) });
      
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
      setExamType('TOEIC_LR');
      setExamTitle('TOEIC L&R Mock Test');
      // TOEIC Listening (100 qs)
      newParts.push({ part_title: 'Part 1: Photographs', instruction: 'Questions 1-6', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 6, 1, 4) }); // 6 groups (1 pic each), 1 q each
      newParts.push({ part_title: 'Part 2: Question-Response', instruction: 'Questions 7-31', shared_audio: { url: '' }, question_groups: createToeicGroups(7, 1, 25, 3) }); // 1 group, 25 qs, 3 options
      newParts.push({ part_title: 'Part 3: Conversations', instruction: 'Questions 32-70', shared_audio: { url: '' }, question_groups: createToeicGroups(32, 13, 3, 4) }); // 13 groups, 3 qs each
      newParts.push({ part_title: 'Part 4: Talks', instruction: 'Questions 71-100', shared_audio: { url: '' }, question_groups: createToeicGroups(71, 10, 3, 4) }); // 10 groups, 3 qs each
      
      // TOEIC Reading (100 qs)
      newParts.push({ part_title: 'Part 5: Incomplete Sentences', instruction: 'Questions 101-130', question_groups: createToeicGroups(101, 1, 30, 4) }); // 1 group, 30 qs
      newParts.push({ part_title: 'Part 6: Text Completion', instruction: 'Questions 131-146', question_groups: createToeicGroups(131, 4, 4, 4) }); // 4 groups, 4 qs each
      newParts.push({ part_title: 'Part 7: Reading Comprehension', instruction: 'Questions 147-200', question_groups: [
        ...createToeicGroups(147, 4, 2, 4),
        ...createToeicGroups(155, 3, 3, 4),
        ...createToeicGroups(164, 3, 4, 4),
        ...createToeicGroups(176, 5, 5, 4)
      ] });
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
    else if (type === 'NLTV') {
      setExamType('NLTV_B1_C1');
      setExamTitle('Đánh giá Năng lực Tiếng Việt (NLTV)');
      
      // Listening
      newParts.push({ part_title: 'Kỹ năng Nghe - Phần 1', instruction: 'Hướng dẫn phần 1', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 8, 1, 4) });
      newParts.push({ part_title: 'Kỹ năng Nghe - Phần 2', instruction: 'Hướng dẫn phần 2', shared_audio: { url: '' }, question_groups: createToeicGroups(9, 3, 4, 4) });
      newParts.push({ part_title: 'Kỹ năng Nghe - Phần 3', instruction: 'Hướng dẫn phần 3', shared_audio: { url: '' }, question_groups: createToeicGroups(21, 3, 5, 4) });
      
      // Reading
      newParts.push({ part_title: 'Kỹ năng Đọc - Phần 1', instruction: 'Hướng dẫn phần đọc 1', question_groups: createToeicGroups(1, 1, 10, 4) });
      newParts.push({ part_title: 'Kỹ năng Đọc - Phần 2', instruction: 'Hướng dẫn phần đọc 2', question_groups: createToeicGroups(11, 1, 10, 4) });
      newParts.push({ part_title: 'Kỹ năng Đọc - Phần 3', instruction: 'Hướng dẫn phần đọc 3', question_groups: createToeicGroups(21, 1, 10, 4) });
      newParts.push({ part_title: 'Kỹ năng Đọc - Phần 4', instruction: 'Hướng dẫn phần đọc 4', question_groups: createToeicGroups(31, 1, 10, 4) });
      
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
      else if (settings.type.includes('MULTIPLE_CHOICE')) defaultOptions = ['', '', '', ''];
      
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

  const generateExcelTemplate = async (partsData: ExamPart[], typeName: string, title?: string) => {
    if (partsData.length === 0) {
      Swal.fire('Lỗi', 'Cấu trúc sườn đề trống, không thể xuất file mẫu.', 'error');
      return;
    }

    const currentTitle = (title || examTitle || 'Đề thi Mới').trim();
    const normalizedType = normalizeExamType(typeName);
    const typeDisplay = EXAM_TYPE_OPTIONS[normalizedType] || typeName;

    const totalParts = partsData.length;
    let totalQuestions = 0;
    partsData.forEach(p => {
      p.question_groups.forEach(g => {
        totalQuestions += g.questions.length;
      });
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Multilingo Platform';
    workbook.lastModifiedBy = 'Multilingo Admin';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.title = currentTitle;
    workbook.subject = normalizedType;
    workbook.description = `Đề thi ${currentTitle} - Loại: ${typeDisplay}`;

    // ==========================================
    // SHEET 1: THÔNG TIN ĐỀ THI (METADATA)
    // ==========================================
    const infoSheet = workbook.addWorksheet('Thông Tin Đề Thi', {
      views: [{ showGridLines: true }]
    });

    infoSheet.columns = [
      { width: 32 }, // Cột A
      { width: 48 }, // Cột B
      { width: 55 }  // Cột C
    ];

    // Banner A1:C1
    infoSheet.mergeCells('A1:C1');
    const bannerCell = infoSheet.getCell('A1');
    bannerCell.value = 'THÔNG TIN CẤU TRÚC ĐỀ THI - MULTILINGO PLATFORM';
    bannerCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
    bannerCell.alignment = { vertical: 'middle', horizontal: 'center' };
    infoSheet.getRow(1).height = 36;

    // Sub-banner A2:C2
    infoSheet.mergeCells('A2:C2');
    const subBanner = infoSheet.getCell('A2');
    subBanner.value = 'File Excel chuẩn dùng để soạn thảo & nhập (Import) trực tiếp vào hệ thống Multilingo';
    subBanner.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF4338CA' } };
    subBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
    subBanner.alignment = { vertical: 'middle', horizontal: 'center' };
    infoSheet.getRow(2).height = 24;

    infoSheet.getRow(3).height = 12;

    // Header A4:C4
    const infoHeaderRow = infoSheet.getRow(4);
    infoHeaderRow.values = ['Thông tin (Field)', 'Giá trị (Value)', 'Ghi chú & Hướng dẫn (Notes)'];
    infoHeaderRow.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    infoHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    infoHeaderRow.alignment = { vertical: 'middle', horizontal: 'left' };
    infoHeaderRow.height = 28;

    const infoRows = [
      {
        field: 'Tên đề thi',
        value: currentTitle,
        notes: 'Bắt buộc: Tên đề thi sẽ tự động được nhận diện và cập nhật vào hệ thống khi import.'
      },
      {
        field: 'Loại chứng chỉ',
        value: typeDisplay,
        notes: 'Tên hiển thị của loại bài thi chuẩn.'
      },
      {
        field: 'Mã loại chứng chỉ',
        value: normalizedType,
        notes: 'Mã định danh hệ thống (IELTS_ACADEMIC, TOEIC_LR, TOEIC_WRITING, NLTV_B1_C1...).'
      },
      {
        field: 'Tổng số phần thi (Parts)',
        value: totalParts,
        notes: 'Số lượng phần thi (Parts) có trong đề.'
      },
      {
        field: 'Tổng số câu hỏi (Questions)',
        value: totalQuestions,
        notes: 'Số câu hỏi đã có sẵn trong bảng câu hỏi.'
      },
      {
        field: 'Thời gian xuất file',
        value: new Date().toLocaleString('vi-VN'),
        notes: 'Ngày giờ xuất file từ Multilingo Platform.'
      },
      {
        field: 'Phiên bản mẫu (Version)',
        value: '2.0 (Full Metadata)',
        notes: 'Hệ thống hỗ trợ đọc tự động Tên đề & Loại chứng chỉ từ bản 2.0.'
      }
    ];

    infoRows.forEach((item, index) => {
      const rowNum = 5 + index;
      const r = infoSheet.getRow(rowNum);
      r.values = [item.field, item.value, item.notes];
      r.height = 26;
      
      const isEven = index % 2 === 0;
      const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
      
      for (let c = 1; c <= 3; c++) {
        const cell = r.getCell(c);
        cell.font = { name: 'Segoe UI', size: 10, bold: c === 1 || (c === 2 && index === 0) };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }

      if (index === 0) {
        r.getCell(2).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      }
      if (index === 2) {
        r.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF4338CA' } };
      }
    });

    // ==========================================
    // SHEET 2: EXAM TEMPLATE (DANH SÁCH CÂU HỎI)
    // ==========================================
    const sheet = workbook.addWorksheet('Exam Template');

    // Define columns
    sheet.columns = [
      { header: 'Phần (Part)', key: 'part', width: 25 },
      { header: 'Hướng dẫn chung (Phần)', key: 'partInstruction', width: 30 },
      { header: 'Nhóm (Group)', key: 'group', width: 15 },
      { header: 'Loại câu hỏi (Type)', key: 'type', width: 25 },
      { header: 'Hướng dẫn riêng (Nhóm)', key: 'groupInstruction', width: 30 },
      { header: 'Nội dung nhóm (Văn bản đọc/nghe)', key: 'passage', width: 40 },
      { header: 'Câu hỏi (Question Text)', key: 'question', width: 40 },
      { header: 'Lựa chọn A', key: 'optA', width: 20 },
      { header: 'Lựa chọn B', key: 'optB', width: 20 },
      { header: 'Lựa chọn C', key: 'optC', width: 20 },
      { header: 'Lựa chọn D', key: 'optD', width: 20 },
      { header: 'Đáp án đúng', key: 'correct', width: 15 },
      { header: 'Giải thích', key: 'explanation', width: 30 },
      { header: 'Audio/File chung (Phần)', key: 'partMedia', width: 25 },
      { header: 'Đính kèm chung (Nhóm)', key: 'groupMedia', width: 25 },
      { header: 'Đính kèm riêng (Câu hỏi)', key: 'qMedia', width: 25 }
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

    let rowIndex = 2;

    partsData.forEach((part, pIdx) => {
      const partName = `Part ${pIdx + 1}: ${part.part_title}`;
      const partStartRow = rowIndex;
      
      part.question_groups.forEach((group, gIdx) => {
        const groupName = `Group ${gIdx + 1}`;
        const groupText = group.content_html || part.shared_content_html || '';
        const groupStartRow = rowIndex;
        
        group.questions.forEach((q, qIdx) => {
          const qType = q.type;
          const qText = q.question_text || `Câu ${qIdx + 1}`;
          
          let optA = '', optB = '', optC = '', optD = '';
          if (q.metadata && q.metadata.options) {
            optA = q.metadata.options[0] || '';
            optB = q.metadata.options[1] || '';
            optC = q.metadata.options[2] || '';
            optD = q.metadata.options[3] || '';
          }
          
          let correct = '';
          if (q.metadata) {
            if (q.metadata.correct_option_index !== undefined && q.metadata.correct_option_index !== null) {
              correct = String.fromCharCode(65 + q.metadata.correct_option_index);
            } else if (q.metadata.correct_option_indices !== undefined && Array.isArray(q.metadata.correct_option_indices) && q.metadata.correct_option_indices.length > 0) {
              correct = q.metadata.correct_option_indices.map((i: number) => String.fromCharCode(65 + i)).join(',');
            } else if (q.metadata.correct_answer) {
              if (Array.isArray(q.metadata.correct_answer)) {
                const validAnswers = q.metadata.correct_answer.filter((ans: string) => typeof ans === 'string' && ans.trim() !== '');
                if (validAnswers.length > 0) {
                  if (q.type && q.type.includes('MULTIPLE_CHOICE')) {
                    const mapped = validAnswers.map((ans: string) => {
                      const idx = q.metadata.options?.indexOf(ans);
                      return idx !== undefined && idx >= 0 ? String.fromCharCode(65 + idx) : ans;
                    });
                    correct = mapped.join(',');
                  } else {
                    correct = validAnswers.join(',');
                  }
                }
              } else if (typeof q.metadata.correct_answer === 'string' && q.metadata.correct_answer.trim() !== '') {
                const trimmedAns = q.metadata.correct_answer.trim();
                if (q.type && q.type.includes('MULTIPLE_CHOICE')) {
                  const idx = q.metadata.options?.indexOf(trimmedAns);
                  if (idx !== undefined && idx >= 0) {
                    correct = String.fromCharCode(65 + idx);
                  } else {
                    correct = trimmedAns;
                  }
                } else {
                  correct = trimmedAns;
                }
              }
            }
          }

          sheet.addRow({
            part: partName,
            partInstruction: part.instruction || '',
            group: groupName,
            type: qType,
            groupInstruction: group.instruction || '',
            passage: groupText,
            question: qText,
            optA: optA, optB: optB, optC: optC, optD: optD,
            correct: correct,
            explanation: q.metadata?.explanation || '',
            partMedia: part.shared_audio?.url || '',
            groupMedia: (group.shared_images && group.shared_images.length > 0)
              ? group.shared_images.join(', ')
              : (group.shared_media?.url || group.shared_audio?.url || ''),
            qMedia: (q.metadata as any)?.media?.url || ''
          });

          // Add Data Validation
          sheet.getCell(`D${rowIndex}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"MULTIPLE_CHOICE,MULTIPLE_CHOICE_MULTI,TRUE_FALSE_NOT_GIVEN,YES_NO_NOT_GIVEN,FILL_IN_THE_BLANK,MATCHING,SHORT_ANSWER"']
          };
          
          sheet.getCell(`L${rowIndex}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            showErrorMessage: false, // Cho phép gõ chữ tự do đối với dạng Fill in the blank
            errorStyle: 'warning',
            errorTitle: 'Lưu ý',
            error: 'Nếu là trắc nghiệm, hãy chọn từ danh sách. Nếu là điền từ, bạn có thể gõ tự do.',
            formulae: ['"A,B,C,D,TRUE,FALSE,NOT GIVEN,YES,NO"']
          };

          rowIndex++;
        });

        if (rowIndex - 1 > groupStartRow) {
          sheet.mergeCells(`C${groupStartRow}:C${rowIndex - 1}`);
          sheet.mergeCells(`E${groupStartRow}:E${rowIndex - 1}`);
          sheet.mergeCells(`F${groupStartRow}:F${rowIndex - 1}`);
          sheet.mergeCells(`O${groupStartRow}:O${rowIndex - 1}`); // groupMedia
          
          sheet.getCell(`C${groupStartRow}`).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
          sheet.getCell(`E${groupStartRow}`).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
          sheet.getCell(`F${groupStartRow}`).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
          sheet.getCell(`O${groupStartRow}`).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        }
      });

      if (rowIndex - 1 > partStartRow) {
        sheet.mergeCells(`A${partStartRow}:A${rowIndex - 1}`);
        sheet.mergeCells(`B${partStartRow}:B${rowIndex - 1}`);
        sheet.mergeCells(`N${partStartRow}:N${rowIndex - 1}`); // partMedia
        sheet.getCell(`A${partStartRow}`).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        sheet.getCell(`B${partStartRow}`).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        sheet.getCell(`N${partStartRow}`).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      }
    });

    // ==========================================
    // SHEET 3: HƯỚNG DẪN ĐIỀN FORM
    // ==========================================
    const guideSheet = workbook.addWorksheet('Hướng dẫn điền Form');
    guideSheet.columns = [
      { header: 'Vấn đề cần lưu ý', key: 'item', width: 30 },
      { header: 'Hướng dẫn chi tiết cách điền', key: 'desc', width: 100 }
    ];
    guideSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    guideSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };

    guideSheet.addRow({ item: '1. GOM NHÓM BÀI ĐỌC/NGHE', desc: 'Các dòng (câu hỏi) có CÙNG tên ở cột "Phần (Part)" và CÙNG tên ở cột "Nhóm (Group)" sẽ tự động được gộp chung vào 1 bài đọc/nghe duy nhất.\n-> Bạn chỉ cần dán đoạn văn/bài đọc vào cột "Nội dung nhóm" của 1 dòng bất kỳ trong nhóm (hoặc dán cho tất cả các dòng thuộc nhóm đó đều được, hệ thống sẽ không bị lặp).' });
    guideSheet.addRow({ item: '2. CÂU TRẮC NGHIỆM (A, B, C, D)', desc: 'Áp dụng cho Loại câu hỏi: MULTIPLE_CHOICE.\n-> Điền nội dung vào cột Lựa chọn A, B, C, D (Nếu câu hỏi chỉ có 3 đáp án thì bỏ trống cột D).\n-> Cột "Đáp án đúng": Bấm chọn A, B, C hoặc D từ danh sách thả xuống.' });
    guideSheet.addRow({ item: '3. CÂU ĐÚNG / SAI / NOT GIVEN', desc: 'Áp dụng cho: TRUE_FALSE_NOT_GIVEN hoặc YES_NO_NOT_GIVEN.\n-> BỎ TRỐNG hoàn toàn các cột Lựa chọn A, B, C, D.\n-> Cột "Đáp án đúng": Bấm chọn TRUE, FALSE, hoặc NOT GIVEN từ danh sách thả xuống.' });
    guideSheet.addRow({ item: '4. CÂU ĐIỀN TỪ / TỰ LUẬN', desc: 'Áp dụng cho: FILL_IN_THE_BLANK, SHORT_ANSWER, WRITING_ESSAY.\n-> BỎ TRỐNG hoàn toàn các cột Lựa chọn A, B, C, D.\n-> Cột "Đáp án đúng": GÕ TRỰC TIẾP chữ/từ cần điền (Ví dụ: apple). Mặc dù cột này có icon danh sách thả xuống của Excel, nhưng bạn vẫn gõ được bình thường mà không bị báo lỗi.' });
    guideSheet.addRow({ item: '5. HƯỚNG DẪN (INSTRUCTION)', desc: 'Cột "Hướng dẫn chung (Phần)": Điền hướng dẫn áp dụng cho toàn bộ Part (ví dụ: Listen and answer questions 1-10).\nCột "Hướng dẫn riêng (Nhóm)": Chỉ điền nếu nhóm câu hỏi đó có hướng dẫn đặc thù riêng (ví dụ: Questions 1-4: Choose the correct letter...). Nếu không có thì để trống, hệ thống sẽ tự động dùng hướng dẫn chung của phần.' });

    guideSheet.getColumn('desc').alignment = { wrapText: true, vertical: 'middle' };
    guideSheet.getColumn('item').alignment = { vertical: 'middle', wrapText: true };
    for (let i = 2; i <= 6; i++) {
      guideSheet.getRow(i).height = 65;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const cleanFileName = currentTitle
      .replace(/[/\\?%*:|"<>]/g, '_')
      .trim()
      .replace(/\s+/g, '_');
    saveAs(blob, `${cleanFileName || `Template_${normalizedType}`}.xlsx`);
  };

  const handleExportTemplate = () => {
    generateExcelTemplate(parts, examType, examTitle);
  };

  const handleExportStandardTemplate = () => {
    Swal.fire({
      title: 'Chọn loại chứng chỉ để tải sườn mẫu',
      input: 'select',
      inputOptions: {
        'Full Đề': {
          'CUSTOM_EMPTY': 'Sườn trống tùy chỉnh (Custom)',
          'IELTS': 'Full IELTS Academic',
          'TOEIC': 'Full TOEIC Listening & Reading',
          'NLTV': 'Full Năng Lực Tiếng Việt',
          'TOEIC_WRITING': 'Full TOEIC Writing'
        },
        'Từng Kỹ Năng (Skills)': {
          'SKILL_IELTS_LISTENING': 'IELTS Listening (4 Parts)',
          'SKILL_IELTS_READING': 'IELTS Reading (3 Passages)',
          'SKILL_TOEIC_LISTENING': 'TOEIC Listening (Part 1-4)',
          'SKILL_TOEIC_READING': 'TOEIC Reading (Part 5-7)',
          'SKILL_NLTV_LISTENING': 'NLTV Kỹ năng Nghe',
          'SKILL_NLTV_READING': 'NLTV Kỹ năng Đọc'
        },
        'Từng Part (Parts)': {
          'PART_IELTS_L1': 'IELTS Listening Part 1',
          'PART_IELTS_R1': 'IELTS Reading Passage 1',
          'PART_TOEIC_1': 'TOEIC Part 1 (Photographs)',
          'PART_TOEIC_2': 'TOEIC Part 2 (Question-Response)',
          'PART_TOEIC_3': 'TOEIC Part 3 (Conversations)',
          'PART_TOEIC_4': 'TOEIC Part 4 (Talks)',
          'PART_TOEIC_5': 'TOEIC Part 5 (Incomplete Sentences)',
          'PART_TOEIC_6': 'TOEIC Part 6 (Text Completion)',
          'PART_TOEIC_7': 'TOEIC Part 7 (Reading Comp.)'
        }
      },
      inputPlaceholder: 'Chọn một loại...',
      showCancelButton: true,
      confirmButtonText: 'Tải Xuống Excel',
      cancelButtonText: 'Hủy'
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const type = result.value;
        const tempParts: ExamPart[] = [];
        
        // Replicate logic from applyTemplate to generate the structure
        if (type === 'CUSTOM_EMPTY') {
          tempParts.push({ part_title: 'Tên Part (Ví dụ: Part 1)', instruction: 'Nhập hướng dẫn làm bài', question_groups: [{ group_id: 'g1', instruction: 'Hướng dẫn cho nhóm', content_html: 'Nội dung bài đọc hoặc transcript', questions: [{ question_id: 'q1', type: 'MULTIPLE_CHOICE', question_text: 'Câu 1', metadata: { correct_answer: '' } }] }] });
        } else if (type === 'IELTS') {
          tempParts.push({ part_title: 'Listening Part 1', instruction: 'Listen and answer questions 1-10', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 1, 10, 4) });
          tempParts.push({ part_title: 'Listening Part 2', instruction: 'Listen and answer questions 11-20', shared_audio: { url: '' }, question_groups: createToeicGroups(11, 1, 10, 4) });
          tempParts.push({ part_title: 'Listening Part 3', instruction: 'Listen and answer questions 21-30', shared_audio: { url: '' }, question_groups: createToeicGroups(21, 1, 10, 4) });
          tempParts.push({ part_title: 'Listening Part 4', instruction: 'Listen and answer questions 31-40', shared_audio: { url: '' }, question_groups: createToeicGroups(31, 1, 10, 4) });
          tempParts.push({ part_title: 'Reading Passage 1', instruction: 'Read the passage and answer questions 1-13', question_groups: createToeicGroups(1, 1, 13, 4) });
          tempParts.push({ part_title: 'Reading Passage 2', instruction: 'Read the passage and answer questions 14-26', question_groups: createToeicGroups(14, 1, 13, 4) });
          tempParts.push({ part_title: 'Reading Passage 3', instruction: 'Read the passage and answer questions 27-40', question_groups: createToeicGroups(27, 1, 14, 4) });
          tempParts.push({ part_title: 'Writing Task 1', instruction: 'Write at least 150 words', question_groups: [{ group_id: 'g1', instruction: '', content_html: '', questions: [{ question_id: 'q_w_1', type: 'WRITING_ESSAY', question_text: 'Task 1', metadata: { correct_answer: '' } }] }] });
          tempParts.push({ part_title: 'Writing Task 2', instruction: 'Write at least 250 words', question_groups: [{ group_id: 'g2', instruction: '', content_html: '', questions: [{ question_id: 'q_w_2', type: 'WRITING_ESSAY', question_text: 'Task 2', metadata: { correct_answer: '' } }] }] });
        } else if (type === 'TOEIC') {
          tempParts.push({ part_title: 'Part 1: Photographs', instruction: 'Questions 1-6', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 6, 1, 4) });
          tempParts.push({ part_title: 'Part 2: Question-Response', instruction: 'Questions 7-31', shared_audio: { url: '' }, question_groups: createToeicGroups(7, 1, 25, 3) });
          tempParts.push({ part_title: 'Part 3: Conversations', instruction: 'Questions 32-70', shared_audio: { url: '' }, question_groups: createToeicGroups(32, 13, 3, 4) });
          tempParts.push({ part_title: 'Part 4: Talks', instruction: 'Questions 71-100', shared_audio: { url: '' }, question_groups: createToeicGroups(71, 10, 3, 4) });
          tempParts.push({ part_title: 'Part 5: Incomplete Sentences', instruction: 'Questions 101-130', question_groups: createToeicGroups(101, 1, 30, 4) });
          tempParts.push({ part_title: 'Part 6: Text Completion', instruction: 'Questions 131-146', question_groups: createToeicGroups(131, 4, 4, 4) });
          tempParts.push({ part_title: 'Part 7: Reading Comprehension', instruction: 'Questions 147-200', question_groups: [...createToeicGroups(147, 4, 2, 4), ...createToeicGroups(155, 3, 3, 4), ...createToeicGroups(164, 3, 4, 4), ...createToeicGroups(176, 5, 5, 4)] });
        } else if (type === 'NLTV') {
          tempParts.push({ part_title: 'Kỹ năng Nghe - Phần 1', instruction: 'Hướng dẫn', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 8, 1, 4) });
          tempParts.push({ part_title: 'Kỹ năng Nghe - Phần 2', instruction: 'Hướng dẫn', shared_audio: { url: '' }, question_groups: createToeicGroups(9, 3, 4, 4) });
          tempParts.push({ part_title: 'Kỹ năng Nghe - Phần 3', instruction: 'Hướng dẫn', shared_audio: { url: '' }, question_groups: createToeicGroups(21, 3, 5, 4) });
          tempParts.push({ part_title: 'Kỹ năng Đọc - Phần 1', instruction: 'Hướng dẫn', question_groups: createToeicGroups(1, 1, 10, 4) });
          tempParts.push({ part_title: 'Kỹ năng Đọc - Phần 2', instruction: 'Hướng dẫn', question_groups: createToeicGroups(11, 1, 10, 4) });
          tempParts.push({ part_title: 'Kỹ năng Đọc - Phần 3', instruction: 'Hướng dẫn', question_groups: createToeicGroups(21, 1, 10, 4) });
          tempParts.push({ part_title: 'Kỹ năng Đọc - Phần 4', instruction: 'Hướng dẫn', question_groups: createToeicGroups(31, 1, 10, 4) });
          tempParts.push({ part_title: 'Kỹ năng Viết - Bài 1', instruction: 'Viết thư', question_groups: [{ group_id: 'g1', instruction: '', content_html: '', questions: [{ question_id: 'q1', type: 'WRITING_ESSAY', question_text: 'Viết', metadata: { correct_answer: '' } }] }] });
          tempParts.push({ part_title: 'Kỹ năng Viết - Bài 2', instruction: 'Viết luận', question_groups: [{ group_id: 'g2', instruction: '', content_html: '', questions: [{ question_id: 'q2', type: 'WRITING_ESSAY', question_text: 'Viết', metadata: { correct_answer: '' } }] }] });
        } else if (type === 'TOEIC_WRITING') {
          tempParts.push({ part_title: 'Part 1: Write a Sentence Based on a Picture', instruction: 'Questions 1-5', question_groups: createToeicWritPart1Groups() });
          tempParts.push({ part_title: 'Part 2: Respond to a Written Request', instruction: 'Questions 6-7', question_groups: createToeicWritPart2Groups() });
          tempParts.push({ part_title: 'Part 3: Write an Opinion Essay', instruction: 'Question 8', question_groups: [{ group_id: 'g1', instruction: '', content_html: '', questions: [{ question_id: 'q8', type: 'WRITING_ESSAY', question_text: 'Write essay', metadata: { correct_answer: '' } }] }] });
        } else if (type === 'SKILL_IELTS_LISTENING') {
          tempParts.push({ part_title: 'Listening Part 1', instruction: 'Listen and answer questions 1-10', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 1, 10, 4) });
          tempParts.push({ part_title: 'Listening Part 2', instruction: 'Listen and answer questions 11-20', shared_audio: { url: '' }, question_groups: createToeicGroups(11, 1, 10, 4) });
          tempParts.push({ part_title: 'Listening Part 3', instruction: 'Listen and answer questions 21-30', shared_audio: { url: '' }, question_groups: createToeicGroups(21, 1, 10, 4) });
          tempParts.push({ part_title: 'Listening Part 4', instruction: 'Listen and answer questions 31-40', shared_audio: { url: '' }, question_groups: createToeicGroups(31, 1, 10, 4) });
        } else if (type === 'SKILL_IELTS_READING') {
          tempParts.push({ part_title: 'Reading Passage 1', instruction: 'Read the passage and answer questions 1-13', question_groups: createToeicGroups(1, 1, 13, 4) });
          tempParts.push({ part_title: 'Reading Passage 2', instruction: 'Read the passage and answer questions 14-26', question_groups: createToeicGroups(14, 1, 13, 4) });
          tempParts.push({ part_title: 'Reading Passage 3', instruction: 'Read the passage and answer questions 27-40', question_groups: createToeicGroups(27, 1, 14, 4) });
        } else if (type === 'SKILL_TOEIC_LISTENING') {
          tempParts.push({ part_title: 'Part 1: Photographs', instruction: 'Questions 1-6', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 6, 1, 4) });
          tempParts.push({ part_title: 'Part 2: Question-Response', instruction: 'Questions 7-31', shared_audio: { url: '' }, question_groups: createToeicGroups(7, 1, 25, 3) });
          tempParts.push({ part_title: 'Part 3: Conversations', instruction: 'Questions 32-70', shared_audio: { url: '' }, question_groups: createToeicGroups(32, 13, 3, 4) });
          tempParts.push({ part_title: 'Part 4: Talks', instruction: 'Questions 71-100', shared_audio: { url: '' }, question_groups: createToeicGroups(71, 10, 3, 4) });
        } else if (type === 'SKILL_TOEIC_READING') {
          tempParts.push({ part_title: 'Part 5: Incomplete Sentences', instruction: 'Questions 101-130', question_groups: createToeicGroups(101, 1, 30, 4) });
          tempParts.push({ part_title: 'Part 6: Text Completion', instruction: 'Questions 131-146', question_groups: createToeicGroups(131, 4, 4, 4) });
          tempParts.push({ part_title: 'Part 7: Reading Comprehension', instruction: 'Questions 147-200', question_groups: [...createToeicGroups(147, 4, 2, 4), ...createToeicGroups(155, 3, 3, 4), ...createToeicGroups(164, 3, 4, 4), ...createToeicGroups(176, 5, 5, 4)] });
        } else if (type === 'SKILL_NLTV_LISTENING') {
          tempParts.push({ part_title: 'Kỹ năng Nghe - Phần 1', instruction: 'Hướng dẫn', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 8, 1, 4) });
          tempParts.push({ part_title: 'Kỹ năng Nghe - Phần 2', instruction: 'Hướng dẫn', shared_audio: { url: '' }, question_groups: createToeicGroups(9, 3, 4, 4) });
          tempParts.push({ part_title: 'Kỹ năng Nghe - Phần 3', instruction: 'Hướng dẫn', shared_audio: { url: '' }, question_groups: createToeicGroups(21, 3, 5, 4) });
        } else if (type === 'SKILL_NLTV_READING') {
          tempParts.push({ part_title: 'Kỹ năng Đọc - Phần 1', instruction: 'Hướng dẫn', question_groups: createToeicGroups(1, 1, 10, 4) });
          tempParts.push({ part_title: 'Kỹ năng Đọc - Phần 2', instruction: 'Hướng dẫn', question_groups: createToeicGroups(11, 1, 10, 4) });
          tempParts.push({ part_title: 'Kỹ năng Đọc - Phần 3', instruction: 'Hướng dẫn', question_groups: createToeicGroups(21, 1, 10, 4) });
          tempParts.push({ part_title: 'Kỹ năng Đọc - Phần 4', instruction: 'Hướng dẫn', question_groups: createToeicGroups(31, 1, 10, 4) });
        } else if (type === 'PART_IELTS_L1') {
          tempParts.push({ part_title: 'Listening Part 1', instruction: 'Listen and answer questions 1-10', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 1, 10, 4) });
        } else if (type === 'PART_IELTS_R1') {
          tempParts.push({ part_title: 'Reading Passage 1', instruction: 'Read the passage and answer questions 1-13', question_groups: createToeicGroups(1, 1, 13, 4) });
        } else if (type === 'PART_TOEIC_1') {
          tempParts.push({ part_title: 'Part 1: Photographs', instruction: 'Questions 1-6', shared_audio: { url: '' }, question_groups: createToeicGroups(1, 6, 1, 4) });
        } else if (type === 'PART_TOEIC_2') {
          tempParts.push({ part_title: 'Part 2: Question-Response', instruction: 'Questions 7-31', shared_audio: { url: '' }, question_groups: createToeicGroups(7, 1, 25, 3) });
        } else if (type === 'PART_TOEIC_3') {
          tempParts.push({ part_title: 'Part 3: Conversations', instruction: 'Questions 32-70', shared_audio: { url: '' }, question_groups: createToeicGroups(32, 13, 3, 4) });
        } else if (type === 'PART_TOEIC_4') {
          tempParts.push({ part_title: 'Part 4: Talks', instruction: 'Questions 71-100', shared_audio: { url: '' }, question_groups: createToeicGroups(71, 10, 3, 4) });
        } else if (type === 'PART_TOEIC_5') {
          tempParts.push({ part_title: 'Part 5: Incomplete Sentences', instruction: 'Questions 101-130', question_groups: createToeicGroups(101, 1, 30, 4) });
        } else if (type === 'PART_TOEIC_6') {
          tempParts.push({ part_title: 'Part 6: Text Completion', instruction: 'Questions 131-146', question_groups: createToeicGroups(131, 4, 4, 4) });
        } else if (type === 'PART_TOEIC_7') {
          tempParts.push({ part_title: 'Part 7: Reading Comprehension', instruction: 'Questions 147-200', question_groups: [...createToeicGroups(147, 4, 2, 4), ...createToeicGroups(155, 3, 3, 4), ...createToeicGroups(164, 3, 4, 4), ...createToeicGroups(176, 5, 5, 4)] });
        }
        
        let targetType = 'IELTS_ACADEMIC';
        let defaultTitle = 'Đề thi IELTS Academic Mẫu';
        if (type === 'CUSTOM_EMPTY') {
          targetType = examType;
          defaultTitle = examTitle || 'Sườn đề thi tùy chỉnh';
        } else if (type === 'TOEIC') {
          targetType = 'TOEIC_LR';
          defaultTitle = 'Đề thi TOEIC Listening & Reading Mẫu';
        } else if (type === 'TOEIC_WRITING') {
          targetType = 'TOEIC_WRITING';
          defaultTitle = 'Đề thi TOEIC Writing Mẫu';
        } else if (type === 'NLTV') {
          targetType = 'NLTV_B1_C1';
          defaultTitle = 'Đề thi Năng Lực Tiếng Việt Mẫu';
        } else if (type.includes('TOEIC_WRIT')) {
          targetType = 'TOEIC_WRITING';
          defaultTitle = `Mẫu TOEIC Writing - ${type.replace(/_/g, ' ')}`;
        } else if (type.includes('TOEIC')) {
          targetType = 'TOEIC_LR';
          defaultTitle = `Mẫu TOEIC - ${type.replace(/_/g, ' ')}`;
        } else if (type.includes('NLTV')) {
          targetType = 'NLTV_B1_C1';
          defaultTitle = `Mẫu NLTV - ${type.replace(/_/g, ' ')}`;
        } else {
          targetType = 'IELTS_ACADEMIC';
          defaultTitle = `Mẫu IELTS Academic - ${type.replace(/_/g, ' ')}`;
        }
        
        generateExcelTemplate(tempParts, targetType, defaultTitle);
      }
    });
  };

  const handleImportOtherExcel = async (file: File) => {

    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      // Find Info Sheet (if present)
      const infoSheet = workbook.getWorksheet('Thông Tin Đề Thi')
        || workbook.getWorksheet('Thông tin đề thi')
        || workbook.getWorksheet('Exam Info')
        || workbook.getWorksheet('Exam Information');

      // Find Question Sheet
      let sheet = workbook.getWorksheet('Exam Template')
        || workbook.getWorksheet('Danh sách câu hỏi')
        || workbook.getWorksheet('Đề thi');

      if (!sheet) {
        // Fallback: pick the first worksheet that is NOT infoSheet and NOT guideSheet
        sheet = workbook.worksheets.find(s => {
          const sName = s.name.toLowerCase();
          return !sName.includes('thông tin') && !sName.includes('hướng dẫn') && !sName.includes('info') && !sName.includes('guide');
        }) || workbook.getWorksheet(1);
      }

      if (!sheet) {
        Swal.fire('Lỗi', 'File không đúng định dạng hoặc không tìm thấy bảng câu hỏi.', 'error');
        return;
      }

      // Read metadata from Info Sheet
      let importedTitle = '';
      let importedType = '';

      if (infoSheet) {
        infoSheet.eachRow((row) => {
          const col1 = (row.getCell(1).text || '').trim().toLowerCase();
          const col2 = (row.getCell(2).text || '').trim();
          if (!col2) return;

          if (col1.includes('tên đề') || col1.includes('exam title') || col1.includes('tiêu đề')) {
            importedTitle = col2;
          }
          if (col1.includes('mã loại') || col1.includes('type code')) {
            importedType = col2;
          } else if (!importedType && (col1.includes('loại chứng chỉ') || col1.includes('exam type'))) {
            importedType = col2;
          }
        });
      }

      // Fallback: read from workbook metadata properties
      if (!importedTitle && workbook.title && workbook.title.trim()) {
        const wbTitle = workbook.title.trim();
        if (wbTitle.toLowerCase() !== 'exam template') {
          importedTitle = wbTitle;
        }
      }
      if (!importedType && workbook.subject && workbook.subject.trim()) {
        importedType = workbook.subject.trim();
      }

      // Fallback: deduce title from file name if not generic
      if (!importedTitle) {
        const rawFileName = file.name.replace(/\.[^/.]+$/, '').trim();
        const lowerName = rawFileName.toLowerCase();
        if (!lowerName.startsWith('template_') && !lowerName.startsWith('exam_template') && lowerName !== 'template') {
          importedTitle = rawFileName.replace(/_/g, ' ').replace(/-/g, ' ').trim();
        }
      }

      // Determine question table header row dynamically
      let headerRowIndex = 1;
      for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
        const cell1 = (sheet.getRow(r).getCell(1).text || '').toLowerCase();
        const cell2 = (sheet.getRow(r).getCell(2).text || '').toLowerCase();
        if (cell1.includes('phần') || cell1.includes('part') || cell2.includes('nhóm') || cell2.includes('group')) {
          headerRowIndex = r;
          break;
        }
      }

      const tempParts: ExamPart[] = [];
      let currentPart: ExamPart | null = null;
      let currentGroup: QuestionGroup | null = null;
      let lastPartName = '';
      let lastGroupName = '';
      let fallbackQCounter = 1;

      const getCellValue = (cell: ExcelJS.Cell) => {
        if (cell.type === ExcelJS.ValueType.Merge) {
          return cell.master.text ? cell.master.text.trim() : '';
        }
        return cell.text ? cell.text.trim() : '';
      };

      // Detect column indices dynamically based on header row
      const headerRow = sheet.getRow(headerRowIndex);
      const headerTexts: string[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headerTexts[colNumber - 1] = cell.text ? cell.text.trim() : '';
      });
      const colMap = detectExcelColumns(headerTexts);

      const getColVal = (rowObj: ExcelJS.Row, colIdx: number) => {
        if (!colIdx || colIdx < 1) return '';
        return getCellValue(rowObj.getCell(colIdx));
      };

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIndex) return; // Skip header

        const rawPartName = getColVal(row, colMap.part);
        const rawGroupName = getColVal(row, colMap.group);
        const type = getColVal(row, colMap.type) || 'MULTIPLE_CHOICE';

        const rawPartInstruction = colMap.partInstruction > 0 ? getColVal(row, colMap.partInstruction) : '';
        const rawGroupInstruction = colMap.groupInstruction > 0 ? getColVal(row, colMap.groupInstruction) : '';
        const rawLegacyInstruction = colMap.legacyInstruction > 0
          ? getColVal(row, colMap.legacyInstruction)
          : (colMap.partInstruction === -1 && colMap.groupInstruction === -1 ? getColVal(row, 4) : '');

        const rawPassage = getColVal(row, colMap.passage);
        const questionText = getColVal(row, colMap.question);
        const correct = getColVal(row, colMap.correct);
        const explanation = getColVal(row, colMap.explanation);
        const rawPartMedia = getColVal(row, colMap.partMedia);
        const rawGroupMedia = getColVal(row, colMap.groupMedia);
        const qMedia = getColVal(row, colMap.qMedia);

        const partName = rawPartName || lastPartName;
        const groupName = rawGroupName || lastGroupName;
        
        if (!partName) return; // Ignore empty rows

        if (partName !== lastPartName) {
          const partInstruction = rawPartInstruction || rawLegacyInstruction || '';
          currentPart = {
            part_title: partName.replace(/^Part \d+: /, ''),
            instruction: partInstruction,
            question_groups: [],
            shared_audio: rawPartMedia ? { url: rawPartMedia } : undefined
          };
          tempParts.push(currentPart);
          lastPartName = partName;
          lastGroupName = ''; // reset group
        } else if (currentPart && !currentPart.instruction) {
          if (rawPartInstruction) currentPart.instruction = rawPartInstruction;
          else if (rawLegacyInstruction) currentPart.instruction = rawLegacyInstruction;
        }

        if (currentPart && !currentPart.shared_audio && rawPartMedia) {
          currentPart.shared_audio = { url: rawPartMedia };
        }

        if (groupName !== lastGroupName || !currentGroup) {
          let groupInstruction = '';
          if (colMap.groupInstruction > 0 && rawGroupInstruction) {
            groupInstruction = rawGroupInstruction;
          } else if (rawLegacyInstruction) {
            const partInstr = currentPart?.instruction || '';
            if (rawLegacyInstruction.trim() !== partInstr.trim()) {
              groupInstruction = rawLegacyInstruction;
            }
          }

          const groupImageUrls = rawGroupMedia
            ? rawGroupMedia.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean)
            : [];
          currentGroup = {
            group_id: generateId('group'),
            instruction: groupInstruction,
            content_html: rawPassage,
            questions: [],
            shared_images: groupImageUrls.length > 0 ? groupImageUrls : undefined,
            shared_media: groupImageUrls.length > 0 ? { type: 'image', url: groupImageUrls[0], display_config: { size_preset: 'medium', alignment: 'center' } } : undefined
          };
          if (currentPart) currentPart.question_groups.push(currentGroup);
          lastGroupName = groupName;
        } else {
          if (rawPassage && currentGroup && !currentGroup.content_html) {
            currentGroup.content_html = rawPassage;
          }
          if (currentGroup && !currentGroup.instruction) {
            if (colMap.groupInstruction > 0 && rawGroupInstruction) {
              currentGroup.instruction = rawGroupInstruction;
            } else if (rawLegacyInstruction) {
              const partInstr = currentPart?.instruction || '';
              if (rawLegacyInstruction.trim() !== partInstr.trim()) {
                currentGroup.instruction = rawLegacyInstruction;
              }
            }
          }
          if (rawGroupMedia && currentGroup && (!currentGroup.shared_images || currentGroup.shared_images.length === 0)) {
            const groupImageUrls = rawGroupMedia.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean);
            if (groupImageUrls.length > 0) {
              currentGroup.shared_images = groupImageUrls;
              currentGroup.shared_media = { type: 'image', url: groupImageUrls[0], display_config: { size_preset: 'medium', alignment: 'center' } };
            }
          }
        }

        const rawOptA = getColVal(row, colMap.optA);
        const rawOptB = getColVal(row, colMap.optB);
        const rawOptC = getColVal(row, colMap.optC);
        const rawOptD = getColVal(row, colMap.optD);
        
        const hasA = rawOptA !== '';
        const hasB = rawOptB !== '';
        const hasC = rawOptC !== '';
        const hasD = rawOptD !== '';
        
        let options: string[] = [];
        if (hasD) options = [rawOptA, rawOptB, rawOptC, rawOptD];
        else if (hasC) options = [rawOptA, rawOptB, rawOptC];
        else if (hasB) options = [rawOptA, rawOptB];
        else if (hasA) options = [rawOptA];
        else if (type.includes('MULTIPLE_CHOICE')) {
          const isPart2 = (partName || '').toLowerCase().includes('part 2') || (partName || '').toLowerCase().includes('phần 2');
          options = isPart2 ? ['', '', ''] : ['', '', '', ''];
        }
        
        const cleanCorrect = (correct || '').trim();
        let parsedCorrectAnswer: any = cleanCorrect;
        let correctOptionIndex: number | undefined = undefined;
        let correctOptionIndices: number[] | undefined = undefined;
        
        if (type.includes('MULTIPLE_CHOICE') && cleanCorrect !== '') {
           if (type === 'MULTIPLE_CHOICE_MULTI') {
               const parts = cleanCorrect.split(',').map(s => s.trim().toUpperCase());
               correctOptionIndices = [];
               parsedCorrectAnswer = [];
               parts.forEach(p => {
                  let idx = -1;
                  if (p === 'A') idx = 0;
                  else if (p === 'B') idx = 1;
                  else if (p === 'C') idx = 2;
                  else if (p === 'D') idx = 3;
                  if (idx >= 0 && idx < options.length) {
                      correctOptionIndices!.push(idx);
                      parsedCorrectAnswer.push(options[idx]);
                  } else {
                      parsedCorrectAnswer.push(p); // fallback
                  }
               });
               if (correctOptionIndices.length === 0) correctOptionIndices = undefined;
           } else {
               const p = cleanCorrect.toUpperCase();
               let idx = -1;
               if (p === 'A') idx = 0;
               else if (p === 'B') idx = 1;
               else if (p === 'C') idx = 2;
               else if (p === 'D') idx = 3;
               if (idx >= 0 && idx < options.length) {
                   correctOptionIndex = idx;
                   parsedCorrectAnswer = options[idx];
               }
           }
        }

        const numMatch = questionText.match(/\d+/);
        const qNum = numMatch ? String(numMatch[0]).padStart(3, '0') : String(fallbackQCounter++).padStart(3, '0');

        const newQuestion: Question = {
          question_id: `q_${qNum}`,
          type: type,
          question_text: questionText,
          metadata: {
            options: options.length > 0 ? options : undefined,
            correct_answer: parsedCorrectAnswer,
            correct_option_index: correctOptionIndex,
            correct_option_indices: correctOptionIndices,
            explanation: explanation
          }
        };

        if (qMedia) {
          (newQuestion.metadata as any).media = { type: 'image', url: qMedia };
        }

        currentGroup.questions.push(newQuestion);
      });

      let detectedType = importedType ? normalizeExamType(importedType) : '';

      if (!detectedType) {
        const fileNameLower = (file.name || '').toLowerCase();
        const allTitlesLower = tempParts.map(p => p.part_title.toLowerCase()).join(' ');

        if (
          fileNameLower.includes('toeic') ||
          allTitlesLower.includes('toeic') ||
          allTitlesLower.includes('photographs') ||
          allTitlesLower.includes('question-response') ||
          allTitlesLower.includes('conversations') ||
          allTitlesLower.includes('talks') ||
          allTitlesLower.includes('incomplete sentences') ||
          allTitlesLower.includes('text completion') ||
          allTitlesLower.includes('reading comprehension') ||
          (/part\s*[5-7]\b/.test(allTitlesLower) && !allTitlesLower.includes('passage')) ||
          (tempParts.length >= 7 && /part\s*1\b/.test(allTitlesLower))
        ) {
          if (fileNameLower.includes('writing') || allTitlesLower.includes('write a sentence') || allTitlesLower.includes('written request') || allTitlesLower.includes('opinion essay')) {
            detectedType = 'TOEIC_WRITING';
          } else {
            detectedType = 'TOEIC_LR';
          }
        } else if (
          fileNameLower.includes('nltv') ||
          fileNameLower.includes('vstep') ||
          allTitlesLower.includes('nltv') ||
          allTitlesLower.includes('tiếng việt') ||
          (allTitlesLower.includes('kỹ năng') && (allTitlesLower.includes('nghe') || allTitlesLower.includes('đọc') || allTitlesLower.includes('viết')))
        ) {
          detectedType = 'NLTV_B1_C1';
        } else if (fileNameLower.includes('general') || allTitlesLower.includes('general')) {
          detectedType = 'IELTS_GENERAL';
        } else {
          detectedType = 'IELTS_ACADEMIC';
        }
      }

      setExamType(detectedType);

      const finalExamTitle = (importedTitle && importedTitle.trim())
        ? importedTitle.trim()
        : (detectedType.startsWith('TOEIC')
            ? (detectedType === 'TOEIC_WRITING' ? 'TOEIC Writing Test' : 'TOEIC L&R Test')
            : (detectedType.startsWith('NLTV')
                ? 'Năng Lực Tiếng Việt Test'
                : (detectedType.includes('GENERAL') ? 'IELTS General Training Test' : 'IELTS Academic Mock Test')));

      setExamTitle(finalExamTitle);
      const cleanedParts = deduplicatePartAndGroupInstructions(tempParts);
      setParts(cleanedParts);
      setActivePartIndex(0);
      setWizardMode('BUILDER');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      const totalQuestionsCount = tempParts.reduce((acc, p) => acc + p.question_groups.reduce((gAcc, g) => gAcc + g.questions.length, 0), 0);

      Swal.fire({
        icon: 'success',
        title: 'Nhập Đề Thi Thành Công!',
        text: `Đã nhập ${tempParts.length} phần, ${totalQuestionsCount} câu. Cần kiểm tra nội dung trước khi lưu.`,
        confirmButtonText: 'Bắt đầu xem & chỉnh sửa'
      });
    } catch {
      Swal.fire('Lỗi', 'Không thể đọc file Excel. Hãy kiểm tra định dạng và thử lại.', 'error');
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || importController.current) return;
    const controller = new AbortController();
    importController.current = controller;
    setImporting(true);
    setImportError(null);
    try {
      // Preserve existing non-TOEIC editing, but never fall back around TOEIC validation.
      let legacyType = '';
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const info = workbook.getWorksheet('Thông Tin Đề Thi');
        info?.eachRow(row => {
          const rawType = row.getCell(2).text.trim();
          if (row.getCell(1).text.trim() === 'Mã loại chứng chỉ' && rawType) legacyType = normalizeExamType(rawType);
        });
      } catch { /* Malformed files remain the backend preview's responsibility. */ }
      if (controller.signal.aborted) return;
      if (['IELTS_ACADEMIC', 'IELTS_GENERAL', 'TOEIC_WRITING', 'NLTV_A1_A2', 'NLTV_B1_C1', 'OTHER'].includes(legacyType)) {
        await handleImportOtherExcel(file);
        setIsPublished(false);
        return;
      }
      const form = new FormData();
      form.append('file', file);
      const response = await axiosClient.post<any, any>('/v1/admin/exams/import/preview', form, { signal: controller.signal, timeout: 10000 });
      if (controller.signal.aborted) return;
      if (!response.success || !response.data?.request?.sections || !Array.isArray(response.data.issues)) throw new Error('Invalid preview');
      const preview = response.data;
      setExamTitle(preview.request.title);
      setExamType(normalizeExamType(preview.request.type));
      setIsPublished(false);
      setParts(toEditorParts(preview.request));
      setImportIssues(preview.issues);
      setActivePartIndex(0);
      setWizardMode('BUILDER');
    } catch {
      if (!controller.signal.aborted) setImportError('Không thể đọc file Excel. Hãy kiểm tra định dạng và thử lại.');
    } finally {
      if (importController.current === controller) {
        importController.current = null;
        setImporting(false);
      }
    }
  };
  const handleSave = async (draft = false) => {
    if (saveMutex.current || importing) return;
    saveMutex.current = true;
    setSaving(true);
    const finalJson = {
      exam_title: examTitle,
      exam_type: examType,
      is_published: draft ? false : isPublished,
      parts: parts
    };
    try { await onSave(JSON.stringify(finalJson, null, 2)); }
    finally { saveMutex.current = false; setSaving(false); }
  };

  if (wizardMode === 'START') {
    return (
      <div className="eb-wizard-container">
        {importNotice}
        <h2 className="eb-wizard-title">Bắt đầu tạo Đề thi</h2>
        <p className="eb-wizard-subtitle">Chọn phương thức phù hợp để xây dựng cấu trúc đề thi của bạn.</p>
        
        <div className="eb-wizard-grid">
          
          <div className="ed-card eb-wizard-card hover-bg-tertiary" onClick={() => setWizardMode('FULL')}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 4px 10px rgba(234, 88, 12, 0.3)' }}>
              <AlignLeft size={28} color="white" />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>1. Tạo Full Đề</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>Sinh toàn bộ cấu trúc chuẩn của một đề thi hoàn chỉnh (IELTS, TOEIC, NLTV...)</p>
          </div>

          <div className="ed-card eb-wizard-card hover-bg-tertiary" onClick={() => setWizardMode('SKILL')}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)' }}>
              <Zap size={28} color="white" />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>2. Tạo 1 Kỹ năng</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>Tạo nhanh toàn bộ cấu trúc cho một kỹ năng riêng biệt (Reading, Listening...)</p>
          </div>

          <div className="ed-card eb-wizard-card hover-bg-tertiary" onClick={() => setWizardMode('PART')}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 4px 10px rgba(13, 148, 136, 0.3)' }}>
              <Plus size={28} color="white" />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>3. Tạo 1 Part Lẻ</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>Chỉ tạo một đoạn văn (Passage) hoặc một part trắc nghiệm nhỏ bất kỳ</p>
          </div>

          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx" disabled={importing} onChange={handleImportExcel} />
          <div className="ed-card eb-wizard-card hover-bg-tertiary" role="button" tabIndex={0} aria-disabled={importing} onKeyDown={event => { if (!importing && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fileInputRef.current?.click(); } }} onClick={() => !importing && fileInputRef.current?.click()}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 4px 10px rgba(190, 24, 93, 0.3)' }}>
              <Upload size={28} color="white" />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>4. Nhập Đề Từ Excel</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>Tải lên file Excel chuẩn để hệ thống tự động bóc tách và trích xuất toàn bộ cấu trúc & câu hỏi</p>
          </div>

          <div className="ed-card eb-wizard-card hover-bg-tertiary" onClick={handleExportStandardTemplate}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 4px 10px rgba(4, 120, 87, 0.3)' }}>
              <Download size={28} color="white" />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>5. Xuất Excel</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>Tải xuống file Excel trắng được thiết lập chuẩn cấu trúc và dropdown để điền dữ liệu</p>
          </div>

          <div className="ed-card eb-wizard-card hover-bg-tertiary" onClick={() => { setParts([{ part_title: 'Part 1', instruction: '', question_groups: [{ group_id: generateId('group'), instruction: '', content_html: '', questions: [{ question_id: generateId('q'), type: 'MULTIPLE_CHOICE', question_text: 'Câu 1', metadata: { correct_answer: '' } }] }] }]); setWizardMode('BUILDER'); }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', boxShadow: '0 4px 10px rgba(109, 40, 217, 0.3)' }}>
              <Edit3 size={28} color="white" />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>6. Tạo Đề Tùy Chỉnh</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>Mở giao diện kéo thả trực tiếp để tự tay thiết kế và nhập từng câu hỏi trên web</p>
          </div>

        </div>
        
        {parts.length > 0 && (
          <button className="btn btn-outline" style={{ marginTop: '2.5rem', padding: '0.65rem 1.5rem', borderRadius: 'var(--radius-full)', fontWeight: 600 }} onClick={() => setWizardMode('BUILDER')}>
            Đóng & Quay lại Trình chỉnh sửa
          </button>
        )}
      </div>
    );
  }

  if (wizardMode === 'FULL') {
    return (
      <div className="eb-wizard-container">
        <h2 className="eb-wizard-title" style={{ marginBottom: '2rem' }}>Chọn Loại Sườn Đề</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '400px' }}>
          <button className="btn btn-outline flex-center" style={{ padding: '1rem', background: 'white', fontSize: '1rem', justifyContent: 'center' }} onClick={() => { applyTemplate('IELTS'); setWizardMode('BUILDER'); }}>Full IELTS Academic</button>
          <button className="btn btn-outline flex-center" style={{ padding: '1rem', background: 'white', fontSize: '1rem', justifyContent: 'center' }} onClick={() => { applyTemplate('TOEIC'); setWizardMode('BUILDER'); }}>Full TOEIC L&R</button>
          <button className="btn btn-outline flex-center" style={{ padding: '1rem', background: 'white', fontSize: '1rem', justifyContent: 'center' }} onClick={() => { applyTemplate('NLTV'); setWizardMode('BUILDER'); }}>Full NLTV B1-C1</button>
          <button className="btn btn-outline flex-center" style={{ padding: '1rem', background: 'white', fontSize: '1rem', justifyContent: 'center' }} onClick={() => { applyTemplate('TOEIC_WRITING'); setWizardMode('BUILDER'); }}>Full TOEIC Writing</button>
        </div>
        <button className="btn" style={{ marginTop: '2rem' }} onClick={() => setWizardMode('START')}>Quay lại</button>
      </div>
    );
  }

  if (wizardMode === 'SKILL') {
    return (
      <div className="eb-wizard-container">
        <h2 className="eb-wizard-title" style={{ marginBottom: '2rem' }}>Chọn Kỹ Năng Cần Thêm</h2>
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <select className="input-field" style={{ padding: '0.75rem', fontSize: '1rem', background: 'white' }} value={selectedSkill} onChange={e => setSelectedSkill(e.target.value)}>
            <option value="IELTS_LISTENING">IELTS - Listening (4 Parts)</option>
            <option value="IELTS_READING">IELTS - Reading (3 Passages)</option>
            <option value="IELTS_WRITING">IELTS - Writing (2 Tasks)</option>
            <option value="TOEIC_LISTENING">TOEIC - Listening (Part 1-4)</option>
            <option value="TOEIC_READING">TOEIC - Reading (Part 5-7)</option>
            <option value="NLTV_LISTENING">NLTV - Listening (3 Phần)</option>
            <option value="NLTV_READING">NLTV - Reading (4 Phần)</option>
            <option value="NLTV_WRITING">NLTV - Writing (2 Bài)</option>
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
      <div className="eb-wizard-container">
        <h2 className="eb-wizard-title" style={{ marginBottom: '2rem' }}>Chọn Part Lẻ Cần Thêm</h2>
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
            <optgroup label="NLTV">
              <option value="NLTV_L">NLTV Kỹ năng Nghe (1 Phần)</option>
              <option value="NLTV_R">NLTV Kỹ năng Đọc (1 Phần)</option>
              <option value="NLTV_W">NLTV Kỹ năng Viết (1 Bài)</option>
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
    <div className="eb-container">
      {/* Builder Top Banner */}
      <div className="eb-top-banner">
        {/* Background Pattern */}
        <div style={{ position: 'absolute', right: '-5%', top: '-20%', opacity: 0.05, transform: 'scale(1.5)', pointerEvents: 'none' }}>
          <Settings size={200} />
        </div>
        
        <div className="flex-between" style={{ position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 className="eb-top-banner-title">Trình Tạo Đề Thi Nâng Cao</h3>
            <p className="eb-top-banner-desc">Thiết kế và tùy chỉnh cấu trúc đề thi một cách trực quan.</p>
          </div>
        </div>
      </div>

      {/* Basic Info Card */}
      <div className="ed-card eb-info-card">
        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>Thông tin Cơ bản</h4>
        <div className="eb-info-grid">
          <div className="eb-info-title-group">
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tên đề thi *</label>
            <input type="text" className="input-field" value={examTitle} onChange={e => setExamTitle(e.target.value)} style={{ padding: '0.75rem 1rem', fontSize: '0.95rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }} />
          </div>
          <div className="eb-info-type-group">
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Loại chứng chỉ</label>
            <select className="input-field" value={examType} onChange={e => setExamType(e.target.value)} style={{ padding: '0.75rem 1rem', fontSize: '0.95rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
              <optgroup label="IELTS">
                <option value="IELTS_ACADEMIC">IELTS Academic</option>
                <option value="IELTS_GENERAL">IELTS General</option>
              </optgroup>
              <optgroup label="TOEIC">
                <option value="TOEIC_LR">TOEIC (Listening & Reading)</option>
                <option value="TOEIC_WRITING">TOEIC Writing</option>
              </optgroup>
              <optgroup label="Năng Lực Tiếng Việt (VSTEP)">
                <option value="NLTV_B1_C1">NLTV (B1 - C1)</option>
                <option value="NLTV_A1_A2">NLTV (A1 - A2)</option>
              </optgroup>
              <optgroup label="Khác">
                <option value="OTHER">Khác (Other)</option>
              </optgroup>
            </select>
          </div>
          <div className="eb-info-status-group">
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trạng thái hiển thị</label>
            <div 
              onClick={() => setIsPublished(!isPublished)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '0.5rem', 
                padding: '0.75rem 1rem', 
                borderRadius: 'var(--radius-md)', 
                border: `1px solid ${isPublished ? 'var(--success)' : 'var(--warning)'}`,
                background: isPublished ? 'var(--success-light)' : 'var(--warning-light)',
                color: isPublished ? 'var(--success-dark)' : 'var(--warning-dark)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: 700,
                fontSize: '0.95rem',
                userSelect: 'none'
              }}
              title="Click để đổi trạng thái"
            >
              {isPublished ? <CheckCircle size={18} /> : <FileText size={18} />}
              {isPublished ? 'Xuất bản (Hiển thị)' : 'Bản nháp (Ẩn)'}
            </div>
          </div>
        </div>
      </div>

      {parts.length === 0 ? (
        <div className="flex-center" style={{ padding: '4rem', border: '2px dashed var(--border-dark)', borderRadius: 'var(--radius-md)', flexDirection: 'column', color: 'var(--text-muted)' }}>
          <AlignLeft size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p style={{ marginBottom: '1.5rem' }}>Chưa có Part nào. Bấm nút bên dưới để bắt đầu.</p>
          <button className="btn btn-primary" onClick={() => {
            const newParts = [...parts, { part_title: `Part ${parts.length + 1}`, instruction: '', question_groups: [] }];
            setParts(newParts);
            setActivePartIndex(newParts.length - 1);
          }}>
            <Plus size={18} /> Thêm Part
          </button>
        </div>
      ) : (
        <div>
          {/* TABS */}
          <div className="eb-tabs-container">
            {parts.map((tabPart, tabIndex) => (
              <button 
                key={tabIndex} 
                onClick={() => setActivePartIndex(tabIndex)}
                className={`eb-tab-btn ${activePartIndex === tabIndex ? 'active' : ''}`}
              >
                {tabPart.part_title || `Part ${tabIndex + 1}`}
              </button>
            ))}
            <button
              onClick={() => {
                const newParts = [...parts, { part_title: `Part ${parts.length + 1}`, instruction: '', question_groups: [] }];
                setParts(newParts);
                setActivePartIndex(newParts.length - 1);
              }}
              style={{
                padding: '0.75rem 1rem',
                border: 'none',
                background: 'transparent',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                borderBottom: '3px solid transparent',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={18} /> Thêm Part
            </button>
          </div>

          {/* ACTIVE TAB CONTENT */}
          {(() => {
            const pIndex = activePartIndex;
            const part = parts[pIndex];
            if (!part) return null;
            return (
              <div className="ed-card eb-part-card">
                <div className="eb-part-header">
                  <div className="eb-part-inputs">
                    <div className="eb-part-title-input">
                      <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Tiêu đề Part</label>
                      <input type="text" className="input-field" value={part.part_title} onChange={(e) => updatePart(pIndex, 'part_title', e.target.value)} />
                    </div>
                    <div className="eb-part-instr-input">
                      <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Hướng dẫn chung (Instruction)</label>
                      <input type="text" className="input-field" value={part.instruction || ''} onChange={e => updatePart(pIndex, 'instruction', e.target.value)} placeholder="VD: Listen to the conversation..." />
                    </div>
                  </div>
                  <div>
                    <button className="btn" style={{ padding: '0.5rem 0.75rem', color: 'var(--danger)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', whiteSpace: 'nowrap' }} onClick={() => {
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
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  {/* AUDIO CHO PART */}
                  {(() => {
                    const titleLower = (part.part_title || '').toLowerCase();
                    const isDefaultListening =
                      titleLower.includes('listen') ||
                      titleLower.includes('nghe') ||
                      titleLower.includes('audio') ||
                      /part\s*[1-4]\b/i.test(titleLower) ||
                      titleLower.includes('photographs') ||
                      titleLower.includes('question-response') ||
                      titleLower.includes('conversations') ||
                      titleLower.includes('talks') ||
                      (examType.includes('TOEIC') && pIndex < 4);

                    const showAudioBox = isDefaultListening || part.shared_audio !== undefined;

                    if (showAudioBox) {
                      return (
                        <div className="eb-audio-box">
                          <div className="eb-audio-box-header">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              <Music size={16} color="var(--primary)" /> File Audio cho Part này (Listening Audio)
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <MediaUploadButton
                                type="audio"
                                onUploadSuccess={(url) => updatePart(pIndex, 'shared_audio', { url: url, duration_seconds: 0 })}
                                label="Upload File Audio"
                              />
                              {part.shared_audio?.url ? (
                                <button
                                  type="button"
                                  style={{ background: 'none', border: 'none', color: 'var(--danger, #ef4444)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem' }}
                                  onClick={() => updatePart(pIndex, 'shared_audio', { url: '', duration_seconds: 0 })}
                                  title="Xóa link audio hiện tại"
                                >
                                  <Trash2 size={13} /> Xóa Audio
                                </button>
                              ) : !isDefaultListening ? (
                                <button
                                  type="button"
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem' }}
                                  onClick={() => updatePart(pIndex, 'shared_audio', undefined)}
                                  title="Đóng phần đính kèm Audio"
                                >
                                  <Trash2 size={13} /> Bỏ Audio
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <input
                            type="text"
                            className="input-field"
                            value={part.shared_audio?.url || ''}
                            onChange={e => updatePart(pIndex, 'shared_audio', { url: e.target.value, duration_seconds: 0 })}
                            placeholder="Nhập đường dẫn URL file .mp3 cho Part này hoặc bấm 'Upload File Audio' ở trên..."
                          />
                          {part.shared_audio?.url && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <audio controls src={part.shared_audio.url} style={{ width: '100%', height: '36px' }} />
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.35rem 0.75rem', background: 'transparent', border: '1px dashed var(--border-medium, #cbd5e1)', cursor: 'pointer' }}
                          onClick={() => updatePart(pIndex, 'shared_audio', { url: '', duration_seconds: 0 })}
                        >
                          <Music size={14} color="var(--primary)" /> + Thêm Audio cho Part này
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* CHỈ HIỆN BÀI ĐỌC CHUNG NẾU LÀ IELTS READING PASSAGE HOẶC NLTV ĐỌC */}
                {(part.part_title.toLowerCase().includes('passage') || (examType === 'NLTV' && part.part_title.toLowerCase().includes('đọc'))) && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <RichTextEditor
                      label="Nội dung Bài Đọc Chung (Shared Reading Passage)"
                      value={part.shared_content_html || ''}
                      onChange={val => updatePart(pIndex, 'shared_content_html', val)}
                      placeholder="Nhập hoặc dán nội dung bài đọc tại đây (hỗ trợ cả văn bản thường và định dạng)..."
                      rows={6}
                      minHeight="180px"
                    />
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
                    <div key={group.group_id} className={`eb-group-card ${isWriting ? 'no-border' : ''}`}>
                      {!isWriting && <span className="eb-group-header-badge">GROUP {gIndex + 1} ({group.questions.length} CÂU)</span>}
                      
                      <div className="eb-group-row">
                        <div className="eb-group-col">
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Instruction</label>
                          <input type="text" className="input-field" value={group.instruction || ''} onChange={e => updateGroup(pIndex, gIndex, 'instruction', e.target.value)} placeholder="Choose the correct letter..." />
                        </div>
                        <div className="eb-group-col">
                          {(() => {
                            const currentImages = group.shared_images || (group.shared_media?.url ? [group.shared_media.url] : []);
                            return (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                    <Image size={14} color="var(--accent)" /> Shared Images ({currentImages.length} ảnh)
                                  </label>
                                  <MediaUploadButton
                                    type="images"
                                    onUploadSuccess={(url) => {
                                      const updated = [...currentImages, url];
                                      updateGroup(pIndex, gIndex, 'shared_images', updated);
                                      updateGroup(pIndex, gIndex, 'shared_media', { type: 'image', url: updated[0], display_config: { size_preset: 'medium', alignment: 'center' } });
                                    }}
                                    label="+ Thêm ảnh"
                                  />
                                </div>
                                <input
                                  type="text"
                                  className="input-field"
                                  value={currentImages.join(', ')}
                                  onChange={e => {
                                    const urls = e.target.value.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
                                    updateGroup(pIndex, gIndex, 'shared_images', urls);
                                    updateGroup(pIndex, gIndex, 'shared_media', urls.length > 0 ? { type: 'image', url: urls[0], display_config: { size_preset: 'medium', alignment: 'center' } } : undefined);
                                  }}
                                  placeholder="Nhập link ảnh (ngăn cách bằng dấu phẩy nếu nhiều ảnh)..."
                                />
                                {currentImages.length > 0 && (
                                  <div className="eb-image-gallery">
                                    {currentImages.map((imgUrl, imgIdx) => (
                                      <div key={imgIdx} className="eb-gallery-item">
                                        <span className="eb-gallery-badge">Ảnh {imgIdx + 1}</span>
                                        <img src={imgUrl} alt={`Ảnh ${imgIdx + 1}`} className="eb-gallery-img" />
                                        <button
                                          type="button"
                                          className="eb-gallery-del-btn"
                                          onClick={() => {
                                            const updated = currentImages.filter((_, idx) => idx !== imgIdx);
                                            updateGroup(pIndex, gIndex, 'shared_images', updated);
                                            updateGroup(pIndex, gIndex, 'shared_media', updated.length > 0 ? { type: 'image', url: updated[0], display_config: { size_preset: 'medium', alignment: 'center' } } : undefined);
                                          }}
                                          title="Xóa ảnh này"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '1.5rem' }}>
                        <RichTextEditor
                          label="Nội dung Đoạn văn / Đề bài (Passage / Prompt)"
                          value={group.content_html || ''}
                          onChange={val => updateGroup(pIndex, gIndex, 'content_html', val)}
                          placeholder="Nhập hoặc dán đoạn văn bài đọc tại đây (hỗ trợ cả văn bản thường và định dạng)..."
                          rows={4}
                          minHeight="130px"
                        />
                      </div>

                      <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>

                        {/* ẨN TẠO NHANH NẾU LÀ KỸ NĂNG VIẾT HOẶC ĐÃ CÓ CÂU HỎI */}
                        {(!isWriting && group.questions.length === 0) && (
                          <div className="flex-center eb-batch-bar">
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
                        <div>
                          {group.questions.map((q, qIndex) => (
                            <div key={qIndex} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: 'white', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', marginBottom: '0.75rem' }}>
                              {!isWriting && (
                                <div style={{ background: 'var(--primary)', color: 'white', width: '32px', height: '24px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
                                  {q.question_id.split('_')[1] || (qIndex + 1)}
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {!isWriting && (
                                  <select className="input-field" style={{ padding: '0.2rem', fontSize: '0.75rem', marginBottom: '0.25rem', width: '200px' }} value={q.type} onChange={e => updateQuestion(pIndex, gIndex, qIndex, 'type', e.target.value)}>
                                    {QUESTION_TYPES.map(qt => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
                                  </select>
                                )}
                                {!isWriting ? (
                                  <input type="text" className="input-field" value={q.question_text} onChange={e => updateQuestion(pIndex, gIndex, qIndex, 'question_text', e.target.value)} placeholder="Nội dung câu hỏi..." style={{ marginBottom: '0.5rem', padding: '0.4rem 0.75rem' }} />
                                ) : (
                                  <div style={{ padding: '1rem', background: 'var(--bg-secondary)', border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    <em>Khung nhập bài làm (văn bản) của thí sinh sẽ hiển thị tại đây. Đề bài đã được thiết lập ở phần trên.</em>
                                  </div>
                                )}
                                
                                {!isWriting && q.metadata.options !== undefined && (
                                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Các lựa chọn (Options):</span>
                                      <button className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-sm)' }} onClick={() => {
                                        updateQuestion(pIndex, gIndex, qIndex, 'metadata', addEditorOption(q.metadata));
                                      }}>
                                        <Plus size={12} style={{ marginRight: '0.2rem' }} /> Thêm đáp án
                                      </button>
                                    </div>
                                    {q.metadata.options.length > 0 ? (
                                      <div className="eb-options-grid">
                                        {q.metadata.options.map((opt, oIdx) => {
                                          const isMulti = q.type === 'MULTIPLE_CHOICE_MULTI';
                                          const hasValidAnswer = isMulti
                                            ? (q.metadata.correct_option_indices !== undefined 
                                                ? q.metadata.correct_option_indices.length > 0 
                                                : (Array.isArray(q.metadata.correct_answer) && q.metadata.correct_answer.length > 0))
                                            : (q.metadata.correct_option_index !== undefined 
                                                ? q.metadata.correct_option_index !== null 
                                                : (Boolean(q.metadata.correct_answer) && q.metadata.correct_answer !== ''));

                                          const isChecked = hasValidAnswer
                                            ? (isMulti 
                                                ? (q.metadata.correct_option_indices !== undefined 
                                                    ? q.metadata.correct_option_indices.includes(oIdx) 
                                                    : (Array.isArray(q.metadata.correct_answer) && opt !== '' && q.metadata.correct_answer.includes(opt)))
                                                : (q.metadata.correct_option_index !== undefined 
                                                    ? q.metadata.correct_option_index === oIdx 
                                                    : (opt !== '' && q.metadata.correct_answer === opt)))
                                            : false;
                                            
                                          return (
                                            <div key={oIdx} className="eb-option-item" style={{ border: `1px solid ${isChecked ? 'var(--success)' : 'var(--border-light)'}` }}>
                                              <input 
                                                type={isMulti ? "checkbox" : "radio"} 
                                                name={`q_${pIndex}_${gIndex}_${qIndex}`}
                                                checked={isChecked}
                                                onChange={(e) => {
                                                  if (isMulti) {
                                                    let currentIndices = Array.isArray(q.metadata.correct_option_indices) ? [...q.metadata.correct_option_indices] : [];
                                                    if (e.target.checked) currentIndices.push(oIdx);
                                                    else currentIndices = currentIndices.filter(item => item !== oIdx);
                                                    
                                                    updateQuestionMetadata(pIndex, gIndex, qIndex, 'correct_option_indices', currentIndices);
                                                    const newCorrectAnswers = currentIndices.map((i: number) => q.metadata.options?.[i] ?? '');
                                                    updateQuestionMetadata(pIndex, gIndex, qIndex, 'correct_answer', newCorrectAnswers);
                                                  } else {
                                                    updateQuestionMetadata(pIndex, gIndex, qIndex, 'correct_option_index', oIdx);
                                                    updateQuestionMetadata(pIndex, gIndex, qIndex, 'correct_answer', opt);
                                                  }
                                                }}
                                                style={{ cursor: 'pointer', accentColor: 'var(--success)', width: '16px', height: '16px', flexShrink: 0 }}
                                                title="Chọn làm đáp án đúng"
                                              />
                                              <div style={{ fontWeight: 700, fontSize: '0.875rem', width: '20px', color: isChecked ? 'var(--success)' : 'inherit', flexShrink: 0 }}>{q.metadata.option_ids?.[oIdx] || String.fromCharCode(65 + oIdx)}.</div>
                                              <input type="text" className="input-field" value={opt} onChange={(e) => {
                                                  const oldVal = opt;
                                                  const newVal = e.target.value;
                                                  
                                                  // Update options array
                                                  const newOpts = [...(q.metadata.options || [])]; 
                                                  newOpts[oIdx] = newVal;
                                                  updateQuestionMetadata(pIndex, gIndex, qIndex, 'options', newOpts);
                                                  
                                                  // Sync correct_answer if the option text changes
                                                  if (isMulti) {
                                                    if (q.metadata.correct_option_indices && q.metadata.correct_option_indices.includes(oIdx)) {
                                                      const newCorrectAnswers = q.metadata.correct_option_indices.map((i: number) => newOpts[i]);
                                                      updateQuestionMetadata(pIndex, gIndex, qIndex, 'correct_answer', newCorrectAnswers);
                                                    } else if (q.metadata.correct_option_indices === undefined && oldVal !== '' && Array.isArray(q.metadata.correct_answer) && q.metadata.correct_answer.includes(oldVal)) {
                                                      let currentArr = [...q.metadata.correct_answer];
                                                      currentArr = currentArr.map(v => v === oldVal ? newVal : v);
                                                      updateQuestionMetadata(pIndex, gIndex, qIndex, 'correct_answer', currentArr);
                                                    }
                                                  } else {
                                                    if (q.metadata.correct_option_index === oIdx || (q.metadata.correct_option_index === undefined && oldVal !== '' && q.metadata.correct_answer === oldVal)) {
                                                      updateQuestionMetadata(pIndex, gIndex, qIndex, 'correct_answer', newVal);
                                                    }
                                                  }
                                                }} style={{ padding: '0.2rem', fontSize: '0.875rem', border: 'none', flex: 1, background: 'transparent' }} />
                                              <button className="btn" style={{ padding: '0.2rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', flexShrink: 0 }} onClick={() => {
                                                updateQuestion(pIndex, gIndex, qIndex, 'metadata', removeEditorOption(q.metadata, oIdx));
                                              }}>
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Chưa có đáp án nào. Bấm "Thêm đáp án" để tạo.</p>
                                    )}
                                  </div>
                                )}

                                {!isWriting && (!q.metadata.options || q.metadata.options.length === 0) && (
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
                                {!isWriting && (
                                  <div style={{ marginTop: '0.75rem' }}>
                                    <RichTextEditor
                                      label="Lời giải thích (Explanation)"
                                      value={q.metadata.explanation || ''}
                                      onChange={val => updateQuestionMetadata(pIndex, gIndex, qIndex, 'explanation', val)}
                                      placeholder="Nhập lời giải thích chi tiết cho câu hỏi (hỗ trợ văn bản thường, định dạng in đậm, dịch nghĩa, hình ảnh)..."
                                      rows={3}
                                      minHeight="90px"
                                    />
                                  </div>
                                )}
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
                        <button className="btn eb-group-delete-btn" onClick={() => {
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
                      const maxGroups = getMaxGroupsForPart(part.part_title, examType);
                      
                      const isPartFull = (boundsForPart && nextStartForPart > boundsForPart.end) || 
                                         (maxGroups !== null && part.question_groups.length >= maxGroups);
                      
                      if (isPartFull) {
                        return <div style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600, padding: '1rem' }}>✓ Đã tạo đủ số lượng theo cấu trúc chuẩn.</div>;
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

      <div className="eb-bottom-bar">
        <div className="eb-bottom-actions">
          <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--success-dark)', borderColor: 'var(--success)', background: 'var(--success-light)' }} onClick={handleExportTemplate}>
            <FileText size={18} /> Xuất Excel
          </button>
          <button className="btn btn-outline" style={{ justifyContent: 'center' }} onClick={() => {
            Swal.fire({
              title: 'Hủy bỏ?',
              text: 'Bạn có chắc chắn muốn hủy? Toàn bộ nội dung đang làm sẽ bị xóa.',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Đồng ý hủy',
              cancelButtonText: 'Tiếp tục làm'
            }).then((result) => {
              if (result.isConfirmed) {
                onCancel();
              }
            });
          }}>Hủy</button>
          {importNotice}
          <button className="btn btn-outline" disabled={saving || importing} onClick={() => handleSave(true)}>Lưu nháp</button>
          <button className="btn btn-primary" disabled={saving || importing} style={{ justifyContent: 'center' }} onClick={() => handleSave()}><Save size={18} /> Lưu Đề Thi</button>
        </div>
      </div>

      {/* Floating Scroll To Top Button rendered at body level so it stays truly fixed in viewport */}
      {typeof document !== 'undefined' && createPortal(
        <button
          type="button"
          className={`eb-scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
          onClick={scrollToTop}
          title="Cuộn lên đầu trang"
          aria-label="Cuộn lên đầu trang"
        >
          <ArrowUp size={22} />
        </button>,
        document.body
      )}
    </div>
  );
};

export default ExamBuilder;
