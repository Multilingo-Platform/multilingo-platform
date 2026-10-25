package com.multilingo.backend.modules.exam.service.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.exam.dto.response.StudentExamSummaryResponse;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.service.StudentExamService;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class StudentExamServiceImpl implements StudentExamService {

    private final ExamRepository examRepository;
    private final LearningLanguageCatalog languageCatalog;
    private final TestAttemptRepository testAttemptRepository;

    public StudentExamServiceImpl(ExamRepository examRepository) {
        this(examRepository, new LearningLanguageCatalog(), null);
    }

    public StudentExamServiceImpl(ExamRepository examRepository, LearningLanguageCatalog languageCatalog) {
        this(examRepository, languageCatalog, null);
    }

    public StudentExamServiceImpl(ExamRepository examRepository, TestAttemptRepository testAttemptRepository) {
        this(examRepository, new LearningLanguageCatalog(), testAttemptRepository);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public StudentExamServiceImpl(ExamRepository examRepository, LearningLanguageCatalog languageCatalog, TestAttemptRepository testAttemptRepository) {
        this.examRepository = examRepository;
        this.languageCatalog = languageCatalog != null ? languageCatalog : new LearningLanguageCatalog();
        this.testAttemptRepository = testAttemptRepository;
    }

    @Override
    public PageResponse<StudentExamSummaryResponse> searchExams(String title, List<String> types, int page, int size, String sortParam) {
        return searchExams(title, types, page, size, sortParam, null);
    }

    @Override
    public PageResponse<StudentExamSummaryResponse> searchExams(String title, List<String> types, int page, int size, String sortParam, String examLanguage) {
        return searchExams(title, types, page, size, sortParam, examLanguage, null);
    }

    @Override
    public PageResponse<StudentExamSummaryResponse> searchExams(String title, List<String> types, int page, int size, String sortParam, String examLanguage, Integer userId) {
        String searchTitle = title == null ? "" : title;
        boolean hasTypes = types != null && !types.isEmpty();
        boolean hasLanguage = examLanguage != null && !examLanguage.isBlank();
        String languageBase = "";
        if (hasLanguage) {
            String normalized = languageCatalog.findNormalized(examLanguage)
                    .orElseThrow(() -> new AppException(ErrorCode.VALIDATION_FAILED, "Ngôn ngữ lọc không được hỗ trợ."));
            int separator = normalized.indexOf('-');
            languageBase = separator < 0 ? normalized : normalized.substring(0, separator);
        }
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        if ("popular".equals(sortParam)) {
            sort = Sort.by(Sort.Direction.DESC, "id");
        }
        PageRequest pageRequest = PageRequest.of(page, size, sort);
        
        Page<Exam> examPage;
        if (hasLanguage) {
            examPage = examRepository.findPublishedExamsByLanguage(searchTitle,
                    types, hasTypes, hasLanguage, languageBase, pageRequest);
        } else {
            examPage = examRepository.findPublishedExams(searchTitle, types, hasTypes, pageRequest);
        }
        Map<Integer, Long> attemptCountMap = getAttemptCountMap();
        Map<Integer, UserExamAttemptSummary> userAttemptMap = getUserAttemptMap(userId);
        
        List<StudentExamSummaryResponse> items = examPage.getContent().stream()
                .map(exam -> {
                    int joins = attemptCountMap.getOrDefault(exam.getId(), 0L).intValue();
                    UserExamAttemptSummary userSummary = userAttemptMap.get(exam.getId());
                    return mapToSummaryResponse(exam, joins, userSummary);
                })
                .collect(Collectors.toList());
                
        return new PageResponse<>(items, examPage.getNumber(), examPage.getSize(), examPage.getTotalElements(), examPage.getTotalPages(), examPage.isLast());
    }

    private StudentExamSummaryResponse mapToSummaryResponse(Exam exam, int joins, UserExamAttemptSummary userSummary) {
        // Map type to level string
        String level = "N/A";
        if (exam.getType().startsWith("IELTS")) level = "Academic";
        if (exam.getType().startsWith("TOEIC")) level = "General";
        if (exam.getType().equals("NLTV_B1_C1")) level = "B1-C1";
        if (exam.getType().equals("NLTV_A1_A2")) level = "A1-A2";
        if (exam.getType().equals("NLTV")) level = "Đa bậc";

        // Map type to tags
        List<String> tags = new ArrayList<>();
        if (exam.getType().startsWith("IELTS")) {
            tags.add("Listening"); tags.add("Reading"); tags.add("Writing");
        } else if (exam.getType().startsWith("TOEIC")) {
            tags.add("Listening"); tags.add("Reading");
        } else if (exam.getType().startsWith("NLTV")) {
            tags.add("Nghe hiểu"); tags.add("Đọc hiểu"); tags.add("Viết");
        } else if ("LANGUAGE_PRACTICE".equals(exam.getType())) {
            tags.add("Listening"); tags.add("Reading"); tags.add("Writing");
        }

        boolean isAttempted = userSummary != null && userSummary.attemptCount() > 0;
        Integer userAttemptsCount = userSummary != null ? userSummary.attemptCount() : 0;
        Double userHighestScore = userSummary != null ? userSummary.highestScore() : null;

        return StudentExamSummaryResponse.builder()
                .id(exam.getId())
                .code(exam.getCode())
                .title(exam.getTitle())
                .type(exam.getType())
                .examLanguage(exam.getExamLanguage())
                .level(level)
                .durationMinutes(exam.getDurationMinutes())
                .joins(joins)
                .tags(tags)
                .thumbnailUrl(exam.getThumbnailUrl())
                .isAttempted(isAttempted)
                .userAttemptsCount(userAttemptsCount)
                .userHighestScore(userHighestScore)
                .build();
    }

    private record UserExamAttemptSummary(int attemptCount, Double highestScore) {}

    private Map<Integer, UserExamAttemptSummary> getUserAttemptMap(Integer userId) {
        if (testAttemptRepository == null || userId == null) {
            return Collections.emptyMap();
        }
        List<Object[]> summaries = testAttemptRepository.findUserAttemptSummariesByUserId(userId);
        if (summaries == null || summaries.isEmpty()) {
            return Collections.emptyMap();
        }
        return summaries.stream()
                .filter(row -> row != null && row.length >= 2 && row[0] instanceof Integer)
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> {
                            int count = row[1] instanceof Number ? ((Number) row[1]).intValue() : 0;
                            Double maxScore = (row.length >= 3 && row[2] instanceof Number)
                                    ? ((Number) row[2]).doubleValue()
                                    : null;
                            return new UserExamAttemptSummary(count, maxScore);
                        },
                        (existing, replacement) -> existing
                ));
    }

    private Map<Integer, Long> getAttemptCountMap() {
        if (testAttemptRepository == null) {
            return Collections.emptyMap();
        }
        List<Object[]> counts = testAttemptRepository.countAttemptsGroupByExamId();
        if (counts == null || counts.isEmpty()) {
            return Collections.emptyMap();
        }
        return counts.stream()
                .filter(row -> row != null && row.length >= 2 && row[0] instanceof Integer && row[1] instanceof Number)
                .collect(Collectors.toMap(
                        row -> (Integer) row[0],
                        row -> ((Number) row[1]).longValue(),
                        (existing, replacement) -> existing
                ));
    }
}
