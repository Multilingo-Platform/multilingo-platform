/** TV3-11 wire response, including legacy fields deliberately unused by the UI. */
export function attemptResultFixture(attemptId = 42) {
  const stats = { rawScore: 5.5, correct: 1, incorrect: 1, unanswered: 1, total: 3, accuracy: 33.33 };
  return {
    attemptId, status: 'AI_GRADING', testScope: 'FULL_EXAM', testMode: 'MOCK_TEST',
    startTime: '2026-10-11T00:00:00Z', endTime: '2026-10-11T01:01:01Z',
    timeSpentSeconds: 3661, overallScore: 5.5, summaryAvailable: true,
    resultSummary: {
      partResults: { '10': { q1: { questionId: 'q1', verdict: 'CORRECT', score: 5 } } },
      totalScore: 5.5, correctCount: 1, totalObjectiveCount: 3, sectionScores: { READING: 5.5 },
      objective: {
        ...stats, scoreUnit: 'RAW_OBJECTIVE',
        bySkill: [{ ...stats, skill: 'READING' }],
        byPart: [{ ...stats, partId: 10, label: 'Phần đọc tiếng Việt', skill: 'READING' }],
      },
      writing: {
        status: 'PENDING', tasks: [{
          partId: 20, questionId: 'essay', label: 'Bài viết tiếng Việt', status: 'PENDING',
          wordCount: 123, score: null, maxScore: null,
        }],
      },
    },
  };
}

export function resultEnvelope(data: unknown = attemptResultFixture()) {
  return { success: true, code: 1000, message: 'Success', data, timestamp: '2026-10-11T01:01:02Z' };
}

/** Multi-part result fixture with ordered reviewParts navigation metadata. */
export function multiPartAttemptResultFixture(attemptId = 42) {
  const base = attemptResultFixture(attemptId);
  return {
    ...base,
    reviewParts: [
      { id: 10, label: 'Phần đọc tiếng Việt' },
      { id: 15, label: 'Phần nghe tiếng Việt' },
      { id: 20, label: 'Bài viết tiếng Việt' },
    ],
  };
}

/** Writing-only result fixture with Writing task and reviewParts. */
export function writingOnlyAttemptResultFixture(attemptId = 42) {
  return {
    attemptId,
    status: 'AI_GRADING',
    testScope: 'SINGLE_SKILL',
    testMode: 'PRACTICE',
    startTime: '2026-10-11T00:00:00Z',
    endTime: '2026-10-11T00:40:00Z',
    timeSpentSeconds: 2400,
    overallScore: null,
    summaryAvailable: true,
    resultSummary: {
      partResults: {},
      totalScore: 0,
      correctCount: 0,
      totalObjectiveCount: 0,
      sectionScores: {},
      objective: {
        rawScore: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        total: 0,
        accuracy: 0,
        scoreUnit: 'RAW_OBJECTIVE',
        bySkill: [],
        byPart: [],
      },
      writing: {
        status: 'PENDING',
        tasks: [
          {
            partId: 20,
            questionId: 'essay-1',
            label: 'Task 1: Email writing',
            status: 'PENDING',
            wordCount: 154,
            score: null,
            maxScore: null,
          },
        ],
      },
    },
    reviewParts: [
      { id: 20, label: 'Phần viết' },
    ],
  };
}

/** Result fixture where summary is unavailable, but reviewParts may be present or absent. */
export function summaryUnavailableAttemptResultFixture(attemptId = 42, reviewParts?: unknown[]) {
  return {
    attemptId,
    status: 'COMPLETED',
    testScope: 'FULL_EXAM',
    testMode: 'MOCK_TEST',
    startTime: '2026-10-11T00:00:00Z',
    endTime: '2026-10-11T01:00:00Z',
    timeSpentSeconds: 3600,
    overallScore: 50,
    summaryAvailable: false,
    resultSummary: null,
    ...(reviewParts !== undefined ? { reviewParts } : {}),
  };
}
