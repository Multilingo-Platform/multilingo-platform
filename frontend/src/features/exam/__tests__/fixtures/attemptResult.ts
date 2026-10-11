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
