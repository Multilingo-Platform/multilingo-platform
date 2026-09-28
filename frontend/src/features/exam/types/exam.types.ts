export type SkillType = 'READING' | 'LISTENING' | 'WRITING';

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'FILL_IN_THE_BLANK'
  | 'TRUE_FALSE_NOT_GIVEN'
  | 'YES_NO_NOT_GIVEN'
  | 'MATCHING'
  | 'DIAGRAM_LABELING'
  | 'ESSAY';

export interface ExamOption {
  id: string;
  text: string;
}

export interface Question {
  question_id: string;
  question_number: number;
  question_type: QuestionType;
  question_text: string;
  options: ExamOption[] | null;
  // KHÔNG có correct_answer trên client — server giữ bảo mật
}

export interface QuestionGroup {
  group_id: string;
  context_html: string | null;
  questions: Question[];
}

export interface ExamPartContent {
  part_title: string;
  instruction: string;
  shared_media: {
    type: 'AUDIO' | 'IMAGE';
    url: string;
  } | null;
  question_groups: QuestionGroup[];
}

export interface ExamPart {
  id: number;           // Integer (BaseEntity.id)
  part_number: number;
  content: ExamPartContent;
}

export interface ExamSection {
  id: number;
  skill_type: SkillType;
  title: string;
  duration_minutes: number;   // Luôn có — ExamSection.durationMinutes default=60
  parts: ExamPart[];
}

export interface ExamSnapshot {
  exam_id: number;
  code: string;
  title: string;
  type: string;
  sections: ExamSection[];
}
