import { describe, it, expect } from 'vitest';
import {
  extractMinWords,
  getPartHeaderInfo,
  extractPartQuestions,
  declaredPartNumber,
  parseQuestionNumberFromId,
  isMultiChoicePair,
} from '../utils/examPartUtils';

describe('extractMinWords', () => {
  it('extracts minWords from explicit question metadata properties', () => {
    expect(extractMinWords({ min_words: 120 })).toBe(120);
    expect(extractMinWords({ minWords: 180 })).toBe(180);
    expect(extractMinWords({}, { min_words: 200 })).toBe(200);
    expect(extractMinWords({}, { minWords: 220 })).toBe(220);
  });

  it('extracts minWords from question_text with "(Minimum 100 words)"', () => {
    const q = {
      question_text: 'Summarize the key trends shown in global language adoption over the past 20 years. (Minimum 100 words)',
    };
    expect(extractMinWords(q)).toBe(100);
  });

  it('extracts minWords from various English phrasing variations', () => {
    expect(extractMinWords({ question_text: 'Write at least 250 words about urbanization.' })).toBe(250);
    expect(extractMinWords({ question_text: 'Provide a minimum of 200 words on renewable energy.' })).toBe(200);
    expect(extractMinWords({ question_text: 'Your response should be 120 words minimum.' })).toBe(120);
    expect(extractMinWords({ question_text: 'Please write min: 80 words.' })).toBe(80);
  });

  it('extracts minWords from Vietnamese phrasing variations', () => {
    expect(extractMinWords({ question_text: 'Viết ít nhất 150 từ nêu quan điểm của bạn.' })).toBe(150);
    expect(extractMinWords({ question_text: 'Yêu cầu tối thiểu 200 từ.' })).toBe(200);
  });

  it('falls back to 250 for Task 2 when no explicit word count is found', () => {
    expect(extractMinWords({ question_text: 'Some generic prompt' }, { title: 'Writing Task 2' })).toBe(250);
    expect(extractMinWords({ question_text: 'In task 2 you must analyze the charts below' })).toBe(250);
  });

  it('falls back to 150 for Task 1 or general Writing when no word count is found', () => {
    expect(extractMinWords({ question_text: 'Some generic prompt' }, { title: 'Writing Task 1' })).toBe(150);
    expect(extractMinWords({ question_text: 'Some generic prompt' }, { title: 'Writing Part' })).toBe(150);
    expect(extractMinWords({ question_text: 'Generic essay prompt' })).toBe(150);
  });

  it('does not invent a certification minimum for generic language-practice tasks', () => {
    expect(extractMinWords({ question_text: 'Some practice prompt' }, { title: 'Writing Task 1' }, 'LANGUAGE_PRACTICE')).toBe(0);
  });
});

