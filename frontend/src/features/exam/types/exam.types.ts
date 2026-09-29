export type SkillType = 'READING' | 'LISTENING' | 'WRITING';

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'FILL_IN_THE_BLANK'
  | 'TRUE_FALSE_NOT_GIVEN'
  | 'YES_NO_NOT_GIVEN'
  | 'MATCHING_FEATURES'
  | 'MATCHING_HEADINGS'
  | 'MAP_LABELING'
  | 'DIAGRAM_LABELING'
  | 'ESSAY';

export interface ExamOption {
  id: string;
  text: string;
}

export interface SharedMedia {
  type: 'image';
  url: string;
  display_config?: {
    size_preset?: 'medium' | 'large';
    alignment?: 'center' | 'left' | 'right';
  };
}

export interface SharedAudio {
  url: string;
  duration_seconds?: number;
}

export interface Question {
  question_id: string;
  question_number: number;
  type: QuestionType;       // aligns with backend "type" field (was question_type)
  question_text: string;
  options: ExamOption[] | null;
  media: SharedMedia | null;
  // correct_answer intentionally absent — server never sends it in workspace
}

export interface QuestionGroup {
  group_id: string;
  instruction: string | null;
  context_html: string | null;
  shared_audio: SharedAudio | null;
  shared_media: SharedMedia | null;
  questions: Question[];
}

export interface ExamPartContent {
  part_title: string;
  instruction: string;
  shared_audio: SharedAudio | null;
  shared_media: SharedMedia | null;
  content_html: string | null;
  question_groups: QuestionGroup[];
}

export interface ExamPart {
  id: number;
  part_number: number;
  content: ExamPartContent;
}

export interface ExamSection {
  id: number;
  skill_type: SkillType;
  title: string;
  duration_minutes: number;
  parts: ExamPart[];
}

export interface ExamSnapshot {
  exam_id: number;
  code: string;
  title: string;
  type: string;
  sections: ExamSection[];
}
