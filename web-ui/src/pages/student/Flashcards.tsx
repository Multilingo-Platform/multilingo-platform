import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Layers, 
  ChevronRight, 
  BookOpen, 
  BrainCircuit,
  Clock,
  Gamepad2,
  ArrowRight,
  Flame,
  Award,
  CheckCircle2,
  TrendingUp,
  RotateCw,
  X
} from 'lucide-react';
import { INITIAL_DECKS, type DeckItem } from './flashcards/vocabData';

export const Flashcards: React.FC = () => {
  const navigate = useNavigate();

  const [decks, setDecks] = useState<DeckItem[]>(INITIAL_DECKS);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Popup tạo bộ thẻ mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckCategory, setNewDeckCategory] = useState<'IELTS' | 'TOEIC' | 'COMMUNICATION' | 'GENERAL'>('IELTS');
  const [newDeckDesc, setNewDeckDesc] = useState('');

  const handleCreateDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;

    const newDeck: DeckItem = {
      id: `deck-${Date.now()}`,
      name: newDeckName.trim(),
      category: newDeckCategory,
      description: newDeckDesc.trim() || 'Bộ từ vựng học tập cá nhân',
      totalWords: 0,
      dueToday: 0,
      masteredPercent: 0,
      updatedAt: 'Vừa xong'
    };

    setDecks([newDeck, ...decks]);
    setNewDeckName('');
    setNewDeckDesc('');
    setShowCreateModal(false);
  };

  // Lọc bộ thẻ
  const filteredDecks = decks.filter(deck => {
    const matchCategory = selectedCategory === 'ALL' || deck.category === selectedCategory;
    const matchSearch = deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        deck.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  const totalDueToday = decks.reduce((sum, d) => sum + d.dueToday, 0);
  const totalWords = decks.reduce((sum, d) => sum + d.totalWords, 0);

  // Đếm số lượng theo chuyên mục
  const countIelts = decks.filter(d => d.category === 'IELTS').length;
  const countToeic = decks.filter(d => d.category === 'TOEIC').length;
  const countComm = decks.filter(d => d.category === 'COMMUNICATION').length;

  return (
    <div className="container" style={{ padding: '20px 1rem 60px' }}>
      
      {/* 4. Layout: [ HEADER / BREADCRUMB ] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: '#6b7280', marginBottom: 16 }}>
        <button 
          onClick={() => navigate('/student/dashboard')}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0 }}
        >
          Trang chủ
        </button>
        <ChevronRight size={14} />
        <span style={{ color: '#111827', fontWeight: 500 }}>Sổ tay từ vựng & Flashcards</span>
      </div>

      {/* [ HERO / TITLE & ACTIONS ] */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
            Sổ Tay Từ Vựng & Thẻ Ghi Nhớ
          </h1>
          <p style={{ color: '#4b5563', fontSize: 14.5, margin: 0, maxWidth: 840, lineHeight: 1.55 }}>
            Ôn tập từ vựng học thuật theo phương pháp lặp lại ngắt quãng (Spaced Repetition SM-2). Chọn bộ thẻ để ôn tập, học trắc nghiệm, làm bài kiểm tra hoặc chơi ghép thẻ tốc độ.
          </p>
        </div>

        {/* Action Button: Mở Modal Popup tạo bộ thẻ */}
        <button 
          onClick={() => setShowCreateModal(true)}
          style={{
            background: '#ffffff',
            color: '#1f2937',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 38,
            transition: 'background-color 0.15s ease, border-color 0.15s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#f9fafb';
            e.currentTarget.style.borderColor = '#9ca3af';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#d1d5db';
          }}
        >
          <Plus size={16} color="#4b5563" />
          Tạo bộ thẻ mới
        </button>
      </div>

      {/* 4 Thống kê đơn giản, có icon, thông tin tinh gọn, không viền màu mè */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        
        {/* Box 1: Thẻ cần ôn hôm nay */}
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #e5e5e5', 
          borderRadius: 4, 
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>
              Thẻ cần ôn hôm nay
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#222222', lineHeight: 1.1 }}>
              {totalDueToday}
            </div>
          </div>
          <div style={{ 
            width: 38, 
            height: 38, 
            borderRadius: 4, 
            background: '#f7f7f7', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#666666'
          }}>
            <Clock size={19} />
          </div>
        </div>

        {/* Box 2: Tổng số từ đã lưu */}
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #e5e5e5', 
          borderRadius: 4, 
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>
              Tổng số từ đã lưu
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#222222', lineHeight: 1.1 }}>
              {totalWords}
            </div>
          </div>
          <div style={{ 
            width: 38, 
            height: 38, 
            borderRadius: 4, 
            background: '#f7f7f7', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#666666'
          }}>
            <BookOpen size={19} />
          </div>
        </div>

        {/* Box 3: Chuỗi ngày học liên tục (Streak) */}
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #e5e5e5', 
          borderRadius: 4, 
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>
              Chuỗi ngày học liên tục
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#222222', lineHeight: 1.1 }}>
              14 <span style={{ fontSize: 14, fontWeight: 400, color: '#666666' }}>ngày</span>
            </div>
          </div>
          <div style={{ 
            width: 38, 
            height: 38, 
            borderRadius: 4, 
            background: '#f7f7f7', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#666666'
          }}>
            <Flame size={19} />
          </div>
        </div>

        {/* Box 4: Tỷ lệ thuộc từ dài hạn */}
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #e5e5e5', 
          borderRadius: 4, 
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#666666', marginBottom: 4 }}>
              Tỷ lệ thuộc từ dài hạn
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#222222', lineHeight: 1.1 }}>
              76%
            </div>
          </div>
          <div style={{ 
            width: 38, 
            height: 38, 
            borderRadius: 4, 
            background: '#f7f7f7', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#666666'
          }}>
            <Award size={19} />
          </div>
        </div>

      </div>

      {/* 4. Layout 2 Cột: [ CONTENT LEFT ~68% ] [ SIDEBAR ~32% (340px) ] 
          Đồng bộ TIÊU ĐỀ 2 BÊN THẲNG HÀNG TRÊN CÙNG ĐƯỜNG CƠ SỞ (BASELINE)
      */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>
        
        {/* CỘT TRÁI: Danh sách bộ thẻ */}
        <div>
          
          {/* HEADER CỘT TRÁI: Thẳng hàng tuyệt đối với Header Sidebar bên phải */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 38, marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
                Danh Sách Bộ Thẻ
              </h2>
            </div>

            {/* Nút tiện ích Tra từ điển nhanh (gọn gàng, thanh lịch thay thế cho khối card quảng cáo to đùng) */}
            <button
              onClick={() => navigate('/student/dictionary')}
              style={{
                background: 'none',
                border: 'none',
                color: '#4b5563',
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                borderRadius: 4,
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#b45309'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#4b5563'; }}
            >
              <BookOpen size={15} color="#b45309" />
              Tra từ điển ngữ cảnh →
            </button>
          </div>

          {/* 8. Tabs / Filter & 9. Input Search Bar: Toolbar liền mạch */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            gap: 16, 
            marginBottom: 20 
          }}>
            
            {/* Tabs lọc dạng segment mượt mà, phân cấp rõ */}
            <div style={{ display: 'flex', gap: 6, background: '#f3f4f6', padding: 4, borderRadius: 8 }}>
              <button 
                onClick={() => setSelectedCategory('ALL')}
                style={{ 
                  fontSize: 14, 
                  padding: '7px 16px', 
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedCategory === 'ALL' ? '#ffffff' : 'transparent',
                  color: selectedCategory === 'ALL' ? '#111827' : '#4b5563',
                  fontWeight: selectedCategory === 'ALL' ? 600 : 500,
                  boxShadow: selectedCategory === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Tất cả ({decks.length})
              </button>
              <button 
                onClick={() => setSelectedCategory('IELTS')}
                style={{ 
                  fontSize: 14, 
                  padding: '7px 16px', 
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedCategory === 'IELTS' ? '#ffffff' : 'transparent',
                  color: selectedCategory === 'IELTS' ? '#111827' : '#4b5563',
                  fontWeight: selectedCategory === 'IELTS' ? 600 : 500,
                  boxShadow: selectedCategory === 'IELTS' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                IELTS ({countIelts})
              </button>
              <button 
                onClick={() => setSelectedCategory('TOEIC')}
                style={{ 
                  fontSize: 14, 
                  padding: '7px 16px', 
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedCategory === 'TOEIC' ? '#ffffff' : 'transparent',
                  color: selectedCategory === 'TOEIC' ? '#111827' : '#4b5563',
                  fontWeight: selectedCategory === 'TOEIC' ? 600 : 500,
                  boxShadow: selectedCategory === 'TOEIC' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                TOEIC ({countToeic})
              </button>
              <button 
                onClick={() => setSelectedCategory('COMMUNICATION')}
                style={{ 
                  fontSize: 14, 
                  padding: '7px 16px', 
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedCategory === 'COMMUNICATION' ? '#ffffff' : 'transparent',
                  color: selectedCategory === 'COMMUNICATION' ? '#111827' : '#4b5563',
                  fontWeight: selectedCategory === 'COMMUNICATION' ? 600 : 500,
                  boxShadow: selectedCategory === 'COMMUNICATION' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Giao tiếp ({countComm})
              </button>
            </div>

            {/* 9. Search Bar tỷ lệ cân đối */}
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Tìm tên bộ thẻ..."
                style={{ 
                  width: '100%', 
                  paddingLeft: 34, 
                  paddingRight: 12,
                  fontSize: 14, 
                  height: 38,
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: 6
                }}
              />
            </div>
          </div>

          {/* 6. Danh sách Card bộ thẻ (Rộng rãi, thoáng đãng, kích thước lớn) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 22 }}>
            {filteredDecks.length === 0 ? (
              <div className="box-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 48, color: '#4b5563', fontSize: 15 }}>
                Không tìm thấy bộ thẻ nào phù hợp với tìm kiếm của bạn.
              </div>
            ) : (
              filteredDecks.map(deck => (
                <div 
                  key={deck.id} 
                  className="box-card"
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    minHeight: 250,
                    padding: '22px 24px',
                    border: '1px solid #e5e5e5',
                    borderRadius: 8,
                    background: '#ffffff'
                  }}
                >
                  <div>
                    {/* Top Row: Category badge & Due badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ 
                        fontSize: 12.5, 
                        fontWeight: 600, 
                        color: '#4b5563', 
                        background: '#f3f4f6', 
                        padding: '3px 10px', 
                        borderRadius: 4 
                      }}>
                        {deck.category}
                      </span>
                      {deck.dueToday > 0 ? (
                        <span style={{ 
                          fontSize: 12.5, 
                          color: '#b45309', 
                          background: '#fffbeb', 
                          border: '1px solid #fde68a', 
                          padding: '3px 10px', 
                          borderRadius: 6, 
                          fontWeight: 600 
                        }}>
                          {deck.dueToday} từ cần ôn
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                          <CheckCircle2 size={15} /> Đã hoàn thành
                        </span>
                      )}
                    </div>

                    {/* Deck Title */}
                    <h3 
                      onClick={() => navigate(`/student/flashcards/deck/${deck.id}`)}
                      style={{ 
                        fontSize: 18, 
                        fontWeight: 600, 
                        color: '#111827', 
                        margin: '0 0 8px',
                        cursor: 'pointer' 
                      }}
                    >
                      {deck.name}
                    </h3>

                    {/* Deck Description */}
                    <p style={{ fontSize: 14.5, color: '#4b5563', margin: '0 0 16px', lineHeight: 1.55 }}>
                      {deck.description}
                    </p>

                    {/* 4 Chế độ học có sẵn trong bộ này (Feature preview chips) */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                      <span style={{ fontSize: 12, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Layers size={12} color="#b45309" /> SRS 3D
                      </span>
                      <span style={{ fontSize: 12, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <BrainCircuit size={12} color="#2563eb" /> Trắc nghiệm
                      </span>
                      <span style={{ fontSize: 12, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} color="#16a34a" /> Kiểm tra
                      </span>
                      <span style={{ fontSize: 12, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Gamepad2 size={12} color="#dc2626" /> Ghép từ 60s
                      </span>
                    </div>

                    {/* Progress Bar (Chiều cao 8px, Pill shape trực quan) */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: '#374151', marginBottom: 6 }}>
                        <span>Tiến độ ghi nhớ</span>
                        <strong style={{ color: '#111827' }}>{deck.masteredPercent}%</strong>
                      </div>
                      <div style={{ width: '100%', height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${deck.masteredPercent}%`, height: '100%', background: '#f5b301', borderRadius: 999 }} />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Metadata & Secondary Action Button */}
                  <div style={{ 
                    borderTop: '1px solid #f3f4f6', 
                    paddingTop: 14, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                  }}>
                    <span style={{ fontSize: 14, color: '#4b5563', fontWeight: 500 }}>
                      {deck.totalWords} từ vựng
                    </span>

                    {/* Secondary button: Đẹp, sạch, chiều cao chuẩn */}
                    <button 
                      onClick={() => navigate(`/student/flashcards/deck/${deck.id}`)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        color: '#111827',
                        borderRadius: 6,
                        padding: '7px 16px',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#f5b301';
                        e.currentTarget.style.backgroundColor = '#fffbeb';
                        e.currentTarget.style.color = '#b45309';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.color = '#111827';
                      }}
                    >
                      Chi tiết & Học
                      <ChevronRight size={15} />
                    </button>
                  </div>

                </div>
              ))
            )}
          </div>

        </div>

        {/* CỘT PHẢI: Sidebar (~380px) 
            Đã loại bỏ các card quảng cáo không cần thiết theo yêu cầu người dùng
            Chỉ giữ lại Khối Ôn Tập Nhanh SM-2 với Tiêu đề thẳng hàng tuyệt đối với cột trái
        */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* HEADER CỘT PHẢI: Nằm trên cùng một baseline ngang với "Danh Sách Bộ Thẻ" */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 38, marginBottom: 18 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
              Ôn Tập Hôm Nay
            </h2>
            <span style={{ 
              fontSize: 12.5, 
              fontWeight: 600, 
              color: '#b45309', 
              background: '#fef3c7', 
              padding: '3px 10px', 
              borderRadius: 6 
            }}>
              {totalDueToday} thẻ đến hạn
            </span>
          </div>

          {/* CARD DUY NHẤT: Ôn tập nhanh hàng ngày theo thuật toán ngắt quãng SM-2 */}
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid #e5e7eb', 
            borderRadius: 10, 
            padding: '24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Layers size={19} color="#b45309" />
              </div>
              <div>
                <h4 style={{ fontSize: 16.5, fontWeight: 700, color: '#111827', margin: 0 }}>
                  Ôn Tập Ngắt Quãng SM-2
                </h4>
                <span style={{ fontSize: 12.5, color: '#6b7280' }}>
                  Học thông minh chống quên
                </span>
              </div>
            </div>

            <p style={{ fontSize: 14.5, color: '#4b5563', lineHeight: 1.6, margin: 0 }}>
              Hệ thống tự động gom <strong>{totalDueToday} từ vựng</strong> đã đến kỳ hạn ôn tập từ tất cả các bộ thẻ. Ôn đều đặn mỗi ngày giúp chuyển từ vựng vào trí nhớ dài hạn vĩnh viễn.
            </p>

            <div style={{ 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: 6, 
              padding: '10px 14px', 
              display: 'flex', 
              justifyContent: 'space-between',
              fontSize: 13,
              color: '#475569'
            }}>
              <span>Ước tính thời gian:</span>
              <strong style={{ color: '#0f172a' }}>~5 - 7 phút</strong>
            </div>

            {/* Nút Primary duy nhất: Nền vàng #f5b301, chữ đen đậm #111827 */}
            <button 
              onClick={() => navigate('/student/flashcards/deck/cam-18/srs')}
              style={{ 
                width: '100%', 
                fontSize: 15, 
                fontWeight: 600,
                padding: '12px 16px',
                background: '#f5b301',
                color: '#111827',
                border: '1px solid #d99a00',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 4px rgba(245, 179, 1, 0.2)',
                transition: 'background-color 0.15s ease, transform 0.1s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#d99a00';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#f5b301';
              }}
            >
              Bắt đầu ôn tập ({totalDueToday} từ)
              <ArrowRight size={17} />
            </button>
          </div>

        </div>

      </div>

      {/* MODAL POPUP: TẠO BỘ THẺ MỚI */}
      {showCreateModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 24, 39, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: 520,
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 24px',
              borderBottom: '1px solid #f3f4f6'
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                  Tạo Bộ Thẻ Từ Vựng Mới
                </h3>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
                  Thiết lập bộ thẻ cá nhân để lưu và học từ vựng theo chu kỳ SM-2
                </p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#111827'; e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'none'; }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateDeck} style={{ padding: '20px 24px' }}>
              
              {/* Tên bộ thẻ */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Tên bộ thẻ <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text"
                  required
                  value={newDeckName}
                  onChange={e => setNewDeckName(e.target.value)}
                  placeholder="Ví dụ: IELTS Speaking Part 2 - Topic Environment"
                  autoFocus
                  style={{
                    width: '100%',
                    height: 42,
                    padding: '0 14px',
                    fontSize: 14.5,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#f5b301'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245, 179, 1, 0.15)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Danh mục / Chuyên mục */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Chuyên mục / Phân loại
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {(['IELTS', 'TOEIC', 'COMMUNICATION', 'GENERAL'] as const).map(cat => {
                    const labelMap = {
                      IELTS: 'IELTS',
                      TOEIC: 'TOEIC',
                      COMMUNICATION: 'Giao tiếp',
                      GENERAL: 'Tổng hợp'
                    };
                    const isSelected = newDeckCategory === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setNewDeckCategory(cat)}
                        style={{
                          height: 38,
                          fontSize: 13,
                          fontWeight: isSelected ? 600 : 500,
                          borderRadius: 6,
                          border: isSelected ? '1.5px solid #f5b301' : '1px solid #e5e7eb',
                          background: isSelected ? '#fffbeb' : '#ffffff',
                          color: isSelected ? '#b45309' : '#4b5563',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {labelMap[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mô tả bộ thẻ */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Mô tả ngắn
                </label>
                <textarea 
                  rows={3}
                  value={newDeckDesc}
                  onChange={e => setNewDeckDesc(e.target.value)}
                  placeholder="Ghi chú về nguồn tài liệu hoặc mục tiêu điểm số..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: 14,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#f5b301'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245, 179, 1, 0.15)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    height: 40,
                    padding: '0 18px',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#4b5563',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  style={{
                    height: 40,
                    padding: '0 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#111827',
                    background: '#f5b301',
                    border: '1px solid #d99a00',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#d99a00'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f5b301'; }}
                >
                  <Plus size={16} />
                  Tạo bộ thẻ
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Flashcards;

