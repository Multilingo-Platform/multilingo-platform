export type SkillType = 'READING' | 'LISTENING' | 'WRITING';

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_CHOICE_MULTI'
  | 'FILL_IN_THE_BLANK'
  | 'TRUE_FALSE_NOT_GIVEN'
  | 'YES_NO_NOT_GIVEN'
  | 'MATCHING_FEATURES'
  | 'MATCHING_HEADINGS'
  | 'MATCHING_SENTENCE_ENDINGS'
  | 'MATCHING_INFORMATION'
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

/**
 * Verified listening detail attached to a question when the *source* actually provides it.
 * Practice-only: the Mock projection strips every transcript alias before the snapshot reaches
 * the client, and the workspace UI must never reveal spoken text before the answer is checked.
 */
export interface ListeningDetailOption {
  /** Option label this spoken line belongs to (A–D). */
  label: string;
  text: string;
}

export interface ListeningDetail {
  /** Verified transcript of the spoken prompt/statement. */
  transcript?: string | null;
  /** Verified spoken option lines. */
  options?: ListeningDetailOption[] | null;
}

export interface Question {
  question_id: string;
  question_number: number;
  type: QuestionType;       // aligns with backend "type" field (was question_type)
  question_text: string;
  options: ExamOption[] | null;
  media: SharedMedia | null;
  answer_group?: {
    id: string;
    mode: 'DISTINCT_UNORDERED';
    question_ids: string[];
  };
  // Wire aliases: the workspace snapshot may arrive with camelCase keys. `id` is the DB id and is
  // never a question number or question identity.
  questionId?: string;
  questionNumber?: number;
  prompt?: string;
  id?: number | string;
  // Practice listening reveal. Absent from Mock snapshots and from sources without a verified
  // transcript; the UI reveals it only after the answer has been checked.
  listening_detail?: ListeningDetail | null;
  listeningDetail?: ListeningDetail | null;
  listening_transcript?: string | null;
  listeningTranscript?: string | null;
  transcript?: string | null;
  // correct_answer intentionally absent — server never sends it in workspace
}

export interface QuestionGroup {
  group_id: string;
  instruction: string | null;
  context_html: string | null;
  shared_audio: SharedAudio | null;
  shared_media: SharedMedia | null;
  questions: Question[];
  // Wire alias for group_id.
  groupId?: string;
}

export interface ExamPartContent {
  part_title: string;
  instruction: string;
  shared_audio: SharedAudio | null;
  shared_media: SharedMedia | null;
  content_html: string | null;
  question_groups: QuestionGroup[];
  // Wire aliases for the nested group list.
  questionGroups?: QuestionGroup[];
}

export interface ExamPart {
  id: number;
  part_number?: number;
  title?: string;
  durationMinutes?: number;
  instruction?: string;
  contentHtml?: string;
  content?: ExamPartContent;
  questions?: Question[];
  // Wire aliases: part_id/partId are the Part id, partNumber aliases part_number.
  part_id?: number;
  partId?: number;
  partNumber?: number;
  part_title?: string;
  question_groups?: QuestionGroup[];
  questionGroups?: QuestionGroup[];
}

export interface ExamSection {
  id: number;
  skill_type: SkillType;
  title: string;
  duration_minutes: number;
  parts: ExamPart[];
  // Wire aliases for the section id.
  section_id?: number;
  sectionId?: number;
}

export interface ExamSnapshot {
  exam_id: number;
  code: string;
  title: string;
  type: string;
  /** Canonical BCP-47 learning language captured in this attempt snapshot. */
  examLanguage?: string | null;
  exam_language?: string | null;
  sections: ExamSection[];
  // Wire aliases used to detect the TOEIC exam family.
  exam_code?: string;
  examCode?: string;
  exam_type?: string;
  examType?: string;
}
