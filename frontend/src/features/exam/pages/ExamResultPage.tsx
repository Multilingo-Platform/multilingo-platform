import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, X, Minus, Target, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface QuestionDetail {
  id: number;
  category: string;
  passageTitle: string;
  passageText: string;
  promptText: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  citation: string;
  explanation: string;
}

const SAMPLE_PASSAGE = `The family of mammals called bovids belongs to the Artiodactyl class, which also includes giraffes. Bovids are a highly diverse group consisting of 137 species, some of which are man's most important domestic animals.

Bovids are well represented in most parts of Eurasia and Southeast Asian islands, but they are by far the most numerous and diverse in the latter. Some species of bovid are solitary, but others live in large groups with complex social structures. Although bovids have adapted to a wide range of habitats, from arctic tundra to deep tropical forest, the majority of species favour open grassland, scrub or desert. This diversity of habitat is also matched by great diversity in size and form: at one extreme is the royal antelope of West Africa, which stands a mere 25 cm at the shoulder; at the other, the massively built bison of North America and Europe, growing to a shoulder height of 2.2m.`;

const QUESTIONS_DATA: QuestionDetail[] = [
  {
    id: 1,
    category: '[Reading] Multiple Choice',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'Bovids are most numerous and diverse in which of the following regions?',
    userAnswer: 'B',
    correctAnswer: 'A',
    isCorrect: false,
    citation: 'Bovids are well represented in most parts of Eurasia and Southeast Asian islands, but they are by far the most numerous and diverse in the latter.',
    explanation: 'Từ "the latter" đề cập đến "Southeast Asian islands", do đó đáp án chính xác là A.'
  },
  {
    id: 2,
    category: '[Reading] Multiple Choice',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'Which class of animals do bovids belong to?',
    userAnswer: 'Artiodactyl',
    correctAnswer: 'Artiodactyl',
    isCorrect: true,
    citation: 'The family of mammals called bovids belongs to the Artiodactyl class, which also includes giraffes.',
    explanation: 'Đoạn văn nêu rõ bovids thuộc lớp Artiodactyl.'
  },
  {
    id: 3,
    category: '[Reading] Multiple Choice',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'What is the shoulder height of the royal antelope?',
    userAnswer: '25 cm',
    correctAnswer: '25 cm',
    isCorrect: true,
    citation: 'at one extreme is the royal antelope of West Africa, which stands a mere 25 cm at the shoulder;',
    explanation: 'Nguyên văn chỉ ra linh dương hoàng gia cao đúng 25 cm ở vai.'
  },
  {
    id: 4,
    category: '[Reading] Matching Features',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'can endure very harsh environments',
    userAnswer: 'a',
    correctAnswer: 'C',
    isCorrect: false,
    citation: 'The sub-family Caprinae includes the sheep and the goat, together with various relatives such as the goral and the tahr. Most are woolly or have long hair. Several species, such as wild goats, chamois and mountain sheep, have adapted to high altitudes and extreme cold.',
    explanation: 'Phân họ Caprinae có khả năng thích nghi cao với điều kiện khắc nghiệt ở vùng núi cao lạnh giá, tương ứng với lựa chọn C.'
  },
  {
    id: 5,
    category: '[Reading] Matching Features',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'have adapted to open grassland habitats',
    userAnswer: 'B',
    correctAnswer: 'D',
    isCorrect: false,
    citation: 'the majority of species favour open grassland, scrub or desert.',
    explanation: 'Đặc điểm thích nghi đồng cỏ mở thuộc nhóm loài D trong bài nối đặc điểm.'
  },
  {
    id: 6,
    category: '[Reading] Matching Features',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'live in solitary social structures',
    userAnswer: 'C',
    correctAnswer: 'B',
    isCorrect: false,
    citation: 'Some species of bovid are solitary, but others live in large groups with complex social structures.',
    explanation: 'Nhóm phân loài B có tập tính sống đơn độc theo mô tả phân tích.'
  },
  {
    id: 7,
    category: '[Reading] Matching Features',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'reach shoulder heights exceeding two metres',
    userAnswer: 'A',
    correctAnswer: 'A',
    isCorrect: true,
    citation: 'at the other, the massively built bison of North America and Europe, growing to a shoulder height of 2.2m.',
    explanation: 'Bison có chiều cao vai lên đến 2.2m, tương ứng lựa chọn A.'
  },
  {
    id: 8,
    category: '[Reading] Matching Features',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'are among man\'s most essential domestic livestock',
    userAnswer: 'E',
    correctAnswer: 'C',
    isCorrect: false,
    citation: 'Bovids are a highly diverse group consisting of 137 species, some of which are man\'s most important domestic animals.',
    explanation: 'Gia súc thuần dưỡng quan trọng của con người thuộc nhóm C (bò, cừu, dê).'
  },
  {
    id: 9,
    category: '[Reading] Short Answer',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'How many total species of bovids are recognized?',
    userAnswer: '120',
    correctAnswer: '137',
    isCorrect: false,
    citation: 'Bovids are a highly diverse group consisting of 137 species...',
    explanation: 'Số lượng loài bovid được công nhận là 137 loài.'
  },
  {
    id: 10,
    category: '[Reading] Short Answer',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'Which mammal outside the bovid family belongs to the same Artiodactyl class?',
    userAnswer: 'antelope',
    correctAnswer: 'giraffes',
    isCorrect: false,
    citation: '...belongs to the Artiodactyl class, which also includes giraffes.',
    explanation: 'Động vật cùng lớp Artiodactyl được nhắc đến là hươu cao cổ (giraffes).'
  },
  {
    id: 11,
    category: '[Reading] Short Answer',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'Where is the royal antelope geographically native to?',
    userAnswer: 'East Africa',
    correctAnswer: 'West Africa',
    isCorrect: false,
    citation: 'the royal antelope of West Africa, which stands a mere 25 cm...',
    explanation: 'Linh dương hoàng gia có nguồn gốc từ Tây Phi (West Africa).'
  },
  {
    id: 12,
    category: '[Reading] Short Answer',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'What type of habitat do the majority of bovid species prefer?',
    userAnswer: 'arctic tundra',
    correctAnswer: 'open grassland',
    isCorrect: false,
    citation: '...the majority of species favour open grassland, scrub or desert.',
    explanation: 'Phần lớn các loài bovid ưa thích môi trường đồng cỏ mở (open grassland).'
  },
  {
    id: 13,
    category: '[Reading] Short Answer',
    passageTitle: 'Bovids',
    passageText: SAMPLE_PASSAGE,
    promptText: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1.',
    questionText: 'What is the large bovid species found in North America and Europe?',
    userAnswer: 'cattle',
    correctAnswer: 'bison',
    isCorrect: false,
    citation: '...the massively built bison of North America and Europe...',
    explanation: 'Loài bovid thể hình đồ sộ ở Bắc Mỹ và châu Âu là bò rừng bizon (bison).'
  }
];

