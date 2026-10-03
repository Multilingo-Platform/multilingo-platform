import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Volume2, 
  ChevronRight, 
  Layers, 
  CheckCircle2, 
  BrainCircuit, 
  HelpCircle, 
  Gamepad2, 
  Check, 
  X,
  Clock,
  Sparkles
} from 'lucide-react';
import { INITIAL_DECKS, INITIAL_CARDS, type CardItem, type DeckItem } from './vocabData';

export const DeckDetailView: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();

  const [decks] = useState<DeckItem[]>(INITIAL_DECKS);
  const currentDeck = decks.find(d => d.id === deckId) || decks[0];

  const [cards, setCards] = useState<CardItem[]>(INITIAL_CARDS.filter(c => c.deckId === currentDeck.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE' | 'MASTERED' | 'NEW'>('ALL');

  // Inline Add Word Form (UC012.1)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newIpa, setNewIpa] = useState('');
  const [newType, setNewType] = useState('noun');
  const [newMeaning, setNewMeaning] = useState('');
  const [newExample, setNewExample] = useState('');
  const [newTranslation, setNewTranslation] = useState('');

  // Audio Playback
  const playWordAudio = (word: string) => {
    // Web Speech API fallback for real pronunciation
    try {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch {
      alert(`Đang phát âm chuẩn bản ngữ cho từ: "${word}"`);
    }
  };

  // Add Card Handler (UC012.1)
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim() || !newMeaning.trim()) return;

    const newCardItem: CardItem = {
      id: Date.now(),
      deckId: currentDeck.id,
      word: newWord.trim(),
      ipa: newIpa.trim() || `/${newWord.toLowerCase()}/`,
      type: newType,
      meaningVi: newMeaning.trim(),
      definitionEn: 'Custom user defined definition',
      example: newExample.trim() || `Example sentence with ${newWord}`,
      exampleTranslation: newTranslation.trim() || 'Bản dịch ví dụ minh họa',
      collocations: [],
      synonyms: [],
      antonyms: [],
      status: 'NEW',
      nextReview: 'Hôm nay',
      easeFactor: 2.5,
      reviews: 0
    };

    setCards([newCardItem, ...cards]);
    setNewWord('');
    setNewIpa('');
    setNewMeaning('');
    setNewExample('');
    setNewTranslation('');
    setShowAddForm(false);
  };

  // Delete Card Handler (UC012.6)
  const handleDeleteCard = (cardId: number, word: string) => {
    if (window.confirm(`Bạn có chắc muốn xóa thẻ "${word}" khỏi bộ thẻ này không?`)) {
      setCards(cards.filter(c => c.id !== cardId));
    }
  };

  // Filtered Cards
  const filteredCards = cards.filter(card => {
    const matchSearch = card.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        card.meaningVi.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;

    if (statusFilter === 'DUE') return card.nextReview === 'Hôm nay';
    if (statusFilter === 'MASTERED') return card.status === 'MASTERED';
    if (statusFilter === 'NEW') return card.status === 'NEW';
    return true;
  });

  const dueCount = cards.filter(c => c.nextReview === 'Hôm nay').length;
  const masteredCount = cards.filter(c => c.status === 'MASTERED').length;

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
        <button 
          onClick={() => navigate('/student/flashcards')}
          style={{ background: 'none', border: 'none', color: '#666666', cursor: 'pointer', padding: 0 }}
        >
          Sổ tay từ vựng
        </button>
        <ChevronRight size={14} />
        <span style={{ color: '#222222', fontWeight: 500 }}>{currentDeck.name}</span>
      </div>

      {/* [ HERO / TITLE ] */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ 
              background: '#f7f7f7', 
              color: '#666666', 
              border: '1px solid #e5e5e5', 
              borderRadius: 6, 
              padding: '2px 8px', 
              fontSize: 12, 
              fontWeight: 500 
            }}>
              {currentDeck.category}
            </span>
            <span style={{ fontSize: 13, color: '#666666' }}>Cập nhật lần cuối: {currentDeck.updatedAt}</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#222222', margin: '0 0 6px' }}>
            {currentDeck.name}
          </h1>
          <p style={{ color: '#666666', fontSize: 14, margin: 0, maxWidth: 680 }}>
            {currentDeck.description}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={() => navigate('/student/flashcards')}
            className="btn btn-secondary"
          >
            <ArrowLeft size={15} />
            Quay lại danh mục
          </button>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
          >
            <Plus size={16} />
            {showAddForm ? 'Đóng form thêm' : '+ Thêm từ mới'}
          </button>
        </div>
      </div>

      {/* 7. Stats chuẩn theo yêu cầu: display: flex; gap: 16px; */}
      <div className="stats-container" style={{ marginBottom: 24 }}>
        <div className="stat-box">
          <span className="stat-number">{dueCount}</span>
          <span className="stat-label">Cần ôn tập hôm nay</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{cards.length}</span>
          <span className="stat-label">Tổng số thẻ từ</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{masteredCount}</span>
          <span className="stat-label">Đã thuộc thành thạo</span>
        </div>
        <div className="stat-box">
          <span className="stat-number">{currentDeck.masteredPercent}%</span>
          <span className="stat-label">Mức độ hoàn thành</span>
        </div>
      </div>

      {/* 4 Dedicated Study Mode Launchers (Màn hình riêng, không popup) */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#222222', margin: 0 }}>
            Chế độ học tập chuyên biệt (SRS & Luyện thi)
          </h2>
          <span style={{ fontSize: 13, color: '#666666' }}>
            Chọn 1 trong 4 chế độ dưới đây để học màn hình riêng
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          
          {/* Mode 1: Ôn tập Flashcard SRS (UC012.2) */}
          <div className="box-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#222222', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={16} color="#f5b301" />
                  ÔN TẬP FLASHCARD
                </span>
                <span style={{ fontSize: 12, background: '#fffbeb', color: '#b45309', border: '1px solid #fef3c7', padding: '2px 6px', borderRadius: 4 }}>
                  SRS SM-2
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: '#666666', lineHeight: 1.45, marginBottom: 14 }}>
                Lật thẻ 3D, nghe phát âm bản ngữ và đánh giá 4 mức độ nhớ theo chu kỳ ngắt quãng SM-2.
              </p>
            </div>
            <button 
              onClick={() => navigate(`/student/flashcards/deck/${currentDeck.id}/srs`)}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Bắt đầu ôn tập ({dueCount} từ)
            </button>
          </div>

          {/* Mode 2: Học từ vựng Trắc nghiệm (UC012.3) */}
          <div className="box-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#222222', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BrainCircuit size={16} color="#2563eb" />
                  HỌC TỪ VỰNG
                </span>
                <span style={{ fontSize: 12, background: '#f7f7f7', color: '#666666', border: '1px solid #e5e5e5', padding: '2px 6px', borderRadius: 4 }}>
                  Trắc nghiệm
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: '#666666', lineHeight: 1.45, marginBottom: 14 }}>
                Chọn nghĩa đúng và hoàn thành câu ngữ cảnh với phản hồi tức thì và giải thích chi tiết.
              </p>
            </div>
            <button 
              onClick={() => navigate(`/student/flashcards/deck/${currentDeck.id}/learn`)}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Bắt đầu học trắc nghiệm
            </button>
          </div>

          {/* Mode 3: Kiểm tra từ vựng (UC012.4) */}
          <div className="box-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#222222', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color="#16a34a" />
                  KIỂM TRA TỪ VỰNG
                </span>
                <span style={{ fontSize: 12, background: '#f7f7f7', color: '#666666', border: '1px solid #e5e5e5', padding: '2px 6px', borderRadius: 4 }}>
                  Tính giờ 10p
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: '#666666', lineHeight: 1.45, marginBottom: 14 }}>
                Làm bài kiểm tra đánh giá tỷ lệ thành thạo có bấm giờ, chấm điểm tự động và xếp loại.
              </p>
            </div>
            <button 
              onClick={() => navigate(`/student/flashcards/deck/${currentDeck.id}/test`)}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Vào làm bài kiểm tra
            </button>
          </div>

          {/* Mode 4: Ghép thẻ tốc độ (UC012.5) */}
          <div className="box-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#222222', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Gamepad2 size={16} color="#dc2626" />
                  GHÉP THẺ TỐC ĐỘ
                </span>
                <span style={{ fontSize: 12, background: '#f7f7f7', color: '#666666', border: '1px solid #e5e5e5', padding: '2px 6px', borderRadius: 4 }}>
                  60 Giây
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: '#666666', lineHeight: 1.45, marginBottom: 14 }}>
                Trò chơi ghép 12 ô từ và định nghĩa thật nhanh, sai bị trừ 5 giây, cạnh tranh BXH.
              </p>
            </div>
            <button 
              onClick={() => navigate(`/student/flashcards/deck/${currentDeck.id}/match`)}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Chơi ghép thẻ tốc độ
            </button>
          </div>

        </div>
      </div>

      {/* Inline Form Thêm Từ Mới (UC012.1) */}
      {showAddForm && (
        <form 
          onSubmit={handleAddCard}
          className="box-card" 
          style={{ marginBottom: 24, border: '1px solid #f5b301', background: '#fff' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#222222', margin: 0 }}>
              + Thêm thẻ ghi nhớ từ vựng mới
            </h3>
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#222', marginBottom: 4 }}>
                Từ tiếng Anh *
              </label>
              <input 
                type="text" 
                value={newWord}
                onChange={e => setNewWord(e.target.value)}
                placeholder="VD: Prerequisite" 
                required 
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#222', marginBottom: 4 }}>
                Phiên âm IPA
              </label>
              <input 
                type="text" 
                value={newIpa}
                onChange={e => setNewIpa(e.target.value)}
                placeholder="VD: /ˌpriːˈrek.wə.zɪt/" 
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#222', marginBottom: 4 }}>
                Từ loại
              </label>
              <select 
                value={newType}
                onChange={e => setNewType(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="noun">Danh từ (Noun)</option>
                <option value="verb">Động từ (Verb)</option>
                <option value="adjective">Tính từ (Adjective)</option>
                <option value="adverb">Trạng từ (Adverb)</option>
                <option value="idiom">Thành ngữ (Idiom / Phrase)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#222', marginBottom: 4 }}>
              Định nghĩa tiếng Việt *
            </label>
            <input 
              type="text" 
              value={newMeaning}
              onChange={e => setNewMeaning(e.target.value)}
              placeholder="VD: Điều kiện tiên quyết, bắt buộc phải có trước" 
              required 
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#222', marginBottom: 4 }}>
                Câu ví dụ tiếng Anh
              </label>
              <input 
                type="text" 
                value={newExample}
                onChange={e => setNewExample(e.target.value)}
                placeholder="VD: Passing this exam is a prerequisite for graduation." 
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#222', marginBottom: 4 }}>
                Dịch nghĩa câu ví dụ
              </label>
              <input 
                type="text" 
                value={newTranslation}
                onChange={e => setNewTranslation(e.target.value)}
                placeholder="VD: Vượt qua kỳ thi này là điều kiện tiên quyết để tốt nghiệp." 
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)}
              className="btn btn-secondary"
            >
              Hủy bỏ
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
            >
              Lưu thẻ ghi nhớ mới
            </button>
          </div>
        </form>
      )}

      {/* 4. Layout: [ LIST / DATA ] - Danh sách từ vựng trong bộ thẻ */}
      <div className="box-card">
        
        {/* Search & Filter Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          
          {/* 8. Tabs / Filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button 
              className={`tab-item ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              Tất cả ({cards.length})
            </button>
            <button 
              className={`tab-item ${statusFilter === 'DUE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('DUE')}
            >
              Cần ôn hôm nay ({dueCount})
            </button>
            <button 
              className={`tab-item ${statusFilter === 'MASTERED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('MASTERED')}
            >
              Đã thuộc ({masteredCount})
            </button>
            <button 
              className={`tab-item ${statusFilter === 'NEW' ? 'active' : ''}`}
              onClick={() => setStatusFilter('NEW')}
            >
              Thẻ mới ({cards.filter(c => c.status === 'NEW').length})
            </button>
          </div>

          {/* 9. Input / Search */}
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={15} color="#888" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm từ vựng hoặc nghĩa..."
              style={{ width: '100%', paddingLeft: 32 }}
            />
          </div>
        </div>

        {/* Word Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e5e5', background: '#f7f7f7' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#222', width: '22%' }}>Từ vựng & Phát âm</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#222', width: '12%' }}>Phiên âm & Loại</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#222', width: '28%' }}>Định nghĩa tiếng Việt</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#222', width: '16%' }}>Kế hoạch ôn</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#222', width: '12%' }}>Trạng thái</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: '#222', textAlign: 'right', width: '10%' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#666666' }}>
                    Không tìm thấy từ vựng nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredCards.map(card => (
                  <tr key={card.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    
                    {/* Word & Audio */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button 
                          onClick={() => playWordAudio(card.word)}
                          title="Phát âm chuẩn"
                          style={{ 
                            background: '#fff', 
                            border: '1px solid #ddd', 
                            borderRadius: 4, 
                            padding: 4, 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Volume2 size={13} color="#f5b301" />
                        </button>
                        <span style={{ fontWeight: 600, color: '#222222', fontSize: 14.5 }}>
                          {card.word}
                        </span>
                      </div>
                    </td>

                    {/* IPA & Type */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ color: '#666666', fontSize: 13, fontFamily: 'monospace' }}>
                        {card.ipa}
                      </div>
                      <span style={{ 
                        fontSize: 11, 
                        color: '#444', 
                        background: '#f2f2f2', 
                        padding: '1px 5px', 
                        borderRadius: 3, 
                        display: 'inline-block',
                        marginTop: 2
                      }}>
                        {card.type}
                      </span>
                    </td>

                    {/* Meaning */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ color: '#222222', fontWeight: 500 }}>
                        {card.meaningVi}
                      </div>
                      {card.example && (
                        <div style={{ fontSize: 12.5, color: '#666666', marginTop: 3, fontStyle: 'italic' }}>
                          "{card.example}"
                        </div>
                      )}
                    </td>

                    {/* Next review */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ 
                        color: card.nextReview === 'Hôm nay' ? '#d97706' : '#666666',
                        fontWeight: card.nextReview === 'Hôm nay' ? 600 : 400
                      }}>
                        {card.nextReview}
                      </span>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        Ôn tập {card.reviews} lần
                      </div>
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '10px 12px' }}>
                      {card.status === 'MASTERED' && (
                        <span style={{ 
                          fontSize: 12, 
                          color: '#16a34a', 
                          background: '#f0fdf4', 
                          border: '1px solid #bbf7d0', 
                          padding: '2px 8px', 
                          borderRadius: 6 
                        }}>
                          Đã thuộc
                        </span>
                      )}
                      {card.status === 'LEARNING' && (
                        <span style={{ 
                          fontSize: 12, 
                          color: '#d97706', 
                          background: '#fffbeb', 
                          border: '1px solid #fde68a', 
                          padding: '2px 8px', 
                          borderRadius: 6 
                        }}>
                          Đang học
                        </span>
                      )}
                      {card.status === 'NEW' && (
                        <span style={{ 
                          fontSize: 12, 
                          color: '#2563eb', 
                          background: '#eff6ff', 
                          border: '1px solid #bfdbfe', 
                          padding: '2px 8px', 
                          borderRadius: 6 
                        }}>
                          Từ mới
                        </span>
                      )}
                    </td>

                    {/* Actions: Edit & Delete (UC012.6) */}
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleDeleteCard(card.id, card.word)}
                        title="Xóa thẻ khỏi bộ này"
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#888888', 
                          cursor: 'pointer', 
                          padding: 4 
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};

export default DeckDetailView;
