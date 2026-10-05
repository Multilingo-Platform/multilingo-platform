/**
 * Tiện ích phát âm từ vựng bản xứ sử dụng Web Speech Synthesis API phía Client (Trình duyệt).
 * Không cần lưu trữ file âm thanh audioUrl trong CSDL, hỗ trợ đa dạng ngôn ngữ: Anh, Hàn, Trung, Nhật, Việt,...
 */

const LANG_CODE_MAP: Record<string, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  ko: 'ko-KR',
  zh: 'zh-CN',
  ja: 'ja-JP',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
};

export const speakWord = (text: string, langCode: string = 'en'): void => {
  if (!('speechSynthesis' in window)) {
    console.warn('Trình duyệt hiện tại không hỗ trợ Web Speech Synthesis API');
    return;
  }

  if (!text || text.trim() === '') {
    return;
  }

  // Dừng phát âm hiện tại nếu đang đọc để tránh bị đè giọng
  window.speechSynthesis.cancel();

  const targetLang = LANG_CODE_MAP[langCode.toLowerCase()] || langCode;
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = targetLang;
  utterance.rate = 0.9; // Tốc độ vừa phải cho người học ngoại ngữ

  // Thử tìm giọng đọc phù hợp nhất với targetLang
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase() || v.lang.startsWith(langCode));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);
};