describe('getPartHeaderInfo', () => {
  const fullExamParts = [
    { id: 1, title: 'Reading Part 1' },
    { id: 2, title: 'Reading Part 2' },
    { id: 3, title: 'Reading Part 3' },
    { id: 4, title: 'Listening Part 1' },
    { id: 5, title: 'Listening Part 2' },
    { id: 6, title: 'Writing Task 2' },
    { id: 7, title: 'Writing Task 1' },
  ];

  it('formats WRITING skill correctly with Task label and section part count', () => {
    const writingSectionParts = [
      { id: 6, title: 'Writing Task 2' },
      { id: 7, title: 'Writing Task 1' },
    ];

    const resultTask1 = getPartHeaderInfo('WRITING', writingSectionParts[1], writingSectionParts, fullExamParts);
    expect(resultTask1).toEqual({
      unitLabel: 'Task',
      currentNumber: 1,
      totalCount: 2,
      displayText: 'Task 1 / 2',
    });

    const resultTask2 = getPartHeaderInfo('WRITING', writingSectionParts[0], writingSectionParts, fullExamParts);
    expect(resultTask2).toEqual({
      unitLabel: 'Task',
      currentNumber: 2,
      totalCount: 2,
      displayText: 'Task 2 / 2',
    });
  });

  it('formats READING skill correctly with Passage label and section part count', () => {
    const readingSectionParts = [
      { id: 1, title: 'Reading Part 1' },
      { id: 2, title: 'Reading Part 2' },
      { id: 3, title: 'Reading Part 3' },
    ];

    const result = getPartHeaderInfo('READING', readingSectionParts[1], readingSectionParts, fullExamParts);
    expect(result).toEqual({
      unitLabel: 'Passage',
      currentNumber: 2,
      totalCount: 3,
      displayText: 'Passage 2 / 3',
    });
  });

  it('formats LISTENING skill correctly with Part label', () => {
    const listeningSectionParts = [
      { id: 4, title: 'Listening Part 1' },
      { id: 5, title: 'Listening Part 2' },
    ];

    const result = getPartHeaderInfo('LISTENING', listeningSectionParts[0], listeningSectionParts, fullExamParts);
    expect(result).toEqual({
      unitLabel: 'Part',
      currentNumber: 1,
      totalCount: 2,
      displayText: 'Part 1 / 2',
    });
  });

  it('handles single-part practice mode gracefully', () => {
    const singlePart = { id: 7, title: 'Writing Task 1' };
    const result = getPartHeaderInfo('WRITING', singlePart, [singlePart], [singlePart]);
    expect(result).toEqual({
      unitLabel: 'Task',
      currentNumber: 1,
      totalCount: 1,
      displayText: 'Task 1 / 1',
    });
  });

  it('falls back to index in section when title does not contain a number', () => {
    const customSectionParts = [
      { id: 10, title: 'Essay Analysis' },
      { id: 11, title: 'Summary Report' },
    ];
    const result = getPartHeaderInfo('WRITING', customSectionParts[0], customSectionParts, customSectionParts);
    expect(result).toEqual({
      unitLabel: 'Task',
      currentNumber: 1,
      totalCount: 2,
      displayText: 'Task 1 / 2',
    });
  });

  it('prefers the authoritative part_number over the section ordinal (TOEIC Parts 5-7)', () => {
    const toeicParts = [
      { id: 101, part_number: 1, title: 'Photographs' },
      { id: 102, part_number: 2, title: 'Question-Response' },
      { id: 103, part_number: 3, title: 'Conversations' },
      { id: 104, part_number: 4, title: 'Talks' },
      { id: 105, part_number: 5, title: 'Incomplete Sentences' },
      { id: 106, partNumber: 6, title: 'Text Completion' },
      { id: 107, partNumber: 7, title: 'Reading Comprehension' },
    ];
    const readingSectionParts = toeicParts.slice(4);

    const result = getPartHeaderInfo('READING', readingSectionParts[1], readingSectionParts, toeicParts);
    expect(result.unitLabel).toBe('Passage');
    expect(result.currentNumber).toBe(6);
    expect(result.displayText).toBe('Passage 6 / 3');
  });

  it('correctly uses Part label and whole-exam denominator for TOEIC examType', () => {
    const toeicParts = [
      { id: 101, part_number: 1, title: 'Part 1: Photographs' },
      { id: 102, part_number: 2, title: 'Part 2: Question-Response' },
      { id: 103, part_number: 3, title: 'Part 3: Conversations' },
      { id: 104, part_number: 4, title: 'Part 4: Talks' },
      { id: 105, part_number: 5, title: 'Part 5: Incomplete Sentences' },
      { id: 106, part_number: 6, title: 'Part 6: Text Completion' },
      { id: 107, part_number: 7, title: 'Part 7: Reading Comprehension' },
    ];
    const readingSectionParts = toeicParts.slice(4);

    const result5 = getPartHeaderInfo('READING', readingSectionParts[0], readingSectionParts, toeicParts, 'TOEIC');
    expect(result5).toEqual({
      unitLabel: 'Part',
      currentNumber: 5,
      totalCount: 7,
      displayText: 'Part 5 / 7',
    });

    const result6 = getPartHeaderInfo('READING', readingSectionParts[1], readingSectionParts, toeicParts, 'TOEIC_LR');
    expect(result6).toEqual({
      unitLabel: 'Part',
      currentNumber: 6,
      totalCount: 7,
      displayText: 'Part 6 / 7',
    });

    const listeningParts = toeicParts.slice(0, 4);
    const result1 = getPartHeaderInfo('LISTENING', listeningParts[0], listeningParts, toeicParts, 'TOEIC');
    expect(result1).toEqual({
      unitLabel: 'Part',
      currentNumber: 1,
      totalCount: 7,
      displayText: 'Part 1 / 7',
    });
  });

  it('keeps IELTS Passage/Task numbering when the exam declares global Part numbers', () => {
    const allParts = [
      { id: 101, part_number: 1, title: 'Listening Part 1' },
      { id: 102, part_number: 2, title: 'Listening Part 2' },
      { id: 103, part_number: 3, title: 'Listening Part 3' },
      { id: 104, part_number: 4, title: 'Listening Part 4' },
      { id: 105, part_number: 5, title: 'Reading Passage 1: The History of the Bicycle' },
      { id: 106, part_number: 6, title: 'Reading Passage 2: The Ocean Floor' },
      { id: 107, part_number: 7, title: 'Reading Passage 3: How stress affects our judgement' },
      { id: 108, part_number: 8, title: 'Writing Task 2: Academic Essay' },
      { id: 109, part_number: 9, title: 'Writing Task 1: Report' },
    ];

    const readingParts = allParts.slice(4, 7);
    const reading = getPartHeaderInfo('READING', readingParts[1], readingParts, allParts, 'IELTS');
    expect(reading.displayText).toBe('Passage 2 / 3');

    const writingParts = [allParts[7], allParts[8]];
    const writing = getPartHeaderInfo('WRITING', writingParts[0], writingParts, allParts, 'IELTS');
    expect(writing.displayText).toBe('Task 2 / 2');
  });

  it('uses the exam-wide Part order instead of the section ordinal when no part number is declared', () => {
    const allParts = [
      { id: 1, title: 'First' },
      { id: 2, title: 'Second' },
      { id: 3, title: 'Third' },
      { id: 4, title: 'Fourth' },
    ];
    const sectionParts = [allParts[2], allParts[3]];

    const result = getPartHeaderInfo('LISTENING', sectionParts[1], sectionParts, allParts);
    expect(result.currentNumber).toBe(4);
  });

  it('ignores an invalid explicit part number', () => {
    const invalidPart = { id: 10, part_number: 0, title: 'Essay Analysis' };
    const result = getPartHeaderInfo('WRITING', invalidPart, [invalidPart], [invalidPart]);
    expect(result.currentNumber).toBe(1);
  });
});

