package com.multilingo.backend.modules.vocab.mapper;

import com.multilingo.backend.modules.vocab.dto.response.PracticeQuestionSnapshotDto;
import com.multilingo.backend.modules.vocab.dto.response.PracticeWrongAnswerDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.NullValuePropertyMappingStrategy;


/**
 * MapStruct Mapper cho phân hệ Luyện tập trắc nghiệm từ vựng (Quiz Practice).
 */
@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface QuizPracticeMapper {

    /**
     * Tạo DTO chi tiết câu trả lời sai.
     */
    @Mapping(target = "questionId", source = "question.questionId")
    @Mapping(target = "cardId", source = "question.cardId")
    @Mapping(target = "word", source = "question.targetWord")
    @Mapping(target = "selectedOptionId", source = "selectedOptionId")
    @Mapping(target = "correctOptionId", source = "question.correctOptionId")
    @Mapping(target = "correctMeaning", source = "correctMeaning")
    PracticeWrongAnswerDto toWrongAnswerDto(
            PracticeQuestionSnapshotDto question,
            String selectedOptionId,
            String correctMeaning
    );

}
