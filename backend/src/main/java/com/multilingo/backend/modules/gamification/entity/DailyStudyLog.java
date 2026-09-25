package com.multilingo.backend.modules.gamification.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "daily_study_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyStudyLog extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "study_date", nullable = false)
    private LocalDate studyDate;

    @Builder.Default
    @Column(name = "learning_minutes", nullable = false)
    private Integer learningMinutes = 0;

    @Builder.Default
    @Column(name = "flashcards_due", nullable = false)
    private Integer flashcardsDue = 0;

    @Builder.Default
    @Column(name = "flashcards_reviewed", nullable = false)
    private Integer flashcardsReviewed = 0;
}
