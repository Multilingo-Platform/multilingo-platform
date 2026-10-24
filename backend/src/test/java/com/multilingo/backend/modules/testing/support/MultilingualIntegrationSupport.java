package com.multilingo.backend.modules.testing.support;

import com.fasterxml.jackson.databind.*;
import com.multilingo.backend.modules.auth.entity.*;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.repository.*;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.repository.*;
import com.multilingo.backend.modules.exam.service.*;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.impl.JwtIdentityAdapter;
import com.multilingo.backend.modules.testing.ai.gemini.*;
import com.multilingo.backend.modules.testing.ai.media.ImageFetcher;
import com.multilingo.backend.modules.testing.config.*;
import com.multilingo.backend.modules.testing.dto.request.*;
import com.multilingo.backend.modules.testing.entity.*;
import com.multilingo.backend.modules.testing.entity.enums.*;
import com.multilingo.backend.modules.testing.repository.*;
import com.multilingo.backend.modules.testing.service.*;
import com.multilingo.backend.modules.testing.service.support.*;
import com.multilingo.backend.modules.testing.service.worker.WritingGradingWorker;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Uses the production identity adapter, services, transactions and repositories; fakes only external AI/media. */
@SpringBootTest(properties = {"testing.dictionary-lookup.enabled=true", "testing.writing-hints.enabled=true",
        "testing.writing-hints.min-interval=0s", "testing.writing-grading.enabled=true",
        "testing.writing-grading.multilingual-enabled=true", "testing.writing-grading.dispatcher-enabled=false"})
@ActiveProfiles("test")
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Import(MultilingualIntegrationSupport.IdentityConfig.class)
public abstract class MultilingualIntegrationSupport {
    @TestConfiguration(proxyBeanMethods = false)
    public static class IdentityConfig {
        @Bean @Primary IdentityAdapter productionIdentityForTest() { return new JwtIdentityAdapter(); }
    }
    @Autowired protected ObjectMapper mapper;
    @Autowired protected UserRepository users;
    @Autowired protected RoleRepository roles;
    @Autowired protected UserQuotaRepository quotas;
    @Autowired protected ExamRepository exams;
    @Autowired protected ExamSectionRepository sections;
    @Autowired protected ExamPartRepository parts;
    @Autowired protected AdminExamService admin;
    @Autowired protected StudentExamService library;
    @Autowired protected TestAttemptService attempts;
    @Autowired protected TestAttemptRepository attemptRepository;
    @Autowired protected WritingGradingJobRepository jobs;
    @Autowired protected DictionaryLookupRequestRepository dictionaryRecords;
    @Autowired protected PracticeDictionaryV2Service dictionary;
    @Autowired protected DictionaryLookupTransactionCoordinator dictionaryCoordinator;
    @Autowired protected WritingHintsService hints;
    @Autowired protected WritingFeedbackService feedback;
    @Autowired protected WritingGradingWorker worker;
    @Autowired protected WritingGradingTransactionCoordinator gradingCoordinator;
    @Autowired protected WritingGradingProperties gradingProperties;
    @Autowired protected GeminiProperties geminiProperties;
    @Autowired protected MockMvc mvc;
    @MockBean protected GeminiClient gemini;
    @MockBean protected ImageFetcher images;
    protected User actor;

    @Autowired protected javax.sql.DataSource dataSource;
    @BeforeAll
    protected void applyActualLedgerMigrations() throws Exception {
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            statement.execute("DROP TABLE IF EXISTS dictionary_lookup_requests");
            statement.execute("DROP TABLE IF EXISTS writing_grading_jobs");
            for (String script : List.of("V20261013210000__add_writing_grading_jobs.sql",
                    "V20261020120000__add_dictionary_lookup_requests.sql", "V20261020180000__add_dictionary_language_context.sql")) {
                try (var input = new org.springframework.core.io.ClassPathResource("db/migration/"+script).getInputStream()) {
                    statement.execute(new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
                }
            }
        }
    }

