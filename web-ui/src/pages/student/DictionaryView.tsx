import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Volume2, 
  Plus, 
  Check, 
  BookOpen, 
  ChevronRight, 
  Layers, 
  Sparkles, 
  History, 
  ExternalLink,
  BookmarkCheck
} from 'lucide-react';
import { INITIAL_DECKS, type DeckItem } from './flashcards/vocabData';

interface DetailedWordEntry {
  word: string;
  ipa: string;
  type: string;
  meaningVi: string;
  definitionEn: string;
  cambridgeAudioUrl?: string;
  examSource: string;
  examples: { en: string; vi: string; context: string }[];
  collocations: string[];
  synonyms: string[];
  antonyms: string[];
  tips: string;
}

const DICTIONARY_DATABASE: Record<string, DetailedWordEntry> = {
  ubiquitous: {
    word: 'Ubiquitous',
    ipa: '/juːˈbɪk.wɪ.təs/',
    type: 'adjective',
    meaningVi: 'Có mặt ở khắp mọi nơi, phổ biến cùng một lúc',
    definitionEn: 'Present, appearing, or found everywhere simultaneously.',
    examSource: 'IELTS Cambridge 18 - Reading Test 2 Passage 1',
    examples: [
      {
        context: 'IELTS Reading Cam 18',
        en: 'In the digital era, smartphones and wireless connectivity have become virtually ubiquitous across all demographic sectors.',
        vi: 'Trong kỷ nguyên số, điện thoại thông minh và kết nối không dây gần như đã trở nên phổ biến ở mọi nhóm nhân khẩu học.'
      },
      {
        context: 'IELTS Writing Task 2 (Technology)',
        en: 'The ubiquitous influence of artificial intelligence raises profound ethical questions concerning data privacy.',
        vi: 'Ảnh hưởng khắp mọi nơi của trí tuệ nhân tạo làm dấy lên những câu hỏi đạo đức sâu sắc liên quan đến quyền riêng tư dữ liệu.'
      }
    ],
    collocations: ['ubiquitous presence', 'become ubiquitous', 'virtually ubiquitous', 'ubiquitous technology'],
    synonyms: ['omnipresent', 'pervasive', 'universal', 'prevalent'],
    antonyms: ['rare', 'scarce', 'isolated', 'seldom'],
    tips: 'Từ vựng C1 mang tính học thuật cao, rất được giám khảo đánh giá cao trong Writing Task 2 khi nói về công nghệ, văn hóa đại chúng.'
  },
  altruism: {
    word: 'Altruism',
    ipa: '/ˈæl.tru.ɪ.zəm/',
    type: 'noun',
    meaningVi: 'Lòng vị tha, sự quan tâm vô tư tới lợi ích của người khác',
    definitionEn: 'The belief in or practice of selfless concern for the well-being of others.',
    examSource: 'IELTS Cambridge 17 - Reading Test 3 Passage 3',
    examples: [
      {
        context: 'IELTS Reading Cam 17',
        en: 'Evolutionary psychologists have long debated whether reciprocal altruism is hardwired into human biological genetics.',
        vi: 'Các nhà tâm lý học tiến hóa từ lâu đã tranh luận xem liệu lòng vị tha tương hỗ có được lập trình sẵn vào hệ gen sinh học con người hay không.'
      },
      {
        context: 'IELTS Speaking Part 3',
        en: 'Many young individuals dedicate their weekends to volunteer charities out of genuine altruism.',
        vi: 'Nhiều người trẻ dành ngày cuối tuần của mình cho các hội từ thiện xuất phát từ lòng vị tha chân thành.'
      }
    ],
    collocations: ['pure altruism', 'reciprocal altruism', 'act of altruism', 'spirit of altruism'],
    synonyms: ['selflessness', 'benevolence', 'philanthropy', 'compassion'],
    antonyms: ['selfishness', 'egoism', 'greed'],
    tips: 'Từ thường xuất hiện trong các bài đọc tâm lý học, xã hội học và đạo đức học.'
  },
  cohesion: {
    word: 'Cohesion',
    ipa: '/kəʊˈhiː.ʒən/',
    type: 'noun',
    meaningVi: 'Sự gắn kết, tính liên kết chặt chẽ',
    definitionEn: 'The action or state of cohering with or forming a united whole.',
    examSource: 'IELTS Cambridge 16 - Writing Band Descriptors',
    examples: [
      {
        context: 'IELTS Writing Criteria',
        en: 'Coherence and cohesion account for 25% of the total score in IELTS Academic Writing Task 2.',
        vi: 'Mạch lạc và liên kết câu chiếm 25% tổng điểm trong bài thi Viết học thuật IELTS Task 2.'
      },
      {
        context: 'IELTS Reading Cam 16',
        en: 'Community cultural festivals foster greater social cohesion among residents of disparate socioeconomic backgrounds.',
        vi: 'Các lễ hội văn hóa cộng đồng thúc đẩy sự gắn kết xã hội lớn hơn giữa các cư dân có hoàn cảnh kinh tế xã hội khác biệt.'
      }
    ],
    collocations: ['social cohesion', 'group cohesion', 'lack of cohesion', 'structural cohesion'],
    synonyms: ['unity', 'solidarity', 'connectedness', 'consistency'],
    antonyms: ['division', 'fragmentation', 'disunity'],
    tips: 'Đặc biệt quan trọng trong tiêu chí chấm thi IELTS Writing "Coherence and Cohesion".'
  },
  disparity: {
    word: 'Disparity',
    ipa: '/dɪˈspær.ə.ti/',
    type: 'noun',
    meaningVi: 'Sự chênh lệch, sự bất bình đẳng rõ rệt',
    definitionEn: 'A great difference or inequality between two or more things.',
    examSource: 'IELTS Cambridge 18 - Reading Test 1 Passage 2',
    examples: [
      {
        context: 'IELTS Reading Cam 18',
        en: 'Government statistical data indicated a widening disparity between urban and remote agrarian household incomes.',
        vi: 'Dữ liệu thống kê của chính phủ chỉ ra sự chênh lệch ngày càng lớn giữa thu nhập của hộ gia đình thành thị và nông thôn vùng sâu vùng xa.'
      }
    ],
    collocations: ['economic disparity', 'growing disparity', 'regional disparity', 'income disparity'],
    synonyms: ['inequality', 'imbalance', 'disproportion', 'divergence'],
    antonyms: ['parity', 'equality', 'similarity'],
    tips: 'Thường dùng trong Writing Task 1 khi miêu tả khoảng cách số liệu hoặc Task 2 về khoảng cách giàu nghèo.'
  },
  pragmatic: {
    word: 'Pragmatic',
    ipa: '/præɡˈmæt.ɪk/',
    type: 'adjective',
    meaningVi: 'Thực tế, thực dụng, giải quyết vấn đề dựa trên hiệu quả thực tế',
    definitionEn: 'Dealing with things sensibly and realistically in a way that is based on practical rather than theoretical considerations.',
    examSource: 'IELTS Cambridge 17 - Reading Test 4',
    examples: [
      {
        context: 'IELTS Reading Cam 17',
        en: 'Policymakers adopted a pragmatic approach to environmental regulation that balanced ecological preservation with commercial viability.',
        vi: 'Các nhà hoạch định chính sách đã áp dụng một cách tiếp cận thực tế đối với quy định môi trường, cân bằng giữa bảo tồn sinh thái và tính khả thi thương mại.'
      }
    ],
    collocations: ['pragmatic approach', 'pragmatic solution', 'pragmatic view'],
    synonyms: ['practical', 'realistic', 'sensible', 'functional'],
    antonyms: ['idealistic', 'impractical', 'theoretical'],
    tips: 'Từ vựng C2 đắt giá thay thế cho từ "practical" thông thường.'
  }
};

