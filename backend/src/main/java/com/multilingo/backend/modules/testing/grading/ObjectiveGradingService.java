package com.multilingo.backend.modules.testing.grading;

import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.dto.GradingResult;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;

import java.util.List;
import java.util.Map;

/**
 * Engine chấm điểm khách quan (Reading, Listening).
 * Là pure function: không đọc DB, không gọi API bên ngoài.
 */
public interface ObjectiveGradingService {

    /**
     * Chấm toàn bộ attempt từ đáp án đã lưu và bộ answer key.
     *
     * @param answers  Danh sách AttemptAnswer từ DB (đã được autosaveAnswers ghi)
     * @param partKeys Map<partId, PartGradingKey> từ GradingAdapter
     * @return GradingResult với flags, điểm và thống kê
     * @throws com.multilingo.backend.common.exception.AppException (GRADING_DATA_ERROR)
     *         nếu fixture có type/correct không hợp lệ
     */
    GradingResult gradeAttempt(List<AttemptAnswer> answers, Map<Integer, PartGradingKey> partKeys);
}
