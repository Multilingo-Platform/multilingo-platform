export interface DeckItem {
  id: string;
  name: string;
  category: 'IELTS' | 'TOEIC' | 'COMMUNICATION' | 'GENERAL';
  description: string;
  totalWords: number;
  dueToday: number;
  masteredPercent: number;
  updatedAt: string;
}

export interface CardItem {
  id: number;
  deckId: string;
  word: string;
  ipa: string;
  type: string;
  meaningVi: string;
  definitionEn: string;
  example: string;
  exampleTranslation: string;
  collocations: string[];
  synonyms: string[];
  antonyms: string[];
  status: 'NEW' | 'LEARNING' | 'MASTERED';
  nextReview: string;
  easeFactor: number;
  reviews: number;
}

export const INITIAL_DECKS: DeckItem[] = [
  { 
    id: 'cam-18', 
    name: 'IELTS Cambridge 18 - Academic', 
    category: 'IELTS', 
    description: 'Từ vựng học thuật trọng điểm trích xuất từ 4 bài thi Reading & Writing Cam 18.', 
    totalWords: 48, 
    dueToday: 8, 
    masteredPercent: 75,
    updatedAt: 'Hôm nay'
  },
  { 
    id: 'writing-task2', 
    name: 'IELTS Writing Task 2 Lexicon', 
    category: 'IELTS', 
    description: 'Cụm từ C1-C2 nâng cao chuyên sâu về Môi trường, Giáo dục, Xã hội và Công nghệ AI.', 
    totalWords: 35, 
    dueToday: 5, 
    masteredPercent: 82,
    updatedAt: 'Hôm qua'
  },
  { 
    id: 'toeic-600', 
    name: 'TOEIC 600 Essential Words', 
    category: 'TOEIC', 
    description: 'Từ vựng thương mại, hợp đồng kinh doanh, điều hành văn phòng và giao tiếp doanh nghiệp ETS.', 
    totalWords: 60, 
    dueToday: 12, 
    masteredPercent: 68,
    updatedAt: '3 ngày trước'
  },
  { 
    id: 'cam-17', 
    name: 'IELTS Cambridge 17 - Reading Lexicon', 
    category: 'IELTS', 
    description: 'Tổng hợp thuật ngữ khoa học tự nhiên, sinh thái học và khảo cổ lịch sử.', 
    totalWords: 24, 
    dueToday: 3, 
    masteredPercent: 90,
    updatedAt: '1 tuần trước'
  }
];

