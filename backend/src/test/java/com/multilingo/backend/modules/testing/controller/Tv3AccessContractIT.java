package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.impl.JwtIdentityAdapter;
import com.multilingo.backend.modules.testing.config.WritingHintsProperties;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * TV3-22-02 Access Control & Security Contract Integration Test.
 * Validates strict ownership isolation through production JwtIdentityAdapter and CustomUserDetails,
 * mode & scope restrictions, rejection of live attempts on review, zero side effects on denied requests,
 * and fail-closed authentication behavior on missing/invalid principals.
 */
@SpringBootTest(properties = "spring.main.allow-bean-definition-overriding=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(Tv3AccessContractIT.TestIdentityConfig.class)
class Tv3AccessContractIT {

    @TestConfiguration
    static class TestIdentityConfig {
        @Bean
        @Primary
        public IdentityAdapter testIdentityAdapter() {
            return new JwtIdentityAdapter();
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private ExamSectionRepository examSectionRepository;

    @Autowired
    private ExamPartRepository examPartRepository;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @Autowired
    private WritingHintsProperties writingHintsProperties;

    private final List<Integer> createdAttemptIds = new ArrayList<>();
    private final List<Integer> createdExamIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        writingHintsProperties.setEnabled(true);
    }

    @AfterEach
    void tearDown() {
        writingHintsProperties.setEnabled(false);
        for (Integer attemptId : createdAttemptIds) {
            try {
                attemptAnswerRepository.deleteAll(attemptAnswerRepository.findByAttemptId(attemptId));
                testAttemptRepository.deleteById(attemptId);
            } catch (Exception ignored) {}
        }
        createdAttemptIds.clear();

        for (Integer examId : createdExamIds) {
            try {
                List<ExamSection> sections = examSectionRepository.findByExam_Id(examId);
                for (ExamSection s : sections) {
                    examPartRepository.deleteAll(examPartRepository.findBySection_Id(s.getId()));
                }
                examSectionRepository.deleteAll(sections);
                examRepository.deleteById(examId);
            } catch (Exception ignored) {}
        }
        createdExamIds.clear();

        SecurityContextHolder.clearContext();
    }

    private static RequestPostProcessor asStudent(int userId) {
        Role role = Role.builder().name("STUDENT").build();
        User user = User.builder()
                .email("student" + userId + "@multilingo.com")
                .role(role)
                .isActive(true)
                .build();
        user.setId(userId);
        CustomUserDetails userDetails = new CustomUserDetails(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        return SecurityMockMvcRequestPostProcessors.authentication(auth);
    }

    private TestAttempt seedAttemptForUser(Integer ownerUserId, TestMode mode, AttemptStatus status, String examType) {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("id", "q_access_1");
        question.put("question_id", "q_access_1");
        question.put("type", "SINGLE_CHOICE");
        question.put("text", "Access verification question");
        question.put("correct_answer", "A");
        question.put("explanation", "Secret access reasoning");

        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", 101);
        part.put("part_number", 1);
        part.put("title", "Access Part 1");
        part.put("questions", List.of(question));

        Map<String, Object> section = new LinkedHashMap<>();
        section.put("id", 10);
        section.put("skillType", "READING");
        section.put("name", "Reading Section");
        section.put("parts", List.of(part));

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", 999);
        snapshot.put("code", "ACCESS-EXAM-01");
        snapshot.put("type", examType != null ? examType : "TOEIC");
        snapshot.put("title", "Access Verification Exam");
        snapshot.put("sections", List.of(section));

        TestAttempt attempt = TestAttempt.builder()
                .userId(ownerUserId)
                .examId(999)
                .testScope(TestScope.FULL_EXAM)
                .testMode(mode)
                .status(status)
                .startTime(Instant.now().minusSeconds(120))
                .deadline(Instant.now().plusSeconds(3600))
                .version(1)
                .examSnapshot(snapshot)
                .lockedSections(new ArrayList<>())
                .build();

        TestAttempt saved = testAttemptRepository.save(attempt);
        createdAttemptIds.add(saved.getId());
        return saved;
    }

    @Test
    @DisplayName("TC_TV3_22_05: User khác (User 2) bị từ chối 403 FORBIDDEN trên mọi endpoints của User 1 và không gây đột biến dữ liệu")
    void testOtherUserAttempt_forbiddenAcrossAllEndpoints() throws Exception {
        // Attempt thuộc sở hữu của User 1
        TestAttempt ownerAttempt = seedAttemptForUser(1, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS, "TOEIC");
        Integer attemptId = ownerAttempt.getId();

        // Legitimate owner (User 1) can access workspace
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/workspace").with(asStudent(1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId));

        // Attacker (User 2) tries all 9 endpoints -> All 403 FORBIDDEN

        // 1. GET workspace -> 403
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/workspace").with(asStudent(2)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // 2. PUT autosave answers -> 403
        AutosaveAnswersRequest autosaveReq = new AutosaveAnswersRequest();
        autosaveReq.setVersion(1);
        autosaveReq.setAnswers(List.of(
                AutosaveAnswersRequest.PartAnswerDto.builder()
                        .partId(101)
                        .answers(List.of(new AutosaveAnswersRequest.QuestionAnswerDto("q_access_1", "B")))
                        .build()
        ));
        mockMvc.perform(put("/api/v1/attempts/" + attemptId + "/answers").with(asStudent(2))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(autosaveReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // 3. POST submit -> 403
        SubmitAttemptRequest submitReq = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/submit").with(asStudent(2))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submitReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // 4. GET result -> 403
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/result").with(asStudent(2)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // 5. GET review -> 403
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/review/101").with(asStudent(2)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // 6. GET listening playback -> 403
        mockMvc.perform(get("/api/v1/attempts/" + attemptId + "/listening-playback").with(asStudent(2)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // 7. POST listening playback start -> 403
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/listening-playback/start").with(asStudent(2)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // 8. POST practice feedback -> 403
        String feedbackJson = "{\"partId\": 101, \"questionId\": \"q_access_1\", \"answer\": \"A\"}";
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/practice-feedback").with(asStudent(2))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(feedbackJson))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // 9. POST writing hints -> 403
        String hintJson = "{\"partId\": 101, \"questionId\": \"q_access_1\", \"requestId\": \"a1b2c3d4-e5f6-7890-abcd-ef1234567890\", \"learningLanguage\": \"en\", \"hintLanguage\": \"vi\"}";
        mockMvc.perform(post("/api/v1/attempts/" + attemptId + "/writing-hints").with(asStudent(2))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(hintJson))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // Invariant check: Verify zero mutation on User 1's attempt
        TestAttempt reloaded = testAttemptRepository.findById(attemptId).orElseThrow();
        assertThat(reloaded.getVersion()).isEqualTo(1);
        assertThat(reloaded.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
        assertThat(reloaded.getUserId()).isEqualTo(1);
        assertThat(attemptAnswerRepository.findByAttemptId(attemptId)).isEmpty();
    }

    @Test
    @DisplayName("TC_TV3_22_07: Practice feedback bị từ chối 403 FORBIDDEN trên bài thi MOCK_TEST")
    void testPracticeFeedback_rejectedInMockTestMode() throws Exception {
        TestAttempt mockAttempt = seedAttemptForUser(1, TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS, "TOEIC");

        String feedbackJson = "{\"partId\": 101, \"questionId\": \"q_access_1\", \"answer\": \"A\"}";
        mockMvc.perform(post("/api/v1/attempts/" + mockAttempt.getId() + "/practice-feedback").with(asStudent(1))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(feedbackJson))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("TC_TV3_22_14: Listening playback bị từ chối 403 FORBIDDEN trên bài thi không phải TOEIC")
    void testListeningPlayback_rejectedForNonToeicExam() throws Exception {
        TestAttempt ieltsAttempt = seedAttemptForUser(1, TestMode.MOCK_TEST, AttemptStatus.IN_PROGRESS, "IELTS_ACADEMIC");

        mockMvc.perform(get("/api/v1/attempts/" + ieltsAttempt.getId() + "/listening-playback").with(asStudent(1)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        mockMvc.perform(post("/api/v1/attempts/" + ieltsAttempt.getId() + "/listening-playback/start").with(asStudent(1)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("Kiểm tra phân định: attempt không tồn tại trả 403 FORBIDDEN, partId sai phạm vi trả 404 NOT_FOUND")
    void testUnknownAttemptOrPart_returns404() throws Exception {
        // Non-existent attemptId (chống quét ID bài thi -> trả 403 FORBIDDEN)
        mockMvc.perform(get("/api/v1/attempts/999999/workspace").with(asStudent(1)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // Non-existent partId in existing attempt (completed so it passes in-progress check -> trả 404 NOT_FOUND)
        TestAttempt completedAttempt = seedAttemptForUser(1, TestMode.PRACTICE, AttemptStatus.COMPLETED, "TOEIC");
        mockMvc.perform(get("/api/v1/attempts/" + completedAttempt.getId() + "/review/888888").with(asStudent(1)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    @DisplayName("Bài thi IN_PROGRESS bị từ chối 400 INVALID_REQUEST khi truy cập Result và Review")
    void testLiveAttempt_resultAndReview_rejectedWhenInProgress() throws Exception {
        TestAttempt liveAttempt = seedAttemptForUser(1, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS, "TOEIC");

        mockMvc.perform(get("/api/v1/attempts/" + liveAttempt.getId() + "/result").with(asStudent(1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        mockMvc.perform(get("/api/v1/attempts/" + liveAttempt.getId() + "/review/101").with(asStudent(1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("Fail-closed: Request chưa xác thực (thiếu token) bị từ chối 401 UNAUTHORIZED")
    void testUnauthenticatedRequest_rejectedWith401() throws Exception {
        TestAttempt attempt = seedAttemptForUser(1, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS, "TOEIC");
        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/workspace"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ErrorCode.UNAUTHENTICATED_ACCESS.getCode()));
    }

    @Test
    @DisplayName("Fail-closed: Principal chuỗi không hợp lệ qua security filter bị JwtIdentityAdapter từ chối 401")
    void testStringPrincipal_rejectedWith401() throws Exception {
        TestAttempt attempt = seedAttemptForUser(1, TestMode.PRACTICE, AttemptStatus.IN_PROGRESS, "TOEIC");
        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/workspace")
                        .with(SecurityMockMvcRequestPostProcessors.user("anonymousStudent").roles("USER")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ErrorCode.UNAUTHENTICATED_ACCESS.getCode()));
    }

    @Test
    @DisplayName("Xác thực JwtIdentityAdapter trích xuất chính xác userId từ CustomUserDetails")
    void testJwtIdentityAdapter_customUserDetails_extractsUserId() {
        JwtIdentityAdapter adapter = new JwtIdentityAdapter();

        // 1. Authenticated with CustomUserDetails
        User user = new User();
        user.setId(77);
        user.setEmail("student77@multilingo.com");

        CustomUserDetails userDetails = new CustomUserDetails(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertEquals(77, adapter.getCurrentUserId());

        // 2. Unauthenticated -> AppException(UNAUTHENTICATED_ACCESS)
        SecurityContextHolder.clearContext();
        AppException ex1 = assertThrows(AppException.class, adapter::getCurrentUserId);
        assertEquals(ErrorCode.UNAUTHENTICATED_ACCESS, ex1.getErrorCode());

        // 3. String Principal -> AppException(UNAUTHENTICATED_ACCESS)
        UsernamePasswordAuthenticationToken stringAuth =
                new UsernamePasswordAuthenticationToken("anonymousStudent", null);
        SecurityContextHolder.getContext().setAuthentication(stringAuth);
        AppException ex2 = assertThrows(AppException.class, adapter::getCurrentUserId);
        assertEquals(ErrorCode.UNAUTHENTICATED_ACCESS, ex2.getErrorCode());
    }
}
