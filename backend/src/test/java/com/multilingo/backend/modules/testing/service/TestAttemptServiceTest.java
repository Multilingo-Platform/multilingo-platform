package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TestAttemptServiceTest {

    @Autowired
    TestAttemptService service;

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
}
