import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findArchivedHighlights,
  highlightArchiveKey,
  highlightArchiveKeyV1,
  highlightArchiveKeyV2,
  pruneExpiredHighlightArchives,
  readHighlightArchive,
  writeHighlightArchive,
  type HighlightArchiveV1,
  type HighlightArchiveV2,
} from '../highlightStorage';

const v1Archive: HighlightArchiveV1 = {
  schemaVersion: 1,
  ownerId: 'user-a',
  attemptId: 23,
  updatedAt: '2026-10-20T00:00:00.000Z',
  documents: [
    {
      partId: 7,
      documentId: 'group-2',
      contentHash: 'hash-a',
      items: [{ id: 'h1', start: 0, end: 4, text: 'fake' }],
    },
  ],
};

const v2Archive: HighlightArchiveV2 = {
  schemaVersion: 2,
  ownerId: 'user-a',
  attemptId: 23,
  updatedAt: '2026-10-20T00:00:00.000Z',
  documents: [
    {
      partId: 7,
      documentId: 'group-2',
      contentHash: 'hash-a',
      items: [
        { id: 'h1', start: 0, end: 4, text: 'fake', color: 'green' },
        { id: 'h2', start: 5, end: 9, text: 'text', color: 'pink' },
      ],
    },
  ],
};

describe('highlightStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips schema 2 archives with color metadata and validates current document hash/ranges', () => {
    expect(writeHighlightArchive(v2Archive)).toBe(true);
    const loaded = readHighlightArchive('user-a', 23);
    expect(loaded.failed).toBe(false);
    expect(loaded.archive?.schemaVersion).toBe(2);
    expect(loaded.archive?.documents[0].items[0].color).toBe('green');
    expect(loaded.archive?.documents[0].items[1].color).toBe('pink');

    expect(findArchivedHighlights(loaded.archive, 7, 'group-2', 'hash-a', 'passage word')).toEqual([
      { id: 'h1', start: 0, end: 4, text: 'pass', color: 'green' },
      { id: 'h2', start: 5, end: 9, text: 'ge w', color: 'pink' },
    ]);
    expect(findArchivedHighlights(loaded.archive, 7, 'group-2', 'other', 'passage')).toEqual([]);
    expect(readHighlightArchive('user-b', 23).archive).toBeNull();
    expect(readHighlightArchive('user-a', 24).archive).toBeNull();
  });

  it('migrates legacy schema 1 archive by assigning yellow color to all items when v2 is absent', () => {
    localStorage.setItem(highlightArchiveKeyV1('user-a', 23), JSON.stringify(v1Archive));

    const loaded = readHighlightArchive('user-a', 23);
    expect(loaded.failed).toBe(false);
    expect(loaded.archive?.schemaVersion).toBe(2);
    expect(loaded.archive?.documents[0].items[0].color).toBe('yellow');
    expect(loaded.archive?.documents[0].items[0].text).toBe('fake');
  });

  it('gives priority to schema 2 even if schema 2 has empty documents while schema 1 has items', () => {
    // Schema 1 has items
    localStorage.setItem(highlightArchiveKeyV1('user-a', 23), JSON.stringify(v1Archive));

    // Schema 2 exists and is empty
    const emptyV2: HighlightArchiveV2 = {
      schemaVersion: 2,
      ownerId: 'user-a',
      attemptId: 23,
      updatedAt: '2026-10-21T00:00:00.000Z',
      documents: [],
    };
    localStorage.setItem(highlightArchiveKeyV2('user-a', 23), JSON.stringify(emptyV2));

    const loaded = readHighlightArchive('user-a', 23);
    expect(loaded.failed).toBe(false);
    expect(loaded.archive?.schemaVersion).toBe(2);
    expect(loaded.archive?.documents).toEqual([]);
  });

  it('prunes expired archives belonging to current owner across both v1 and v2 keys', () => {
    const oldV1 = { ...v1Archive, updatedAt: '2026-01-01T00:00:00.000Z' };
    const oldV2 = { ...v2Archive, attemptId: 24, updatedAt: '2026-01-01T00:00:00.000Z' };
    localStorage.setItem(highlightArchiveKeyV1('user-a', 23), JSON.stringify(oldV1));
    localStorage.setItem(highlightArchiveKeyV2('user-a', 24), JSON.stringify(oldV2));

    // user-b archives should NOT be pruned
    localStorage.setItem(highlightArchiveKeyV2('user-b', 24), JSON.stringify(oldV2));

    expect(pruneExpiredHighlightArchives('user-a', Date.parse('2026-10-20T00:00:00.000Z'))).toBe(true);
    expect(localStorage.getItem(highlightArchiveKeyV1('user-a', 23))).toBeNull();
    expect(localStorage.getItem(highlightArchiveKeyV2('user-a', 24))).toBeNull();
    expect(localStorage.getItem(highlightArchiveKeyV2('user-b', 24))).not.toBeNull();
  });

  it('treats malformed and inaccessible storage as a recoverable failure', () => {
    localStorage.setItem(highlightArchiveKey('user-a', 23), '{broken');
    expect(readHighlightArchive('user-a', 23)).toEqual({ archive: null, failed: false });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readHighlightArchive('user-a', 23)).toEqual({ archive: null, failed: true });
  });

  it('RD04-R01: round-trips split cluster identities and colors without altering IDs', () => {
    const archiveWithSplitClusters: HighlightArchiveV2 = {
      schemaVersion: 2,
      ownerId: 'user-c',
      attemptId: 55,
      updatedAt: '2026-10-27T00:00:00.000Z',
      documents: [
        {
          partId: 1,
          documentId: 'doc-split',
          contentHash: 'hash-split',
          items: [
            { id: 'old', start: 0, end: 3, text: 'abc', color: 'yellow' },
            { id: 'blue', start: 3, end: 6, text: 'def', color: 'blue' },
            { id: 'old_r6', start: 6, end: 10, text: 'ghij', color: 'yellow' },
          ],
        },
      ],
    };

    expect(writeHighlightArchive(archiveWithSplitClusters)).toBe(true);
    const read = readHighlightArchive('user-c', 55);
    expect(read.failed).toBe(false);
    expect(read.archive?.documents[0].items).toEqual([
      { id: 'old', start: 0, end: 3, text: 'abc', color: 'yellow' },
      { id: 'blue', start: 3, end: 6, text: 'def', color: 'blue' },
      { id: 'old_r6', start: 6, end: 10, text: 'ghij', color: 'yellow' },
    ]);
  });
});
