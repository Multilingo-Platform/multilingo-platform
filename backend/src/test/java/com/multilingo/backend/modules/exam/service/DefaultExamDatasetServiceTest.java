package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DefaultExamDatasetServiceTest {
    private final ExamRepository repository = mock(ExamRepository.class);
    private final AdminExamService admin = mock(AdminExamService.class);
    private final DefaultExamDatasetService service = new DefaultExamDatasetService(repository, admin, new ObjectMapper());

    private ExamDatasetBundle bundle() throws Exception {
        try (var workbook = ExcelV2Fixture.workbook()) {
            var request = new ExamParserService(new ObjectMapper()).parseExamFile(ExcelV2Fixture.file(workbook));
            var original = ExamDatasetBundle.export(request);
            return new ExamDatasetBundle(original.schemaVersion(), original.datasetKey(), original.version(),
                original.examCode(), new ExamDatasetBundle.Source("synthetic-test.xlsx", "a".repeat(64), "TEST-FIXTURE-APPROVED"),
                original.checksum(), original.request());
        }
    }

    @Test void createsWithStableCodeAndUnpublishedThenSkipsEquivalentPublishedData() throws Exception {
        var bundle = bundle();
        when(repository.findByCode(bundle.examCode())).thenReturn(Optional.empty());
        when(admin.createExamWithCode(any(), eq(bundle.examCode()))).thenReturn(12);
        assertThat(service.seed(List.of(bundle))).isEqualTo(1);
        assertThat(bundle.request().isPublished()).isFalse();
        Exam existing = new Exam(); existing.setId(12);
        when(repository.findByCode(bundle.examCode())).thenReturn(Optional.of(existing));
        var published = new ExamContentNormalizer().normalize(bundle.request());
        published.setPublished(true);
        when(admin.getExamDetail(12)).thenReturn(published);
        assertThat(service.seed(List.of(bundle))).isZero();
        verify(admin, times(1)).createExamWithCode(any(), any());
        assertThat(published.isPublished()).isTrue();
    }

    @Test void rejectsConflictChecksumAndUnapprovedBundleWithoutWriting() throws Exception {
        var bundle = bundle();
        var bad = new ExamDatasetBundle(1, bundle.datasetKey(), 1, bundle.examCode(), bundle.source(), "b".repeat(64), bundle.request());
        assertThatThrownBy(() -> service.seed(List.of(bad))).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        var unapproved = ExamDatasetBundle.export(bundle.request());
        assertThatThrownBy(() -> service.seed(List.of(unapproved))).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        Exam existing = new Exam(); existing.setId(12);
        when(repository.findByCode(bundle.examCode())).thenReturn(Optional.of(existing));
        var changed = new ExamContentNormalizer().normalize(bundle.request()); changed.setTitle("Other title");
        when(admin.getExamDetail(12)).thenReturn(changed);
        assertThatThrownBy(() -> service.seed(List.of(bundle))).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        verify(admin, never()).createExamWithCode(any(), any());
    }

    @Test void validatesAllBundlesBeforeCreatingAndExportRejectsIncompleteContent() throws Exception {
        var bundle = bundle();
        assertThatThrownBy(() -> service.seed(List.of(bundle, bundle))).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        verify(admin, never()).createExamWithCode(any(), any());
        bundle.request().getSections().get(1).setParts(new ArrayList<>(bundle.request().getSections().get(1).getParts().subList(1,3)));
        assertThatThrownBy(() -> ExamDatasetBundle.export(bundle.request())).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
    }
}
