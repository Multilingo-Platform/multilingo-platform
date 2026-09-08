package com.multilingo.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ExamPartDto {
    private String sectionId;
    private Integer partNumber;
    private Object contentData; // Dữ liệu JSON gửi từ Frontend
}
