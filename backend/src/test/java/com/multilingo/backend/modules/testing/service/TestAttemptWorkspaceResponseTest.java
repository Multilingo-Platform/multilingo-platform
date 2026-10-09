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
    void getAttemptWorkspace_returns_persisted_version_and_saved_answers() {
        TestAttempt attempt = TestAttempt.builder()
                .userId(7)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.PRACTICE)
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
        when(testAttemptRepository.findByIdAndUserId(202, 7)).thenReturn(Optional.of(attempt));
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
    }

    private CreateAttemptRequest createRequest() {
        CreateAttemptRequest request = new CreateAttemptRequest();
        request.setExamId(1);
        request.setTestScope(TestScope.FULL_EXAM);
        request.setTestMode(TestMode.PRACTICE);
        return request;
    }
}
