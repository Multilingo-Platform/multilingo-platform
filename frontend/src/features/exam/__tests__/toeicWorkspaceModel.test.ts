import { describe, it, expect } from 'vitest';
import {
  buildToeicWorkspaceModel,
  isToeicExamSnapshot,
  parseCanonicalQuestionNumber,
  resolveQuestionNumber,
} from '../utils/toeicWorkspaceModel';

const PART_RANGE: Record<number, [number, number]> = {
  1: [1, 6],
  2: [7, 31],
  3: [32, 70],
  4: [71, 100],
  5: [101, 130],
  6: [131, 146],
  7: [147, 200],
};

function canonicalId(n: number): string {
  return `q_${String(n).padStart(3, '0')}`;
}

function makeQuestion(n: number, extra: Record<string, unknown> = {}) {
  return {
    question_id: canonicalId(n),
    type: 'SINGLE_CHOICE',
    question_text: '',
    options: [],
    media: null,
    ...extra,
  };
}

function makePart(
  partNumber: number,
  partId: number,
  questions: unknown[],
  groupKey: 'questionGroups' | 'question_groups' | 'content' = 'questionGroups'
) {
  const groups = [{ group_id: `group-${partNumber}`, questions }];
  const base: Record<string, unknown> = { id: partId, part_number: partNumber, title: `Part ${partNumber}` };
  if (groupKey === 'content') {
    base.content = { part_title: `Part ${partNumber}`, question_groups: groups };
  } else {
    base[groupKey] = groups;
  }
  return base;
}

function toeicSnapshot(parts: unknown[]) {
  return {
    exam_id: 1,
    code: 'TOEIC-ETS-2024-T1-V2',
    type: 'TOEIC',
    title: 'ETS 2024 Test 1',
    sections: [
      { id: 11, skill_type: 'LISTENING', title: 'Listening', duration_minutes: 45, parts },
    ],
  };
}

describe('parseCanonicalQuestionNumber', () => {
  it('accepts canonical q_ ids with the TOEIC 1..200 and Part range rules', () => {
    expect(parseCanonicalQuestionNumber('q_001')).toBe(1);
    expect(parseCanonicalQuestionNumber('q_200')).toBe(200);
    expect(parseCanonicalQuestionNumber('q_0007')).toBe(7);
    expect(parseCanonicalQuestionNumber('q_7')).toBe(7);
    expect(parseCanonicalQuestionNumber('q_0')).toBeNull();
    expect(parseCanonicalQuestionNumber('q_201')).toBeNull();
    expect(parseCanonicalQuestionNumber('Q_001')).toBeNull();
    expect(parseCanonicalQuestionNumber('custom_1')).toBeNull();
    expect(parseCanonicalQuestionNumber('')).toBeNull();
    expect(parseCanonicalQuestionNumber(null)).toBeNull();
  });

  it('enforces the Part range when the Part number is known', () => {
    expect(parseCanonicalQuestionNumber('q_001', 2)).toBeNull();
    expect(parseCanonicalQuestionNumber('q_007', 2)).toBe(7);
    expect(parseCanonicalQuestionNumber('q_101', 5)).toBe(101);
    expect(parseCanonicalQuestionNumber('q_100', 5)).toBeNull();
  });
});

describe('resolveQuestionNumber', () => {
  it('reports the number source and never uses a DB id', () => {
    expect(resolveQuestionNumber({ question_number: 5 }, 1)).toEqual({ number: 5, source: 'explicit' });
    expect(resolveQuestionNumber({ questionNumber: 5 }, 1)).toEqual({ number: 5, source: 'explicit' });
    expect(resolveQuestionNumber({ question_id: 'q_005' }, 1)).toEqual({ number: 5, source: 'canonical_id' });
    expect(resolveQuestionNumber({ id: 5, question_id: 'q_005' }, 1)).toEqual({ number: 5, source: 'canonical_id' });
    expect(resolveQuestionNumber({ id: 5 }, 1)).toEqual({ number: null, source: null });
    expect(resolveQuestionNumber({ question_id: 'custom_1' }, 5)).toEqual({ number: null, source: null });
  });

  it('ignores an explicit number that is not canonical for the Part', () => {
    expect(resolveQuestionNumber({ question_id: 'q_003', question_number: 99 }, 1)).toEqual({
      number: 3,
      source: 'canonical_id',
    });
    expect(resolveQuestionNumber({ question_id: 'q_003', questionNumber: '99' }, 1)).toEqual({
      number: 3,
      source: 'canonical_id',
    });
  });
});

