package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
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
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestAttemptSinglePartDurationTest {

    @Mock private TestAttemptRepository testAttemptRepository;
    @Mock private AttemptAnswerRepository attemptAnswerRepository;
    @Mock private ExamAdapter examAdapter;
    @Mock private IdentityAdapter identityAdapter;
    @Mock private GradingAdapter gradingAdapter;
    @Mock private ObjectiveGradingService gradingService;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private EntityManager entityManager;

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
                new com.multilingo.backend.modules.testing.service.support.WritingGradingAttemptStateResolver()
        );
        lenient().when(identityAdapter.getCurrentUserId()).thenReturn(1);
    }

    private ExamFixture createFixture(Integer sectionDuration) {
        ExamFixture exam = new ExamFixture();
        exam.setId(42);
        exam.setTitle("IELTS Academic Test");
        exam.setDurationMinutes(120);

        SectionFixture section = new SectionFixture();
        section.setId(70);
        section.setName("Reading Section");
        section.setDurationMinutes(sectionDuration);

        PartFixture part = new PartFixture();
        part.setId(701);
        part.setPartNumber(1);
        part.setDurationMinutes(null); // Explicitly null as in production schema/entity

        section.setParts(List.of(part));
        exam.setSections(List.of(section));
        return exam;
    }

    private CreateAttemptRequest createRequest(Integer sectionId, Integer partId) {
        CreateAttemptRequest request = new CreateAttemptRequest();
        request.setExamId(42);
        request.setTestScope(TestScope.SINGLE_PART);
        request.setTestMode(TestMode.MOCK_TEST);
        request.setTargetSectionId(sectionId);
        request.setTargetPartId(partId);
        return request;
    }

    @Test
    void tc_tv305_be_01_single_part_mock_uses_containing_section_duration() {
        ExamFixture exam = createFixture(60);
        when(examAdapter.findPublishedSnapshotById(42)).thenReturn(Optional.of(exam));

        ArgumentCaptor<TestAttempt> attemptCaptor = ArgumentCaptor.forClass(TestAttempt.class);
        when(testAttemptRepository.save(attemptCaptor.capture())).thenAnswer(invocation -> {
            TestAttempt attempt = invocation.getArgument(0);
            attempt.setId(101);
            return attempt;
        });
        when(attemptAnswerRepository.findByAttemptId(101)).thenReturn(List.of());

        CreateAttemptRequest request = createRequest(70, 701);

        WorkspaceResponse response = service.createAttempt(request);

        TestAttempt savedAttempt = attemptCaptor.getValue();
        assertThat(savedAttempt.getDeadline()).isNotNull();

        // Deadline should be calculated from containing section duration (60 minutes)
        Duration expectedDeadlineDiff = Duration.between(savedAttempt.getStartTime(), savedAttempt.getDeadline());
        assertThat(expectedDeadlineDiff.toMinutes()).isEqualTo(60);

        // Snapshot should preserve containing section duration
        Map<String, Object> snapshot = savedAttempt.getExamSnapshot();
        assertThat(snapshot).isNotNull();
        assertThat(snapshot.get("durationMinutes")).isEqualTo(60);

        List<?> sections = (List<?>) snapshot.get("sections");
        assertThat(sections).hasSize(1);
        Map<?, ?> sectionMap = (Map<?, ?>) sections.get(0);
        assertThat(sectionMap.get("durationMinutes")).isEqualTo(60);
    }

    @Test
    void tc_tv305_be_02_part_outside_exam_throws_resource_not_found_without_saving() {
        ExamFixture exam = createFixture(60);
        when(examAdapter.findPublishedSnapshotById(42)).thenReturn(Optional.of(exam));

        CreateAttemptRequest request = createRequest(70, 999); // Part does not exist in exam

        assertThatThrownBy(() -> service.createAttempt(request))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.RESOURCE_NOT_FOUND);

        verify(testAttemptRepository, never()).save(any());
    }

    @Test
    void tc_tv305_be_03_invalid_section_duration_throws_invalid_request_without_saving() {
        ExamFixture exam = createFixture(null); // Section has null duration
        when(examAdapter.findPublishedSnapshotById(42)).thenReturn(Optional.of(exam));

        CreateAttemptRequest request = createRequest(70, 701);

        assertThatThrownBy(() -> service.createAttempt(request))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_REQUEST);

        verify(testAttemptRepository, never()).save(any());
    }
}
