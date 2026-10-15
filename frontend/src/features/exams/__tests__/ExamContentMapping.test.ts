import { describe, expect, it } from 'vitest';
import { addEditorOption, removeEditorOption, toEditorParts, toToeicRequest } from '../utils/examContentMapping';

const request = {
  title: 'ETS', type: 'TOEIC_LR', examLanguage: 'en', published: false,
  sections: [{ skillType: 'READING', durationMinutes: 75, parts: [{ partNumber: 5, contentData: {
    part_title: 'Part 5: Sentences', instruction: 'Read', import_profile: 'ETS_2024_TEMPLATE_44',
    question_groups: [{ group_id: 'p5-g1', instruction: '', content_html: '<p>Context</p>',
      questions: [{ question_id: 'q_101', type: 'SINGLE_CHOICE', question_text: 'Choose',
        options: [{ id: 'A', text: 'same' }, { id: 'B', text: 'same' }], correct_answer: 'B', explanation: 'Vì đúng.',
        media: { type: 'image', url: 'https://cdn.example.com/q.png' } }] }],
  } }] }],
};

describe('canonical/editor round trip', () => {
  it('preserves selected option IDs after removal and clears a deleted key', () => {
    const parts = toEditorParts(request);
    const question = parts[0].question_groups[0].questions[0];
    question.metadata = removeEditorOption(question.metadata, 0);
    expect(toToeicRequest('ETS', parts, false).sections[0].parts[0].contentData.question_groups[0].questions[0].correct_answer).toBe('B');
    question.metadata = addEditorOption(question.metadata);
    expect(question.metadata.option_ids).toEqual(['B', 'A']);
    expect(toToeicRequest('ETS', parts, false).sections[0].parts[0].contentData.question_groups[0].questions[0].correct_answer).toBe('B');
    question.metadata = removeEditorOption(question.metadata, 0);
    expect(toToeicRequest('ETS', parts, false).sections[0].parts[0].contentData.question_groups[0].questions[0].correct_answer).toBeNull();
  });
  it('keeps the option ID even when option texts are identical', () => {
    const parts = toEditorParts(request);
    expect(parts[0].question_groups[0].questions[0].metadata.correct_option_index).toBe(1);
    const rebuilt = toToeicRequest('ETS', parts, false);
    expect(rebuilt.sections[0].parts[0].partNumber).toBe(5);
    expect(rebuilt.sections[0].skillType).toBe('READING');
    expect(rebuilt.sections[0].durationMinutes).toBe(75);
    expect(rebuilt.sections[0].parts[0].contentData).toEqual(request.sections[0].parts[0].contentData);
  });
  it('uses live editor changes instead of stale canonical properties', () => {
    const parts = toEditorParts(request);
    const question = parts[0].question_groups[0].questions[0];
    question.metadata.correct_option_index = 0;
    question.metadata.explanation = 'Đã cập nhật';
    const q = toToeicRequest('ETS', parts, false).sections[0].parts[0].contentData.question_groups[0].questions[0];
    expect(q.correct_answer).toBe('A');
    expect(q.explanation).toBe('Đã cập nhật');
    expect(q.media).toEqual({ type: 'image', url: 'https://cdn.example.com/q.png' });
    expect(q).not.toHaveProperty('metadata');
  });
  it('does not infer listening from a placeholder media string', () => {
    const parts = toEditorParts(request);
    parts[0].shared_audio = { url: '44' };
    expect(toToeicRequest('ETS', parts, false).sections[0].skillType).toBe('READING');
  });
  it('keeps media stored in legacy builder metadata', () => {
    const parts = toEditorParts(request);
    const question: any = parts[0].question_groups[0].questions[0];
    delete question.media;
    question.metadata.media = { type: 'image', url: 'https://cdn.example.com/legacy.png' };
    expect(toToeicRequest('ETS', parts, false).sections[0].parts[0].contentData.question_groups[0].questions[0].media)
      .toEqual(question.metadata.media);
  });
});