describe('extractPartQuestions', () => {
  it('extracts questions from grouped canonical structure (question_groups)', () => {
    const part = {
      id: 1,
      question_groups: [
        { group_id: 'g1', questions: [{ id: 'q1' }, { id: 'q2' }] },
        { group_id: 'g2', questions: [{ id: 'q3' }] },
      ],
    };
    const qs = extractPartQuestions(part);
    expect(qs).toHaveLength(3);
    expect(qs.map(q => q.id)).toEqual(['q1', 'q2', 'q3']);
  });

  it('extracts questions from camelCase questionGroups', () => {
    const part = {
      id: 2,
      questionGroups: [
        { groupId: 'g1', questions: [{ questionId: 'q10' }] },
      ],
    };
    const qs = extractPartQuestions(part);
    expect(qs).toHaveLength(1);
    expect(qs[0].questionId).toBe('q10');
  });

  it('extracts questions from nested contentData or content question_groups', () => {
    const partWithContentData = {
      contentData: {
        question_groups: [
          { questions: [{ id: 'cd_q1' }, { id: 'cd_q2' }] },
        ],
      },
    };
    expect(extractPartQuestions(partWithContentData)).toHaveLength(2);

    const partWithContent = {
      content: {
        question_groups: [
          { questions: [{ id: 'c_q1' }] },
        ],
      },
    };
    expect(extractPartQuestions(partWithContent)).toHaveLength(1);
  });

  it('falls back to flat questions when question_groups is absent', () => {
    const part = {
      id: 3,
      questions: [{ id: 'flat_1' }, { id: 'flat_2' }],
    };
    expect(extractPartQuestions(part)).toHaveLength(2);
  });

  it('returns empty array when part is null, undefined, or has no questions', () => {
    expect(extractPartQuestions(null)).toEqual([]);
    expect(extractPartQuestions(undefined)).toEqual([]);
    expect(extractPartQuestions({})).toEqual([]);
    expect(extractPartQuestions({ question_groups: [] })).toEqual([]);
  });
});

