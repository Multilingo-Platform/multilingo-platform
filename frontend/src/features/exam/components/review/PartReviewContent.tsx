import React, { useState, useRef, useEffect } from 'react';
import type {
  ExamReviewResponse,
  ReviewQuestionDto,
  ReviewQuestionGroupDto,
  ResultSummary,
} from '../../types/api.types';
import HtmlContent from '../content/HtmlContent';
import { QuestionReviewCard } from './QuestionReviewCard';
import {
  filterReviewQuestions,
  formatScore,
  type ReviewFilter,
} from '../../utils/reviewPresentation';

function extractAudioUrl(media: unknown): string | null {
  if (!media) return null;
  if (typeof media === 'string' && media.trim().length > 0) return media.trim();
  if (typeof media === 'object' && media !== null) {
    const rec = media as Record<string, unknown>;
    const url = rec.url ?? rec.audioUrl ?? rec.src ?? rec.audio_url;
    if (typeof url === 'string' && url.trim().length > 0) {
      return url.trim();
    }
  }
  return null;
}

function extractPartStimulus(examData: unknown): string | null {
  if (!examData || typeof examData !== 'object') return null;
  const rec = examData as Record<string, unknown>;
  const content =
    rec.contentHtml ??
    rec.content_html ??
    rec.passageHtml ??
    rec.passage_html ??
    rec.passage ??
    rec.description ??
    rec.stimulus;
  if (typeof content === 'string' && content.trim().length > 0) {
    return content.trim();
  }
  return null;
}

export interface PartReviewContentProps {
  reviewData: ExamReviewResponse;
  resultSummary?: ResultSummary | null;
  selectedQuestionId?: string | number | null;
  onSelectQuestion?: (questionId: any) => void;
  activeFilter?: ReviewFilter;
  onFilterChange?: (filter: ReviewFilter) => void;
}

