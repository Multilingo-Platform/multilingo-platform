package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.*;
import com.multilingo.backend.modules.testing.adapter.*;
import com.multilingo.backend.modules.testing.adapter.impl.DbExamAdapter;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.*;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.repository.*;
import com.multilingo.backend.modules.testing.service.impl.TestAttemptServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DraftAttemptAccessTest {
    private final ExamRepository exams=mock(ExamRepository.class);
    private final TestAttemptRepository attempts=mock(TestAttemptRepository.class);
    private final IdentityAdapter identity=mock(IdentityAdapter.class);
    private final TestAttemptServiceImpl service=new TestAttemptServiceImpl(attempts,mock(AttemptAnswerRepository.class),
        new DbExamAdapter(exams,mock(ExamSectionRepository.class),mock(ExamPartRepository.class),new ObjectMapper()),
        identity,new ObjectMapper(),mock(GradingAdapter.class),mock(ObjectiveGradingService.class),mock(PlatformTransactionManager.class),mock(EntityManager.class),
        mock(com.multilingo.backend.modules.testing.service.support.WritingGradingEnqueuer.class),
        new com.multilingo.backend.modules.testing.service.support.WritingGradingAttemptStateResolver());

    private CreateAttemptRequest request(boolean published) {
        Exam e=Exam.builder().title("ETS draft").type("TOEIC_LR").isPublished(published).durationMinutes(120).build();e.setId(9);
        when(exams.findById(9)).thenReturn(Optional.of(e));when(identity.getCurrentUserId()).thenReturn(1);
        when(attempts.save(any())).thenAnswer(i->{TestAttempt a=i.getArgument(0);a.setId(10);return a;});
        CreateAttemptRequest r=new CreateAttemptRequest();r.setExamId(9);r.setTestMode(TestMode.PRACTICE);r.setTestScope(TestScope.FULL_EXAM);return r;
    }
    @Test void directStartOfDraftFailsWithoutPersistingAttempt() {
        var request=request(false);
        assertThatThrownBy(()->service.createAttempt(request)).isInstanceOf(AppException.class);
        verify(attempts,never()).save(any());
    }
    @Test void directStartOfPublishedExamStillWorks() {
        assertThat(service.createAttempt(request(true)).getAttemptId()).isEqualTo(10);
    }
}
