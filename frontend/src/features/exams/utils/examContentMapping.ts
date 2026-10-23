import type { ExamPart } from '../pages/admin/ExamBuilder';

type CanonicalOption = { id: string; text: string; [key: string]: unknown };

function editorQuestion(question: any) {
  const answerGroup = question.answer_group ?? question.metadata?.answer_group;
  if (question.metadata) return { ...question, ...(answerGroup ? { answer_group: answerGroup } : {}) };

  const options: CanonicalOption[] = Array.isArray(question.options) ? question.options : [];
  const correct = question.correct_answer;
  const correctValues = Array.isArray(correct) ? correct : correct == null ? [] : [correct];
  const correctIndices = correctValues.map(value => options.findIndex(option => option.id === value));
  const allCorrectValuesAreOptions = correctIndices.length > 0 && correctIndices.every(index => index >= 0);
  const editorCorrectAnswer = allCorrectValuesAreOptions
    ? correctIndices.map(index => options[index].text)
    : correct;
  const editorType = question.type === 'SINGLE_CHOICE'
    ? 'MULTIPLE_CHOICE'
    : question.type === 'MULTIPLE_CHOICE'
      ? 'MULTIPLE_CHOICE_MULTI'
      : question.type === 'ESSAY' ? 'WRITING_ESSAY' : question.type;

  return {
    ...question,
    type: editorType,
    ...(answerGroup ? { answer_group: answerGroup } : {}),
    metadata: {
      ...(question.metadata ?? {}),
      options: options.map(option => option.text),
      option_ids: options.map(option => option.id),
      correct_answer: editorCorrectAnswer,
      ...(allCorrectValuesAreOptions
        ? Array.isArray(correct)
          ? { correct_option_indices: correctIndices }
          : { correct_option_index: correctIndices[0] }
        : {}),
      explanation: question.explanation !== undefined ? question.explanation : question.metadata?.explanation,
      ...(question.media ? { media: question.media } : {}),
    },
  };
}

export function addEditorOption(metadata: Record<string, any>) {
  const result = structuredClone(metadata);
  result.options = [...(result.options || []), 'Lựa chọn mới'];
  if (result.option_ids) {
    const nextId = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(id => !result.option_ids.includes(id));
    result.option_ids.push(nextId);
  }
  return result;
}

export function removeEditorOption(metadata: Record<string, any>, index: number) {
  const result = structuredClone(metadata);
  result.options = (result.options || []).filter((_: unknown, i: number) => i !== index);
  if (result.option_ids) result.option_ids.splice(index, 1);
  if (result.correct_option_index === index) {
    delete result.correct_option_index;
    result.correct_answer = null;
  } else if (result.correct_option_index > index) result.correct_option_index--;
  if (Array.isArray(result.correct_option_indices)) {
    result.correct_option_indices = result.correct_option_indices.filter((i: number) => i !== index).map((i: number) => i > index ? i - 1 : i);
    result.correct_answer = result.correct_option_indices.map((i: number) => result.options[i]);
  }
  return result;
}

// Keep canonical fields alongside editor metadata so IDs/media survive editing.
export function toEditorParts(request: any): ExamPart[] {
  return (request.sections || []).flatMap((section: any) => (section.parts || []).map((part: any) => {
    const content = structuredClone(part.contentData || part.content_data || {});
    return {
      ...content,
      partNumber: part.partNumber ?? part.part_number,
      section_skill_type: section.skillType ?? section.skill_type,
      section_duration_minutes: section.durationMinutes ?? section.duration_minutes,
      shared_content_html: content.content_html ?? content.shared_content_html,
      question_groups: (content.question_groups || []).map((group: any) => ({
        ...group,
        questions: (group.questions || []).map(editorQuestion),
      })),
    };
  }));
}

function inferOfficialSkill(type: string, partNumber: number, partTitle: string): string {
  if (type === 'TOEIC_LR') return partNumber <= 4 ? 'LISTENING' : 'READING';
  if (type === 'TOEIC_WRITING') return 'WRITING';
  if (type === 'IELTS_ACADEMIC') {
    if (partNumber <= 4) return 'LISTENING';
    if (partNumber <= 7) return 'READING';
    return 'WRITING';
  }
  const title = partTitle.toLowerCase();
  if (title.includes('listen') || title.includes('nghe')) return 'LISTENING';
  if (title.includes('read') || title.includes('đọc')) return 'READING';
  if (title.includes('writ') || title.includes('viết')) return 'WRITING';
  return 'MIXED';
}

