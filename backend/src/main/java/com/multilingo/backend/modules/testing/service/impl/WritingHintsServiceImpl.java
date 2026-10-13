package com.multilingo.backend.modules.testing.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.ai.hints.WritingHintGenerator;
import com.multilingo.backend.modules.testing.dto.request.WritingHintsRequest;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import com.multilingo.backend.modules.testing.service.WritingHintsService;
import com.multilingo.backend.modules.testing.service.support.WritingHintTransactionCoordinator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Triển khai WritingHintsService: điều phối ba pha xử lý:
 * Pha 1: Transaction ngắn (begin) kiểm tra guards, quota reservation và ghi PENDING.
 * Pha 2: Gọi Gemini hoàn toàn NGOÀI transaction database.
 * Pha 3: Transaction ngắn (complete hoặc fail) recheck attempt, run fencing, lưu kết quả hoặc hoàn quota.
 */
@Service
@RequiredArgsConstructor
public class WritingHintsServiceImpl implements WritingHintsService {

    private final WritingHintTransactionCoordinator coordinator;
    private final WritingHintGenerator hintGenerator;
    private final IdentityAdapter identityAdapter;

    @Override
    public WritingHintsResponse generate(Integer attemptId, WritingHintsRequest request) {
        Integer userId = identityAdapter.getCurrentUserId();
        return generate(userId, attemptId, request);
    }

    @Override
    public WritingHintsResponse generate(Integer userId, Integer attemptId, WritingHintsRequest request) {
        // Pha 1: Transaction ngắn kiểm tra quyền, trạng thái attempt, quota và ghi PENDING
        WritingHintTransactionCoordinator.BeginDecision beginDecision = coordinator.begin(userId, attemptId, request);

        if (beginDecision instanceof WritingHintTransactionCoordinator.BeginDecision.Replay replay) {
            return replay.response();
        }

        if (beginDecision instanceof WritingHintTransactionCoordinator.BeginDecision.Denied denied) {
            if (denied.retryAfterSeconds() != null) {
                throw new com.multilingo.backend.modules.testing.exception.WritingHintsRetryAfterException(
                        denied.errorCode(), denied.message(), denied.retryAfterSeconds()
                );
            }
            throw new AppException(denied.errorCode(), denied.message());
        }

        WritingHintTransactionCoordinator.Reservation reservation =
                ((WritingHintTransactionCoordinator.BeginDecision.Reserved) beginDecision).reservation();

        // Pha 2: Gọi Gemini provider hoàn toàn NGOÀI transaction database
        WritingHintsResponse.Content content;
        try {
            content = hintGenerator.generate(reservation.hintContext(), reservation.languages());
        } catch (AppException e) {
            WritingHintTransactionCoordinator.TerminalDecision termDecision =
                    coordinator.fail(reservation, e.getErrorCode(), e.getMessage());
            if (termDecision instanceof WritingHintTransactionCoordinator.TerminalDecision.Failure fail) {
                throw new AppException(fail.errorCode(), fail.message());
            }
            throw e;
        } catch (Exception e) {
            WritingHintTransactionCoordinator.TerminalDecision termDecision =
                    coordinator.fail(reservation, ErrorCode.WRITING_HINTS_UNAVAILABLE, "Lỗi khi tạo gợi ý viết");
            if (termDecision instanceof WritingHintTransactionCoordinator.TerminalDecision.Failure fail) {
                throw new AppException(fail.errorCode(), fail.message());
            }
            throw new AppException(ErrorCode.WRITING_HINTS_UNAVAILABLE, "Lỗi khi tạo gợi ý viết");
        }

        // Pha 3: Transaction ngắn kiểm tra recheck attempt/run fencing và lưu kết quả
        WritingHintTransactionCoordinator.TerminalDecision terminalDecision = coordinator.complete(reservation, content);

        if (terminalDecision instanceof WritingHintTransactionCoordinator.TerminalDecision.Success success) {
            return success.response();
        } else if (terminalDecision instanceof WritingHintTransactionCoordinator.TerminalDecision.Failure failure) {
            throw new AppException(failure.errorCode(), failure.message());
        }

        throw new AppException(ErrorCode.WRITING_HINTS_INVALID_RESPONSE, "Không thể hoàn tất yêu cầu gợi ý viết");
    }
}
