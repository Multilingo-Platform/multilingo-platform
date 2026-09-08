package com.multilingo.backend.controller;

import com.multilingo.backend.dto.ExamPartDto;
import com.multilingo.backend.entity.ExamPart;
import com.multilingo.backend.repository.ExamPartRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/test")
@CrossOrigin(origins = "http://localhost:5173") // Cho phép React (Vite) gọi API
public class ExamTestController {

    @Autowired
    private ExamPartRepository examPartRepository;

    @PostMapping("/upload-audio")
    public ResponseEntity<?> saveAudioExamPart(@RequestBody ExamPartDto dto) {
        // Tạo mới Entity từ DTO
        ExamPart examPart = ExamPart.builder()
                .sectionId(dto.getSectionId() != null ? dto.getSectionId() : UUID.randomUUID().toString())
                .partNumber(dto.getPartNumber() != null ? dto.getPartNumber() : 1)
                .contentData(dto.getContentData())
                .build();

        // Lưu vào Database PostgreSQL
        ExamPart savedPart = examPartRepository.save(examPart);

        // Trả về JSON chứa ID của bản ghi vừa lưu
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Lưu thành công dữ liệu JSONB có chứa Audio URL vào Database!");
        response.put("saved_id", savedPart.getId());
        response.put("content_data", savedPart.getContentData());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/latest-part")
    public ResponseEntity<?> getLatestExamPart() {
        // Lấy bản ghi cuối cùng (hoặc đầu tiên) trong DB để test
        return examPartRepository.findAll().stream()
                .reduce((first, second) -> second) // Lấy phần tử cuối cùng (mới nhất)
                .map(part -> ResponseEntity.ok(part))
                .orElse(ResponseEntity.notFound().build());
    }
}