const CATEGORIES_SUMMARY = [
  {
    name: '[Reading] Matching Features',
    correct: 1,
    wrong: 4,
    skipped: 0,
    questions: [4, 5, 6, 7, 8]
  },
  {
    name: '[Reading] Multiple Choice',
    correct: 1,
    wrong: 2,
    skipped: 0,
    questions: [1, 2, 3]
  },
  {
    name: '[Reading] Short Answer',
    correct: 0,
    wrong: 5,
    skipped: 0,
    questions: [9, 10, 11, 12, 13]
  }
];

export const ExamResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [isExplanationOpen, setIsExplanationOpen] = useState(true);

  const totalQuestions = QUESTIONS_DATA.length;
  const correctCount = QUESTIONS_DATA.filter((q) => q.isCorrect).length;
  const wrongCount = totalQuestions - correctCount;
  const skippedCount = 0;
  const accuracyPercentage = ((correctCount / totalQuestions) * 100).toFixed(1);

  const selectedQuestion = QUESTIONS_DATA.find((q) => q.id === selectedQuestionId) || null;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-6 text-slate-800">
      
      {/* 1. HEADER: Kết quả [Thi thử, Luyện tập]: [Tên chứng chỉ] + [Kỹ năng thi] + [Phần thi] */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Kết quả luyện tập: IELTS Collection 1 Reading Test 1
          </h1>
          <span className="inline-block px-2.5 py-0.5 text-xs sm:text-sm font-semibold rounded bg-amber-500 text-white">
            Passage 1
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button 
            type="button"
            className="px-4 py-2 bg-[#2b3990] hover:bg-[#202c77] text-white text-sm font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
          >
            Xem đáp án
          </button>
          <button 
            type="button"
            onClick={() => navigate('/student/history')}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium rounded-md shadow-2xs transition-colors cursor-pointer"
          >
            Lịch sử làm bài
          </button>
          <button 
            type="button"
            onClick={() => navigate('/student/library')}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium rounded-md shadow-2xs transition-colors cursor-pointer"
          >
            Tới trang đề thi
          </button>
        </div>
      </div>

      {/* 2. THỐNG KÊ TỔNG QUAN (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Kết quả làm bài & Độ chính xác */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <Check size={16} className="text-slate-400" />
              Kết quả làm bài
            </span>
            <span className="font-bold text-slate-900">{correctCount}/{totalQuestions}</span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <Target size={16} className="text-slate-400" />
              Độ chính xác (#đúng/#tổng)
            </span>
            <span className="font-bold text-slate-900">{accuracyPercentage}%</span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              Thời gian hoàn thành
            </span>
            <span className="font-bold text-slate-900">0:00:00</span>
          </div>
        </div>

        {/* Card 2: Trả lời đúng */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-2xs">
            <Check size={18} strokeWidth={3} />
          </div>
          <span className="text-emerald-600 font-semibold text-sm">Trả lời đúng</span>
          <span className="text-3xl font-extrabold text-slate-900 mt-1">{correctCount}</span>
          <span className="text-xs text-slate-400 mt-0.5">câu hỏi</span>
        </div>

        {/* Card 3: Trả lời sai */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center mb-2 shadow-2xs">
            <X size={18} strokeWidth={3} />
          </div>
          <span className="text-rose-600 font-semibold text-sm">Trả lời sai</span>
          <span className="text-3xl font-extrabold text-slate-900 mt-1">{wrongCount}</span>
          <span className="text-xs text-slate-400 mt-0.5">câu hỏi</span>
        </div>

        {/* Card 4: Bỏ qua */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 rounded-full bg-slate-400 text-white flex items-center justify-center mb-2 shadow-2xs">
            <Minus size={18} strokeWidth={3} />
          </div>
          <span className="text-slate-500 font-semibold text-sm">Bỏ qua</span>
          <span className="text-3xl font-extrabold text-slate-900 mt-1">{skippedCount}</span>
          <span className="text-xs text-slate-400 mt-0.5">câu hỏi</span>
        </div>
      </div>

      {/* 3. PHÂN TÍCH CHI TIẾT */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          Phân tích chi tiết
        </h2>


        {/* Bảng phân tích chi tiết */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-900 font-semibold">
                <th className="py-3 px-3">Phân loại câu hỏi</th>
                <th className="py-3 px-3 text-center">Số câu đúng</th>
                <th className="py-3 px-3 text-center">Số câu sai</th>
                <th className="py-3 px-3 text-center">Số câu bỏ qua</th>
                <th className="py-3 px-3 text-center">Độ chính xác</th>
                <th className="py-3 px-3">Danh sách câu hỏi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {CATEGORIES_SUMMARY.map((cat, idx) => {
                const totalInCat = cat.correct + cat.wrong + cat.skipped;
                const catAccuracy = ((cat.correct / totalInCat) * 100).toFixed(2);

                return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-3 font-medium text-slate-800">{cat.name}</td>
                    <td className="py-3.5 px-3 text-center">{cat.correct}</td>
                    <td className="py-3.5 px-3 text-center">{cat.wrong}</td>
                    <td className="py-3.5 px-3 text-center">{cat.skipped}</td>
                    <td className="py-3.5 px-3 text-center">{catAccuracy}%</td>
                    <td className="py-3.5 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {cat.questions.map((qId) => {
                          const question = QUESTIONS_DATA.find((q) => q.id === qId);
                          const isCorrect = question?.isCorrect;

                          return (
                            <button
                              key={qId}
                              type="button"
                              onClick={() => setSelectedQuestionId(qId)}
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-transform hover:scale-110 cursor-pointer ${
                                isCorrect
                                  ? 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                                  : 'border-rose-400 text-rose-500 hover:bg-rose-50'
                              }`}
                            >
                              {qId}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Dòng Total */}
              <tr className="font-bold text-slate-900 border-t border-slate-200 bg-slate-50/50">
                <td className="py-3.5 px-3">Total</td>
                <td className="py-3.5 px-3 text-center">{correctCount}</td>
                <td className="py-3.5 px-3 text-center">{wrongCount}</td>
                <td className="py-3.5 px-3 text-center">{skippedCount}</td>
                <td className="py-3.5 px-3 text-center">
                  {((correctCount / totalQuestions) * 100).toFixed(2)}%
                </td>
                <td className="py-3.5 px-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. BẢNG ĐÁP ÁN CÂU HỎI MÀ CHÚNG TA ĐÃ CHỌN */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          Bảng đáp án câu hỏi
        </h2>
        {/* TODO: MOCK DATA NOTE 
            Hiện tại đang sử dụng dữ liệu tĩnh (QUESTIONS_DATA).
            Khi có API hoặc Redux (ví dụ: state.examResult.passages), 
            cần map qua danh sách các passage và group câu hỏi theo từng passage.
            Ví dụ: 
            passages.map(passage => (
               <div key={passage.id}>
                  <h3>{passage.title}</h3>
                  <div className="grid...">...</div>
               </div>
            ))
        */}
        <div className="space-y-4 pt-2">
          {/* Static group header since mock data is all from one passage */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Passage 1</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {QUESTIONS_DATA.map((q) => {
                return (
                  <div key={q.id} className="flex items-center gap-2.5 py-2 border-b border-slate-100 last:border-0">
                    {/* Circle Question Number */}
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold text-xs shrink-0">
                      {q.id}
                    </span>
                    
                    {/* Correct Answer */}
                    <span className="font-bold text-slate-800 text-sm truncate max-w-[120px]" title={q.correctAnswer}>
                      {q.correctAnswer}:
                    </span>
                    
                    {/* User Answer */}
                    <span className={`text-sm font-medium truncate max-w-[120px] ${!q.isCorrect ? 'text-slate-400 line-through' : 'text-slate-800'}`} title={q.userAnswer}>
                      {q.userAnswer || '-'}
                    </span>
                    
                    {/* Tick or Cross */}
                    <div className="flex-1 flex items-center gap-2">
                      {q.isCorrect ? (
                        <Check size={18} className="text-emerald-500 stroke-[3] shrink-0" />
                      ) : (
                        <X size={18} className="text-rose-500 stroke-[3] shrink-0" />
                      )}
                      
                      {/* Chi tiết link */}
                      <button
                        type="button"
                        onClick={() => setSelectedQuestionId(q.id)}
                        className="ml-auto text-amber-600 hover:text-amber-700 font-semibold text-xs cursor-pointer transition-colors shrink-0"
                      >
                        [Chi tiết]
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 5. POP-UP / MODAL ĐÁP ÁN CHI TIẾT */}
      {selectedQuestion && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  Đáp án chi tiết #{selectedQuestion.id}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  IELTS Collection 1 Reading Test 1
                </p>
                <span className="inline-block px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-semibold mt-1">
                  #{selectedQuestion.category}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuestionId(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
              
              {/* Prompt instruction */}
              <p className="text-xs text-slate-500 italic">
                {selectedQuestion.promptText}
              </p>

              {/* Passage Preview */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 text-base">
                  {selectedQuestion.passageTitle}
                </h4>
                <div className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto pr-2">
                  {selectedQuestion.passageText}
                </div>
              </div>

              {/* Question & Chosen Answer Box */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {selectedQuestion.id}
                  </span>
                  <p className="font-semibold text-slate-900 text-sm sm:text-base leading-snug">
                    {selectedQuestion.questionText}
                  </p>
                </div>

                {/* Box đáp án người dùng đã chọn */}
                <div className="ml-10">
                  <div
                    className={`p-3 rounded-lg border text-sm font-medium ${
                      selectedQuestion.isCorrect
                        ? 'border-emerald-400 bg-emerald-50/50 text-emerald-900'
                        : 'border-rose-400 bg-slate-100 text-slate-900'
                    }`}
                  >
                    {selectedQuestion.userAnswer}
                  </div>

                  {/* Đáp án đúng */}
                  <div className="mt-2 text-sm font-bold text-emerald-600">
                    Đáp án đúng: {selectedQuestion.correctAnswer}
                  </div>
                </div>
              </div>

              {/* Accordion: Giải thích chi tiết đáp án */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsExplanationOpen(!isExplanationOpen)}
                  className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <span>Giải thích chi tiết đáp án</span>
                  {isExplanationOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isExplanationOpen && (
                  <div className="mt-3 p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2 text-xs sm:text-sm">
                    <div className="font-bold text-slate-900">
                      Trích đoạn chứa đáp án:
                    </div>
                    <blockquote className="italic text-slate-700 border-l-2 border-amber-400 pl-3 leading-relaxed">
                      "{selectedQuestion.citation}"
                    </blockquote>
                    <p className="text-slate-600 leading-relaxed pt-1">
                      {selectedQuestion.explanation}
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      , document.body)}

    </div>
  );
};

export default ExamResultPage;
