package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.impl.TestAttemptServiceImpl;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestAttemptWorkspaceResponseTest {

    @Mock TestAttemptRepository testAttemptRepository;
    @Mock AttemptAnswerRepository attemptAnswerRepository;
    @Mock ExamAdapter examAdapter;
    @Mock IdentityAdapter identityAdapter;
    @Mock GradingAdapter gradingAdapter;
    @Mock ObjectiveGradingService gradingService;
    @Mock PlatformTransactionManager transactionManager;
    @Mock EntityManager entityManager;

    private TestAttemptServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new TestAttemptServiceImpl(
                testAttemptRepository,
                attemptAnswerRepository,
                examAdapter,
                identityAdapter,
                new ObjectMapper(),
                gradingAdapter,
                gradingService,
                transactionManager,
                entityManager);
        when(identityAdapter.getCurrentUserId()).thenReturn(7);
    }

    @Test
    void createAttempt_returns_initial_version_and_empty_saved_answers() {
        ExamFixture exam = new ExamFixture();
        exam.setId(1);
        exam.setTitle("Public exam");
        exam.setDurationMinutes(60);
        exam.setSections(List.of());
        when(examAdapter.findById(1)).thenReturn(Optional.of(exam));
        when(testAttemptRepository.save(any(TestAttempt.class))).thenAnswer(invocation -> {
            TestAttempt saved = invocation.getArgument(0);
            saved.setId(101);
            return saved;
        });
        when(attemptAnswerRepository.findByAttemptId(101)).thenReturn(List.of());

        WorkspaceResponse response = service.createAttempt(createRequest());

        assertThat(response.getVersion()).isEqualTo(1);
        assertThat(response.getSavedAnswers()).isEmpty();
    }

    @Test
    void getAttemptWorkspace_returns_persisted_version_and_saved_answers_using_locked_query() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(7)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
                .status(com.multilingo.backend.modules.testing.entity.enums.AttemptStatus.IN_PROGRESS)
                .startTime(Instant.parse("2026-10-09T00:00:00Z"))
                .examSnapshot(Map.of("id", 1))
                .version(7)
                .build();
        attempt.setId(202);
        Map<String, Object> userAnswers = new LinkedHashMap<>();
        userAnswers.put("q_1", "A");
        userAnswers.put("q_2", List.of("B", "C"));
        AttemptAnswer saved = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(11)
                .userAnswers(userAnswers)
                .build();
        when(testAttemptRepository.findByIdAndUserIdForUpdate(202, 7)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(202)).thenReturn(List.of(saved));

        WorkspaceResponse response = service.getAttemptWorkspace(202);

        assertThat(response.getVersion()).isEqualTo(7);
        assertThat(response.getSavedAnswers()).singleElement().satisfies(part -> {
            assertThat(part.getPartId()).isEqualTo(11);
            assertThat(part.getAnswers()).extracting(
                            AutosaveAnswersRequest.QuestionAnswerDto::getQuestionId,
                            AutosaveAnswersRequest.QuestionAnswerDto::getAnswer)
                    .containsExactly(tuple("q_1", "A"), tuple("q_2", List.of("B", "C")));
        });
        org.mockito.Mockito.verify(testAttemptRepository).findByIdAndUserIdForUpdate(202, 7);
        org.mockito.Mockito.verify(testAttemptRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void getAttemptWorkspace_mock_test_before_grace_remains_in_progress() {
        Instant fixedNow = Instant.parse("2026-10-10T12:00:00Z");
        Instant deadline = fixedNow.minusSeconds(15).plusMillis(1); // 1ms before grace threshold expires

        try (org.mockito.MockedStatic<Instant> mockedInstant = org.mockito.Mockito.mockStatic(Instant.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
            mockedInstant.when(Instant::now).thenReturn(fixedNow);

            TestAttempt attempt = TestAttempt.builder()
                    .userId(7)
                    .examId(1)
                    .testScope(TestScope.FULL_EXAM)
                    .testMode(TestMode.MOCK_TEST)
                    .status(com.multilingo.backend.modules.testing.entity.enums.AttemptStatus.IN_PROGRESS)
                    .startTime(fixedNow.minusSeconds(3600))
                    .deadline(deadline)
                    .examSnapshot(Map.of("id", 1))
                    .version(3)
                    .build();
            attempt.setId(301);

            when(testAttemptRepository.findByIdAndUserIdForUpdate(301, 7)).thenReturn(Optional.of(attempt));
            when(attemptAnswerRepository.findByAttemptId(301)).thenReturn(List.of());

            WorkspaceResponse response = service.getAttemptWorkspace(301);

            assertThat(response.getStatus()).isEqualTo(com.multilingo.backend.modules.testing.entity.enums.AttemptStatus.IN_PROGRESS);
            org.mockito.Mockito.verify(testAttemptRepository, org.mockito.Mockito.never()).save(any());
            org.mockito.Mockito.verifyNoInteractions(gradingService);
        }
    }

    @Test
    void getAttemptWorkspace_mock_test_at_exact_grace_boundary_remains_in_progress() {
        Instant fixedNow = Instant.parse("2026-10-10T12:00:00Z");
        Instant deadline = fixedNow.minusSeconds(15); // exactly at grace threshold (now.isAfter is false)

        try (org.mockito.MockedStatic<Instant> mockedInstant = org.mockito.Mockito.mockStatic(Instant.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
            mockedInstant.when(Instant::now).thenReturn(fixedNow);

            TestAttempt attempt = TestAttempt.builder()
                    .userId(7)
                    .examId(1)
                    .testScope(TestScope.FULL_EXAM)
                    .testMode(TestMode.MOCK_TEST)
                    .status(com.multilingo.backend.modules.testing.entity.enums.AttemptStatus.IN_PROGRESS)
                    .startTime(fixedNow.minusSeconds(3600))
                    .deadline(deadline)
                    .examSnapshot(Map.of("id", 1))
                    .version(3)
                    .build();
            attempt.setId(302);

            when(testAttemptRepository.findByIdAndUserIdForUpdate(302, 7)).thenReturn(Optional.of(attempt));
            when(attemptAnswerRepository.findByAttemptId(302)).thenReturn(List.of());

            WorkspaceResponse response = service.getAttemptWorkspace(302);

            assertThat(response.getStatus()).isEqualTo(com.multilingo.backend.modules.testing.entity.enums.AttemptStatus.IN_PROGRESS);
            org.mockito.Mockito.verify(testAttemptRepository, org.mockito.Mockito.never()).save(any());
            org.mockito.Mockito.verifyNoInteractions(gradingService);
        }
    }

    @Test
    void getAttemptWorkspace_mock_test_past_grace_finalizes_inline_once() {
        Instant fixedNow = Instant.parse("2026-10-10T12:00:00Z");
        Instant deadline = fixedNow.minusSeconds(15).minusMillis(1); // 1ms past grace threshold

        try (org.mockito.MockedStatic<Instant> mockedInstant = org.mockito.Mockito.mockStatic(Instant.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
            mockedInstant.when(Instant::now).thenReturn(fixedNow);

            TestAttempt attempt = TestAttempt.builder()
                    .userId(7)
                    .examId(1)
                    .testScope(TestScope.FULL_EXAM)
                    .testMode(TestMode.MOCK_TEST)
                    .status(com.multilingo.backend.modules.testing.entity.enums.AttemptStatus.IN_PROGRESS)
                    .startTime(fixedNow.minusSeconds(3600))
                    .deadline(deadline)
                    .examSnapshot(Map.of("id", 1, "sections", List.of(Map.of("id", 1, "name", "READING", "parts", List.of()))))
                    .version(3)
                    .build();
            attempt.setId(303);

            when(testAttemptRepository.findByIdAndUserIdForUpdate(303, 7)).thenReturn(Optional.of(attempt));
            when(attemptAnswerRepository.findByAttemptId(303)).thenReturn(List.of());
            lenient().when(gradingAdapter.loadPartKeys(1)).thenReturn(Map.of());
            when(gradingService.gradeAttempt(any(), any())).thenReturn(
                    com.multilingo.backend.modules.testing.grading.dto.GradingResult.builder()
                            .totalScore(java.math.BigDecimal.ZERO)
                            .partResults(Map.of())
                            .sectionScores(Map.of())
                            .build()
            );

            WorkspaceResponse response = service.getAttemptWorkspace(303);

            assertThat(response.getStatus()).isEqualTo(com.multilingo.backend.modules.testing.entity.enums.AttemptStatus.COMPLETED);
            org.mockito.Mockito.verify(gradingService).gradeAttempt(any(), any());
            org.mockito.Mockito.verify(testAttemptRepository, org.mockito.Mockito.atLeastOnce()).save(attempt);
        }
    }

    private CreateAttemptRequest createRequest() {
        CreateAttemptRequest request = new CreateAttemptRequest();
        request.setExamId(1);
        request.setTestScope(TestScope.FULL_EXAM);
        request.setTestMode(TestMode.PRACTICE);
        return request;
    }
}
