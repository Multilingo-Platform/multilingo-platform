package com.multilingo.backend.modules.analytics.adapter.impl;

import com.multilingo.backend.modules.analytics.adapter.ExamCatalogAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.ExamSummaryInfo;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class DbExamCatalogAdapter implements ExamCatalogAdapter {

    private final ExamRepository examRepository;

    @Override
    @Transactional(readOnly = true)
    public List<ExamSummaryInfo> findAllExams() {
        if (examRepository == null) {
            return Collections.emptyList();
        }
        return examRepository.findAll().stream()
                .map(e -> ExamSummaryInfo.builder()
                        .id(e.getId())
                        .title(e.getTitle())
                        .code(e.getCode())
                        .type(e.getType())
                        .isPublished(e.getIsPublished())
                        .build())
                .collect(Collectors.toList());
    }
}