describe('declaredPartNumber & parseQuestionNumberFromId', () => {
  it('declaredPartNumber parses valid numbers and rejects invalid ones', () => {
    expect(declaredPartNumber({ part_number: 5 })).toBe(5);
    expect(declaredPartNumber({ partNumber: 7 })).toBe(7);
    expect(declaredPartNumber({ part_number: 0 })).toBeNull();
    expect(declaredPartNumber({ part_number: -1 })).toBeNull();
    expect(declaredPartNumber({ part_number: 2.5 })).toBeNull();
    expect(declaredPartNumber(null)).toBeNull();
  });

  it('parseQuestionNumberFromId extracts trailing digits', () => {
    expect(parseQuestionNumberFromId('q_001')).toBe(1);
    expect(parseQuestionNumberFromId('q_032')).toBe(32);
    expect(parseQuestionNumberFromId('q_200')).toBe(200);
    expect(parseQuestionNumberFromId('question15')).toBe(15);
    expect(parseQuestionNumberFromId('invalid')).toBeNull();
    expect(parseQuestionNumberFromId(null)).toBeNull();
    expect(parseQuestionNumberFromId(123)).toBeNull();
  });
});

describe('isMultiChoicePair', () => {
  it('detects pairs with MULTIPLE_CHOICE_MULTI type', () => {
    const q1 = { question_id: 'q1', type: 'MULTIPLE_CHOICE_MULTI' };
    const q2 = { question_id: 'q2', type: 'MULTIPLE_CHOICE_MULTI' };
    expect(isMultiChoicePair(q1, q2)).toBe(true);
  });

  it('detects pairs with shared answer_group id (Cambridge IELTS format)', () => {
    const q1 = {
      question_id: 'l_017',
      type: 'SINGLE_CHOICE',
      answer_group: { id: 'listening-17-18', mode: 'DISTINCT_UNORDERED', question_ids: ['l_017', 'l_018'] },
    };
    const q2 = {
      question_id: 'l_018',
      type: 'SINGLE_CHOICE',
      answer_group: { id: 'listening-17-18', mode: 'DISTINCT_UNORDERED', question_ids: ['l_017', 'l_018'] },
    };
    expect(isMultiChoicePair(q1, q2)).toBe(true);
  });

  it('detects pairs with shared answer_group question_ids', () => {
    const q1 = {
      question_id: 'l_021',
      type: 'SINGLE_CHOICE',
      answer_group: { question_ids: ['l_021', 'l_022'] },
    };
    const q2 = {
      question_id: 'l_022',
      type: 'SINGLE_CHOICE',
      answer_group: { question_ids: ['l_021', 'l_022'] },
    };
    expect(isMultiChoicePair(q1, q2)).toBe(true);
  });

  it('detects pairs with identical range text like Question 17-18 or Choose TWO', () => {
    const q1 = {
      question_id: 'q_a',
      question_text: 'Question 17-18: Which TWO things does Heather explain about kilns?',
    };
    const q2 = {
      question_id: 'q_b',
      question_text: 'Question 17-18: Which TWO things does Heather explain about kilns?',
    };
    expect(isMultiChoicePair(q1, q2)).toBe(true);
  });

  it('returns false for independent questions', () => {
    const q1 = { question_id: 'l_011', type: 'SINGLE_CHOICE', question_text: 'Question 11: Pottery differs...' };
    const q2 = { question_id: 'l_012', type: 'SINGLE_CHOICE', question_text: 'Question 12: Archaeologists...' };
    expect(isMultiChoicePair(q1, q2)).toBe(false);
    expect(isMultiChoicePair(null, q2)).toBe(false);
    expect(isMultiChoicePair(q1, null)).toBe(false);
  });
});
