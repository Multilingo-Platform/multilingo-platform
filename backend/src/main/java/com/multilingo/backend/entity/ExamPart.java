package com.multilingo.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Entity
@Table(name = "exam_parts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamPart {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Tạm thời để sectionId dạng chuỗi cho test (Đáng lẽ phải là @ManyToOne)
    @Column(name = "section_id")
    private String sectionId;

    @Column(name = "part_number")
    private Integer partNumber;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content_data", columnDefinition = "jsonb")
    private Object contentData;
}