export const INITIAL_CARDS: CardItem[] = [
  { 
    id: 1, 
    deckId: 'cam-18', 
    word: 'Ubiquitous', 
    ipa: '/juːˈbɪk.wɪ.təs/', 
    type: 'adjective', 
    meaningVi: 'Có mặt ở khắp mọi nơi, phổ biến cùng một lúc', 
    definitionEn: 'Present, appearing, or found everywhere simultaneously.', 
    example: 'In the digital era, smartphones and wireless connectivity have become virtually ubiquitous across all age groups.', 
    exampleTranslation: 'Trong kỷ nguyên số, điện thoại thông minh và kết nối không dây gần như đã trở nên phổ biến ở mọi lứa tuổi.',
    collocations: ['ubiquitous presence', 'become ubiquitous', 'virtually ubiquitous'],
    synonyms: ['omnipresent', 'pervasive', 'universal'],
    antonyms: ['rare', 'scarce', 'isolated'],
    status: 'LEARNING', 
    nextReview: 'Hôm nay', 
    easeFactor: 2.5, 
    reviews: 4 
  },
  { 
    id: 2, 
    deckId: 'writing-task2', 
    word: 'Altruism', 
    ipa: '/ˈæl.tru.ɪ.zəm/', 
    type: 'noun', 
    meaningVi: 'Lòng vị tha, sự quan tâm vô tư tới quyền lợi người khác', 
    definitionEn: 'The belief in or practice of selfless concern for the well-being of others.', 
    example: 'Many adolescents engage in voluntary community service out of pure altruism rather than personal gain.', 
    exampleTranslation: 'Nhiều thanh thiếu niên tham gia công tác thiện nguyện cộng đồng vì lòng vị tha thuần khiết hơn là lợi ích cá nhân.',
    collocations: ['pure altruism', 'act of altruism', 'spirit of altruism'],
    synonyms: ['selflessness', 'benevolence', 'philanthropy'],
    antonyms: ['selfishness', 'egoism'],
    status: 'LEARNING', 
    nextReview: 'Hôm nay', 
    easeFactor: 2.3, 
    reviews: 3 
  },
  { 
    id: 3, 
    deckId: 'writing-task2', 
    word: 'Cohesion', 
    ipa: '/kəʊˈhiː.ʒən/', 
    type: 'noun', 
    meaningVi: 'Sự gắn kết, tính liên kết chặt chẽ', 
    definitionEn: 'The action or state of cohering with or forming a united whole.', 
    example: 'Community cultural activities foster greater social cohesion among residents of diverse ethnic backgrounds.', 
    exampleTranslation: 'Các hoạt động văn hóa cộng đồng thúc đẩy sự gắn kết xã hội lớn hơn giữa các cư dân có nền tảng sắc tộc đa dạng.',
    collocations: ['social cohesion', 'group cohesion', 'lack of cohesion'],
    synonyms: ['unity', 'solidarity', 'connectedness'],
    antonyms: ['division', 'fragmentation'],
    status: 'MASTERED', 
    nextReview: '7 ngày nữa', 
    easeFactor: 2.6, 
    reviews: 5 
  },
  { 
    id: 4, 
    deckId: 'cam-17', 
    word: 'Disparity', 
    ipa: '/dɪˈspær.ə.ti/', 
    type: 'noun', 
    meaningVi: 'Sự chênh lệch, sự bất bình đẳng rõ rệt', 
    definitionEn: 'A great difference or inequality between two or more things.', 
    example: 'The economic report revealed a widening disparity between urban and rural household incomes.', 
    exampleTranslation: 'Báo cáo kinh tế đã chỉ ra sự chênh lệch ngày càng nới rộng giữa thu nhập của hộ gia đình thành thị và nông thôn.',
    collocations: ['economic disparity', 'growing disparity', 'regional disparity'],
    synonyms: ['imbalance', 'inequality', 'disproportion'],
    antonyms: ['parity', 'equality', 'similarity'],
    status: 'LEARNING', 
    nextReview: 'Ngày mai', 
    easeFactor: 2.5, 
    reviews: 2 
  },
  { 
    id: 5, 
    deckId: 'writing-task2', 
    word: 'Formative', 
    ipa: '/ˈfɔː.mə.tɪv/', 
    type: 'adjective', 
    meaningVi: 'Mang tính định hình nhân cách và sự phát triển ban đầu', 
    definitionEn: 'Serving to form something, especially having a profound influence on a person’s development.', 
    example: 'Childhood experiences during the formative years have an enduring impact on adult psychological stability.', 
    exampleTranslation: 'Những trải nghiệm thời thơ ấu trong những năm tháng định hình có tác động lâu dài đến sự ổn định tâm lý của người trưởng thành.',
    collocations: ['formative years', 'formative period', 'formative influence'],
    synonyms: ['developmental', 'foundational', 'formative'],
    antonyms: ['destructive', 'terminal'],
    status: 'MASTERED', 
    nextReview: '5 ngày nữa', 
    easeFactor: 2.7, 
    reviews: 6 
  },
  { 
    id: 6, 
    deckId: 'cam-18', 
    word: 'Underprivileged', 
    ipa: '/ˌʌn.dəˈprɪv.əl.ɪdʒd/', 
    type: 'adjective', 
    meaningVi: 'Thiệt thòi, yếu thế, không có đủ điều kiện kinh tế xã hội', 
    definitionEn: 'Not enjoying the normal economic and social benefits that others have.', 
    example: 'Scholarship initiatives aim to expand higher education opportunities for underprivileged students from remote provinces.', 
    exampleTranslation: 'Các sáng kiến học bổng nhằm mở rộng cơ hội học đại học cho các sinh viên có hoàn cảnh khó khăn từ các tỉnh vùng sâu vùng xa.',
    collocations: ['underprivileged background', 'underprivileged children', 'underprivileged groups'],
    synonyms: ['disadvantaged', 'deprived', 'needy'],
    antonyms: ['privileged', 'affluent', 'wealthy'],
    status: 'NEW', 
    nextReview: 'Hôm nay', 
    easeFactor: 2.4, 
    reviews: 1 
  },
  { 
    id: 7, 
    deckId: 'cam-18', 
    word: 'Rehabilitation', 
    ipa: '/ˌriː.həˌbɪl.ɪˈteɪ.ʃən/', 
    type: 'noun', 
    meaningVi: 'Sự phục hồi chức năng, tái thiết môi trường hoặc tái hòa nhập', 
    definitionEn: 'The action of restoring something to its former condition or restoring someone to health.', 
    example: 'The wetland rehabilitation project successfully revived indigenous bird populations and improved local water quality.', 
    exampleTranslation: 'Dự án phục hồi vùng đất ngập nước đã hồi sinh thành công các quần thể chim bản địa và cải thiện chất lượng nước địa phương.',
    collocations: ['wetland rehabilitation', 'rehabilitation program', 'complete rehabilitation'],
    synonyms: ['restoration', 'recovery', 'reconstruction'],
    antonyms: ['degradation', 'deterioration'],
    status: 'LEARNING', 
    nextReview: 'Hôm nay', 
    easeFactor: 2.5, 
    reviews: 3 
  },
  { 
    id: 8, 
    deckId: 'writing-task2', 
    word: 'Egocentric', 
    ipa: '/ˌiː.ɡoʊˈsen.trɪk/', 
    type: 'adjective', 
    meaningVi: 'Ích kỷ, luôn coi mình là trung tâm vũ trụ', 
    definitionEn: 'Thinking only of oneself, without regard for the feelings or desires of others.', 
    example: 'Excessive reliance on social media validation can exacerbate egocentric tendencies among young users.', 
    exampleTranslation: 'Sự phụ thuộc quá mức vào sự công nhận trên mạng xã hội có thể làm trầm trọng thêm xu hướng vị kỷ của người dùng trẻ tuổi.',
    collocations: ['egocentric behavior', 'egocentric worldview', 'egocentric tendencies'],
    synonyms: ['self-centered', 'narcissistic', 'egoistic'],
    antonyms: ['altruistic', 'selfless', 'empathetic'],
    status: 'LEARNING', 
    nextReview: 'Hôm nay', 
    easeFactor: 2.1, 
    reviews: 2 
  }
];
