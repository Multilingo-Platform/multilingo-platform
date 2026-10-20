import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PartReviewContent } from '../components/review/PartReviewContent';
import { attemptReviewFixture } from './fixtures/attemptReview';
import answerReducer from '../store/answerSlice';
import { prepareReadingDocument } from '../utils/readingHighlightDocument';
import { highlightArchiveKey } from '../utils/highlightStorage';

describe('Reading highlight review', () => {
  it('renders matching local archive as read-only only after valid review data is present', () => {
    const ownerId = 'review-owner';
    const attemptId = 42;
    const partId = 10;
    const passage = '<p>Historical review passage text.</p>';
    const prepared = prepareReadingDocument(passage, { partId, documentId: 'part' });
    const originalStorage = 'sentinel';
    localStorage.setItem('unrelated', originalStorage);
    localStorage.setItem(highlightArchiveKey(ownerId, attemptId), JSON.stringify({
      schemaVersion: 1, ownerId, attemptId, updatedAt: new Date().toISOString(),
      documents: [{ partId, documentId: 'part', contentHash: prepared.contentHash, items: [{ id: 'saved-hl', start: 0, end: 10, text: 'wrong' }] }],
    }));
    const fixture = {
      ...attemptReviewFixture(attemptId, partId),
      skill: 'READING',
      examData: { title: 'Reading Part', contentHtml: passage },
    };
    const store = configureStore({
      reducer: {
        auth: (state = { user: { id: ownerId } }, _action) => state,
        answers: answerReducer,
      },
    });

    render(<Provider store={store}><PartReviewContent reviewData={fixture as any} ownerId={ownerId} /></Provider>);

    expect(document.querySelector('mark[data-hl-id="saved-hl"]')?.textContent).toBe('Historical');
    expect(screen.queryByRole('button', { name: /xóa highlight|highlight/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('unrelated')).toBe(originalStorage);
  });

  it('ignores an archive with a different passage hash', () => {
    const ownerId = 'review-owner';
    const attemptId = 43;
    const partId = 10;
    const fixture = {
      ...attemptReviewFixture(attemptId, partId),
      skill: 'READING',
      examData: { title: 'Reading Part', contentHtml: '<p>Changed passage content.</p>' },
    };
    localStorage.setItem(highlightArchiveKey(ownerId, attemptId), JSON.stringify({
      schemaVersion: 1, ownerId, attemptId, updatedAt: new Date().toISOString(),
      documents: [{ partId, documentId: 'part', contentHash: 'old-hash', items: [{ id: 'old', start: 0, end: 7, text: 'changed' }] }],
    }));
    const store = configureStore({ reducer: { auth: (state = { user: { id: ownerId } }) => state, answers: answerReducer } });
    render(<Provider store={store}><PartReviewContent reviewData={fixture as any} ownerId={ownerId} /></Provider>);
    const passageElement = screen.getByTestId('review-reading-passage');
    expect(passageElement.querySelector('mark')).toBeNull();
  });
});
