import React, { useState } from 'react';
import { Volume2, RefreshCcw, CheckCircle, XCircle } from 'lucide-react';

const Flashcards = () => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Ôn tập Từ vựng (SRS)</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Hôm nay bạn còn <strong style={{ color: 'var(--primary)' }}>45</strong> thẻ cần ôn tập.</p>
      </div>

      {/* 3D Flip Card Container */}
      <div 
        className="flashcard-container" 
        onClick={() => setIsFlipped(!isFlipped)}
        style={{ width: '400px', height: '500px', perspective: '1000px', cursor: 'pointer' }}
      >
        <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`} style={{ width: '100%', height: '100%', transition: 'transform 0.6s', transformStyle: 'preserve-3d', position: 'relative' }}>
          
          {/* Front Side (English Word) */}
          <div className="ed-card flashcard-front flex-center" style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', flexDirection: 'column', gap: '1rem' }}>
            <span className="badge badge-gray" style={{ letterSpacing: '1px' }}>Tính từ</span>
            <h2 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--primary)' }}>ubiquitous</h2>
            <div className="flex-center" style={{ gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <span>/juːˈbɪk.wɪ.təs/</span>
              <Volume2 size={20} color="var(--text-muted)" />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 'auto', marginBottom: '2rem' }}>Click để lật thẻ</p>
          </div>

          {/* Back Side (Meaning & Example) */}
          <div className="ed-card flashcard-back" style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Có mặt ở khắp mọi nơi</h3>
            <div style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
              <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: 1.6 }}>"In recent years, urban farming has become an increasingly <strong>ubiquitous</strong> phenomenon."</p>
            </div>
            
            {/* SRS Controls (Only show when flipped) */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto', opacity: isFlipped ? 1 : 0, transition: 'opacity 0.3s delay 0.3s' }}>
              <button className="btn btn-outline" style={{ flex: 1, color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}>
                <XCircle size={18} /> Quên (1d)
              </button>
              <button className="btn btn-outline" style={{ flex: 1, color: 'var(--warning)', borderColor: 'var(--warning)' }} onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}>
                <RefreshCcw size={18} /> Khó (3d)
              </button>
              <button className="btn btn-outline" style={{ flex: 1, color: 'var(--success)', borderColor: 'var(--success)' }} onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}>
                <CheckCircle size={18} /> Nhớ (7d)
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Flashcards;
