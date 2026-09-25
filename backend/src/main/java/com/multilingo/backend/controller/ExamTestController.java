package com.multilingo.backend.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.dto.ExamPartDto;
import com.multilingo.backend.entity.ExamPart;
import com.multilingo.backend.repository.ExamPartRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/test")
@CrossOrigin(origins = "http://localhost:5173") // Cho phép React (Vite) gọi API
public class ExamTestController {

    @Autowired
    private ExamPartRepository examPartRepository;

    @PostMapping("/upload-audio")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveAudioExamPart(@RequestBody ExamPartDto dto) {
        // Tạo mới Entity từ DTO
        ExamPart examPart = ExamPart.builder()
                .sectionId(dto.getSectionId() != null ? dto.getSectionId() : 1)
                .partNumber(dto.getPartNumber() != null ? dto.getPartNumber() : 1)
                .contentData(dto.getContentData())
                .build();

        // Lưu vào Database PostgreSQL
        ExamPart savedPart = examPartRepository.save(examPart);

        // Trả về JSON chứa ID của bản ghi vừa lưu
        Map<String, Object> data = new HashMap<>();
        data.put("saved_id", savedPart.getId());
        data.put("content_data", savedPart.getContentData());

        return ResponseEntity.ok(ApiResponse.success("Lưu thành công dữ liệu JSONB có chứa Audio URL vào Database!", data));
    }

    @GetMapping("/latest-part")
    public ResponseEntity<ApiResponse<ExamPart>> getLatestExamPart() {
        // Lấy bản ghi cuối cùng (hoặc đầu tiên) trong DB để test
        return examPartRepository.findAll().stream()
                .reduce((first, second) -> second)
                .map(part -> ResponseEntity.ok(ApiResponse.success(part)))
                .orElse(ResponseEntity.notFound().build());
    }
}