function defaultOfficialDuration(type: string, skillType: string): number {
  if (type === 'TOEIC_LR') return skillType === 'LISTENING' ? 45 : 75;
  if (type === 'TOEIC_WRITING') return 60;
  if (type === 'IELTS_ACADEMIC') return skillType === 'LISTENING' ? 30 : 60;
  return 60;
}

function canonicalAnswer(answer: unknown, options: CanonicalOption[], metadata: Record<string, any>): unknown {
  const optionId = (value: unknown) => {
    if (typeof value !== 'string') return value;
    const index = metadata.option_ids?.indexOf(value) ?? -1;
    if (index >= 0 && options[index]) return options[index].id;
    const matches = options.filter(option => option.text === value);
    return matches.length === 1 ? matches[0].id : value;
  };
  if (Array.isArray(answer)) return answer.map(optionId);
  return optionId(answer);
}

export function toOfficialExamRequest(title: string, type: string, parts: ExamPart[], published: boolean) {
  const sections: Array<{ skillType: string; durationMinutes: number; parts: any[] }> = [];
  parts.forEach((part, index) => {
    const partNumber = part.partNumber ?? Number(/^Part\s+(\d+)/i.exec(part.part_title)?.[1] || index + 1);
    const skillType = part.section_skill_type || inferOfficialSkill(type, partNumber, part.part_title);
    const durationMinutes = Number(part.section_duration_minutes) || defaultOfficialDuration(type, skillType);
    let section = sections.find(value => value.skillType === skillType);
    if (!section) {
      section = { skillType, durationMinutes, parts: [] };
      sections.push(section);
    } else if (section.durationMinutes !== durationMinutes) {
      throw new Error('Thời lượng kỹ năng trong dữ liệu đề thi không nhất quán.');
    }
    const { partNumber: ignoredNumber, shared_content_html: sharedContent, section_skill_type: ignoredSkill,
      section_duration_minutes: ignoredDuration, ...content } = part;
    void ignoredNumber; void ignoredSkill; void ignoredDuration;
    const contentData: any = { ...content };
    if (sharedContent !== undefined) contentData.content_html = sharedContent;
    delete contentData.shared_content_html;
    contentData.question_groups = part.question_groups.map(group => ({ ...group, questions: group.questions.map(question => {
      const metadata = question.metadata || {};
      const { metadata: ignoredMetadata, ...canonical } = question;
      void ignoredMetadata;
      const options: CanonicalOption[] = (metadata.options || []).map((text: string, i: number) => ({
        id: metadata.option_ids?.[i] || String.fromCharCode(65 + i), text,
      }));
      const mappedAnswer = metadata.correct_option_indices !== undefined
        ? metadata.correct_option_indices.map((optionIndex: number) => options[optionIndex]?.id).filter(Boolean)
        : metadata.correct_option_index !== undefined
          ? options[metadata.correct_option_index]?.id ?? null
          : canonicalAnswer(metadata.correct_answer, options, metadata);
      const answerGroup = question.answer_group ?? metadata.answer_group;
      return { ...canonical,
        type: question.type === 'MULTIPLE_CHOICE' ? 'SINGLE_CHOICE'
          : question.type === 'MULTIPLE_CHOICE_MULTI' ? 'MULTIPLE_CHOICE'
            : question.type === 'WRITING_ESSAY' ? 'ESSAY' : question.type,
        options,
        correct_answer: mappedAnswer,
        explanation: metadata.explanation,
        ...(answerGroup ? { answer_group: answerGroup } : {}),
        ...(canonical.media !== undefined || metadata.media !== undefined ? { media: canonical.media ?? metadata.media } : {}),
      };
    }) }));
    section.parts.push({ partNumber, contentData });
  });
  return { title, type, examLanguage: 'en', published, sections };
}

export function toToeicRequest(title: string, parts: ExamPart[], published: boolean) {
  return toOfficialExamRequest(title, 'TOEIC_LR', parts, published);
}
