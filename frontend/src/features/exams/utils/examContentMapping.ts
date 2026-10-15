import type { ExamPart } from '../pages/admin/ExamBuilder';

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
    const content = structuredClone(part.contentData || {});
    return {
      ...content,
      partNumber: part.partNumber,
      shared_content_html: content.content_html ?? content.shared_content_html,
      question_groups: (content.question_groups || []).map((group: any) => ({
        ...group,
        questions: (group.questions || []).map((question: any) => {
          if (question.metadata) return question;
          const options = question.options || [];
          const index = options.findIndex((option: any) => option.id === question.correct_answer);
          return { ...question, type: question.type === 'SINGLE_CHOICE' ? 'MULTIPLE_CHOICE' : question.type === 'MULTIPLE_CHOICE' ? 'MULTIPLE_CHOICE_MULTI' : question.type,
            metadata: { options: options.map((option: any) => option.text), option_ids: options.map((option: any) => option.id),
              correct_answer: index >= 0 ? options[index].text : question.correct_answer,
              ...(index >= 0 ? { correct_option_index: index } : {}),
              ...(Array.isArray(question.correct_answer) ? { correct_option_indices: options.flatMap((option: any, i: number) => question.correct_answer.includes(option.id) ? [i] : []) } : {}),
              explanation: question.explanation,
            } };
        }),
      })),
    };
  }));
}

export function toToeicRequest(title: string, parts: ExamPart[], published: boolean) {
  const sections: Array<{ skillType: string; durationMinutes: number; parts: any[] }> = [];
  parts.forEach((part, index) => {
    const partNumber = part.partNumber ?? Number(/^Part\s+(\d+)/i.exec(part.part_title)?.[1] || index + 1);
    const skillType = partNumber <= 4 ? 'LISTENING' : 'READING';
    let section = sections.find(value => value.skillType === skillType);
    if (!section) {
      section = { skillType, durationMinutes: skillType === 'LISTENING' ? 45 : 75, parts: [] };
      sections.push(section);
    }
    const { partNumber: ignoredNumber, shared_content_html: sharedContent, ...content } = part;
    void ignoredNumber;
    const contentData: any = { ...content };
    if (sharedContent !== undefined) contentData.content_html = sharedContent;
    contentData.question_groups = part.question_groups.map(group => ({ ...group, questions: group.questions.map(question => {
      const { metadata, ...canonical } = question;
      const options = (metadata.options || []).map((text, i) => ({ id: metadata.option_ids?.[i] || String.fromCharCode(65 + i), text }));
      const answerId = (answer: unknown) => options.find(option => option.id === answer)?.id
        ?? (options.filter(option => option.text === answer).length === 1 ? options.find(option => option.text === answer)?.id : answer);
      return { ...canonical,
        type: question.type === 'MULTIPLE_CHOICE' ? 'SINGLE_CHOICE' : question.type === 'MULTIPLE_CHOICE_MULTI' ? 'MULTIPLE_CHOICE' : question.type,
        options,
        correct_answer: question.type === 'MULTIPLE_CHOICE_MULTI'
          ? metadata.correct_option_indices?.map(i => options[i]?.id) ?? (Array.isArray(metadata.correct_answer) ? metadata.correct_answer.map(answerId) : metadata.correct_answer)
          : metadata.correct_option_index !== undefined ? options[metadata.correct_option_index]?.id ?? null : answerId(metadata.correct_answer),
        explanation: metadata.explanation,
        ...(canonical.media !== undefined || metadata.media !== undefined ? { media: canonical.media ?? metadata.media } : {}),
      };
    }) }));
    section.parts.push({ partNumber, contentData });
  });
  sections.sort((a, b) => a.skillType === b.skillType ? 0 : a.skillType === 'LISTENING' ? -1 : 1);
  return { title, type: 'TOEIC_LR', examLanguage: 'en', published, sections };
}
