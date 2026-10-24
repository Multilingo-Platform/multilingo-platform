import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React, { useState } from 'react';
import type { QuestionGroup, Question, SharedMedia, SharedAudio } from '../../types/exam.types';
import HtmlContent from '../content/HtmlContent';
import AudioPlayer from '../AudioPlayer';

export interface WritingPromptContentProps {
  partTitle: string;
  partInstruction?: string | null;
  partSharedAudio?: SharedAudio | null;
  partSharedMedia?: SharedMedia | null;
  groups?: QuestionGroup[];
  questions?: Question[];
}

export function normalizePromptText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>?/gm, ' ')
    .toLowerCase()
    .replace(/^(?:writing\s+)?(?:task|bài|phần|câu|question)\s+\d+[:.\s-]*/gi, '')
    .replace(/[^\w\s\u00C0-\u024F\u1EA0-\u1EF9]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
}

const PromptImage: React.FC<{ media: SharedMedia; alt: string }> = ({ media, alt }) => {
  useExamLocale();
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        role="alert"
        className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg my-3"
      >
        {em("Không tải được hình minh họa đề bài")}</div>
    );
  }

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-slate-200 bg-white p-2 flex justify-center shadow-2xs">
      <img
        src={media.url}
        alt={alt}
        onError={() => setHasError(true)}
        className="w-full max-w-full h-auto max-h-[55vh] object-contain"
      />
    </div>
  );
};

