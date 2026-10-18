import React from 'react';
import HtmlContent from '../content/HtmlContent';
import MediaDisplay from '../content/MediaDisplay';
import type { SharedMedia } from '../../types/exam.types';

export interface ReferenceDoc {
  /** Stable document id (question group id, or `part` for a whole-part reference). */
  groupId: string;
  instruction: string | null;
  /** Highlight-applied HTML for this document, or null when the source provides none. */
  html: string | null;
  /** Source images (shared media) that belong to this document. */
  mediaUrls: string[];
}

export interface ReferencePaneProps {
  docs: ReferenceDoc[];
  className?: string;
}

function asImage(url: string): SharedMedia {
  return { type: 'image', url, display_config: { size_preset: 'large' } };
}

/**
 * Left reading reference: one block per source document, in server order. Text is rendered through
 * the shared sanitizer with embedded media stripped, so a reference can never mount a native player
 * or frame; images stay visible. Each document is wrapped with `data-highlight-scope` so a
 * selection (and its text offsets) is always attributed to exactly one document.
 */
const ReferencePane: React.FC<ReferencePaneProps> = ({ docs, className }) => {
  if (docs.length === 0) return null;

  return (
    <div data-testid="toeic-reference-pane" className={className ?? 'space-y-6'}>
      {docs.map((doc, index) => {
        const label = doc.instruction ?? `Tài liệu ${index + 1}`;
        return (
          <section
            key={doc.groupId}
            data-testid={`toeic-reference-group-${doc.groupId}`}
            aria-label={label}
            className="space-y-3"
          >
            {doc.instruction && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
                {doc.instruction}
              </div>
            )}

            {doc.mediaUrls.map((url, mediaIndex) => (
              <div
                key={`${doc.groupId}-media-${mediaIndex}`}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <MediaDisplay
                  media={asImage(url)}
                  alt={`Tài liệu ${index + 1} hình ${mediaIndex + 1}`}
                />
              </div>
            ))}

            {doc.html && (
              // Offset base for highlights: contains exactly this document's rendered text.
              <div data-highlight-scope={doc.groupId}>
                <HtmlContent
                  html={doc.html}
                  stripMedia
                  className="prose prose-slate max-w-none [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-bold [&_p]:mb-4 [&_p]:leading-relaxed [&_strong]:text-amber-700 [&_table]:w-full [&_table]:overflow-x-auto"
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default ReferencePane;
