/** TV3-13 wire review response fixture. */
export function attemptReviewFixture(attemptId = 42, partId = 10) {
  return {
    attemptId,
    partId,
    partTitle: 'Reading Passage 1',
    skill: 'READING',
    partStats: {
      score: 1.0,
      correctCount: 1,
      incorrectCount: 1,
      unansweredCount: 0,
      totalQuestions: 2,
      accuracy: 50.0,
      isCorrectFlags: {
        q1: true,
        q2: false,
      },
    },
    userAnswers: {
      q1: 'A',
      q2: 'C',
    },
    questions: [
      {
        questionId: 'q1',
        type: 'SINGLE_CHOICE',
        questionText: 'What does AI offer?',
        prompt: 'Choose one answer',
        label: 'Question 1',
        explanation: 'AI provides personalized learning pathways according to the text.',
        correctAnswer: 'A',
        userAnswer: 'A',
        verdict: 'CORRECT',
        score: 1.0,
        options: [
          { id: 'A', text: 'Option A description', isCorrect: true },
          { id: 'B', text: 'Option B description', isCorrect: false },
          { id: 'C', text: 'Option C description', isCorrect: false },
        ],
      },
      {
        questionId: 'q2',
        type: 'SINGLE_CHOICE',
        questionText: 'Is it adaptive?',
        prompt: 'Choose one answer',
        label: 'Question 2',
        explanation: 'The second paragraph explains adaptive learning.',
        correctAnswer: 'B',
        userAnswer: 'C',
        verdict: 'WRONG',
        score: 0.0,
        options: [
          { id: 'A', text: 'Option A description', isCorrect: false },
          { id: 'B', text: 'Option B description', isCorrect: true },
        ],
      },
    ],
    questionGroups: [
      {
        groupId: 'g1',
        instruction: 'Choose the correct option for questions 1-2',
        contentHtml: '<p>Passage content</p>',
        questions: [
          {
            questionId: 'q1',
            type: 'SINGLE_CHOICE',
            questionText: 'What does AI offer?',
            verdict: 'CORRECT',
          },
          {
            questionId: 'q2',
            type: 'SINGLE_CHOICE',
            questionText: 'Is it adaptive?',
            verdict: 'WRONG',
          },
        ],
      },
    ],
    examData: {
      title: 'Reading Passage 1',
    },
    partResult: {
      q1: { verdict: 'CORRECT', score: 1.0 },
      q2: { verdict: 'WRONG', score: 0.0 },
    },
    isCorrectFlags: {
      q1: true,
      q2: false,
    },
  };
}

export function reviewEnvelope(data: unknown = attemptReviewFixture()) {
  return {
    success: true,
    code: 1000,
    message: 'Success',
    data,
    timestamp: '2026-10-11T01:01:02Z',
  };
}
