import { describe, it, expect } from 'vitest';
import { extractMinWords, getPartHeaderInfo } from '../utils/examPartUtils';

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
    expect(extractMinWords({ question_text: 'Write at least 250 words about climate change.' })).toBe(250);
    expect(extractMinWords({ prompt: 'Write a minimum of 200 words.' })).toBe(200);
    expect(extractMinWords({ question_text: 'Complete the response (min 80 words).' })).toBe(80);
    expect(extractMinWords({ question_text: '120 words minimum required.' })).toBe(120);
    expect(extractMinWords({ question_text: 'You must write 300 words or more.' })).toBe(300);
  });

  it('extracts minWords from Vietnamese phrasing variations', () => {
    expect(extractMinWords({ question_text: 'Viết bài luận tối thiểu 150 từ về chủ đề sau.' })).toBe(150);
    expect(extractMinWords({ prompt: 'Thí sinh viết ít nhất 250 từ.' })).toBe(250);
    expect(extractMinWords({}, { instruction: 'Số lượng từ tối thiểu: 100 từ' })).toBe(100);
  });

  it('falls back to 250 for Task 2 when no explicit word count is found', () => {
    expect(extractMinWords({ question_text: 'Discuss both views.' }, { title: 'Writing Task 2' })).toBe(250);
    expect(extractMinWords({ question_text: 'Writing Task 2 Essay Question' })).toBe(250);
    expect(extractMinWords({}, { content: { part_title: 'IELTS Writing Task 2' } })).toBe(250);
  });

  it('falls back to 150 for Task 1 or general Writing when no word count is found', () => {
    expect(extractMinWords({ question_text: 'Describe the chart.' }, { title: 'Writing Task 1' })).toBe(150);
    expect(extractMinWords(null, null)).toBe(150);
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
});
