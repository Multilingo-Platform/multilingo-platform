export const validAiDoneTextOnlyWire = {
  attemptId: 101,
  partId: 202,
  attemptStatus: 'COMPLETED',
  partStatus: 'DONE',
  tasks: [
    {
      questionId: 'task_1',
      label: 'Task 1: Academic Essay',
      status: 'DONE',
      wordCount: 15,
      language: 'en',
      source: 'AI',
      scoreUnit: 'BAND_0_9',
      overall: 7.0,
      maxScore: 9.0,
      criteria: [
        { code: 'TR', score: 7.0, feedback: 'Strong task response addressing all parts.' },
        { code: 'CC', score: 7.0, feedback: 'Clear progression throughout with appropriate cohesive devices.' },
        { code: 'LR', score: 7.0, feedback: 'Sufficient range of vocabulary with flexibility.' },
        { code: 'GRA', score: 7.0, feedback: 'Good mix of simple and complex sentence structures.' },
      ],
      originalText: 'Environmental protection requires international agreements and active cooperation worldwide. Future generations depend on these decisions.',
      overallFeedback: 'A well-written response with clear argumentation and solid structure.',
      correctedEssay: 'Environmental protection requires international agreements and active global cooperation worldwide. Future generations depend on these decisions.',
      corrections: [
        {
          start: 70,
          end: 70,
          replacement: 'global ',
          explanation: 'Added "global" for stronger academic collocation.',
        },
      ],
      diff: [
        { type: 'EQUAL', text: 'Environmental protection requires international agreements and active ' },
        { type: 'INSERT', text: 'global ' },
        { type: 'EQUAL', text: 'cooperation worldwide. Future generations depend on these decisions.' },
      ],
      displayMessage: 'Chấm điểm hoàn tất.',
      hasVisualContext: false,
    },
  ],
};

export const validAiDoneVisualWire = {
  attemptId: 101,
  partId: 202,
  attemptStatus: 'COMPLETED',
  partStatus: 'DONE',
  tasks: [
    {
      questionId: 'task_visual',
      label: 'Task 1: Report Chart',
      status: 'DONE',
      wordCount: 15,
      language: 'en',
      source: 'AI',
      scoreUnit: 'BAND_0_9',
      overall: 7.5,
      maxScore: 9.0,
      criteria: [
        { code: 'TR', score: 7.5, feedback: 'Detailed description of key chart trends.' },
        { code: 'CC', score: 7.0, feedback: 'Logically sequenced comparison paragraphs.' },
        { code: 'LR', score: 8.0, feedback: 'Precise lexical resource describing statistical shifts.' },
        { code: 'GRA', score: 7.5, feedback: 'Frequent error-free structures with good variety.' },
      ],
      originalText: 'The bar chart illustrates the dramatic growth of renewable energy sectors between 2010 and 2020.',
      overallFeedback: 'Thorough visual reporting capturing principal peaks and anomalies accurately.',
      correctedEssay: 'The bar chart illustrates the remarkable growth of renewable energy sectors between 2010 and 2020.',
      corrections: [
        {
          start: 30,
          end: 38,
          replacement: 'remarkable',
          explanation: 'Replaced "dramatic" with "remarkable" for accurate objective nuance.',
        },
      ],
      diff: [
        { type: 'EQUAL', text: 'The bar chart illustrates the ' },
        { type: 'DELETE', text: 'dramatic' },
        { type: 'INSERT', text: 'remarkable' },
        { type: 'EQUAL', text: ' growth of renewable energy sectors between 2010 and 2020.' },
      ],
      displayMessage: 'Chấm điểm hoàn tất.',
      hasVisualContext: true,
      visualObservations: 'Biểu đồ cột thể hiện mức tiêu thụ năng lượng sạch tăng gấp đôi trong thập kỷ vừa qua.',
    },
  ],
};

export const validTooShortSystemWire = {
  attemptId: 101,
  partId: 202,
  attemptStatus: 'COMPLETED',
  partStatus: 'DONE',
  tasks: [
    {
      questionId: 'task_short',
      label: 'Task 1: Short Essay',
      status: 'DONE',
      wordCount: 6,
      language: 'en',
      source: 'SYSTEM',
      scoreUnit: 'BAND_0_9',
      overall: 0.0,
      maxScore: 9.0,
      criteria: [
        { code: 'TR', score: 0.0, feedback: 'Bài viết quá ngắn (≤ 10 từ), không đủ nội dung để đánh giá Task Response.' },
        { code: 'CC', score: 0.0, feedback: 'Bài viết quá ngắn (≤ 10 từ), không thể đánh giá tính mạch lạc và liên kết.' },
        { code: 'LR', score: 0.0, feedback: 'Bài viết quá ngắn (≤ 10 từ), vốn từ vựng chưa đủ để xếp thang điểm.' },
        { code: 'GRA', score: 0.0, feedback: 'Bài viết quá ngắn (≤ 10 từ), chưa đủ cấu trúc câu để đánh giá ngữ pháp.' },
      ],
      originalText: 'Too short essay text submitted.',
      overallFeedback: 'Bài viết của bạn quá ngắn (không quá 10 từ), không đủ dung lượng tối thiểu để tiến hành chấm điểm bài luận.',
      correctedEssay: 'Too short essay text submitted.',
      corrections: [],
      diff: [
        { type: 'EQUAL', text: 'Too short essay text submitted.' },
      ],
      reasonCode: 'TOO_SHORT',
      displayMessage: 'Bài viết của bạn quá ngắn (không quá 10 từ), không đủ dung lượng tối thiểu để tiến hành chấm điểm bài luận.',
      hasVisualContext: false,
    },
  ],
};