export const PartReviewContent: React.FC<PartReviewContentProps> = ({
  reviewData,
  resultSummary,
  selectedQuestionId,
  activeFilter: externalFilter,
  onFilterChange: externalOnFilterChange,
}) => {
  const [internalFilter, setInternalFilter] = useState<ReviewFilter>('ALL');
  const currentFilter = externalFilter ?? internalFilter;
  const setFilter = externalOnFilterChange ?? setInternalFilter;

  const containerRef = useRef<HTMLDivElement>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  audioElementsRef.current = [];

  const registerAudio = (el: HTMLAudioElement | null) => {
    if (el && !audioElementsRef.current.includes(el)) {
      audioElementsRef.current.push(el);
    }
  };

  // Stop & cleanup audio and embedded media when partId changes or on unmount (AC-07)
  useEffect(() => {
    const containerEl = containerRef.current;
    return () => {
      audioElementsRef.current.forEach((el) => {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {}
      });
      audioElementsRef.current = [];

      if (containerEl) {
        const mediaElements = containerEl.querySelectorAll<HTMLMediaElement>('audio, video');
        mediaElements.forEach((el) => {
          try {
            el.pause();
            el.currentTime = 0;
          } catch {}
        });
      }
    };
  }, [reviewData.partId]);

  const allQuestions: ReviewQuestionDto[] = reviewData.questions || [];
  const filteredQuestions = filterReviewQuestions(allQuestions, currentFilter);
  const partStats = reviewData.partStats;
  const groups: ReviewQuestionGroupDto[] = reviewData.questionGroups || [];
  const partTitle =
    reviewData.partTitle || reviewData.examData?.title || `Part ${reviewData.partId}`;

  // Part-level stimulus / passage
  const partStimulusHtml = extractPartStimulus(reviewData.examData);

  // Audio URL from part or shared media
  const partAudioUrl =
    extractAudioUrl(reviewData.examData?.sharedAudio) ||
    extractAudioUrl(reviewData.examData?.shared_audio) ||
    extractAudioUrl(reviewData.examData?.sharedMedia) ||
    extractAudioUrl(reviewData.examData?.shared_media) ||
    extractAudioUrl(reviewData.examData?.audioUrl) ||
    extractAudioUrl(reviewData.examData?.audio_url) ||
    extractAudioUrl(reviewData.examData?.media) ||
    extractAudioUrl((reviewData as any).audioUrl) ||
    extractAudioUrl((reviewData as any).sharedAudio) ||
    extractAudioUrl((reviewData as any).media);

  return (
    <div ref={containerRef} className="space-y-6" role="region" aria-label={`Nội dung ôn tập ${partTitle}`}>
      {/* Part Statistics and Filter Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {reviewData.skill || 'Ôn tập'}
              </span>
              <span className="text-xs text-slate-500 font-medium">Part {reviewData.partId}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{partTitle}</h2>
          </div>

          {/* Quick Accuracy & Score Badges */}
          {partStats && (
            <div className="flex items-center gap-3">
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center min-w-[80px]">
                <div className="text-xs text-slate-500 font-medium">Độ chính xác</div>
                <div className="text-lg font-bold text-slate-900">{partStats.accuracy}%</div>
              </div>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center min-w-[80px]">
                <div className="text-xs text-slate-500 font-medium">Số câu đúng</div>
                <div className="text-lg font-bold text-green-700">
                  {partStats.correctCount} / {partStats.totalQuestions}
                </div>
              </div>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center min-w-[80px]">
                <div className="text-xs text-slate-500 font-medium">Điểm số</div>
                <div className="text-lg font-bold text-slate-900">{formatScore(partStats.score)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span className="text-slate-500 mr-1">Bộ lọc:</span>
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                currentFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tất cả ({allQuestions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('WRONG')}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                currentFilter === 'WRONG'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-red-50 text-red-800 hover:bg-red-100'
              }`}
            >
              Câu sai ({partStats?.incorrectCount ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setFilter('BLANK')}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                currentFilter === 'BLANK'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Chưa làm ({partStats?.unansweredCount ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setFilter('CORRECT')}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                currentFilter === 'CORRECT'
                  ? 'bg-green-700 text-white shadow-xs'
                  : 'bg-green-50 text-green-800 hover:bg-green-100'
              }`}
            >
              Câu đúng ({partStats?.correctCount ?? 0})
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Đang hiển thị {filteredQuestions.length} câu hỏi
          </div>
        </div>
      </div>

      {/* Part-level Stimulus / Passage if present */}
      {partStimulusHtml && (
        <div
          className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs"
          data-testid="part-stimulus"
        >
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Nội dung bài đọc (Passage)
          </div>
          <div className="text-slate-800 text-sm leading-relaxed prose max-w-none">
            <HtmlContent html={partStimulusHtml} />
          </div>
        </div>
      )}

      {/* Part Audio Stimulus if present (Never autoplay - AC-07) */}
      {partAudioUrl && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs" data-testid="part-audio">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            File nghe (Audio)
          </div>
          <audio
            ref={registerAudio}
            src={partAudioUrl}
            controls
            preload="none"
            autoPlay={false}
            className="w-full h-10"
          >
            Trình duyệt của bạn không hỗ trợ phát âm thanh.
          </audio>
        </div>
      )}

      {/* Questions list */}
      {allQuestions.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
          Không có câu hỏi trong phần thi này.
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
          Không có câu hỏi phù hợp với bộ lọc hiện tại.
        </div>
      ) : groups.length > 0 ? (
        /* Group-based rendering */
        <div className="space-y-6">
          {groups.map((group, gIdx) => {
            const groupAudioUrl =
              extractAudioUrl(group.sharedAudio) ||
              extractAudioUrl(group.sharedMedia) ||
              extractAudioUrl((group as any).media) ||
              extractAudioUrl((group as any).audioUrl);

            // Find questions belonging to this group
            const groupQuestions = filteredQuestions.filter((q) => {
              if (Array.isArray(group.questions)) {
                return group.questions.some((gq) => String(gq.questionId) === String(q.questionId));
              }
              return false;
            });

            if (groupQuestions.length === 0 && currentFilter !== 'ALL') {
              return null;
            }

            return (
              <div
                key={group.groupId || gIdx}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-4"
              >
                {/* Group instruction */}
                {group.instruction && (
                  <div className="text-sm font-semibold text-slate-800 bg-amber-50/60 p-3 rounded-md border border-amber-200/50">
                    {group.instruction}
                  </div>
                )}

                {/* Group Audio if present (Never autoplay - AC-07) */}
                {groupAudioUrl && (
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200" data-testid="group-audio">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      File nghe phần thi (Audio)
                    </div>
                    <audio
                      ref={registerAudio}
                      src={groupAudioUrl}
                      controls
                      preload="none"
                      autoPlay={false}
                      className="w-full h-10"
                    >
                      Trình duyệt của bạn không hỗ trợ phát âm thanh.
                    </audio>
                  </div>
                )}

                {/* Group contentHtml sanitized */}
                {group.contentHtml && (
                  <div className="p-4 bg-slate-50 rounded-md border border-slate-200 text-slate-800 text-sm">
                    <HtmlContent html={group.contentHtml} />
                  </div>
                )}

                {/* Questions in group */}
                <div className="space-y-4 pt-2">
                  {groupQuestions.map((q, qIdx) => (
                    <QuestionReviewCard
                      key={q.questionId}
                      question={q}
                      partId={reviewData.partId}
                      resultSummary={resultSummary}
                      index={qIdx}
                      isSelected={
                        selectedQuestionId !== null &&
                        selectedQuestionId !== undefined &&
                        String(selectedQuestionId) === String(q.questionId)
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Any questions not in groups */}
          {(() => {
            const groupedIds = new Set(
              groups.flatMap((g) => (g.questions || []).map((q) => String(q.questionId)))
            );
            const ungrouped = filteredQuestions.filter((q) => !groupedIds.has(String(q.questionId)));
            if (ungrouped.length === 0) return null;

            return (
              <div className="space-y-4">
                {ungrouped.map((q, idx) => (
                  <QuestionReviewCard
                    key={q.questionId}
                    question={q}
                    partId={reviewData.partId}
                    resultSummary={resultSummary}
                    index={idx}
                    isSelected={
                      selectedQuestionId !== null &&
                      selectedQuestionId !== undefined &&
                      String(selectedQuestionId) === String(q.questionId)
                    }
                  />
                ))}
              </div>
            );
          })()}
        </div>
      ) : (
        /* Flat question list when no groups */
        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => (
            <QuestionReviewCard
              key={q.questionId}
              question={q}
              partId={reviewData.partId}
              resultSummary={resultSummary}
              index={idx}
              isSelected={
                selectedQuestionId !== null &&
                selectedQuestionId !== undefined &&
                String(selectedQuestionId) === String(q.questionId)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
