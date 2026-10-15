package com.multilingo.backend.modules.testing.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.dto.response.WritingFeedbackResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import com.multilingo.backend.modules.testing.service.WritingFeedbackService;
import com.multilingo.backend.modules.testing.service.support.WritingFeedbackMapper;
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class WritingFeedbackServiceImpl implements WritingFeedbackService {

    private final TestAttemptRepository testAttemptRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final WritingGradingJobRepository jobRepository;
    private final IdentityAdapter identityAdapter;
    private final WritingFeedbackMapper feedbackMapper;

    @Override
    @Transactional(readOnly = true)
    public WritingFeedbackResponse getWritingFeedback(Integer attemptId, Integer partId) {
        if (attemptId == null || attemptId <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "attemptId must be a positive integer");
        }
        if (partId == null || partId <= 0) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "partId must be a positive integer");
        }

        Integer currentUserId = identityAdapter.getCurrentUserId();

        // 1. Kiểm tra tồn tại và quyền sở hữu attempt (nếu không tồn tại hoặc không phải chủ sở hữu -> HTTP 403)
        Optional<TestAttempt> attemptOpt = testAttemptRepository.findById(attemptId);
        if (attemptOpt.isEmpty() || !Objects.equals(attemptOpt.get().getUserId(), currentUserId)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Attempt not found or access denied: " + attemptId);
        }

        TestAttempt attempt = attemptOpt.get();

        // 2. Kiểm tra trạng thái bài thi: nếu IN_PROGRESS -> HTTP 400 (tuyệt đối không lazy-finalize)
        if (attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Attempt is still in progress");
        }

        // 3. Kiểm tra snapshot đề thi
        if (attempt.getExamSnapshot() == null) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Attempt exam snapshot is missing");
        }

        List<AttemptResultScope.ScopedPart> scopedParts;
        try {
            scopedParts = AttemptResultScope.read(attempt.getExamSnapshot());
        } catch (Exception e) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Invalid attempt snapshot scope");
        }

        AttemptResultScope.ScopedPart targetScopedPart = scopedParts.stream()
                .filter(sp -> Objects.equals(sp.getPartId(), partId))
                .findFirst()
                .orElse(null);

        if (targetScopedPart == null) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Part not found in attempt snapshot: " + partId);
        }

        boolean hasEssay = targetScopedPart.getQuestions().stream()
                .anyMatch(q -> "ESSAY".equalsIgnoreCase(q.getType()));

        if (!hasEssay) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Part contains no essay questions: " + partId);
        }

        // 4. Đọc AttemptAnswer và WritingGradingJob
        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndPartId(attemptId, partId).orElse(null);
        List<WritingGradingJob> jobs = jobRepository.findAllByAttemptIdAndPartId(attemptId, partId);

        // 5. Ánh xạ sang WritingFeedbackResponse
        return feedbackMapper.mapFeedback(attempt, partId, targetScopedPart, answer, jobs);
    }
}
