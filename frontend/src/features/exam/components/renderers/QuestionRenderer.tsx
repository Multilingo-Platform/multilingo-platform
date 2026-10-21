import React from 'react';
import type { Question, ExamOption } from '../../types/exam.types';
import type { AnswerValue } from '../../types/answer.types';
import SingleChoiceRenderer from './SingleChoiceRenderer';
import TFNGRenderer from './TFNGRenderer';
import MultipleChoiceRenderer from './MultipleChoiceRenderer';
import FillInBlankRenderer from './FillInBlankRenderer';
import MatchingRenderer from './MatchingRenderer';
import EssayRenderer from './EssayRenderer';
import MapLabelingRenderer from './MapLabelingRenderer';
import DiagramLabelingRenderer from './DiagramLabelingRenderer';
import MatchingInformationRenderer from './MatchingInformationRenderer';

interface QuestionRendererProps {
  question: Question;
  partId: number;
  currentAnswer: AnswerValue;
  onChange: (value: AnswerValue) => void;
  minWords?: number;
  learningLanguage?: string | null;
  showPrompt?: boolean;
}

const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question, currentAnswer, onChange, minWords, learningLanguage, showPrompt = true,
}) => {
  const { type, question_text, options, media } = question;

  switch (type) {
    case 'SINGLE_CHOICE':
      return (
        <SingleChoiceRenderer
          options={options ?? []}
          value={currentAnswer as string | null}
          onChange={onChange}
          questionId={question.question_id}
        />
      );

    case 'TRUE_FALSE_NOT_GIVEN':
    case 'YES_NO_NOT_GIVEN':
      return (
        <TFNGRenderer
          variant={type}
          value={currentAnswer as string | null}
          onChange={onChange}
        />
      );

    case 'MULTIPLE_CHOICE':
    case 'MULTIPLE_CHOICE_MULTI': {
      const normalizedOptions: ExamOption[] = (options ?? []).map((opt: any, idx: number) => {
        if (typeof opt === 'string') {
          return { id: String.fromCharCode(65 + idx), text: opt };
        }
        return opt;
      });
      return (
        <MultipleChoiceRenderer
          options={normalizedOptions}
          value={(currentAnswer as string[] | null) ?? []}
          onChange={onChange}
          maxSelections={type === 'MULTIPLE_CHOICE_MULTI' ? 2 : undefined}
        />
      );
    }

    case 'FILL_IN_THE_BLANK':
      return (
        <FillInBlankRenderer
          value={currentAnswer as string | null}
          onChange={onChange}
          questionText={question_text}
        />
      );

    case 'MATCHING_FEATURES':
    case 'MATCHING_HEADINGS':
    case 'MATCHING_SENTENCE_ENDINGS':
      return (
        <MatchingRenderer
          options={options ?? []}
          value={currentAnswer as string | null}
          onChange={onChange}
          questionText={question_text}
        />
      );

    case 'MATCHING_INFORMATION':
      return (
        <MatchingInformationRenderer
          options={options ?? []}
          value={currentAnswer as string | null}
          onChange={onChange}
        />
      );

    case 'ESSAY':
      return (
        <EssayRenderer
          value={currentAnswer as string | null}
          onChange={onChange}
          questionText={question_text}
          media={media}
          minWords={minWords}
          learningLanguage={learningLanguage}
          showPrompt={showPrompt}
        />
      );

    case 'MAP_LABELING':
      return (
        <MapLabelingRenderer
          questionId={question.question_id}
          options={options ?? []}
          value={currentAnswer as string | null}
          onChange={onChange}
          media={media}
        />
      );

    case 'DIAGRAM_LABELING':
      return (
        <DiagramLabelingRenderer
          value={currentAnswer as string | null}
          onChange={onChange}
        />
      );

    default:
      return (
        <div role="note" style={{ color: '#999', fontStyle: 'italic' }}>
          Dạng câu hỏi chưa được hỗ trợ: {type}
        </div>
      );
  }
};

export default QuestionRenderer;
