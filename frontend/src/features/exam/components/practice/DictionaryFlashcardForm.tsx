import { useEffect, useRef, useState } from 'react';
import type { DeckSummary } from '../../../vocab/types/vocab.types';
import type { DictionaryLookupResponse } from '../../types/api.types';
import {
  addDictionaryFlashcard,
  createDictionaryDeck,
  DictionaryFlashcardDuplicateError,
  DictionaryFlashcardSaveUncertainError,
  getDictionaryDecks,
} from '../../api/dictionaryFlashcardApi';

interface Props { ownerId: number | null; result: DictionaryLookupResponse; onSaved?: () => void; }
type FormPhase = 'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'uncertain';

export function DictionaryFlashcardForm({ ownerId, result, onSaved }: Props) {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [phase, setPhase] = useState<FormPhase>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const active = useRef(true);
  const mutex = useRef(false);

  useEffect(() => {
    active.current = true;
    if (!ownerId) { setPhase('error'); setMessage('Không xác định được tài khoản.'); return () => { active.current = false; }; }
    void getDictionaryDecks(ownerId).then(items => {
      if (!active.current) return;
      setDecks(items);
      setSelectedId(items[0] ? String(items[0].id) : '');
      setPhase('ready');
      setMessage(items.length ? null : 'Chưa có bộ thẻ tiếng Anh → tiếng Việt riêng tư.');
    }).catch(() => {
      if (active.current) { setPhase('error'); setMessage('Không tải được danh sách bộ thẻ.'); }
    });
    return () => { active.current = false; };
  }, [ownerId]);

  const save = async (deck: DeckSummary) => {
    if (mutex.current || !ownerId) return;
    mutex.current = true;
    setPhase('saving'); setMessage(null);
    try {
      await addDictionaryFlashcard(deck, ownerId, result);
      if (active.current) { setPhase('saved'); setMessage('Đã lưu vào bộ thẻ.'); onSaved?.(); }
    } catch (error) {
      if (!active.current) return;
      if (error instanceof DictionaryFlashcardDuplicateError) {
        setPhase('error'); setMessage(error.message);
      } else if (error instanceof DictionaryFlashcardSaveUncertainError) {
        setPhase('uncertain'); setMessage(error.message);
      } else {
        const code = (error as any)?.response?.data?.code;
        setPhase('error');
        setMessage(code === 1210 ? 'Từ đã có trong bộ thẻ này.' : 'Không thể lưu thẻ. Kết quả tra từ vẫn được giữ.');
      }
    } finally { mutex.current = false; }
  };

  const saveSelected = () => {
    const deck = decks.find(item => String(item.id) === selectedId);
    if (deck) void save(deck);
  };

  const createAndSave = async () => {
    if (mutex.current || !ownerId || !newName.trim()) return;
    mutex.current = true;
    setPhase('saving'); setMessage(null);
    try {
      const deck = await createDictionaryDeck(ownerId, newName);
      if (!active.current) return;
      setDecks(current => [...current, deck]);
      setSelectedId(String(deck.id));
      await addDictionaryFlashcard(deck, ownerId, result);
      if (active.current) { setPhase('saved'); setMessage('Đã lưu vào bộ thẻ mới.'); onSaved?.(); }
    } catch (error) {
      if (!active.current) return;
      if (error instanceof DictionaryFlashcardSaveUncertainError) {
        setPhase('uncertain'); setMessage(error.message);
      } else if (error instanceof DictionaryFlashcardDuplicateError) {
        setPhase('error'); setMessage(error.message);
      } else {
        setPhase('error'); setMessage('Không thể tạo bộ thẻ hoặc lưu thẻ. Kết quả tra từ vẫn được giữ.');
      }
    } finally { mutex.current = false; }
  };

  return (
    <section className="space-y-2 border-t border-slate-100 pt-3" aria-label="Lưu Flashcard">
      <p className="text-xs text-slate-600">Lưu “{result.selectedText}” — {result.meaningVi}</p>
      {phase === 'loading' ? <p role="status">Đang tải bộ thẻ…</p> : null}
      {phase === 'ready' && decks.length === 0 && message && <p role="status">{message}</p>}
      {decks.length > 0 && phase !== 'saved' && (
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="dictionary-deck-select">Chọn bộ thẻ</label>
          <select id="dictionary-deck-select" value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={phase === 'saving'}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm">
            {decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
          </select>
          <button type="button" onClick={saveSelected} disabled={!selectedId || phase === 'saving' || phase === 'uncertain'}
            className="min-h-11 rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white disabled:opacity-50">
            {phase === 'saving' ? 'Đang lưu…' : '+ Lưu Flashcard'}
          </button>
        </div>
      )}
      {decks.length === 0 && phase !== 'loading' && !creating && (
        <button type="button" onClick={() => setCreating(true)} className="min-h-11 rounded-lg border border-amber-500 px-3 text-sm font-medium text-amber-800">Tạo bộ thẻ</button>
      )}
      {creating && phase !== 'saved' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium" htmlFor="dictionary-new-deck">Tên bộ thẻ mới</label>
          <input id="dictionary-new-deck" value={newName} maxLength={100} onChange={event => setNewName(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          <button type="button" onClick={() => void createAndSave()} disabled={!newName.trim() || phase === 'saving'}
            className="min-h-11 rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white disabled:opacity-50">
            {phase === 'saving' ? 'Đang lưu…' : 'Tạo và lưu'}
          </button>
        </div>
      )}
      {phase === 'saved' && <p role="status" className="text-sm font-medium text-emerald-700">{message}</p>}
      {(phase === 'error' || phase === 'uncertain') && message && <p role="alert" className="text-sm text-red-700">{message}</p>}
    </section>
  );
}
