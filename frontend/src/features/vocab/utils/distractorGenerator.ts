import type { Flashcard, QuizOption, QuizQuestion } from '../types/vocab.types';

/**
 * Thuật toán sinh câu hỏi trắc nghiệm kèm các phương án nhiễu ngẫu nhiên.
 * Đảm bảo 1 đáp án đúng + 3 phương án nhiễu độc nhất (A, B, C, D).
 */
export const generateQuizQuestions = (cards: Flashcard[]): QuizQuestion[] => {
  const validCards = cards.filter((c) => Boolean(c.customWord && c.customMeaning?.trim()));
  if (validCards.length < 4) {
    return [];
  }

  // Xáo trộn thứ tự câu hỏi
  const shuffledCards = [...validCards].sort(() => Math.random() - 0.5);

  return shuffledCards.map((card, index) => {
    // 1. Lọc các thẻ khác có nghĩa khác biệt với thẻ hiện tại (tránh trùng nghĩa)
    const currentMeaning = card.customMeaning.trim();
    const otherCards = validCards.filter(
      (c) => c.id !== card.id && c.customMeaning.trim().toLowerCase() !== currentMeaning.toLowerCase()
    );

    // 2. Thuật toán phân tầng POS: Ưu tiên cùng từ loại (pos), sau đó đến các từ loại khác
    const samePosCards = otherCards.filter((c) => Boolean(c.pos && card.pos && c.pos === card.pos));
    const diffPosCards = otherCards.filter((c) => !c.pos || !card.pos || c.pos !== card.pos);

    const candidates = [
      ...samePosCards.sort(() => Math.random() - 0.5),
      ...diffPosCards.sort(() => Math.random() - 0.5),
    ];

    // Gom tối đa 3 phương án nhiễu có nghĩa độc nhất
    const uniqueDistractors: string[] = [];
    for (const c of candidates) {
      const text = c.customMeaning.trim();
      if (!uniqueDistractors.includes(text)) {
        uniqueDistractors.push(text);
        if (uniqueDistractors.length === 3) break;
      }
    }

    // 3. Gom 4 phương án và xáo trộn ngẫu nhiên
    const rawOptions = [
      { text: currentMeaning, isCorrect: true },
      ...uniqueDistractors.map((m) => ({ text: m, isCorrect: false })),
    ].sort(() => Math.random() - 0.5);

    const keys = ['A', 'B', 'C', 'D'];
    const options: QuizOption[] = rawOptions.map((opt, i) => ({
      key: keys[i],
      text: opt.text,
      isCorrect: opt.isCorrect,
    }));

    const explanation = `'${card.customWord}' có nghĩa là: "${card.customMeaning}".${
      card.exampleSentence ? ` Ví dụ: "${card.exampleSentence}"` : ''
    }`;

    return {
      questionNumber: index + 1,
      cardId: card.id,
      targetWord: card.customWord,
      phonetic: card.phonetic,
      pos: card.pos,
      sentence: card.exampleSentence,
      options,
      explanation,
      card,
    };
  });
};
