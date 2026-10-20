import { describe, expect, it } from 'vitest';
import { toEditorParts, toOfficialExamRequest } from '../utils/examContentMapping';

describe('official exam canonical editor mapping', () => {
  it('round-trips IELTS section timing, part content, structured media, paired keys and explanations', () => {
    const request = {
      title: 'Cambridge IELTS 20 Test 1',
      type: 'IELTS_ACADEMIC',
      examLanguage: 'en',
      published: false,
      sections: [
        {
          skillType: 'LISTENING', durationMinutes: 30,
          parts: [{ partNumber: 1, contentData: {
            part_title: 'Listening Part 1', instruction: 'Listen and answer.',
            shared_audio: { url: 'https://cdn.example.test/audio.mp3', duration_seconds: 90 },
            shared_media: { type: 'image', url: 'https://cdn.example.test/map.png' },
            content_html: '<p>Shared context</p>',
            question_groups: [{ group_id: 'g-listen-1', instruction: 'Choose two.', content_html: '',
              questions: [
                { question_id: 'l_017', type: 'SINGLE_CHOICE', question_number: 17, question_text: 'First slot',
                  options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(id => ({ id, text: `Option ${id}` })),
                  correct_answer: ['A', 'E'], explanation: null,
                  answer_group: { id: 'listening-17-18', mode: 'DISTINCT_UNORDERED', question_ids: ['l_017', 'l_018'] } },
                { question_id: 'l_018', type: 'SINGLE_CHOICE', question_number: 18, question_text: 'Second slot',
                  options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(id => ({ id, text: `Option ${id}` })),
                  correct_answer: ['A', 'E'], explanation: 'Verified explanation',
                  answer_group: { id: 'listening-17-18', mode: 'DISTINCT_UNORDERED', question_ids: ['l_017', 'l_018'] } },
              ] }],
          } }],
        },
        { skillType: 'READING', durationMinutes: 60, parts: [{ partNumber: 5, contentData: {
          part_title: 'Reading Passage 1', instruction: 'Read the passage.', content_html: '<p>Stress</p>',
          question_groups: [{ group_id: 'g-reading-1', instruction: '', content_html: '<p>Stress passage</p>', questions: [
            { question_id: 'r_001', type: 'TRUE_FALSE_NOT_GIVEN', question_number: 1, question_text: 'Statement',
              options: null, correct_answer: 'TRUE', explanation: null },
          ] }],
        } }] },
        { skillType: 'WRITING', durationMinutes: 60, parts: [{ partNumber: 8, contentData: {
          part_title: 'Writing Task 1', instruction: 'Write at least 150 words.',
          shared_media: { type: 'image', url: 'https://cdn.example.test/chart.png' },
          question_groups: [{ group_id: 'g-writing-1', instruction: '', content_html: '', questions: [
            { question_id: 'w_001', type: 'ESSAY', question_number: 1, question_text: 'Describe the chart.',
              options: null, correct_answer: null, explanation: null },
          ] }],
        } }] },
      ],
    };

    const editorParts = toEditorParts(request);
    expect(editorParts.map(part => [part.partNumber, part.section_skill_type, part.section_duration_minutes]))
      .toEqual([[1, 'LISTENING', 30], [5, 'READING', 60], [8, 'WRITING', 60]]);
    expect(editorParts[0].shared_audio).toEqual({ url: 'https://cdn.example.test/audio.mp3', duration_seconds: 90 });
    expect(editorParts[0].shared_media).toEqual({ type: 'image', url: 'https://cdn.example.test/map.png' });
    const pairQuestion = editorParts[0].question_groups[0].questions[0];
    expect(pairQuestion.answer_group).toEqual({ id: 'listening-17-18', mode: 'DISTINCT_UNORDERED', question_ids: ['l_017', 'l_018'] });
    expect(pairQuestion.metadata).toMatchObject({
      option_ids: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      correct_option_indices: [0, 4],
      correct_answer: ['Option A', 'Option E'],
    });

    const saved = toOfficialExamRequest('Cambridge IELTS 20 Test 1', 'IELTS_ACADEMIC', editorParts, false);
    expect(saved.examLanguage).toBe('en');
    expect(saved.published).toBe(false);
    expect(saved.sections.map(section => [section.skillType, section.durationMinutes])).toEqual([
      ['LISTENING', 30], ['READING', 60], ['WRITING', 60],
    ]);
    const savedPart = saved.sections[0].parts[0];
    expect(savedPart.partNumber).toBe(1);
    expect(savedPart.contentData).toMatchObject({
      part_title: 'Listening Part 1',
      instruction: 'Listen and answer.',
      shared_audio: { url: 'https://cdn.example.test/audio.mp3', duration_seconds: 90 },
      shared_media: { type: 'image', url: 'https://cdn.example.test/map.png' },
      content_html: '<p>Shared context</p>',
    });
    const savedQuestions = savedPart.contentData.question_groups[0].questions;
    expect(savedQuestions[0]).toMatchObject({
      question_id: 'l_017', type: 'SINGLE_CHOICE', correct_answer: ['A', 'E'], explanation: null,
      answer_group: { id: 'listening-17-18', mode: 'DISTINCT_UNORDERED', question_ids: ['l_017', 'l_018'] },
      options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(id => ({ id, text: `Option ${id}` })),
    });
    expect(savedQuestions[0]).not.toHaveProperty('metadata');
    expect(saved.sections[1].parts[0].contentData.question_groups[0].questions[0])
      .toMatchObject({ type: 'TRUE_FALSE_NOT_GIVEN', correct_answer: 'TRUE' });
    expect(saved.sections[2].parts[0].contentData.question_groups[0].questions[0])
      .toMatchObject({ type: 'ESSAY', correct_answer: null });
  });

  it('retains TOEIC audio-only answer labels, original part numbers, and duration while saving canonical IDs', () => {
    const request = {
      title: 'ETS Test', type: 'TOEIC_LR', examLanguage: 'en', published: false,
      sections: [{ skillType: 'LISTENING', durationMinutes: 45, parts: [{ partNumber: 2, contentData: {
        part_title: 'Part 2: Question-Response', instruction: 'Listen.',
        shared_audio: { url: 'https://cdn.example.test/p2.mp3' },
        question_groups: [{ group_id: 'g2', instruction: '', content_html: '', questions: [{
          question_id: 'q_007', type: 'SINGLE_CHOICE', question_number: 7, question_text: 'Where is the station?',
          options: ['A', 'B', 'C'].map(id => ({ id, text: id })), correct_answer: 'B', explanation: 'Because.',
        }] }],
      } }] }],
    };
    const editorParts = toEditorParts(request);
    expect(editorParts[0].partNumber).toBe(2);
    expect(editorParts[0].metadata).toBeUndefined();
    expect(editorParts[0].section_skill_type).toBe('LISTENING');
    expect(editorParts[0].section_duration_minutes).toBe(45);
    expect(editorParts[0].question_groups[0].questions[0].metadata.options).toEqual(['A', 'B', 'C']);

    const saved = toOfficialExamRequest('ETS Test', 'TOEIC_LR', editorParts, false);
    expect(saved.sections).toHaveLength(1);
    expect(saved.sections[0]).toMatchObject({ skillType: 'LISTENING', durationMinutes: 45 });
    expect(saved.sections[0].parts[0].partNumber).toBe(2);
    expect(saved.sections[0].parts[0].contentData.question_groups[0].questions[0])
      .toMatchObject({ question_id: 'q_007', type: 'SINGLE_CHOICE', correct_answer: 'B', options: [
        { id: 'A', text: 'A' }, { id: 'B', text: 'B' }, { id: 'C', text: 'C' },
      ] });
  });
});
