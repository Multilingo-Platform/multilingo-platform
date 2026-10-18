package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.service.impl.StudentExamServiceImpl;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Opt-in PostgreSQL smoke. It is enabled only for the dedicated official_exams_test database.
 * The test transaction rolls back a newly seeded dataset; application startup still
 * runs the normal test-profile bootstrap, so point it only at a disposable database.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "1", roles = "USER")
@EnabledIfEnvironmentVariable(named = "OFFICIAL_EXAM_POSTGRES_TEST_URL",
        matches = "jdbc:postgresql://[^/]+/official_exams_test(\\?.*)?")
class OfficialCatalogPostgresIT {
    private static final String TOEIC_RESOURCE = "/datasets/official-source/ets-2024-test-1-completed.xlsx";

    @Autowired private ExamParserService parser;
    @Autowired private DefaultExamDatasetService datasets;
    @Autowired private AdminExamService admin;
    @Autowired private StudentExamServiceImpl studentExams;
    @Autowired private ExamRepository exams;
    @Autowired private ObjectMapper mapper;
    @Autowired private Environment environment;

    @DynamicPropertySource
    static void configureDisposablePostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("OFFICIAL_EXAM_POSTGRES_TEST_URL"));
        registry.add("spring.datasource.username", () -> System.getenv("OFFICIAL_EXAM_POSTGRES_TEST_USERNAME"));
        registry.add("spring.datasource.password", () -> System.getenv("OFFICIAL_EXAM_POSTGRES_TEST_PASSWORD"));
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @Test
    void postgresCatalogReturnsTheCanonicalPublishedToeicDataset() throws Exception {
        ExamDatasetBundle bundle = parseToeicBundle();
        var existing = exams.findByCode(bundle.examCode());
        if (existing.isEmpty()) {
            datasets.seed(java.util.List.of(bundle), true);
        } else {
            assertThat(ExamDatasetBundle.digest(admin.getExamDetail(existing.get().getId())))
                    .isEqualTo(bundle.checksum());
        }

        var stored = exams.findByCode(bundle.examCode()).orElseThrow();
        assertThat(stored.getIsPublished()).isTrue();
        assertThat(OfficialExamTestData.questions(admin.getExamDetail(stored.getId()))).hasSize(200);
        var catalog = studentExams.searchExams("ETS 2024 Test 1", java.util.List.of("TOEIC_LR"), 0, 20, "createdAt");
        assertThat(catalog.getItems()).anySatisfy(item -> assertThat(item.getCode()).isEqualTo(bundle.examCode()));
        assertThat(environment.getProperty("spring.datasource.url")).contains("test");
    }

    private ExamDatasetBundle parseToeicBundle() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(TOEIC_RESOURCE)) {
            assertThat(input).isNotNull();
            try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(input.readAllBytes()))) {
                var preview = new ExcelV2ExamParser().parse(workbook,
                        OfficialExamSourceProfile.ETS_2024_COMPLETED_SHA256);
                return ExamDatasetBundle.exportOfficial(preview.request(), OfficialExamDatasetRegistry.ETS_TOEIC_KEY,
                        "TEST-ONLY; no release approval");
            }
        }
    }
}