export const WritingPromptContent: React.FC<WritingPromptContentProps> = ({
  partTitle,
  partInstruction,
  partSharedAudio,
  partSharedMedia,
  groups = [],
  questions = [],
}) => {
  useExamLocale();
  const seenMediaUrls = new Set<string>();
  const seenPromptTexts = new Set<string>();

  // Determine if any group already provides an instruction covering partInstruction
  const hasGroupInstruction = groups.some(g => Boolean(g.instruction?.trim()));
  const firstGroupInstruction = groups[0]?.instruction?.trim() || '';
  const partInst = partInstruction?.trim() || null;

  // Only render part-level instruction at top if groups do NOT provide instruction,
  // or if partInstruction is completely different from the group instruction
  const showTopPartInstruction = Boolean(
    partInst &&
    (!hasGroupInstruction ||
      (!firstGroupInstruction.toLowerCase().includes(partInst.toLowerCase()) &&
       !partInst.toLowerCase().includes(firstGroupInstruction.toLowerCase())))
  );

  return (
    <div data-testid="writing-prompt-content" className="space-y-6">
      {/* 1. Header & Primary Instruction */}
      <div className="space-y-3">
        <h2 className="font-heading text-xl font-bold text-slate-900 tracking-tight">
          {partTitle}
        </h2>
        {showTopPartInstruction && (
          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 text-slate-700 text-sm leading-relaxed">
            {partInst}
          </div>
        )}
      </div>

      {/* Part-level shared audio */}
      {partSharedAudio?.url && (
        <AudioPlayer url={partSharedAudio.url} isActive={true} />
      )}

      {/* Part-level shared media */}
      {partSharedMedia?.url && !seenMediaUrls.has(partSharedMedia.url) && (() => {
        seenMediaUrls.add(partSharedMedia.url);
        return <PromptImage media={partSharedMedia} alt={em("Hình minh họa {{v0}}", { v0: partTitle })} />;
      })()}

      {/* 2. Question Groups */}
      {groups.length > 0 ? (
        groups.map((group, groupIndex) => {
          const groupInstruction = group.instruction?.trim() || null;
          const groupHtml = (group.context_html || (group as any).content_html)?.trim() || null;
          const groupNormText = groupHtml ? normalizePromptText(groupHtml) : '';

          if (groupNormText) {
            seenPromptTexts.add(groupNormText);
          }

          const isInstructionDuplicateOfHtml = Boolean(
            groupInstruction &&
            groupNormText &&
            normalizePromptText(groupInstruction) === groupNormText
          );

          const showGroupInstruction = Boolean(
            groupInstruction &&
              !isInstructionDuplicateOfHtml &&
              (!showTopPartInstruction || groupInstruction.toLowerCase() !== (partInst || '').toLowerCase())
          );

          // Collect questions in this group
          const groupQuestions = group.questions && group.questions.length > 0
            ? group.questions
            : questions;

          return (
            <div
              key={group.group_id || `group-${groupIndex}`}
              data-testid={`writing-prompt-group-${group.group_id || groupIndex}`}
              className="space-y-4"
            >
              {showGroupInstruction && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium">
                  {groupInstruction}
                </div>
              )}

              {/* Group Shared Audio */}
              {group.shared_audio?.url && (
                <AudioPlayer url={group.shared_audio.url} isActive={true} />
              )}

              {/* Group Shared Media */}
              {group.shared_media?.url && !seenMediaUrls.has(group.shared_media.url) && (() => {
                seenMediaUrls.add(group.shared_media.url);
                return (
                  <PromptImage
                    media={group.shared_media}
                    alt={em("Hình minh họa {{v0}} {{v1}}", { v0: partTitle, v1: group.group_id || '' })}
                  />
                );
              })()}

              {/* Group HTML Content */}
              {groupHtml && (
                <HtmlContent
                  html={groupHtml}
                  className="prose prose-slate max-w-none text-slate-800 font-medium text-[15px] leading-relaxed"
                />
              )}

              {/* Question items content */}
              {groupQuestions.map((q) => {
                const questionMedia = q.media;
                const questionText = q.question_text?.trim();
                const questionNormText = questionText ? normalizePromptText(questionText) : '';

                // Deduplicate: If question text matches group HTML or is redundant, don't repeat it
                const isDuplicateOfGroupHtml =
                  !questionText ||
                  questionNormText.length === 0 ||
                  (Boolean(groupNormText) &&
                    (groupNormText === questionNormText ||
                      groupNormText.includes(questionNormText) ||
                      questionNormText.includes(groupNormText) ||
                      (groupNormText.length >= 40 &&
                        questionNormText.length >= 40 &&
                        (groupNormText.startsWith(questionNormText.slice(0, 40)) ||
                          questionNormText.startsWith(groupNormText.slice(0, 40))))));

                const isAlreadySeen = Boolean(questionNormText && seenPromptTexts.has(questionNormText));
                const shouldRenderQuestionText = Boolean(questionText && !isDuplicateOfGroupHtml && !isAlreadySeen);

                if (shouldRenderQuestionText && questionNormText) {
                  seenPromptTexts.add(questionNormText);
                }

                return (
                  <div key={q.question_id || q.questionId} className="space-y-4">
                    {questionMedia?.url && !seenMediaUrls.has(questionMedia.url) && (() => {
                      seenMediaUrls.add(questionMedia.url);
                      return (
                        <PromptImage
                          media={questionMedia}
                          alt={em("Hình minh họa câu hỏi {{v0}}", { v0: q.question_number || '' })}
                        />
                      );
                    })()}

                    {shouldRenderQuestionText && (
                      <div className="prose prose-slate max-w-none text-slate-800 font-medium whitespace-pre-wrap text-[15px] leading-relaxed">
                        {questionText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      ) : (
        // Fallback when no groups exist: render questions directly
        questions.map((q) => {
          const questionText = q.question_text?.trim();
          const questionNormText = questionText ? normalizePromptText(questionText) : '';
          const isAlreadySeen = Boolean(questionNormText && seenPromptTexts.has(questionNormText));
          const shouldRender = Boolean(questionText && questionNormText.length > 0 && !isAlreadySeen);

          if (shouldRender && questionNormText) {
            seenPromptTexts.add(questionNormText);
          }

          return (
            <div key={q.question_id || q.questionId} className="space-y-4">
              {q.media?.url && !seenMediaUrls.has(q.media.url) && (() => {
                seenMediaUrls.add(q.media.url);
                return (
                  <PromptImage
                    media={q.media}
                    alt={em("Hình minh họa câu hỏi {{v0}}", { v0: q.question_number || '' })}
                  />
                );
              })()}
              {shouldRender && (
                <div className="prose prose-slate max-w-none text-slate-800 font-medium whitespace-pre-wrap text-[15px] leading-relaxed">
                  {questionText}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default WritingPromptContent;
