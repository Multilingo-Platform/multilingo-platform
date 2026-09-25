package com.multilingo.backend.modules.vocab.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "user_flashcards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserFlashcard extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deck_id", nullable = false)
    private FlashcardDeck deck;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "word_id")
    private DictionaryWord word;

    @Column(name = "custom_word", length = 150, nullable = false)
    private String customWord;

    @Column(name = "custom_meaning", columnDefinition = "text", nullable = false)
    private String customMeaning;

    @Column(name = "example_sentence", columnDefinition = "text")
    private String exampleSentence;

    @Column(name = "custom_image_url", length = 500)
    private String customImageUrl;

    @Builder.Default
    @Column(name = "status", length = 30, nullable = false)
    private String status = "NEW";

    @Builder.Default
    @Column(name = "review_count", nullable = false)
    private Integer reviewCount = 0;

    @Builder.Default
    @Column(name = "ease_factor", precision = 4, scale = 2, nullable = false)
    private BigDecimal easeFactor = new BigDecimal("2.50");

    @Builder.Default
    @Column(name = "interval_days", nullable = false)
    private Integer intervalDays = 0;

    @Column(name = "next_review_date", nullable = false)
    private Instant nextReviewDate;
}
