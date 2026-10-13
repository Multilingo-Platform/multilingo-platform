import type { WritingHintsResponse, WritingHintsRequest } from '../../types/api.types';

export const VALID_REQUEST_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

export const validWritingHintsRequest: WritingHintsRequest = {
  partId: 30,
  questionId: 'writing-task-1',
  requestId: VALID_REQUEST_ID,
  learningLanguage: 'en',
  hintLanguage: 'vi',
};

export const validWritingHintsEn: WritingHintsResponse = {
  attemptId: 42,
  partId: 30,
  questionId: 'writing-task-1',
  requestId: VALID_REQUEST_ID,
  learningLanguage: 'en',
  hintLanguage: 'en',
  generatedAt: '2026-10-13T07:00:00.000Z',
  outline: [
    {
      title: 'Introduction',
      points: [
        'Paraphrase the given writing task statement',
        'State your primary thesis and outline main arguments',
      ],
    },
    {
      title: 'Body Paragraph 1 - Advantages',
      points: [
        'Present the first key benefit with supporting evidence',
        'Elaborate on real-world impact and significance',
      ],
    },
    {
      title: 'Body Paragraph 2 - Counterarguments',
      points: [
        'Examine potential drawbacks or opposing viewpoints',
        'Provide a balanced rebuttal confirming your stance',
      ],
    },
    {
      title: 'Conclusion',
      points: [
        'Summarize the core discussion points succinctly',
        'Deliver a closing recommendation or thought-provoking summary',
      ],
    },
  ],
  vocabulary: [
    {
      term: 'ubiquitous',
      definition: 'Present, appearing, or found everywhere',
      explanation: 'Use this adjective to describe pervasive modern phenomena',
      example: 'Smartphones have become ubiquitous in daily academic life.',
    },
    {
      term: 'substantiate',
      definition: 'Provide evidence to support or prove the truth of',
      explanation: 'Academic verb suitable for validating arguments in formal essays',
      example: 'The researcher offered extensive data to substantiate the claim.',
    },
    {
      term: 'detrimental',
      definition: 'Tending to cause harm or damage',
      explanation: 'Formal synonym for harmful, ideal for discussing adverse impacts',
      example: 'Excessive screentime can have a detrimental effect on concentration.',
    },
    {
      term: 'paramount',
      definition: 'More important than anything else; supreme',
      explanation: 'Emphasizes extreme importance in thesis statements',
      example: 'Digital literacy is of paramount importance for modern students.',
    },
    {
      term: 'ameliorate',
      definition: 'Make (something bad or unsatisfactory) better',
      explanation: 'High-level transition verb when proposing policy solutions',
      example: 'Targeted educational investments can ameliorate existing inequality.',
    },
  ],
  limitations: [
    'Visual context and chart graphics are not analyzed directly in text hints.',
  ],
};

export const validWritingHintsVi: WritingHintsResponse = {
  "attemptId": 42,
  "partId": 30,
  "questionId": "writing-task-1",
  "requestId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "learningLanguage": "en",
  "hintLanguage": "vi",
  "generatedAt": "2026-10-13T07:00:00.000Z",
  "outline": [
    {
      "title": "Mở bài",
      "points": [
        "Diễn đạt lại yêu cầu bằng lời của mình.",
        "Giới thiệu chủ đề năng lượng tái tạo."
      ]
    },
    {
      "title": "Thân bài",
      "points": [
        "So sánh xu hướng của các nguồn năng lượng.",
        "Chỉ dùng số liệu mà người học xác nhận từ biểu đồ."
      ]
    }
  ],
  "vocabulary": [
    {
      "term": "tăng trưởng",
      "definition": "Sự gia tăng theo thời gian.",
      "explanation": "Dùng khi mô tả xu hướng đi lên.",
      "example": "Sản lượng điện mặt trời có xu hướng tăng trưởng."
    },
    {
      "term": "ổn định",
      "definition": "Ít thay đổi trong một khoảng thời gian.",
      "explanation": "Dùng để diễn đạt một mức tương đối đều.",
      "example": "Sản lượng thủy điện duy trì ổn định."
    },
    {
      "term": "dao động",
      "definition": "Tăng giảm quanh một mức.",
      "explanation": "Dùng khi xu hướng không liên tục tăng hoặc giảm.",
      "example": "Sản lượng điện gió có thể dao động qua các năm."
    },
    {
      "term": "tỷ trọng",
      "definition": "Phần đóng góp trong tổng thể.",
      "explanation": "Dùng để so sánh vai trò của từng nguồn.",
      "example": "Cần đối chiếu tỷ trọng của các nguồn năng lượng."
    },
    {
      "term": "chênh lệch",
      "definition": "Khoảng cách giữa hai giá trị.",
      "explanation": "Dùng khi so sánh số liệu đã được xác nhận.",
      "example": "Người học cần xác định chênh lệch trên biểu đồ."
    }
  ],
  "limitations": [
    "Gợi ý chỉ dựa trên văn bản; người học cần kiểm tra số liệu trong biểu đồ."
  ]
};

export const validWritingHintsFr: WritingHintsResponse = {
  attemptId: 42,
  partId: 30,
  questionId: 'writing-task-1',
  requestId: VALID_REQUEST_ID,
  learningLanguage: 'fr',
  hintLanguage: 'fr',
  generatedAt: '2026-10-13T07:00:00.000Z',
  outline: [
    {
      title: 'Introduction',
      points: [
        'Présenter le sujet et reformuler la consigne',
        'Poser la problématique et annoncer le plan',
      ],
    },
    {
      title: 'Développement 1 - Arguments pour',
      points: [
        'Présenter le premier argument principal',
        'Illustrer avec un exemple pertinent',
      ],
    },
    {
      title: 'Développement 2 - Nuances et limites',
      points: [
        'Examiner les contre-arguments',
        'Défendre la thèse avec équilibre',
      ],
    },
    {
      title: 'Conclusion',
      points: [
        'Faire une synthèse des idées abordées',
        'Proposer une ouverture pertinente',
      ],
    },
  ],
  vocabulary: [
    {
      term: 'omniprésent',
      definition: 'Présent en tous lieux',
      explanation: 'Adjectif décrivant la présence universelle d’un phénomène',
      example: 'La technologie est devenue omniprésente dans l’éducation moderne.',
    },
    {
      term: 'étayer',
      definition: 'Appuyer, soutenir une argumentation avec des preuves',
      explanation: 'Verbe académique indispensable pour structurer un essai formel',
      example: 'Il convient d’étayer chaque affirmation par un exemple concret.',
    },
    {
      term: 'néfaste',
      definition: 'Qui a de mauvaises conséquences, nuisible',
      explanation: 'Synonyme formel pour qualifier des effets indésirables',
      example: 'La sédentarité produit des effets néfastes sur la santé.',
    },
    {
      term: 'primordial',
      definition: 'De première importance, essentiel',
      explanation: 'Qualifie l’élément fondamental de la thèse',
      example: 'La maîtrise de la langue écrite est primordiale pour réussir.',
    },
    {
      term: 'atténuer',
      definition: 'Rendre moins grave ou moins vif',
      explanation: 'Verbe pertinent pour formuler des propositions de remédiation',
      example: 'Des politiques ciblées peuvent atténuer les inégalités scolaires.',
    },
  ],
  limitations: [
    'Le contexte visuel et les diagrammes ne sont pas analysés directement.',
  ],
};

export function createWritingHintsEnvelope(data: unknown) {
  return {
    code: 200,
    message: 'Success',
    data,
  };
}
