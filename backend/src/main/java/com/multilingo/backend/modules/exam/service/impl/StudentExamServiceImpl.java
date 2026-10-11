package com.multilingo.backend.modules.exam.service.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.exam.dto.response.StudentExamSummaryResponse;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.service.StudentExamService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentExamServiceImpl implements StudentExamService {

    private final ExamRepository examRepository;

    @Override
    public PageResponse<StudentExamSummaryResponse> searchExams(String title, List<String> types, int page, int size, String sortParam) {
        String searchTitle = title == null ? "" : title;
        boolean hasTypes = types != null && !types.isEmpty();
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        if ("popular".equals(sortParam)) {
            // we don't have a joins field in DB yet, so let's fallback to createdAt for now, or you could sort by id
            // wait, we can just keep it createdAt or sort by durationMinutes to simulate something different
            sort = Sort.by(Sort.Direction.DESC, "id");
        }
        PageRequest pageRequest = PageRequest.of(page, size, sort);
        
        Page<Exam> examPage = examRepository.findPublishedExams(searchTitle, types, hasTypes, pageRequest);
        
        List<StudentExamSummaryResponse> items = examPage.getContent().stream()
                .map(this::mapToSummaryResponse)
                .collect(Collectors.toList());
                
        return new PageResponse<>(items, examPage.getNumber(), examPage.getSize(), examPage.getTotalElements(), examPage.getTotalPages(), examPage.isLast());
    }

    private StudentExamSummaryResponse mapToSummaryResponse(Exam exam) {
        // Map type to level string
        String level = "N/A";
        if (exam.getType().startsWith("IELTS")) level = "Academic";
        if (exam.getType().startsWith("TOEIC")) level = "General";
        if (exam.getType().equals("NLTV_B1_C1")) level = "B1-C1";
        if (exam.getType().equals("NLTV_A1_A2")) level = "A1-A2";

        // Map type to tags (dummy for now)
        List<String> tags = new ArrayList<>();
        if (exam.getType().startsWith("IELTS")) {
            tags.add("Listening"); tags.add("Reading"); tags.add("Writing");
        } else if (exam.getType().startsWith("TOEIC")) {
            tags.add("Listening"); tags.add("Reading");
        } else if (exam.getType().startsWith("NLTV")) {
            tags.add("Nghe hiểu"); tags.add("Đọc hiểu"); tags.add("Viết");
        }

        return StudentExamSummaryResponse.builder()
                .id(exam.getId())
                .code(exam.getCode())
                .title(exam.getTitle())
                .type(exam.getType())
                .level(level)
                .durationMinutes(exam.getDurationMinutes())
                .joins(0) // Dummy joins
                .tags(tags)
                .thumbnailUrl(exam.getThumbnailUrl())
                .build();
    }
}