describe('buildToeicWorkspaceModel', () => {
  it('assigns stable whole-exam numbers 1..200 across all seven Parts and their groups', () => {
    const parts = [1, 2, 3, 4, 5, 6, 7].map((partNumber, index) => {
      const [min, max] = PART_RANGE[partNumber];
      const questions: unknown[] = [];
      for (let n = min; n <= max; n += 1) questions.push(makeQuestion(n));
      return makePart(partNumber, 101 + index, questions);
    });

    const model = buildToeicWorkspaceModel(toeicSnapshot(parts));

    expect(model.valid).toBe(true);
    expect(model.issues).toEqual([]);
    expect(model.parts.map(p => p.partNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(model.questions.map(q => q.questionNumber)).toEqual(
      Array.from({ length: 200 }, (_, i) => i + 1)
    );
    expect(new Set(model.questions.map(q => q.questionId)).size).toBe(200);
    expect(model.parts[0].questions[0].questionNumber).toBe(1);
    expect(model.parts[6].questions[model.parts[6].questions.length - 1].questionNumber).toBe(200);
    // Server Part/group order is preserved.
    expect(model.questions[0].questionId).toBe('q_001');
    expect(model.questions[199].questionId).toBe('q_200');
  });

  it('prefers the explicit question number when it is canonical for the Part', () => {
    const model = buildToeicWorkspaceModel(
      toeicSnapshot([
        makePart(2, 102, [
          { question_id: 'q_009', questionNumber: 12, type: 'SINGLE_CHOICE', question_text: '', options: [], media: null },
        ]),
      ])
    );

    expect(model.questions[0].questionNumber).toBe(12);
    expect(model.questions[0].numberSource).toBe('explicit');
  });

  it('never derives a number from a DB id, an array index, or a non-canonical id', () => {
    const model = buildToeicWorkspaceModel(
      toeicSnapshot([
        makePart(1, 101, [
          { question_id: 'q_201', type: 'SINGLE_CHOICE', question_text: '', options: [], media: null },
          { question_id: 'custom_2', id: 98765, type: 'SINGLE_CHOICE', question_text: '', options: [], media: null },
        ]),
      ])
    );

    expect(model.questions.map(q => q.questionNumber)).toEqual([null, null]);
    expect(model.questions.map(q => q.questionId)).toEqual(['q_201', 'custom_2']);
    expect(model.issues.map(i => i.code)).toEqual(['missing_question_number', 'missing_question_number']);
    expect(model.valid).toBe(false);
  });

  it('skips questions without a usable identity and records the issue', () => {
    const model = buildToeicWorkspaceModel(
      toeicSnapshot([
        makePart(1, 101, [
          makeQuestion(1),
          { id: 555, type: 'SINGLE_CHOICE', question_text: '', options: [], media: null },
        ]),
      ])
    );

    expect(model.questions.map(q => q.questionId)).toEqual(['q_001']);
    expect(model.issues.map(i => i.code)).toContain('missing_question_id');
  });

  it('keeps only the first occurrence of a duplicate question id', () => {
    const model = buildToeicWorkspaceModel(
      toeicSnapshot([makePart(1, 101, [makeQuestion(1)]), makePart(2, 102, [makeQuestion(1)])])
    );

    expect(model.questions).toHaveLength(1);
    expect(model.questions[0].partNumber).toBe(1);
    expect(model.issues.filter(i => i.code === 'duplicate_question_id')).toHaveLength(1);
    expect(model.valid).toBe(false);
  });

  it('reads nested groups from camelCase, snake_case, content, or a flat questions list', () => {
    const camel = buildToeicWorkspaceModel(toeicSnapshot([makePart(1, 101, [makeQuestion(1)], 'questionGroups')]));
    const snake = buildToeicWorkspaceModel(toeicSnapshot([makePart(1, 101, [makeQuestion(1)], 'question_groups')]));
    const content = buildToeicWorkspaceModel(toeicSnapshot([makePart(1, 101, [makeQuestion(1)], 'content')]));
    const flat = buildToeicWorkspaceModel(
      toeicSnapshot([{ id: 101, part_number: 1, questions: [makeQuestion(1)] }])
    );

    for (const model of [camel, snake, content, flat]) {
      expect(model.questions).toHaveLength(1);
      expect(model.questions[0].questionNumber).toBe(1);
      expect(model.parts[0].groups).toHaveLength(1);
      expect(model.parts[0].groups[0].questions).toHaveLength(1);
    }
    expect(camel.parts[0].groups[0].groupId).toBe('group-1');
    expect(flat.parts[0].groups[0].groupId).toBeNull();
  });

  it('fails closed on a Part without an identity', () => {
    const model = buildToeicWorkspaceModel(
      toeicSnapshot([{ part_number: 1, title: 'Part 1', questions: [makeQuestion(1)] }])
    );

    expect(model.parts).toHaveLength(0);
    expect(model.issues.map(i => i.code)).toContain('missing_part_id');
    expect(model.valid).toBe(false);
  });

  it('falls back to the exam-wide Part order and never uses the section ordinal', () => {
    const model = buildToeicWorkspaceModel({
      code: 'TOEIC-ETS-2024-T1-V2',
      type: 'TOEIC',
      sections: [
        { id: 11, skill_type: 'LISTENING', parts: [{ id: 1, questions: [] }, { id: 2, questions: [] }] },
        { id: 12, skill_type: 'READING', parts: [{ id: 3, questions: [] }, { id: 4, questions: [] }] },
      ],
    });

    expect(model.parts.map(p => p.partNumber)).toEqual([1, 2, 3, 4]);
    expect(model.parts[2].sectionId).toBe(12);
  });

  it('uses an authoritative part_number or partNumber when declared', () => {
    const model = buildToeicWorkspaceModel(
      toeicSnapshot([
        { id: 201, part_number: 5, questions: [] },
        { id: 202, title: 'Part 6', questions: [] },
        { id: 203, partNumber: 7, questions: [] },
      ])
    );

    expect(model.parts.map(p => [p.partId, p.partNumber])).toEqual([
      [201, 5],
      [202, 6],
      [203, 7],
    ]);
  });

  it('records an invalid explicit part number and falls back safely', () => {
    const model = buildToeicWorkspaceModel(toeicSnapshot([{ id: 1, part_number: 9, questions: [] }]));

    expect(model.issues.map(i => i.code)).toContain('invalid_part_number');
    expect(model.parts[0].partNumber).toBe(1);
  });

  it('fails closed when the snapshot has no sections', () => {
    const model = buildToeicWorkspaceModel({ code: 'TOEIC-X' });

    expect(model.parts).toEqual([]);
    expect(model.questions).toEqual([]);
    expect(model.issues.map(i => i.code)).toEqual(['invalid_snapshot']);
    expect(model.valid).toBe(false);
  });
});

describe('isToeicExamSnapshot', () => {
  it('detects TOEIC from exam code/type aliases only', () => {
    expect(isToeicExamSnapshot({ code: 'TOEIC-ETS-2024-T1-V2' })).toBe(true);
    expect(isToeicExamSnapshot({ exam_code: 'toeic-official' })).toBe(true);
    expect(isToeicExamSnapshot({ examCode: 'TOEIC-X' })).toBe(true);
    expect(isToeicExamSnapshot({ type: 'TOEIC' })).toBe(true);
    expect(isToeicExamSnapshot({ exam_type: 'TOEIC' })).toBe(true);
    expect(isToeicExamSnapshot({ examType: 'TOEIC' })).toBe(true);
    expect(isToeicExamSnapshot({ code: 'IELTS-ACADEMIC-20-T1' })).toBe(false);
    expect(isToeicExamSnapshot({ title: 'TOEIC practice' })).toBe(false);
    expect(isToeicExamSnapshot(null)).toBe(false);
  });
});
