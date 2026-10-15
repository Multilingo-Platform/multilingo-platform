package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.response.AutosaveVersionResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestAttemptAutosaveVersionTest {

    @Mock private TestAttemptRepository testAttemptRepository;
    @Mock private AttemptAnswerRepository attemptAnswerRepository;
    @Mock private ExamAdapter examAdapter;
    @Mock private IdentityAdapter identityAdapter;
    @Mock private GradingAdapter gradingAdapter;
    @Mock private ObjectiveGradingService gradingService;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private EntityManager entityManager;
    @Mock private com.multilingo.backend.modules.testing.service.support.WritingGradingEnqueuer writingGradingEnqueuer;

    private TestAttemptServiceImpl service;

    private static final Integer CURRENT_USER_ID = 1;
    private static final Integer ATTEMPT_ID = 42;

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
                entityManager,
                writingGradingEnqueuer,
                new com.multilingo.backend.modules.testing.service.support.WritingGradingAttemptStateResolver()
        );
        lenient().when(identityAdapter.getCurrentUserId()).thenReturn(CURRENT_USER_ID);
    }

    private TestAttempt createAttempt(AttemptStatus status, Integer version, Instant deadline) {
        TestAttempt attempt = TestAttempt.builder()
                .userId(CURRENT_USER_ID)
                .examId(10)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(status)
                .version(version)
                .startTime(Instant.now().minusSeconds(60))
                .deadline(deadline)
                .build();
        attempt.setId(ATTEMPT_ID);
        return attempt;
    }

    @Test
    void autosaveAnswers_matchingVersion_incrementsVersion_andReturnsNewVersion() {
        // Arrange
        TestAttempt attempt = createAttempt(AttemptStatus.IN_PROGRESS, 1, Instant.now().plusSeconds(3600));
        when(testAttemptRepository.findByIdAndUserIdForUpdate(ATTEMPT_ID, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptIdAndPartId(ATTEMPT_ID, 10))
                .thenReturn(Optional.empty());

        AutosaveAnswersRequest request = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(10)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q1")
                                                .answer("A")
                                                .build()
                                ))
                                .build()
                ))
                .build();

        // Act
        AutosaveVersionResponse response = service.autosaveAnswers(ATTEMPT_ID, request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getVersion()).isEqualTo(2);

        // Verify row lock was requested
        verify(testAttemptRepository).findByIdAndUserIdForUpdate(ATTEMPT_ID, CURRENT_USER_ID);
        verify(testAttemptRepository, never()).findByIdAndUserId(any(), any());

        // Verify attempt version updated in DB
        ArgumentCaptor<TestAttempt> attemptCaptor = ArgumentCaptor.forClass(TestAttempt.class);
        verify(testAttemptRepository).save(attemptCaptor.capture());
        assertThat(attemptCaptor.getValue().getVersion()).isEqualTo(2);

        // Verify answer saved
        verify(attemptAnswerRepository).save(any(AttemptAnswer.class));
    }

    @Test
    void autosaveAnswers_staleVersion_throwsVersionConflict_andNoMutations() {
        // Arrange: server has version 2, client sends version 1
        TestAttempt attempt = createAttempt(AttemptStatus.IN_PROGRESS, 2, Instant.now().plusSeconds(3600));
        when(testAttemptRepository.findByIdAndUserIdForUpdate(ATTEMPT_ID, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));

        AutosaveAnswersRequest request = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(List.of(
                        AutosaveAnswersRequest.PartAnswerDto.builder()
                                .partId(10)
                                .answers(List.of(
                                        AutosaveAnswersRequest.QuestionAnswerDto.builder()
                                                .questionId("q1")
                                                .answer("B")
                                                .build()
                                ))
                                .build()
                ))
                .build();

        // Act & Assert
        assertThatThrownBy(() -> service.autosaveAnswers(ATTEMPT_ID, request))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.VERSION_CONFLICT);

        // Verify no mutations
        verify(testAttemptRepository, never()).save(any());
        verify(attemptAnswerRepository, never()).save(any());
    }

    @Test
    void autosaveAnswers_mismatchedFutureVersion_throwsVersionConflict_andNoMutations() {
        // Arrange: server has version 1, client sends version 3
        TestAttempt attempt = createAttempt(AttemptStatus.IN_PROGRESS, 1, Instant.now().plusSeconds(3600));
        when(testAttemptRepository.findByIdAndUserIdForUpdate(ATTEMPT_ID, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));

        AutosaveAnswersRequest request = AutosaveAnswersRequest.builder()
                .version(3)
                .answers(Collections.emptyList())
                .build();

        // Act & Assert
        assertThatThrownBy(() -> service.autosaveAnswers(ATTEMPT_ID, request))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.VERSION_CONFLICT);

        verify(testAttemptRepository, never()).save(any());
        verify(attemptAnswerRepository, never()).save(any());
    }

    @Test
    void autosaveAnswers_nullVersionInRequest_throwsVersionConflict_andNoMutations() {
        // Arrange
        TestAttempt attempt = createAttempt(AttemptStatus.IN_PROGRESS, 1, Instant.now().plusSeconds(3600));
        when(testAttemptRepository.findByIdAndUserIdForUpdate(ATTEMPT_ID, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));

        AutosaveAnswersRequest request = AutosaveAnswersRequest.builder()
                .version(null)
                .answers(Collections.emptyList())
                .build();

        // Act & Assert
        assertThatThrownBy(() -> service.autosaveAnswers(ATTEMPT_ID, request))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.VERSION_CONFLICT);

        verify(testAttemptRepository, never()).save(any());
        verify(attemptAnswerRepository, never()).save(any());
    }

    @Test
    void autosaveAnswers_emptyAnswers_incrementsVersion_withoutMutatingAnswersTable() {
        // Arrange
        TestAttempt attempt = createAttempt(AttemptStatus.IN_PROGRESS, 1, Instant.now().plusSeconds(3600));
        when(testAttemptRepository.findByIdAndUserIdForUpdate(ATTEMPT_ID, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));

        AutosaveAnswersRequest request = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(Collections.emptyList())
                .build();

        // Act
        AutosaveVersionResponse response = service.autosaveAnswers(ATTEMPT_ID, request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getVersion()).isEqualTo(2);

        // Attempt version must be updated to 2
        ArgumentCaptor<TestAttempt> attemptCaptor = ArgumentCaptor.forClass(TestAttempt.class);
        verify(testAttemptRepository).save(attemptCaptor.capture());
        assertThat(attemptCaptor.getValue().getVersion()).isEqualTo(2);

        // Answers must NOT be touched or cleared
        verify(attemptAnswerRepository, never()).save(any());
        verify(attemptAnswerRepository, never()).deleteAll(any());
        verify(attemptAnswerRepository, never()).delete(any());
    }

    @Test
    void autosaveAnswers_submittedAttempt_throwsAttemptAlreadySubmitted_andNoMutations() {
        // Arrange
        TestAttempt attempt = createAttempt(AttemptStatus.SUBMITTED, 1, Instant.now().plusSeconds(3600));
        when(testAttemptRepository.findByIdAndUserIdForUpdate(ATTEMPT_ID, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));

        AutosaveAnswersRequest request = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(Collections.emptyList())
                .build();

        // Act & Assert
        assertThatThrownBy(() -> service.autosaveAnswers(ATTEMPT_ID, request))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ATTEMPT_ALREADY_SUBMITTED);

        verify(testAttemptRepository, never()).save(any());
        verify(attemptAnswerRepository, never()).save(any());
    }

    @Test
    void autosaveAnswers_expiredMockTest_throwsAttemptExpired_andNoMutations() {
        // Arrange: deadline was 10 seconds ago
        TestAttempt attempt = createAttempt(AttemptStatus.IN_PROGRESS, 1, Instant.now().minusSeconds(10));
        when(testAttemptRepository.findByIdAndUserIdForUpdate(ATTEMPT_ID, CURRENT_USER_ID))
                .thenReturn(Optional.of(attempt));

        AutosaveAnswersRequest request = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(Collections.emptyList())
                .build();

        // Act & Assert
        assertThatThrownBy(() -> service.autosaveAnswers(ATTEMPT_ID, request))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ATTEMPT_EXPIRED);

        verify(testAttemptRepository, never()).save(any());
        verify(attemptAnswerRepository, never()).save(any());
    }

    @Test
    void autosaveAnswers_wrongOwnerOrNotFound_throwsForbidden_andNoMutations() {
        // Arrange: repository returns empty for user ID
        when(testAttemptRepository.findByIdAndUserIdForUpdate(ATTEMPT_ID, CURRENT_USER_ID))
                .thenReturn(Optional.empty());

        AutosaveAnswersRequest request = AutosaveAnswersRequest.builder()
                .version(1)
                .answers(Collections.emptyList())
                .build();

        // Act & Assert
        assertThatThrownBy(() -> service.autosaveAnswers(ATTEMPT_ID, request))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

        verify(testAttemptRepository, never()).save(any());
        verify(attemptAnswerRepository, never()).save(any());
    }
}
