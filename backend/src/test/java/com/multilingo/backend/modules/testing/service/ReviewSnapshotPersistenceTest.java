package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.adapter.dto.PartFixture;
import com.multilingo.backend.modules.testing.adapter.dto.SectionFixture;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.impl.TestAttemptServiceImpl;
import com.multilingo.backend.modules.testing.service.support.AttemptGradingInputFactory;
import com.multilingo.backend.modules.testing.service.support.AttemptResultSummaryMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ReviewSnapshotPersistenceTest {

    private final TestAttemptRepository testAttemptRepository = mock(TestAttemptRepository.class);
    private final AttemptAnswerRepository attemptAnswerRepository = mock(AttemptAnswerRepository.class);
    private final ExamAdapter examAdapter = mock(ExamAdapter.class);
    private final IdentityAdapter identityAdapter = mock(IdentityAdapter.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final GradingAdapter gradingAdapter = mock(GradingAdapter.class);
    private final ObjectiveGradingService gradingService = mock(ObjectiveGradingService.class);
    private final PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
    private final EntityManager entityManager = mock(EntityManager.class);
    private final AttemptGradingInputFactory gradingInputFactory = new AttemptGradingInputFactory();
    private final AttemptResultSummaryMapper summaryMapper = new AttemptResultSummaryMapper(objectMapper);

    private TestAttemptServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new TestAttemptServiceImpl(
                testAttemptRepository,
                attemptAnswerRepository,
                examAdapter,
                identityAdapter,
                objectMapper,
                gradingAdapter,
                gradingService,
                transactionManager,
                entityManager,
                gradingInputFactory,
                summaryMapper
        );
        when(identityAdapter.getCurrentUserId()).thenReturn(100);
    }

    @Test
    void createAttempt_persistsSnapshotWithCorrectAnswerAndExplanation_whileReturningSanitizedWorkspace() throws Exception {
        // Setup exam fixture returned by findSnapshotById
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", "q_1");
        question.put("type", "SINGLE_CHOICE");
        question.put("question_text", "Sample question");
        question.put("options", List.of(Map.of("id", "A", "text", "Apple"), Map.of("id", "B", "text", "Banana")));
        question.put("correct_answer", "A");
        question.put("explanation", "Apple is correct because reasons.");

        PartFixture partFixture = new PartFixture();
        partFixture.setId(10);
        partFixture.setTitle("Part 1");
        partFixture.setQuestions(List.of(question));

        SectionFixture sectionFixture = new SectionFixture();
        sectionFixture.setId(1);
        sectionFixture.setName("READING");
        sectionFixture.setDurationMinutes(60);
        sectionFixture.setParts(List.of(partFixture));

        ExamFixture snapshotFixture = new ExamFixture();
        snapshotFixture.setId(1);
        snapshotFixture.setTitle("Test Exam");
        snapshotFixture.setDurationMinutes(60);
        snapshotFixture.setSections(List.of(sectionFixture));

        when(examAdapter.findSnapshotById(1)).thenReturn(Optional.of(snapshotFixture));
        when(testAttemptRepository.save(any(TestAttempt.class))).thenAnswer(invocation -> {
            TestAttempt attempt = invocation.getArgument(0);
            attempt.setId(123);
            return attempt;
        });

        CreateAttemptRequest request = new CreateAttemptRequest();
        request.setExamId(1);
        request.setTestScope(TestScope.FULL_EXAM);
        request.setTestMode(TestMode.PRACTICE);

        // When creating attempt
        WorkspaceResponse workspaceResponse = service.createAttempt(request);

        // Then verify repository saved attempt contains the full snapshot
        ArgumentCaptor<TestAttempt> captor = ArgumentCaptor.forClass(TestAttempt.class);
        verify(testAttemptRepository).save(captor.capture());
        TestAttempt savedAttempt = captor.getValue();

        String persistedSnapshotJson = objectMapper.writeValueAsString(savedAttempt.getExamSnapshot());
        assertThat(persistedSnapshotJson)
                .as("Persisted snapshot must retain correct_answer and explanation")
                .contains("correct_answer")
                .contains("Apple is correct because reasons.");

        // But the returned workspaceResponse must NOT contain correct_answer or explanation
        String workspaceSnapshotJson = objectMapper.writeValueAsString(workspaceResponse.getExamSnapshot());
        assertThat(workspaceSnapshotJson)
                .as("Workspace response snapshot must be sanitized")
                .doesNotContain("correct_answer")
                .doesNotContain("Apple is correct because reasons.")
                .contains("Sample question");
    }
}
