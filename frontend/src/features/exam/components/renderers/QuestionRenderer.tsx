import React from 'react';
import type { Question } from '../../types/exam.types';
import type { AnswerValue } from '../../types/answer.types';
import SingleChoiceRenderer from './SingleChoiceRenderer';
import TFNGRenderer from './TFNGRenderer';
import MultipleChoiceRenderer from './MultipleChoiceRenderer';
import FillInBlankRenderer from './FillInBlankRenderer';
import MatchingRenderer from './MatchingRenderer';
import EssayRenderer from './EssayRenderer';
import MapLabelingRenderer from './MapLabelingRenderer';
import DiagramLabelingRenderer from './DiagramLabelingRenderer';

interface QuestionRendererProps {
  question: Question;
  partId: number;
  currentAnswer: AnswerValue;
  onChange: (value: AnswerValue) => void;
  minWords?: number;
}

const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question, currentAnswer, onChange, minWords,
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
      return (
        <MultipleChoiceRenderer
          options={options ?? []}
          value={(currentAnswer as string[] | null) ?? []}
          onChange={onChange}
        />
      );

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
      return (
        <MatchingRenderer
          options={options ?? []}
          value={currentAnswer as string | null}
          onChange={onChange}
          questionText={question_text}
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
        />
      );

    case 'MAP_LABELING':
      return (
        <MapLabelingRenderer
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
