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
    // Lấy 3 phương án nhiễu từ các thẻ khác
    const otherCards = validCards.filter((c) => c.id !== card.id);
    const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
    const distractorMeanings = shuffledOthers.slice(0, 3).map((c) => c.customMeaning.trim());

    // Gom 4 phương án và xáo trộn
    const rawOptions = [
      { text: card.customMeaning.trim(), isCorrect: true },
      ...distractorMeanings.map((m) => ({ text: m, isCorrect: false })),
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
    };
  });
};
