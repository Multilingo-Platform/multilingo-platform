package com.multilingo.backend.modules.exam.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;

@Entity
@Table(name = "exam_parts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamPart extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id", nullable = false)
    private ExamSection section;

    @Builder.Default
    @Column(name = "part_number", nullable = false)
    private Integer partNumber = 1;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content_data", nullable = false)
    private Map<String, Object> contentData;
}