export const validPendingWire = {
  attemptId: 101,
  partId: 202,
  attemptStatus: 'AI_GRADING',
  partStatus: 'PENDING',
  tasks: [
    {
      questionId: 'task_pending',
      label: 'Task 1: In Progress',
      status: 'PENDING',
      wordCount: 180,
      language: 'en',
      source: 'AI',
      scoreUnit: 'BAND_0_9',
      originalText: 'Comprehensive research on sustainable architectural practices.',
      displayMessage: 'Đang chấm điểm bài viết...',
      hasVisualContext: false,
    },
  ],
};

export const validQueuedWire = {
  attemptId: 101,
  partId: 202,
  attemptStatus: 'AI_GRADING_QUEUED',
  partStatus: 'QUEUED',
  tasks: [
    {
      questionId: 'task_queued',
      label: 'Task 1: Queued',
      status: 'QUEUED',
      wordCount: 140,
      language: 'en',
      source: 'AI',
      scoreUnit: 'BAND_0_9',
      originalText: 'Waiting for available grading quota.',
      reasonCode: 'PROVIDER_DISABLED',
      displayMessage: 'Hệ thống đang chờ lượt chấm tự động.',
      hasVisualContext: false,
    },
  ],
};

export const validFailedWire = {
  attemptId: 101,
  partId: 202,
  attemptStatus: 'GRADING_FAILED',
  partStatus: 'FAILED',
  tasks: [
    {
      questionId: 'task_failed',
      label: 'Task 1: Failed',
      status: 'FAILED',
      wordCount: 120,
      language: 'en',
      source: 'AI',
      scoreUnit: 'BAND_0_9',
      originalText: 'Content triggered a terminal error during analysis.',
      reasonCode: 'BLOCKED',
      displayMessage: 'Không thể chấm bài viết do lỗi hệ thống.',
      hasVisualContext: false,
    },
  ],
};

export const validUnavailableWire = {
  attemptId: 101,
  partId: 202,
  attemptStatus: 'COMPLETED',
  partStatus: 'UNAVAILABLE',
  tasks: [
    {
      questionId: 'task_unavail',
      label: 'Task 1: Unavailable',
      status: 'UNAVAILABLE',
      wordCount: 95,
      language: 'vi',
      source: 'SYSTEM',
      scoreUnit: 'BAND_0_9',
      originalText: 'Bài thi viết bằng tiếng Việt không nằm trong phạm vi chấm điểm tiếng Anh v1.',
      reasonCode: 'UNSUPPORTED_LANGUAGE',
      displayMessage: 'Ngôn ngữ bài thi không được hỗ trợ chấm tự động.',
      hasVisualContext: false,
    },
  ],
};

export const validSurrogateAndCrlfWire = {
  attemptId: 101,
  partId: 202,
  attemptStatus: 'COMPLETED',
  partStatus: 'DONE',
  tasks: [
    {
      questionId: 'task_surrogate',
      label: 'Task 2: Astral Symbols & CRLF',
      status: 'DONE',
      wordCount: 80,
      language: 'en',
      source: 'AI',
      scoreUnit: 'BAND_0_9',
      overall: 8.0,
      maxScore: 9.0,
      criteria: [
        { code: 'TR', score: 8.0, feedback: 'Insightful exploration of planetary ecosystems 🌍.' },
        { code: 'CC', score: 8.0, feedback: 'Fluid narrative linking complex concepts.\r\nExcellent coherence.' },
        { code: 'LR', score: 8.0, feedback: 'Precise scientific terms including cafe\u0301 culture nuances.' },
        { code: 'GRA', score: 8.0, feedback: 'Sophisticated compound structures used flawlessly.' },
      ],
      // originalText contains emoji 🌍 (high: 0xD83C, low: 0xDF0E, length 2), cafe\u0301 (combining mark), CRLF \r\n
      originalText: 'Space exploration protects our planet 🌍.\r\nScientists work hard in cafe\u0301s worldwide.',
      overallFeedback: 'Remarkable essay demonstrating outstanding mastery.\r\nBravo!',
      // Replace "Scientists work hard" with "Dedicated scientists research tirelessly"
      correctedEssay: 'Space exploration protects our planet 🌍.\r\nDedicated scientists research tirelessly in cafe\u0301s worldwide.',
      corrections: [
        {
          start: 43,
          end: 63,
          replacement: 'Dedicated scientists research tirelessly',
          explanation: 'Elevated academic register and precise verb choice.',
        },
      ],
      diff: [
        { type: 'EQUAL', text: 'Space exploration protects our planet 🌍.\r\n' },
        { type: 'DELETE', text: 'Scientists work hard' },
        { type: 'INSERT', text: 'Dedicated scientists research tirelessly' },
        { type: 'EQUAL', text: ' in cafe\u0301s worldwide.' },
      ],
      displayMessage: 'Chấm điểm hoàn tất.',
      hasVisualContext: false,
    },
  ],
};
