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
  return (request.sections || []).flatMap((section: any, sectionIndex: number) => (section.parts || []).map((part: any) => {
    const content = structuredClone(part.contentData || part.content_data || {});
    return {
      ...content,
      partNumber: part.partNumber ?? part.part_number,
      section_skill_type: section.skillType ?? section.skill_type,
      section_duration_minutes: section.durationMinutes ?? section.duration_minutes,
      section_id: section.id ?? section.section_id ?? `sec_${sectionIndex}`,
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
  if (type === 'NLTV') return partNumber <= 4 ? 'LISTENING' : partNumber <= 6 ? 'READING' : 'WRITING';
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
    if (contentData.shared_audio && (!contentData.shared_audio.url || !String(contentData.shared_audio.url).trim())) {
      delete contentData.shared_audio;
    }
    if (contentData.shared_media && (!contentData.shared_media.url || !String(contentData.shared_media.url).trim())) {
      delete contentData.shared_media;
    }
    contentData.question_groups = part.question_groups.map(group => {
      const groupData: any = { ...group };
      if (!groupData.content_html && contentData.content_html) {
        groupData.content_html = contentData.content_html;
      }
      if (groupData.shared_media && (!groupData.shared_media.url || !String(groupData.shared_media.url).trim())) {
        delete groupData.shared_media;
      }
      groupData.questions = group.questions.map(question => {
        const metadata = question.metadata || {};
        const { metadata: ignoredMetadata, ...canonical } = question;
        void ignoredMetadata;
        const isEssay = question.type === 'WRITING_ESSAY' || question.type === 'ESSAY';
        const options: CanonicalOption[] = isEssay ? [] : (metadata.options || []).map((text: string, i: number) => ({
          id: metadata.option_ids?.[i] || String.fromCharCode(65 + i), text,
        }));
        const mappedAnswer = isEssay ? null : (metadata.correct_option_indices !== undefined
          ? metadata.correct_option_indices.map((optionIndex: number) => options[optionIndex]?.id).filter(Boolean)
          : metadata.correct_option_index !== undefined
            ? options[metadata.correct_option_index]?.id ?? null
            : canonicalAnswer(metadata.correct_answer, options, metadata));
        const answerGroup = question.answer_group ?? metadata.answer_group;
        const alternates = (canonical as any).alternates ?? metadata.alternates;
        const rawMedia = canonical.media ?? metadata.media;
        const hasMedia = rawMedia && rawMedia.url && String(rawMedia.url).trim() !== '';
        const minWords = (canonical as any).min_words ?? metadata.min_words ?? (partNumber === 8 && type === 'NLTV' ? 120 : partNumber === 9 && type === 'NLTV' ? 200 : undefined);

        const qObj: any = {
          ...canonical,
          type: question.type === 'MULTIPLE_CHOICE' ? 'SINGLE_CHOICE'
            : question.type === 'MULTIPLE_CHOICE_MULTI' ? 'MULTIPLE_CHOICE'
              : question.type === 'WRITING_ESSAY' ? 'ESSAY' : question.type,
          explanation: metadata.explanation,
          ...(answerGroup ? { answer_group: answerGroup } : {}),
          ...(hasMedia ? { media: rawMedia } : {}),
          ...(alternates !== undefined ? { alternates } : {}),
        };
        if (isEssay) {
          if (minWords !== undefined) qObj.min_words = minWords;
          qObj.correct_answer = null;
          delete qObj.options;
        } else {
          qObj.options = options;
          qObj.correct_answer = mappedAnswer;
        }
        return qObj;
      });

      if (type === 'NLTV' && partNumber === 7) {
        let passage = groupData.content_html || contentData.content_html || '';
        if (passage) {
          for (let num = 1; num <= 10; num++) {
            const markerRegex = new RegExp(`\\(\\s*${num}\\s*\\)\\s*(?:_{2,}|\\.{2,}|[-–—]{2,}|\\u2026+)`, 'g');
            passage = passage.replace(markerRegex, `(${num}) ____`);
          }
          if (Array.isArray(groupData.questions)) {
            groupData.questions.forEach((q: any, i: number) => {
              const num = i + 1;
              const ans = typeof q.correct_answer === 'string' ? q.correct_answer.trim() : '';
              if (ans) {
                const regex = new RegExp(`\\(\\s*${num}\\s*\\)\\s+${ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
                passage = passage.replace(regex, `(${num}) ____`);
              }
              const markerRegex = new RegExp(`\\(\\s*${num}\\s*\\)\\s*(?:_{2,}|\\.{2,}|[-–—]{2,}|\\u2026+)`, 'g');
              passage = passage.replace(markerRegex, `(${num}) ____`);
            });
          }
          groupData.content_html = passage;
          contentData.content_html = passage;
        }
      }

      return groupData;
    });
    section.parts.push({ partNumber, contentData });
  });
  return { title, type, examLanguage: type === 'NLTV' ? 'vi' : 'en', published, isPublished: published, sections };
}

const LEARNING_LANGUAGE_ALIASES: Record<string, string> = {
  eng: 'en', vie: 'vi', kor: 'ko', zho: 'zh', jpn: 'ja', fra: 'fr', deu: 'de', spa: 'es',
};
const SUPPORTED_LEARNING_BASES = new Set(['en', 'vi', 'ko', 'zh', 'ja', 'fr', 'de', 'es']);

function canonicalLearningLanguage(raw: string): string {
  const tag = raw.trim().replace(/_/g, '-');
  const parts = tag.split('-');
  const base = parts.shift()?.toLowerCase() || '';
  const language = LEARNING_LANGUAGE_ALIASES[base] ?? base;
  if (!SUPPORTED_LEARNING_BASES.has(language) || parts.some(part => !/^[A-Za-z0-9]{1,8}$/.test(part))) {
    throw new Error('Ngôn ngữ đề không được hỗ trợ.');
  }
  const script = parts.find(part => /^[A-Za-z]{4}$/.test(part));
  const region = parts.find(part => /^[A-Za-z]{2}$/.test(part) || /^\d{3}$/.test(part));
  if (parts.length > Number(Boolean(script)) + Number(Boolean(region))) {
    throw new Error('Thẻ ngôn ngữ đề không hợp lệ.');
  }
  return [language, script ? script[0].toUpperCase() + script.slice(1).toLowerCase() : '',
    region ? (/^\d/.test(region) ? region : region.toUpperCase()) : ''].filter(Boolean).join('-');
}

/** Maps manually authored language-practice parts to the backend canonical request. */
export function toLanguagePracticeRequest(title: string, language: string, parts: ExamPart[], published: boolean) {
  const examLanguage = canonicalLearningLanguage(language);
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('Đề cần ít nhất một Part.');

  const sections: Array<{ sectionKey: string; skillType: string; durationMinutes: number; parts: any[] }> = [];
  parts.forEach((part, index) => {
    const skillType = String((part as any).section_skill_type || '').trim().toUpperCase();
    const durationMinutes = Number((part as any).section_duration_minutes);
    if (!['LISTENING', 'READING', 'WRITING'].includes(skillType)) {
      throw new Error(`Part ${index + 1} cần chọn skill tường minh.`);
    }
    if (!Number.isSafeInteger(durationMinutes) || durationMinutes <= 0) {
      throw new Error(`Part ${index + 1} cần thời lượng dương.`);
    }
    if (!Array.isArray(part.question_groups)) throw new Error(`Part ${index + 1} thiếu nhóm câu hỏi.`);

    const sectionId = (part as any).section_id;
    const sectionKey = sectionId !== undefined && sectionId !== null && String(sectionId).trim() !== ''
      ? `id:${String(sectionId).trim()}_${skillType}_${durationMinutes}`
      : `skill:${skillType}_${durationMinutes}`;

    let section = sections.find(item => item.sectionKey === sectionKey);
    if (!section) {
      section = { sectionKey, skillType, durationMinutes, parts: [] };
      sections.push(section);
    }

    const partNumber = Number.isSafeInteger(part.partNumber) && Number(part.partNumber) > 0
      ? Number(part.partNumber)
      : index + 1;
    const { partNumber: ignoredNumber, shared_content_html: sharedContent, section_skill_type: ignoredSkill,
      section_duration_minutes: ignoredDuration, ...content } = part as any;
    void ignoredNumber; void ignoredSkill; void ignoredDuration;
    const contentData: any = { ...content };
    if (sharedContent !== undefined) contentData.content_html = sharedContent;
    delete contentData.shared_content_html;
    contentData.question_groups = part.question_groups.map(group => ({
      ...group,
      questions: group.questions.map((question: any) => {
        const metadata = question.metadata || {};
        const canonicalOptions: CanonicalOption[] = Array.isArray(question.options) ? question.options : [];
        const optionTexts: string[] = Array.isArray(metadata.options)
          ? metadata.options
          : canonicalOptions.map(option => option.text);
        const options: CanonicalOption[] = optionTexts.map((text, i) => ({
          id: metadata.option_ids?.[i] || canonicalOptions[i]?.id || String.fromCharCode(65 + i),
          text,
        }));
        const rawAnswer = metadata.correct_option_indices !== undefined
          ? metadata.correct_option_indices.map((optionIndex: number) => options[optionIndex]?.id).filter(Boolean)
          : metadata.correct_option_index !== undefined
            ? options[metadata.correct_option_index]?.id ?? null
            : metadata.correct_answer ?? question.correct_answer;
        const { metadata: ignoredMetadata, ...canonical } = question;
        void ignoredMetadata;
        const alternates = canonical.alternates ?? metadata.alternates;
        return {
          ...canonical,
          type: question.type === 'MULTIPLE_CHOICE' ? 'SINGLE_CHOICE'
            : question.type === 'MULTIPLE_CHOICE_MULTI' ? 'MULTIPLE_CHOICE'
              : question.type === 'WRITING_ESSAY' ? 'ESSAY' : question.type,
          options: options.length ? options : null,
          correct_answer: canonicalAnswer(rawAnswer, options, metadata),
          explanation: metadata.explanation ?? question.explanation ?? null,
          ...(question.answer_group || metadata.answer_group
            ? { answer_group: question.answer_group ?? metadata.answer_group }
            : {}),
          ...(alternates !== undefined ? { alternates } : {}),
        };
      }),
    }));
    section.parts.push({ partNumber, contentData });
  });

  return {
    title,
    type: 'LANGUAGE_PRACTICE',
    examLanguage,
    published,
    sections: sections.map(({ skillType, durationMinutes, parts }) => ({ skillType, durationMinutes, parts })),
  };
}

export function toToeicRequest(title: string, parts: ExamPart[], published: boolean) {
  return toOfficialExamRequest(title, 'TOEIC_LR', parts, published);
}
