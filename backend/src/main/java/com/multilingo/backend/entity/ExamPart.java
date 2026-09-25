package com.multilingo.backend.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "exam_parts")
@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamPart extends BaseEntity {

    @Column(name = "section_id")
    private Integer sectionId;

    @Column(name = "part_number")
    private Integer partNumber;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content_data", columnDefinition = "jsonb")
    private Object contentData;
}
