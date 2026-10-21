package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.service.impl.StudentExamServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

/** Opt-in real PostgreSQL regression; never points at the application database. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "1", roles = "USER")
@EnabledIfEnvironmentVariable(named = "OFFICIAL_EXAM_POSTGRES_TEST_URL",
        matches = "jdbc:postgresql://[^/]+/official_exams_test(\\?.*)?")
class NltvDatasetPostgresIT {
    @Autowired ExamRepository exams;
    @Autowired ExamPartRepository parts;
    @Autowired DefaultExamDatasetService datasets;
    @Autowired AdminExamService admin;
    @Autowired StudentExamServiceImpl catalog;
    @Autowired ObjectMapper mapper;
    private ExamDatasetBundle bundle;

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> System.getenv("OFFICIAL_EXAM_POSTGRES_TEST_URL"));
        properties.add("spring.datasource.username", () -> System.getenv("OFFICIAL_EXAM_POSTGRES_TEST_USERNAME"));
        properties.add("spring.datasource.password", () -> System.getenv("OFFICIAL_EXAM_POSTGRES_TEST_PASSWORD"));
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        properties.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        properties.add("spring.jpa.hibernate.ddl-auto", () -> "update");
        properties.add("spring.flyway.enabled", () -> "false");
    }

    @BeforeEach
    void loadApprovedBundle() throws Exception {
        try (var input = getClass().getResourceAsStream("/datasets/exams/nltv-sample-test-1.v2.json")) {
            assertThat(input).isNotNull();
            bundle = mapper.readValue(input, ExamDatasetBundle.class);
        }
        assertThat(exams.findByCode("NLTV-SAMPLE-T1-V1"))
                .as("Dedicated regression database must not contain a committed NLTV exam").isEmpty();
    }

    @Test
    void draftIsHiddenAndExplicitPublishIsIdempotentWithoutReplacingParts() {
        assertThat(datasets.seed(List.of(bundle), false)).isEqualTo(1);
        var exam = exams.findByCode("NLTV-SAMPLE-T1-V1").orElseThrow();
        assertThat(exam.getIsPublished()).isFalse();
        assertThat(exam.getDurationMinutes()).isEqualTo(180);
        assertThat(catalog.searchExams(null, List.of("NLTV"), 0, 20, "createdAt").getItems()).isEmpty();
        var originalPartIds = parts.findAll().stream().map(part -> part.getId()).sorted().toList();
        assertThat(originalPartIds).hasSize(9);
        assertThat(ExamDatasetBundle.digest(admin.getExamDetail(exam.getId()))).isEqualTo(bundle.checksum());

        assertThat(datasets.seed(List.of(bundle), true)).isZero();
        assertThat(datasets.seed(List.of(bundle), true)).isZero();
        assertThat(exams.findByCode(bundle.examCode()).orElseThrow().getId()).isEqualTo(exam.getId());
        assertThat(parts.findAll().stream().map(part -> part.getId()).sorted().toList()).isEqualTo(originalPartIds);
        assertThat(catalog.searchExams(null, List.of("NLTV"), 0, 20, "createdAt").getItems())
                .singleElement().satisfies(item -> assertThat(item.getId()).isEqualTo(exam.getId()));
    }

    @Test
    void existingDifferentContentIsRejectedWithoutOverwritingOrPublishing() {
        datasets.seed(List.of(bundle), false);
        var exam = exams.findByCode(bundle.examCode()).orElseThrow();
        exam.setTitle("Existing content must survive");
        exams.saveAndFlush(exam);

        assertThatThrownBy(() -> datasets.seed(List.of(bundle), true))
                .isInstanceOfSatisfying(AppException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
        assertThat(exam.getTitle()).isEqualTo("Existing content must survive");
        assertThat(exam.getIsPublished()).isFalse();
        assertThat(parts.count()).isEqualTo(9);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void laterBundleConflictRollsBackNltvCreateAndPublishAtTheServiceBoundary() throws Exception {
        ExamDatasetBundle other;
        try (var input = getClass().getResourceAsStream("/datasets/exams/ets-2024-test-1.v2.json")) {
            other = mapper.readValue(input, ExamDatasetBundle.class);
        }
        assertThat(exams.findByCode(other.examCode())).isEmpty();
        datasets.seed(List.of(other), false);
        var conflicting = exams.findByCode(other.examCode()).orElseThrow();
        try {
            conflicting.setTitle("Existing content must survive a batch conflict");
            exams.saveAndFlush(conflicting);
            long initialExams = exams.count();
            long initialParts = parts.count();

            assertThatThrownBy(() -> datasets.seed(List.of(bundle, other), true))
                    .isInstanceOfSatisfying(AppException.class,
                            error -> assertThat(error.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));

            assertThat(exams.findByCode(bundle.examCode())).isEmpty();
            assertThat(exams.count()).isEqualTo(initialExams);
            assertThat(parts.count()).isEqualTo(initialParts);
            assertThat(exams.findById(conflicting.getId()).orElseThrow().getIsPublished()).isFalse();
        } finally {
            // Only rows created by this test, on the name-guarded disposable database.
            exams.findByCode(bundle.examCode()).ifPresent(exam -> admin.deleteExam(exam.getId()));
            admin.deleteExam(conflicting.getId());
        }
    }
}