const SUGGESTIONS = ['Ubiquitous', 'Altruism', 'Cohesion', 'Disparity', 'Pragmatic'];

export const DictionaryView: React.FC = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('Ubiquitous');
  const [currentWordKey, setCurrentWordKey] = useState('ubiquitous');
  const [recentSearches, setRecentSearches] = useState<string[]>(['Ubiquitous', 'Altruism', 'Cohesion']);
  
  // Save to flashcard state (UC011.1)
  const [selectedDeckId, setSelectedDeckId] = useState<string>(INITIAL_DECKS[0].id);
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);
  const [savedDeckName, setSavedDeckName] = useState('');

  const wordData = DICTIONARY_DATABASE[currentWordKey] || DICTIONARY_DATABASE['ubiquitous'];

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const key = term.trim().toLowerCase();
    if (DICTIONARY_DATABASE[key]) {
      setCurrentWordKey(key);
      if (!recentSearches.includes(term.trim())) {
        setRecentSearches([term.trim(), ...recentSearches.slice(0, 4)]);
      }
      setIsSavedSuccessfully(false);
    }
  };

  const playAudio = () => {
    try {
      const utterance = new SpeechSynthesisUtterance(wordData.word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch {
      alert(`Đang phát âm chuẩn bản ngữ cho từ: "${wordData.word}"`);
    }
  };

  // UC011.1: Lưu từ vựng vào Flashcard cá nhân
  const handleSaveToDeck = () => {
    const targetDeck = INITIAL_DECKS.find(d => d.id === selectedDeckId);
    setSavedDeckName(targetDeck?.name || 'Sổ tay cá nhân');
    setIsSavedSuccessfully(true);

    setTimeout(() => {
      setIsSavedSuccessfully(false);
    }, 4000);
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 16px 48px' }}>
      
      {/* 4. Layout: [ HEADER / BREADCRUMB ] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666666', marginBottom: 16 }}>
        <button 
          onClick={() => navigate('/student/dashboard')}
          style={{ background: 'none', border: 'none', color: '#666666', cursor: 'pointer', padding: 0 }}
        >
          Trang chủ
        </button>
        <ChevronRight size={14} />
        <span style={{ color: '#222222', fontWeight: 500 }}>Từ điển ngữ cảnh đa ngôn ngữ</span>
      </div>

      {/* [ HERO / TITLE ] */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#222222', margin: '0 0 6px' }}>
          Tra Cứu Từ Điển Ngữ Cảnh Đề Thi
        </h1>
        <p style={{ color: '#666666', fontSize: 14, margin: '0 0 16px' }}>
          Tra cứu nghĩa tiếng Việt, câu ngữ cảnh trích xuất từ đề thi thật (IELTS/TOEIC), nghe phát âm IPA và lưu trực tiếp vào các bộ thẻ Flashcard cá nhân.
        </p>

        {/* 9. Input / Search - Simple, no SaaS floating effects */}
        <div style={{ display: 'flex', gap: 8, maxWidth: 650 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#888" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Nhập từ vựng cần tra (VD: Ubiquitous, Altruism, Cohesion...)"
              style={{ width: '100%', paddingLeft: 34, fontSize: 14 }}
            />
          </div>
          <button 
            onClick={() => handleSearch(searchTerm)}
            className="btn btn-primary"
          >
            Tìm kiếm
          </button>
        </div>

        {/* Quick suggestions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#666666' }}>Gợi ý nhanh:</span>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleSearch(s)}
              style={{
                background: currentWordKey === s.toLowerCase() ? '#fffbeb' : '#ffffff',
                border: `1px solid ${currentWordKey === s.toLowerCase() ? '#f5b301' : '#e5e5e5'}`,
                color: currentWordKey === s.toLowerCase() ? '#b45309' : '#222222',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 12.5,
                cursor: 'pointer'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Layout: [ CONTENT LEFT ] [ SIDEBAR ] */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 20, alignItems: 'start' }}>
        
        {/* Left Column: Word Detail View */}
        <div>
          
          {/* Main Word Card (Rule 6: Card / Box) */}
          <div className="box-card" style={{ marginBottom: 16 }}>
            
            {/* Header: Word, IPA, Type, Audio, Save button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #e5e5e5', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 28, fontWeight: 600, color: '#222222', margin: 0 }}>
                    {wordData.word}
                  </h2>
                  <span style={{ 
                    fontSize: 12, 
                    background: '#f7f7f7', 
                    color: '#666666', 
                    border: '1px solid #e5e5e5', 
                    padding: '2px 8px', 
                    borderRadius: 6,
                    fontWeight: 500
                  }}>
                    {wordData.type}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, color: '#666666', fontFamily: 'monospace' }}>
                    {wordData.ipa}
                  </span>
                  <button 
                    onClick={playAudio}
                    title="Phát âm chuẩn Cambridge"
                    style={{ 
                      background: '#fff', 
                      border: '1px solid #ddd', 
                      borderRadius: 4, 
                      padding: '4px 8px', 
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      color: '#222'
                    }}
                  >
                    <Volume2 size={14} color="#f5b301" />
                    <span>Phát âm (UK/US)</span>
                  </button>
                </div>
              </div>

              {/* UC011.1: Lưu từ vựng vào Flashcard Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select 
                    value={selectedDeckId}
                    onChange={e => setSelectedDeckId(e.target.value)}
                    style={{ fontSize: 13, padding: '6px 8px' }}
                  >
                    {INITIAL_DECKS.map(deck => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name}
                      </option>
                    ))}
                  </select>

                  <button 
                    onClick={handleSaveToDeck}
                    className="btn btn-primary"
                    style={{ padding: '6px 14px', fontSize: 13 }}
                  >
                    <Plus size={14} />
                    + Lưu Flashcard
                  </button>
                </div>

                {isSavedSuccessfully && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#16a34a', fontWeight: 500 }}>
                    <BookmarkCheck size={14} />
                    <span>Đã lưu thành công vào "{savedDeckName}"!</span>
                  </div>
                )}
              </div>
            </div>

            {/* Vietnamese Meaning */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: '#666666', marginBottom: 4, fontWeight: 500 }}>
                ĐỊNH NGHĨA TIẾNG VIỆT
              </div>
              <div style={{ 
                background: '#fffbeb', 
                borderLeft: '3px solid #f5b301', 
                padding: '10px 14px', 
                borderRadius: 2, 
                fontSize: 15, 
                fontWeight: 500, 
                color: '#222222' 
              }}>
                {wordData.meaningVi}
              </div>
            </div>

            {/* English Academic Definition */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#666666', marginBottom: 4, fontWeight: 500 }}>
                ĐỊNH NGHĨA HỌC THUẬT (CAMBRIDGE / OXFORD)
              </div>
              <p style={{ fontSize: 14, color: '#333333', margin: 0, lineHeight: 1.5 }}>
                {wordData.definitionEn}
              </p>
            </div>

            {/* Exam Context Sentences */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#666666', marginBottom: 6, fontWeight: 500 }}>
                CÂU NGỮ CẢNH TRONG ĐỀ THI THẬT
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {wordData.examples.map((ex, idx) => (
                  <div key={idx} style={{ background: '#f7f7f7', border: '1px solid #e5e5e5', borderRadius: 4, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11.5, color: '#b45309', fontWeight: 600, marginBottom: 4 }}>
                      [{ex.context}]
                    </div>
                    <div style={{ fontSize: 14, color: '#222222', lineHeight: 1.45, marginBottom: 4 }}>
                      {ex.en}
                    </div>
                    <div style={{ fontSize: 13, color: '#666666', fontStyle: 'italic' }}>
                      → {ex.vi}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Collocations */}
            {wordData.collocations.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#666666', marginBottom: 6, fontWeight: 500 }}>
                  COLLOCATIONS & CỤM TỪ THƯỜNG GẶP
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {wordData.collocations.map((col, idx) => (
                    <span 
                      key={idx}
                      style={{ 
                        background: '#ffffff', 
                        border: '1px solid #e5e5e5', 
                        padding: '4px 10px', 
                        borderRadius: 4, 
                        fontSize: 13, 
                        color: '#222222' 
                      }}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Synonyms & Antonyms */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 6, fontWeight: 600 }}>
                  TỪ ĐỒNG NGHĨA (SYNONYMS)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {wordData.synonyms.map((syn, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSearch(syn)}
                      style={{ 
                        background: '#f0fdf4', 
                        border: '1px solid #bbf7d0', 
                        padding: '3px 8px', 
                        borderRadius: 4, 
                        fontSize: 12.5, 
                        color: '#15803d',
                        cursor: 'pointer' 
                      }}
                    >
                      {syn}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 6, fontWeight: 600 }}>
                  TỪ TRÁI NGHĨA (ANTONYMS)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {wordData.antonyms.map((ant, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSearch(ant)}
                      style={{ 
                        background: '#fef2f2', 
                        border: '1px solid #fecaca', 
                        padding: '3px 8px', 
                        borderRadius: 4, 
                        fontSize: 12.5, 
                        color: '#b91c1c',
                        cursor: 'pointer' 
                      }}
                    >
                      {ant}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Lexical Tips Box */}
          <div className="box-card" style={{ background: '#f7f7f7' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#222222', marginBottom: 6 }}>
              Mẹo ghi điểm Lexical Resource:
            </h3>
            <p style={{ fontSize: 13.5, color: '#666666', margin: 0, lineHeight: 1.5 }}>
              {wordData.tips}
            </p>
          </div>

        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Sổ tay bộ thẻ cá nhân */}
          <div className="box-card">
            <h4 style={{ fontSize: 14, fontWeight: 600, color: '#222222', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={16} color="#f5b301" />
              Sổ Tay Từ Vựng Của Bạn
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {INITIAL_DECKS.map(d => (
                <div 
                  key={d.id}
                  onClick={() => navigate(`/student/flashcards/deck/${d.id}`)}
                  style={{
                    border: '1px solid #e5e5e5',
                    borderRadius: 4,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    background: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{d.totalWords} từ • {d.dueToday} cần ôn</div>
                  </div>
                  <ChevronRight size={14} color="#888" />
                </div>
              ))}
            </div>

            <button 
              onClick={() => navigate('/student/flashcards')}
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: 13 }}
            >
              Quản lý toàn bộ sổ tay
            </button>
          </div>

          {/* Lịch sử tra cứu gần đây */}
          <div className="box-card">
            <h4 style={{ fontSize: 14, fontWeight: 600, color: '#222222', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <History size={16} color="#666666" />
              Lịch Sử Tra Cứu Gần Đây
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentSearches.map((w, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(w)}
                  style={{
                    background: '#f7f7f7',
                    border: '1px solid #e5e5e5',
                    borderRadius: 4,
                    padding: '6px 10px',
                    textAlign: 'left',
                    fontSize: 13,
                    color: '#222222',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{w}</span>
                  <ExternalLink size={12} color="#888" />
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default DictionaryView;
