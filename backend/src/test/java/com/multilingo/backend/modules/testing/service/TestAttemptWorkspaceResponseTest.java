package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.adapter.entity.AttemptListeningPlayback;
import com.multilingo.backend.modules.testing.adapter.repository.AttemptListeningPlaybackRepository;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.impl.TestAttemptServiceImpl;
import com.multilingo.backend.modules.testing.service.support.ToeicListeningMediaProfile;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
    @Mock AttemptListeningPlaybackRepository playbackRepository;

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
                entityManager,
                mock(com.multilingo.backend.modules.testing.service.support.WritingGradingEnqueuer.class),
                new com.multilingo.backend.modules.testing.service.support.WritingGradingAttemptStateResolver());
        service.setListeningPlaybackService(new ListeningPlaybackService(
                testAttemptRepository, playbackRepository, identityAdapter, new ObjectMapper()));
        when(identityAdapter.getCurrentUserId()).thenReturn(7);
    }

    @Test
    void createAttempt_returns_initial_version_and_empty_saved_answers() {
        ExamFixture exam = new ExamFixture();
        exam.setId(1);
        exam.setTitle("Public exam");
        exam.setExamLanguage("en");
        exam.setDurationMinutes(60);
        exam.setSections(List.of());
        when(examAdapter.findPublishedSnapshotById(1)).thenReturn(Optional.of(exam));
        when(testAttemptRepository.save(any(TestAttempt.class))).thenAnswer(invocation -> {
            TestAttempt saved = invocation.getArgument(0);
            saved.setId(101);
            return saved;
        });
        when(attemptAnswerRepository.findByAttemptId(101)).thenReturn(List.of());

        WorkspaceResponse response = service.createAttempt(createRequest());

        assertThat(response.getVersion()).isEqualTo(1);
        assertThat(response.getSavedAnswers()).isEmpty();
        assertThat(response.getExamSnapshot()).containsEntry("examLanguage", "en");
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

    @Test
    void getAttemptWorkspace_projectsToeicQuestionNumbers_whenAttemptIsToeic() {
        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q_001");
        q1.put("type", "SINGLE_CHOICE");
        Map<String, Object> part1 = new LinkedHashMap<>();
        part1.put("id", 101);
        part1.put("part_number", 1);
        part1.put("questions", List.of(q1));
        Map<String, Object> section1 = new LinkedHashMap<>();
        section1.put("id", 10);
        section1.put("name", "LISTENING");
        section1.put("parts", List.of(part1));

        Map<String, Object> toeicSnapshot = new LinkedHashMap<>();
        toeicSnapshot.put("id", 1);
        toeicSnapshot.put("code", "TOEIC-ETS-2024-T1-V1");
        toeicSnapshot.put("type", "TOEIC_LR");
        toeicSnapshot.put("sections", List.of(section1));

        TestAttempt attempt = TestAttempt.builder()
                .userId(7)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(com.multilingo.backend.modules.testing.entity.enums.AttemptStatus.IN_PROGRESS)
                .startTime(Instant.parse("2026-10-17T00:00:00Z"))
                .deadline(Instant.parse("2026-10-17T02:00:00Z"))
                .examSnapshot(toeicSnapshot)
                .version(1)
                .build();
        attempt.setId(401);

        when(testAttemptRepository.findByIdAndUserIdForUpdate(401, 7)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(401)).thenReturn(List.of());

        WorkspaceResponse response = service.getAttemptWorkspace(401);

        assertThat(response).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> secList = (List<Map<String, Object>>) response.getExamSnapshot().get("sections");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pList = (List<Map<String, Object>>) secList.get(0).get("parts");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> qList = (List<Map<String, Object>>) pList.get(0).get("questions");
        assertThat(qList.get(0).get("question_number")).isEqualTo(1);
        assertThat(qList.get(0).get("questionNumber")).isEqualTo(1);
    }

    @Test
    void getAttemptWorkspace_toeicWithInvalidExplicitQuestionNumber_fallsBackToCanonicalNumber() {
        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q_001");
        q1.put("question_number", 201); // Invalid: > 200 and out of Part 1 (1..6)
        q1.put("type", "SINGLE_CHOICE");

        Map<String, Object> q2 = new LinkedHashMap<>();
        q2.put("question_id", "q_002");
        q2.put("questionNumber", "7"); // Invalid: String "7" out of Part 1 (1..6)
        q2.put("type", "SINGLE_CHOICE");

        Map<String, Object> part1 = new LinkedHashMap<>();
        part1.put("id", 101);
        part1.put("part_number", 1);
        part1.put("questions", List.of(q1, q2));

        Map<String, Object> section1 = new LinkedHashMap<>();
        section1.put("id", 10);
        section1.put("name", "LISTENING");
        section1.put("parts", List.of(part1));

        Map<String, Object> toeicSnapshot = new LinkedHashMap<>();
        toeicSnapshot.put("id", 1);
        toeicSnapshot.put("code", "TOEIC-ETS-2024-T1-V1");
        toeicSnapshot.put("type", "TOEIC_LR");
        toeicSnapshot.put("sections", List.of(section1));

        TestAttempt attempt = TestAttempt.builder()
                .userId(7)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(com.multilingo.backend.modules.testing.entity.enums.AttemptStatus.IN_PROGRESS)
                .startTime(Instant.parse("2026-10-17T00:00:00Z"))
                .deadline(Instant.parse("2026-10-17T02:00:00Z"))
                .examSnapshot(toeicSnapshot)
                .version(1)
                .build();
        attempt.setId(403);

        when(testAttemptRepository.findByIdAndUserIdForUpdate(403, 7)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(403)).thenReturn(List.of());

        WorkspaceResponse response = service.getAttemptWorkspace(403);

        assertThat(response).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> secList = (List<Map<String, Object>>) response.getExamSnapshot().get("sections");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pList = (List<Map<String, Object>>) secList.get(0).get("parts");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> qList = (List<Map<String, Object>>) pList.get(0).get("questions");

        // q1 falls back from 201 to canonical 1
        assertThat(qList.get(0).get("question_number")).isEqualTo(1);
        assertThat(qList.get(0).get("questionNumber")).isEqualTo(1);

        // q2 falls back from "7" to canonical 2
        assertThat(qList.get(1).get("question_number")).isEqualTo(2);
        assertThat(qList.get(1).get("questionNumber")).isEqualTo(2);

        // Immutability: original attempt snapshot retains original values
        assertThat(q1.get("question_number")).isEqualTo(201);
        assertThat(q2.get("questionNumber")).isEqualTo("7");
    }

    @Test
    void getAttemptWorkspace_mockToeic_sanitizesPart1AndPart2PromptsInResponseAndJsonSerialization() throws Exception {
        Map<String, Object> q7 = new LinkedHashMap<>();
        q7.put("question_id", "q_007");
        q7.put("type", "SINGLE_CHOICE");
        q7.put("question_text", "Where is the meeting being held?");
        q7.put("prompt", "Spoken prompt text for Q7");
        q7.put("spoken_prompt", "Question 7 spoken prompt alias");
        q7.put("content", "Secret audio content for Q7");
        q7.put("options", List.of(
                Map.of("id", "A", "text", "In room 302"),
                Map.of("id", "B", "text", "Tomorrow afternoon"),
                Map.of("id", "C", "text", "Yes, please")
        ));
        Map<String, Object> p2Group = new LinkedHashMap<>();
        p2Group.put("content_html", "<p>Part 2 Question 7 spoken dialogue: Where is the meeting being held?</p>");
        p2Group.put("spoken_prompt", "Group 2 spoken prompt alias");
        p2Group.put("questions", List.of(q7));

        Map<String, Object> part2 = new LinkedHashMap<>();
        part2.put("id", 102);
        part2.put("part_number", 2);
        part2.put("question_groups", List.of(p2Group));

        Map<String, Object> section1 = new LinkedHashMap<>();
        section1.put("id", 10);
        section1.put("name", "LISTENING");
        section1.put("parts", List.of(part2));

        Map<String, Object> toeicSnapshot = new LinkedHashMap<>();
        toeicSnapshot.put("id", 1);
        toeicSnapshot.put("code", "TOEIC-ETS-2024-T1-V1");
        toeicSnapshot.put("type", "TOEIC_LR");
        toeicSnapshot.put("sections", List.of(section1));

        TestAttempt attempt = TestAttempt.builder()
                .userId(7)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(com.multilingo.backend.modules.testing.entity.enums.AttemptStatus.IN_PROGRESS)
                .startTime(Instant.parse("2026-10-17T00:00:00Z"))
                .deadline(Instant.parse("2026-10-17T02:00:00Z"))
                .examSnapshot(toeicSnapshot)
                .version(1)
                .build();
        attempt.setId(402);

        when(testAttemptRepository.findByIdAndUserIdForUpdate(402, 7)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(402)).thenReturn(List.of());

        WorkspaceResponse response = service.getAttemptWorkspace(402);

        assertThat(response).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> secList = (List<Map<String, Object>>) response.getExamSnapshot().get("sections");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pList = (List<Map<String, Object>>) secList.get(0).get("parts");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> gList = (List<Map<String, Object>>) pList.get(0).get("question_groups");
        Map<String, Object> projectedGroup = gList.get(0);
        assertThat(projectedGroup).doesNotContainKey("content_html");
        assertThat(projectedGroup).doesNotContainKey("spoken_prompt");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> qList = (List<Map<String, Object>>) projectedGroup.get("questions");
        Map<String, Object> projectedQ7 = qList.get(0);

        assertThat(projectedQ7.get("question_number")).isEqualTo(7);
        assertThat(projectedQ7.get("question_text")).isEqualTo("Question 7");
        assertThat(projectedQ7.get("prompt")).isEqualTo("Question 7");
        assertThat(projectedQ7).doesNotContainKey("content");
        assertThat(projectedQ7).doesNotContainKey("spoken_prompt");

        ObjectMapper mapper = new ObjectMapper().registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        String json = mapper.writeValueAsString(response);
        assertThat(json).doesNotContain("Where is the meeting being held?");
        assertThat(json).doesNotContain("Spoken prompt text for Q7");
        assertThat(json).doesNotContain("Question 7 spoken prompt alias");
        assertThat(json).doesNotContain("Group 2 spoken prompt alias");
        assertThat(json).doesNotContain("Part 2 Question 7 spoken dialogue");
        assertThat(json).doesNotContain("Secret audio content for Q7");
        assertThat(json).doesNotContain("In room 302");
        assertThat(json).contains("\"question_text\":\"Question 7\"");
    }

    private CreateAttemptRequest createRequest() {
        CreateAttemptRequest request = new CreateAttemptRequest();
        request.setExamId(1);
        request.setTestScope(TestScope.FULL_EXAM);
        request.setTestMode(TestMode.PRACTICE);
        return request;
    }

    // ---- TW-04 re-fix: workspace playback summary integration ----

    @Test
    void getAttemptWorkspace_toeicMock_surfacesPlaybackSummaryFromRealServiceWithoutWrite() throws Exception {
        TestAttempt attempt = toeicAttempt(501, TestMode.MOCK_TEST, Instant.now().plusSeconds(3600), List.of());
        when(testAttemptRepository.findByIdAndUserIdForUpdate(501, 7)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(501)).thenReturn(List.of());

        WorkspaceResponse response;
        ToeicListeningMediaProfile fixture = verifiedFixture();
        try (var mockedStatic = org.mockito.Mockito.mockStatic(ToeicListeningMediaProfile.class, invocation ->
                invocation.getMethod().getName().equals("loadDefault") ? fixture : invocation.callRealMethod())) {
            mockedStatic.when(ToeicListeningMediaProfile::loadDefault).thenReturn(fixture);
            response = service.getAttemptWorkspace(501);
        }

        assertThat(response.getListeningPlayback()).isNotNull();
        assertThat(response.getListeningPlayback().getStatus()).isEqualTo("NOT_STARTED");
        assertThat(response.getListeningPlayback().getAvailable()).isTrue();

        var summaryNode = jsonTree(response).get("listeningPlayback");
        assertThat(summaryNode.get("status").asText()).isEqualTo("NOT_STARTED");
        assertThat(summaryNode.get("available").asBoolean()).isTrue();

        // Workspace read must not write playback state or mutate the attempt
        verify(playbackRepository).findByAttemptId(501);
        verify(playbackRepository, never()).save(any(AttemptListeningPlayback.class));
        verify(playbackRepository, never()).saveAndFlush(any(AttemptListeningPlayback.class));
        verify(testAttemptRepository, never()).save(any(TestAttempt.class));
    }

    @Test
    void getAttemptWorkspace_toeicMock_unavailableProfileSummaryWithoutWrite() {
        TestAttempt attempt = toeicAttempt(502, TestMode.MOCK_TEST, Instant.now().plusSeconds(3600), List.of());
        when(testAttemptRepository.findByIdAndUserIdForUpdate(502, 7)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(502)).thenReturn(List.of());

        WorkspaceResponse response;
        try (var mockedStatic = org.mockito.Mockito.mockStatic(ToeicListeningMediaProfile.class)) {
            mockedStatic.when(ToeicListeningMediaProfile::loadDefault)
                    .thenThrow(new IllegalStateException("Unverified production profile"));
            response = service.getAttemptWorkspace(502);
        }

        assertThat(response.getListeningPlayback()).isNotNull();
        assertThat(response.getListeningPlayback().getStatus()).isEqualTo("UNAVAILABLE");
        assertThat(response.getListeningPlayback().getAvailable()).isFalse();
        verify(playbackRepository, never()).findByAttemptId(org.mockito.ArgumentMatchers.any());
        verify(playbackRepository, never()).save(any(AttemptListeningPlayback.class));
        verify(testAttemptRepository, never()).save(any(TestAttempt.class));
    }

    @Test
    void getAttemptWorkspace_completedToeicMock_summaryClosed() {
        TestAttempt attempt = toeicAttempt(503, TestMode.MOCK_TEST, Instant.now().plusSeconds(3600), List.of());
        attempt.setStatus(AttemptStatus.COMPLETED);
        when(testAttemptRepository.findByIdAndUserIdForUpdate(503, 7)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(503)).thenReturn(List.of());

        WorkspaceResponse response = service.getAttemptWorkspace(503);

        assertThat(response.getListeningPlayback().getStatus()).isEqualTo("CLOSED");
        assertThat(response.getListeningPlayback().getAvailable()).isFalse();
        verify(playbackRepository, never()).findByAttemptId(org.mockito.ArgumentMatchers.any());
        verify(testAttemptRepository, never()).save(any(TestAttempt.class));
    }

    @Test
    void getAttemptWorkspace_lockedListeningSection_summaryLocked() {
        TestAttempt attempt = toeicAttempt(504, TestMode.MOCK_TEST, Instant.now().plusSeconds(3600), List.of(10));
        when(testAttemptRepository.findByIdAndUserIdForUpdate(504, 7)).thenReturn(Optional.of(attempt));
        when(attemptAnswerRepository.findByAttemptId(504)).thenReturn(List.of());

        WorkspaceResponse response = service.getAttemptWorkspace(504);

        assertThat(response.getListeningPlayback().getStatus()).isEqualTo("LOCKED");
        assertThat(response.getListeningPlayback().getAvailable()).isFalse();
        verify(playbackRepository, never()).findByAttemptId(org.mockito.ArgumentMatchers.any());
        verify(testAttemptRepository, never()).save(any(TestAttempt.class));
    }

    @Test
    void getAttemptWorkspace_practiceAndIelts_omitPlaybackSummaryInJson() throws Exception {
        TestAttempt practice = toeicAttempt(505, TestMode.PRACTICE, null, List.of());
        when(testAttemptRepository.findByIdAndUserIdForUpdate(505, 7)).thenReturn(Optional.of(practice));
        when(attemptAnswerRepository.findByAttemptId(505)).thenReturn(List.of());

        TestAttempt ielts = TestAttempt.builder()
                .userId(7)
                .examId(2)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(60))
                .deadline(Instant.now().plusSeconds(3600))
                .examSnapshot(new LinkedHashMap<>(Map.of(
                        "code", "IELTS-CAM-20-T1",
                        "type", "IELTS_ACADEMIC",
                        "sections", List.of())))
                .version(1)
                .build();
        ielts.setId(506);
        when(testAttemptRepository.findByIdAndUserIdForUpdate(506, 7)).thenReturn(Optional.of(ielts));
        when(attemptAnswerRepository.findByAttemptId(506)).thenReturn(List.of());

        WorkspaceResponse practiceResponse = service.getAttemptWorkspace(505);
        WorkspaceResponse ieltsResponse = service.getAttemptWorkspace(506);

        assertThat(practiceResponse.getListeningPlayback()).isNull();
        assertThat(ieltsResponse.getListeningPlayback()).isNull();
        assertThat(jsonTree(practiceResponse).has("listeningPlayback")).isFalse();
        assertThat(jsonTree(ieltsResponse).has("listeningPlayback")).isFalse();
        verify(playbackRepository, never()).save(any(AttemptListeningPlayback.class));
    }

    private static com.fasterxml.jackson.databind.JsonNode jsonTree(WorkspaceResponse response) throws Exception {
        ObjectMapper mapper = new ObjectMapper()
                .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        return mapper.readTree(mapper.writeValueAsString(response));
    }

    private static ToeicListeningMediaProfile verifiedFixture() throws Exception {
        try (var input = TestAttemptWorkspaceResponseTest.class
                .getResourceAsStream("/testing/toeic-listening-verified-fixture.json")) {
            return new ObjectMapper().readValue(input, ToeicListeningMediaProfile.class);
        }
    }

    private static TestAttempt toeicAttempt(Integer id, TestMode mode, Instant deadline, List<Integer> lockedSections) {
        TestAttempt attempt = TestAttempt.builder()
                .userId(7)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(mode)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now().minusSeconds(60))
                .deadline(deadline)
                .examSnapshot(toeicListeningSnapshot("TOEIC-ETS-2024-T1-V2"))
                .version(1)
                .lockedSections(new ArrayList<>(lockedSections))
                .build();
        attempt.setId(id);
        return attempt;
    }

    private static Map<String, Object> toeicListeningSnapshot(String examCode) {
        List<Map<String, Object>> parts = new ArrayList<>();
        for (int part = 1; part <= 4; part++) {
            Map<String, Object> partMap = new LinkedHashMap<>();
            partMap.put("id", 100 + part);
            partMap.put("partNumber", part);
            partMap.put("shared_audio", Map.of("url", "https://media.test/p" + part + ".mp3"));
            parts.add(partMap);
        }
        Map<String, Object> section = new LinkedHashMap<>();
        section.put("id", 10);
        section.put("name", "LISTENING");
        section.put("parts", parts);
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", 1);
        snapshot.put("code", examCode);
        snapshot.put("type", "TOEIC_LR");
        snapshot.put("sections", List.of(section));
        return snapshot;
    }
}
