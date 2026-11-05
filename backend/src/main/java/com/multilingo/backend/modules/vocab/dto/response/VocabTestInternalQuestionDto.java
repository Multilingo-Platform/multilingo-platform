package com.multilingo.backend.modules.vocab.dto.response;

import lombok.*;

import java.util.List;

/**
 * Snapshot nội bộ của một câu hỏi trong bài thi thử (Vocab Mock Test).
 * Lưu trữ trong cột questions_snapshot (JSONB) gồm cả đáp án đúng và lời giải thích.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabTestInternalQuestionDto {

    private Integer questionNumber;

    private Integer cardId;

    private String word;

    private String phonetic;

    private String pos;

    private String sentence;

    private List<VocabTestOptionDto> options;

    private String correctKey;

    private String explanation;
}