    @BeforeEach
    protected void prepareActorAndFakeProvider() {
        Role role = roles.findByName("USER").orElseGet(() -> roles.save(Role.builder().name("USER").build()));
        actor = users.saveAndFlush(User.builder().email(UUID.randomUUID()+"@ml.test").passwordHash("test-only")
                .fullName("Multilingual integration").nativeLanguage("vi").targetLanguage("en").role(role).build());
        authenticate(actor);
        for (String feature : List.of(UserQuotaReservationService.GRADING_FEATURE_CODE, UserQuotaReservationService.FEATURE_CODE)) {
            quotas.saveAndFlush(UserQuota.builder().userId(actor.getId()).featureCode(feature).usedCount(0)
                    .maxLimit(30).resetDate(Instant.now().plusSeconds(86400)).build());
        }
        geminiProperties.setEnabled(true);
        gradingProperties.setEnabled(true);
        gradingProperties.setMultilingualEnabled(true);
        reset(gemini, images);
        when(gemini.generate(any())).thenAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            GeminiGenerationRequest request = call.getArgument(0);
            JsonNode data = mapper.readTree(request.userText());
            Map<String, Object> output = new LinkedHashMap<>();
            if (data.has("selectedText")) {
                output.put("meaning", "Définition vérifiée"); output.put("phonetic", null); output.put("partOfSpeech", null);
                output.put("example", data.path("selectedText").asText()); output.put("exampleTranslation", "Exemple");
            } else if (data.has("originalEssay")) {
                output.put("feedbackLanguage", data.path("feedbackLanguage").asText());
                output.put("criteria", List.of("TR","CC","LR","GRA").stream()
                        .map(code -> Map.of("code",code,"score",10,"feedback","Bien.")).toList());
                output.put("overallFeedback", "Très bien."); output.put("correctedEssay", data.path("originalEssay").asText());
                output.put("corrections", List.of());
            } else {
                output.put("hintLanguage", data.path("hintLanguage").asText());
                output.put("outline", List.of(Map.of("title","Introduction","points",List.of("First point")),
                        Map.of("title","Conclusion","points",List.of("Final point"))));
                output.put("vocabulary", java.util.stream.IntStream.range(0,5).mapToObj(i ->
                        Map.of("term","term"+i,"definition","Definition","explanation","Context","example","Example")).toList());
                output.put("limitations", List.of());
            }
            return new GeminiGenerationResult(mapper.writeValueAsString(output), null);
        });
    }

    @AfterEach
    protected void clearAuthentication() { SecurityContextHolder.clearContext(); }

    protected void authenticate(User user) {
        var details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(details, "test", details.getAuthorities()));
    }

    protected record Seed(int examId, int readingPart, int writingPart, int writingSection) {}
    protected Seed publish(String language) throws Exception {
        Map<String,Object> reading = Map.of("question_id","objective","type","SINGLE_CHOICE","question_text","Choose",
                "options",List.of(Map.of("id","A","text","Yes"), Map.of("id","B","text","No")),
                "correct_answer","A","explanation","SERVER_SOLUTION_ONLY");
        Map<String,Object> writing = Map.of("question_id","essay","type","ESSAY","question_text","Write about this topic.","min_words",0);
        var request = mapper.convertValue(Map.of("title","Multilingual "+UUID.randomUUID(),"type","LANGUAGE_PRACTICE",
                "examLanguage",language,"isPublished",false,"sections",List.of(
                        Map.of("skillType","READING","durationMinutes",20,"parts",List.of(Map.of("partNumber",1,"contentData",
                                Map.of("part_title","Reading","question_groups",List.of(Map.of("group_id","passage","content_html","<p>水 a café Việt 日本語</p>","questions",List.of(reading))))))),
                        Map.of("skillType","WRITING","durationMinutes",20,"parts",List.of(Map.of("partNumber",1,"contentData",
                                Map.of("part_title","Writing","question_groups",List.of(Map.of("group_id","writing","questions",List.of(writing))))))))), ExamBuilderRequest.class);
        int examId=admin.createExam(request);
        admin.updateExamStatus(examId,true);
        var ss=sections.findByExam_Id(examId);
        int rp=parts.findBySection_Id(ss.stream().filter(s->s.getSkillType().equals("READING")).findFirst().orElseThrow().getId()).getFirst().getId();
        var ws=ss.stream().filter(s->s.getSkillType().equals("WRITING")).findFirst().orElseThrow();
        int wp=parts.findBySection_Id(ws.getId()).getFirst().getId();
        assertThat(library.searchExams(request.getTitle(),List.of("LANGUAGE_PRACTICE"),0,10,"id,desc",language).getItems()).hasSize(1);
        return new Seed(examId,rp,wp,ws.getId());
    }

    protected int start(Seed seed, TestMode mode) {
        var request=new CreateAttemptRequest();request.setExamId(seed.examId());request.setTestScope(TestScope.FULL_EXAM);request.setTestMode(mode);
        var workspace=attempts.createAttempt(request);
        assertThat(workspace.getExamSnapshot().toString()).doesNotContain("SERVER_SOLUTION_ONLY","correct_answer");
        return workspace.getAttemptId();
    }
    protected AutosaveAnswersRequest.PartAnswerDto answer(int part,String id,String text) {
        return new AutosaveAnswersRequest.PartAnswerDto(part,List.of(new AutosaveAnswersRequest.QuestionAnswerDto(id,text)));
    }
    protected void submit(int attempt,Seed seed,String essay,String feedbackLanguage) {
        int initialVersion=attempts.getAttemptWorkspace(attempt).getVersion();
        var saved=attempts.autosaveAnswers(attempt,new AutosaveAnswersRequest(initialVersion,List.of(answer(seed.readingPart(),"objective","A"),answer(seed.writingPart(),"essay",essay))));
        assertThat(attempts.getAttemptWorkspace(attempt).getVersion()).isEqualTo(saved.getVersion());
        attempts.submitAttempt(attempt,new SubmitAttemptRequest(SubmitReason.MANUAL,saved.getVersion(),null,feedbackLanguage));
    }
}
