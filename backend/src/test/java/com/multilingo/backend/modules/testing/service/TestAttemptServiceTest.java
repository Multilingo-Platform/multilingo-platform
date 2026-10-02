package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.response.SubmitResultResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TestAttemptServiceTest {

    @Autowired
    TestAttemptService service;

    @Autowired
    AttemptAnswerRepository attemptAnswerRepository;

    @Autowired
    TestAttemptRepository testAttemptRepository;

    // ─── UC-01: createAttempt FULL_EXAM MOCK_TEST ───────────────────────────────

    @Test
    void createAttempt_full_exam_mock_test_returns_workspace_with_deadline() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.MOCK_TEST);

        WorkspaceResponse response = service.createAttempt(req);

        assertThat(response.getAttemptId()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
        assertThat(response.getDeadline()).isNotNull();
        assertThat(response.getDeadline()).isAfter(Instant.now());
        assertThat(response.getExamSnapshot()).isNotNull();
        assertThat(response.getExamSnapshot()).containsKey("id");
    }

    // ─── UC-01: createAttempt FULL_EXAM PRACTICE ───────────────────────────────

    @Test
    void createAttempt_practice_mode_has_null_deadline() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse response = service.createAttempt(req);

        assertThat(response.getDeadline()).isNull();
        assertThat(response.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
    }

    // ─── UC-01: Exam not found ──────────────────────────────────────────────────

    @Test
    void createAttempt_with_unknown_exam_throws_not_found() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(9999);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.MOCK_TEST);

        assertThatThrownBy(() -> service.createAttempt(req))
                .isInstanceOf(AppException.class);
    }

    // ─── UC-01: MOCK_TEST with null duration rejected ───────────────────────────

    @Test
    void createAttempt_mock_test_with_null_duration_exam_throws_invalid_request() {
        // examId=2 has durationMinutes=null in fixture
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(2);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.MOCK_TEST);

        assertThatThrownBy(() -> service.createAttempt(req))
                .isInstanceOf(AppException.class);
    }

    // ─── UC-02: getAttemptWorkspace — own attempt ───────────────────────────────

    @Test
    void getAttemptWorkspace_returns_own_attempt() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse created = service.createAttempt(req);

        WorkspaceResponse found = service.getAttemptWorkspace(created.getAttemptId());

        assertThat(found.getAttemptId()).isEqualTo(created.getAttemptId());
        assertThat(found.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
    }

    // ─── UC-02: getAttemptWorkspace — not found or forbidden ───────────────────

    @Test
    void getAttemptWorkspace_with_nonexistent_id_throws_forbidden() {
        assertThatThrownBy(() -> service.getAttemptWorkspace(99999))
                .isInstanceOf(AppException.class);
    }

    // ─── Exam snapshot integrity ────────────────────────────────────────────────

    @Test
    void exam_snapshot_contains_sections_not_correct_answers() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);

        WorkspaceResponse response = service.createAttempt(req);

        assertThat(response.getExamSnapshot()).containsKey("sections");
        // Security: correct_answer must not be in snapshot
        String snapshotJson = response.getExamSnapshot().toString();
        assertThat(snapshotJson).doesNotContain("correctAnswer");
        assertThat(snapshotJson).doesNotContain("correct_answer");
    }

    // ─── UC-03: autosaveAnswers ────────────────────────────────────────────────

    @Test
    void autosaveAnswers_saves_to_attempt_answers_table() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse attempt = service.createAttempt(req);

        AutosaveAnswersRequest saveReq = new AutosaveAnswersRequest();
        saveReq.setVersion(1);
        saveReq.setAnswers(List.of(
                AutosaveAnswersRequest.PartAnswerDto.builder()
                        .partId(1)
                        .answers(List.of(
                                AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                        .questionId("q_001")
                                        .answer("A")
                                        .build()
                        ))
                        .build()
        ));

        assertDoesNotThrow(() -> service.autosaveAnswers(attempt.getAttemptId(), saveReq));
    }

    // ─── UC-04: submitAttempt ──────────────────────────────────────────────────

    @Test
    void submitAttempt_changes_status_to_COMPLETED() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse attempt = service.createAttempt(req);

        AutosaveAnswersRequest submitReq = new AutosaveAnswersRequest();
        submitReq.setVersion(1);
        submitReq.setAnswers(Collections.emptyList());

        SubmitResultResponse result = service.submitAttempt(attempt.getAttemptId(), submitReq);

        assertThat(result.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(result.getRedirectUrl()).contains(attempt.getAttemptId().toString());
    }

    @Test
    void submitAttempt_is_idempotent_when_already_completed() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse attempt = service.createAttempt(req);

        AutosaveAnswersRequest submitReq = new AutosaveAnswersRequest();
        submitReq.setVersion(1);
        submitReq.setAnswers(Collections.emptyList());

        service.submitAttempt(attempt.getAttemptId(), submitReq);

        // Submit lần 2 — phải trả về kết quả cũ, không throw
        SubmitResultResponse result2 = service.submitAttempt(attempt.getAttemptId(), submitReq);
        assertThat(result2.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
    }

    // ─── TC_SUBMIT_01: grading persisted after submit ───────────────────────────

    @Test
    void submitAttempt_persists_isCorrectFlags_and_overallScore() {
        // Tạo attempt với exam 1
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse attempt = service.createAttempt(req);

        // Autosave đáp án cho Part 1 (q_1 correct=A, q_2 correct=A)
        AutosaveAnswersRequest saveReq = AutosaveAnswersRequest.builder()
            .version(1)
            .answers(List.of(
                AutosaveAnswersRequest.PartAnswerDto.builder()
                    .partId(1)
                    .answers(List.of(
                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                            .questionId("q_1").answer("A").build(),
                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                            .questionId("q_2").answer("B").build() // wrong
                    ))
                    .build()
            ))
            .build();
        service.autosaveAnswers(attempt.getAttemptId(), saveReq);

        // Submit
        SubmitResultResponse result = service.submitAttempt(attempt.getAttemptId(), saveReq);
        assertThat(result.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

        // Verify grading persisted — query directly from repository
        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attempt.getAttemptId());
        assertThat(answers).isNotEmpty();
        AttemptAnswer part1Answer = answers.stream()
            .filter(aa -> aa.getPartId().equals(1))
            .findFirst()
            .orElseThrow();

        // isCorrectFlags phải được ghi
        assertThat(part1Answer.getIsCorrectFlags()).isNotNull();
        assertThat(part1Answer.getIsCorrectFlags()).containsKey("q_1");
        assertThat(part1Answer.getIsCorrectFlags().get("q_1")).isEqualTo("CORRECT");
        assertThat(part1Answer.getIsCorrectFlags().get("q_2")).isEqualTo("WRONG");
        // earnedScore = 1.0 (1 câu đúng trong Part 1)
        assertThat(part1Answer.getEarnedScore()).isEqualByComparingTo("1.0");
    }

    @Test
    void submitAttempt_persists_overallScore_on_attempt() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse attempt = service.createAttempt(req);

        AutosaveAnswersRequest emptyReq = AutosaveAnswersRequest.builder()
            .version(1).answers(List.of()).build();

        service.submitAttempt(attempt.getAttemptId(), emptyReq);

        // Verify overallScore được ghi vào TestAttempt
        TestAttempt saved = testAttemptRepository.findById(attempt.getAttemptId()).orElseThrow();
        assertThat(saved.getOverallScore()).isNotNull();
    }

    // ─── TC_SUBMIT_02: idempotency không ghi đè score ───────────────────────────

    @Test
    void submitAttempt_idempotent_does_not_overwrite_score() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse attempt = service.createAttempt(req);

        AutosaveAnswersRequest submitReq = AutosaveAnswersRequest.builder()
            .version(1)
            .answers(List.of(
                AutosaveAnswersRequest.PartAnswerDto.builder()
                    .partId(1)
                    .answers(List.of(
                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                            .questionId("q_1").answer("A").build()
                    ))
                    .build()
            ))
            .build();

        service.submitAttempt(attempt.getAttemptId(), submitReq);
        TestAttempt firstSubmit = testAttemptRepository.findById(attempt.getAttemptId()).orElseThrow();
        BigDecimal firstScore = firstSubmit.getOverallScore();

        // Submit lần 2
        SubmitResultResponse second = service.submitAttempt(attempt.getAttemptId(), submitReq);
        assertThat(second.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

        TestAttempt secondCheck = testAttemptRepository.findById(attempt.getAttemptId()).orElseThrow();
        // Score không thay đổi
        assertThat(secondCheck.getOverallScore()).isEqualByComparingTo(firstScore);
    }

    // ─── Review Focus: grading fixture không rò rỉ qua API ─────────────────────

    @Test
    void exam_snapshot_does_not_contain_correct_answer_after_grading() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse attempt = service.createAttempt(req);

        AutosaveAnswersRequest emptyReq = AutosaveAnswersRequest.builder()
            .version(1).answers(List.of()).build();
        service.submitAttempt(attempt.getAttemptId(), emptyReq);

        WorkspaceResponse workspace = service.getAttemptWorkspace(attempt.getAttemptId());
        String snapshotJson = workspace.getExamSnapshot().toString();
        assertThat(snapshotJson).doesNotContain("correct=");
        assertThat(snapshotJson).doesNotContain("correct_answer");
        assertThat(snapshotJson).doesNotContain("alternates");
    }

    // ─── TC_SUBMIT_04: sectionScores persisted ──────────────────────────────────

    @Test
    void submitAttempt_persists_sectionScores() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.FULL_EXAM);
        req.setTestMode(TestMode.PRACTICE);
        WorkspaceResponse attempt = service.createAttempt(req);

        // Answer Part 1 (Reading section, q_1 correct)
        AutosaveAnswersRequest saveReq = AutosaveAnswersRequest.builder()
            .version(1)
            .answers(List.of(
                AutosaveAnswersRequest.PartAnswerDto.builder()
                    .partId(1)
                    .answers(List.of(
                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                            .questionId("q_1").answer("A").build()
                    ))
                    .build()
            ))
            .build();

        service.submitAttempt(attempt.getAttemptId(), saveReq);

        TestAttempt saved = testAttemptRepository.findById(attempt.getAttemptId()).orElseThrow();
        assertThat(saved.getSectionScores()).isNotNull();
        // Only Part 1 was autosaved → only Reading section has an AttemptAnswer row
        assertThat(saved.getSectionScores()).containsKey("Reading");
    }

    @Test
    void createAttempt_single_skill_filters_exam_snapshot_to_single_section() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.SINGLE_SKILL);
        req.setTestMode(TestMode.PRACTICE);
        req.setTargetSectionId(1); // Reading

        WorkspaceResponse response = service.createAttempt(req);

        assertThat(response.getExamSnapshot()).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sections = (List<Map<String, Object>>) response.getExamSnapshot().get("sections");
        assertThat(sections).hasSize(1);
        assertThat(sections.get(0).get("id")).isEqualTo(1);
        assertThat(response.getExamSnapshot().get("durationMinutes")).isEqualTo(60);
    }

    @Test
    void createAttempt_single_part_filters_exam_snapshot_to_single_part() {
        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1);
        req.setTestScope(TestScope.SINGLE_PART);
        req.setTestMode(TestMode.PRACTICE);
        req.setTargetPartId(2); // Reading Part 2

        WorkspaceResponse response = service.createAttempt(req);

        assertThat(response.getExamSnapshot()).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sections = (List<Map<String, Object>>) response.getExamSnapshot().get("sections");
        assertThat(sections).hasSize(1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> parts = (List<Map<String, Object>>) sections.get(0).get("parts");
        assertThat(parts).hasSize(1);
        assertThat(parts.get(0).get("id")).isEqualTo(2);
        assertThat(response.getExamSnapshot().get("durationMinutes")).isEqualTo(20);
    }
}
