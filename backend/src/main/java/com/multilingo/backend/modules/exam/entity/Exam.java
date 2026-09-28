package com.multilingo.backend.modules.exam.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "exams")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Exam extends BaseEntity {

    @Column(name = "code", length = 100, unique = true, nullable = false)
    private String code;

    @Column(name = "title", length = 255, nullable = false)
    private String title;

    @Column(name = "type", length = 50, nullable = false)
    private String type;

    @Builder.Default
    @Column(name = "exam_language", length = 10, nullable = false)
    private String examLanguage = "en";

    @Builder.Default
    @Column(name = "is_published", nullable = false)
    private Boolean isPublished = false;

    @Builder.Default
    @Column(name = "is_vip_only", nullable = false)
    private Boolean isVipOnly = false;

    @Builder.Default
    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes = 60;

    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;

    @Column(name = "created_by")
    private Integer createdBy;
}
