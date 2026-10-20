import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findArchivedHighlights,
  highlightArchiveKey,
  pruneExpiredHighlightArchives,
  readHighlightArchive,
  writeHighlightArchive,
  type HighlightArchive,
} from '../highlightStorage';

const archive: HighlightArchive = {
  schemaVersion: 1,
  ownerId: 'user-a',
  attemptId: 23,
  updatedAt: '2026-10-20T00:00:00.000Z',
  documents: [{ partId: 7, documentId: 'group-2', contentHash: 'hash-a', items: [{ id: 'h1', start: 0, end: 4, text: 'fake' }] }],
};

describe('highlightStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips owner and attempt scoped archives and validates current document hash/ranges', () => {
    expect(writeHighlightArchive(archive)).toBe(true);
    const loaded = readHighlightArchive('user-a', 23);
    expect(loaded.failed).toBe(false);
    expect(loaded.archive?.documents[0].items[0].text).toBe('fake');
    expect(findArchivedHighlights(loaded.archive, 7, 'group-2', 'hash-a', 'passage')).toEqual([
      { id: 'h1', start: 0, end: 4, text: 'pass' },
    ]);
    expect(findArchivedHighlights(loaded.archive, 7, 'group-2', 'other', 'passage')).toEqual([]);
    expect(readHighlightArchive('user-b', 23).archive).toBeNull();
    expect(readHighlightArchive('user-a', 24).archive).toBeNull();
  });

  it('prunes only expired archives belonging to the current owner', () => {
    const old = { ...archive, updatedAt: '2026-01-01T00:00:00.000Z' };
    writeHighlightArchive(old);
    writeHighlightArchive({ ...old, ownerId: 'user-b', attemptId: 23 });
    expect(pruneExpiredHighlightArchives('user-a', Date.parse('2026-10-20T00:00:00.000Z'))).toBe(true);
    expect(localStorage.getItem(highlightArchiveKey('user-a', 23))).toBeNull();
    expect(localStorage.getItem(highlightArchiveKey('user-b', 23))).not.toBeNull();
  });

  it('treats malformed and inaccessible storage as a recoverable failure', () => {
    localStorage.setItem(highlightArchiveKey('user-a', 23), '{broken');
    expect(readHighlightArchive('user-a', 23)).toEqual({ archive: null, failed: false });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readHighlightArchive('user-a', 23)).toEqual({ archive: null, failed: true });
  });
});
