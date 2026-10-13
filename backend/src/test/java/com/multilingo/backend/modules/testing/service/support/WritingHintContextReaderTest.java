package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.adapter.dto.PartFixture;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationRequest;
import com.multilingo.backend.modules.testing.ai.hints.WritingHintOutputParser;
import com.multilingo.backend.modules.testing.ai.hints.WritingHintPromptFactory;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WritingHintContextReaderTest {

    private WritingHintContextReader reader;

    @BeforeEach
    void setUp() {
        reader = new WritingHintContextReader();
    }

    @Test
    @DisplayName("Ưu tiên đọc grouped questions khi cả questionGroups và questions đều tồn tại")
    void prefersGroupedQuestionsOverFlat() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of(
                                                "partId", 1,
                                                "title", "Part 1 Writing",
                                                "questionGroups", List.of(
                                                        Map.of(
                                                                "instruction", "Group Instruction",
                                                                "questions", List.of(
                                                                        Map.of(
                                                                                "questionId", "w1",
                                                                                "type", "ESSAY",
                                                                                "prompt", "Write an essay about AI."
                                                                        )
                                                                )
                                                        )
                                                ),
                                                "questions", List.of(
                                                        Map.of(
                                                                "questionId", "w1",
                                                                "type", "ESSAY",
                                                                "prompt", "FLAT_PROMPT_SHOULD_BE_IGNORED"
                                                        )
                                                )
                                        )
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        WritingHintContextReader.HintContext context = reader.read(attempt, 1, "w1");

        assertThat(context.taskPrompt()).isEqualTo("Write an essay about AI.");
        assertThat(context.taskPrompt()).doesNotContain("FLAT_PROMPT_SHOULD_BE_IGNORED");
        assertThat(context.groupInstruction()).isEqualTo("Group Instruction");
        assertThat(context.hasVisualContext()).isFalse();
    }

    @Test
    @DisplayName("Đọc flat questions khi questionGroups absent (null)")
    void readsFlatQuestionsWhenGroupsAbsent() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of(
                                                "partId", 2,
                                                "title", "Writing Task 2",
                                                "questions", List.of(
                                                        Map.of(
                                                                "questionId", "w2",
                                                                "type", "ESSAY",
                                                                "content", "Discuss both views and give your opinion."
                                                        )
                                                )
                                        )
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        WritingHintContextReader.HintContext context = reader.read(attempt, 2, "w2");

        assertThat(context.taskPrompt()).isEqualTo("Discuss both views and give your opinion.");
        assertThat(context.partTitle()).isEqualTo("Writing Task 2");
        assertThat(context.hasVisualContext()).isFalse();
    }

    @Test
    @DisplayName("Loại trừ hoàn toàn answer key, explanation, grading context và các câu hỏi khác")
    void excludesSentinelsAndOtherQuestions() {
        String answerKeySentinel = "SECRET_ANSWER_KEY_12345";
        String explanationSentinel = "SECRET_EXPLANATION_67890";
        String privatePromptSentinel = "SECRET_PRIVATE_AI_PROMPT";
        String otherQuestionSentinel = "OTHER_TASK_SHOULD_NOT_LEAK";

        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of(
                                                "partId", 1,
                                                "title", "Writing Part",
                                                "questions", List.of(
                                                        Map.of(
                                                                "questionId", "w1",
                                                                "type", "ESSAY",
                                                                "question_text", "Prompt for w1 task.",
                                                                "correct_answer", answerKeySentinel,
                                                                "explanation", explanationSentinel,
                                                                "ai_prompt_context", privatePromptSentinel
                                                        ),
                                                        Map.of(
                                                                "questionId", "w2",
                                                                "type", "ESSAY",
                                                                "question_text", otherQuestionSentinel
                                                        )
                                                )
                                        )
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        WritingHintContextReader.HintContext context = reader.read(attempt, 1, "w1");

        assertThat(context.taskPrompt()).isEqualTo("Prompt for w1 task.");
        assertThat(context.taskPrompt()).doesNotContain(answerKeySentinel, explanationSentinel, privatePromptSentinel, otherQuestionSentinel);
    }

    @Test
    @DisplayName("Nhận diện cờ visualContext khi câu hỏi hoặc group chứa hình ảnh")
    void detectsVisualContextFlagWhenMediaPresent() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of(
                                                "partId", 1,
                                                "title", "Report Writing",
                                                "questions", List.of(
                                                        Map.of(
                                                                "questionId", "w1",
                                                                "type", "ESSAY",
                                                                "text", "The chart below shows energy consumption.",
                                                                "image_url", "https://example.com/chart.png"
                                                        )
                                                )
                                        )
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        WritingHintContextReader.HintContext context = reader.read(attempt, 1, "w1");

        assertThat(context.hasVisualContext()).isTrue();
    }

    @Test
    @DisplayName("Ném RESOURCE_NOT_FOUND khi partId không tồn tại trong snapshot")
    void throwsResourceNotFoundWhenPartIdNotInSnapshot() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of("partId", 1, "questions", List.of(Map.of("questionId", "w1", "type", "ESSAY", "prompt", "test")))
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        assertThatThrownBy(() -> reader.read(attempt, 999, "w1"))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    @DisplayName("Ném RESOURCE_NOT_FOUND khi questionId không tồn tại trong part")
    void throwsResourceNotFoundWhenQuestionIdNotInPart() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of("partId", 1, "questions", List.of(Map.of("questionId", "w1", "type", "ESSAY", "prompt", "test")))
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        assertThatThrownBy(() -> reader.read(attempt, 1, "w_unknown"))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    @DisplayName("Ném VALIDATION_FAILED khi câu hỏi là objective type (SINGLE_CHOICE, FILL_IN_THE_BLANK...)")
    void throwsValidationFailedWhenQuestionIsObjective() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "READING",
                                "parts", List.of(
                                        Map.of("partId", 1, "questions", List.of(Map.of("questionId", "q1", "type", "SINGLE_CHOICE", "prompt", "Select A or B")))
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        assertThatThrownBy(() -> reader.read(attempt, 1, "q1"))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("Ném WRITING_HINTS_CONTEXT_UNAVAILABLE khi prompt bị thiếu hoặc blank")
    void throwsContextUnavailableWhenPromptMissingOrBlank() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of("partId", 1, "questions", List.of(Map.of("questionId", "w1", "type", "ESSAY", "prompt", "   ")))
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        assertThatThrownBy(() -> reader.read(attempt, 1, "w1"))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE);
    }

    @Test
    @DisplayName("Ném WRITING_HINTS_CONTEXT_UNAVAILABLE khi context vượt quá 16.000 Unicode code points")
    void throwsContextUnavailableWhenContextExceeds16000CodePoints() {
        String hugePrompt = "a".repeat(16001);

        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of("partId", 1, "questions", List.of(Map.of("questionId", "w1", "type", "ESSAY", "prompt", hugePrompt)))
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        assertThatThrownBy(() -> reader.read(attempt, 1, "w1"))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE);
    }

    @Test
    @DisplayName("P1-02: Conflicting aliases ưu tiên scoped question precedence (question_id -> questionId -> id) và chỉ lấy selected task")
    void conflictingAliasesPrefersScopedQuestionPrecedenceAndExtractsSelectedTask() {
        String selectedTaskPrompt = "SELECTED_TASK_PROMPT_A";
        String otherTaskSentinel = "OTHER_TASK_SECRET_SENTINEL";

        // Snapshot có 2 câu hỏi:
        // Câu A: question_id = "w1", id = "internal-A" -> ScopedQuestionID là "w1", prompt là SELECTED_TASK_PROMPT_A
        // Câu B: question_id = "w2", id = "w1" -> ScopedQuestionID là "w2", prompt là OTHER_TASK_SECRET_SENTINEL
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of(
                                                "partId", 1,
                                                "title", "Writing Part",
                                                "questions", List.of(
                                                        Map.of(
                                                                "question_id", "w1",
                                                                "id", "internal-A",
                                                                "type", "ESSAY",
                                                                "prompt", selectedTaskPrompt
                                                        ),
                                                        Map.of(
                                                                "question_id", "w2",
                                                                "id", "w1",
                                                                "type", "ESSAY",
                                                                "prompt", otherTaskSentinel
                                                        )
                                                )
                                        )
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        WritingHintContextReader.HintContext context = reader.read(attempt, 1, "w1");

        assertThat(context.taskPrompt()).isEqualTo(selectedTaskPrompt);
        assertThat(context.taskPrompt()).doesNotContain(otherTaskSentinel);
    }

    @Test
    @DisplayName("P1-02: Cùng questionId ở part khác không bị xung đột hay rò rỉ đề part khác")
    void sameQuestionIdInDifferentPartDoesNotCollide() {
        String targetPartPrompt = "PART_1_WRITING_TASK";
        String otherPartSentinel = "OTHER_PART_TASK_SENTINEL";

        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "questions", List.of(
                                                        Map.of("question_id", "w1", "type", "ESSAY", "prompt", targetPartPrompt)
                                                )
                                        ),
                                        Map.of(
                                                "id", 2,
                                                "questions", List.of(
                                                        Map.of("question_id", "w1", "type", "ESSAY", "prompt", otherPartSentinel)
                                                )
                                        )
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        WritingHintContextReader.HintContext context = reader.read(attempt, 1, "w1");

        assertThat(context.taskPrompt()).isEqualTo(targetPartPrompt);
        assertThat(context.taskPrompt()).doesNotContain(otherPartSentinel);
    }

    @Test
    @DisplayName("P1-02: Part aliases đồng bộ với precedence của AttemptResultScope (id -> part_id -> partId)")
    void partAliasesMatchesScopePrecedence() {
        // Part có id=10, part_id=20, partId=30. Scope resolve là 10.
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of(
                                                "id", 10,
                                                "part_id", 20,
                                                "partId", 30,
                                                "questions", List.of(
                                                        Map.of("question_id", "w1", "type", "ESSAY", "prompt", "Task for Part 10")
                                                )
                                        )
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        WritingHintContextReader.HintContext context = reader.read(attempt, 10, "w1");
        assertThat(context.taskPrompt()).isEqualTo("Task for Part 10");
    }

    @Test
    @DisplayName("P1-02: Duplicate canonical question IDs trong cùng part fail-closed (RESOURCE_NOT_FOUND)")
    void duplicateCanonicalQuestionIdsFailClosed() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "questions", List.of(
                                                        Map.of("question_id", "w1", "type", "ESSAY", "prompt", "Task 1"),
                                                        Map.of("question_id", "w1", "type", "ESSAY", "prompt", "Task 2")
                                                )
                                        )
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        assertThatThrownBy(() -> reader.read(attempt, 1, "w1"))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    @DisplayName("P1-03: Serialized PartFixture có sharedMedia được nhận diện visualContext=true, truyền tới prompt và parser reject nếu thiếu limitation")
    void detectsVisualContextFromSerializedPartFixtureWithSharedMedia() {
        String mediaUrlSentinel = "https://example.com/charts/ielts-task1-secret-chart.png";

        PartFixture partFixture = new PartFixture();
        partFixture.setId(1);
        partFixture.setTitle("Writing Task 1 Academic");
        partFixture.setSharedMedia(Map.of(
                "type", "IMAGE",
                "url", mediaUrlSentinel
        ));
        partFixture.setQuestions(List.of(
                Map.of(
                        "question_id", "w1",
                        "type", "ESSAY",
                        "prompt", "The chart below shows global renewable energy share."
                )
        ));

        ObjectMapper mapper = new ObjectMapper();
        @SuppressWarnings("unchecked")
        Map<String, Object> partMap = mapper.convertValue(partFixture, Map.class);

        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(partMap)
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        WritingHintContextReader.HintContext context = reader.read(attempt, 1, "w1");

        // 1. Reader phát hiện visualContext = true
        assertThat(context.hasVisualContext()).isTrue();

        // 2. Prompt factory sinh userText với visualContext = true và KHÔNG rò rỉ URL media
        WritingHintPromptFactory promptFactory = new WritingHintPromptFactory();
        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("en", "en");
        GeminiGenerationRequest request = promptFactory.build(context, languages);

        assertThat(request.userText()).contains("\"visualContext\":true");
        assertThat(request.userText()).doesNotContain(mediaUrlSentinel);

        // 3. Output parser reject nếu output không có limitation khi visualContext = true
        WritingHintOutputParser parser = new WritingHintOutputParser(new LearningLanguageCatalog());
        String validJsonNoLimitations = """
                {
                  "hintLanguage": "en",
                  "outline": [
                    {"title": "Overview", "points": ["Identify main trends"]},
                    {"title": "Details", "points": ["Compare specific numbers"]}
                  ],
                  "vocabulary": [
                    {"term": "soar", "definition": "increase rapidly", "explanation": "use for sharp rise", "example": "Prices soared."},
                    {"term": "plummet", "definition": "fall rapidly", "explanation": "use for sharp drop", "example": "Sales plummeted."},
                    {"term": "fluctuate", "definition": "rise and fall irregularly", "explanation": "use for irregular movement", "example": "Figures fluctuated."},
                    {"term": "plateau", "definition": "reach a state of little change", "explanation": "use for leveling off", "example": "Trends plateaued."},
                    {"term": "outstrip", "definition": "move faster than", "explanation": "use for overtaking", "example": "Demand outstripped supply."}
                  ],
                  "limitations": []
                }
                """;

        assertThatThrownBy(() -> parser.parse(validJsonNoLimitations, "en", context.hasVisualContext()))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.WRITING_HINTS_INVALID_RESPONSE);
                    assertThat(appEx.getMessage()).isEqualTo("Task with visual context requires at least one limitation");
                });
    }

    @Test
    @DisplayName("P1-03: Nhận diện visualContext=true khi group có shared_media")
    void detectsVisualContextFromGroupSharedMedia() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of(
                                                "partId", 1,
                                                "title", "Task 1",
                                                "questionGroups", List.of(
                                                        Map.of(
                                                                "instruction", "Analyze the visual chart",
                                                                "shared_media", Map.of("type", "IMAGE", "url", "https://img.com/p.png"),
                                                                "questions", List.of(
                                                                        Map.of(
                                                                                "question_id", "w1",
                                                                                "type", "ESSAY",
                                                                                "prompt", "Summarize information."
                                                                        )
                                                                )
                                                        )
                                                )
                                        )
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        WritingHintContextReader.HintContext context = reader.read(attempt, 1, "w1");
        assertThat(context.hasVisualContext()).isTrue();
    }

    @Test
    @DisplayName("P2-01: Giữ nguyên văn task prompt không trim (whitespace, newline, emoji, Unicode)")
    void preservesVerbatimTaskPromptWithoutTrimmingAndPreservesEmojiAndUnicode() throws Exception {
        String verbatimPrompt = "  \nWriting task with emoji \uD83D\uDCDD and accents \u00E0\u00E9\u00EF.\n  ";

        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "questions", List.of(
                                                        Map.of("question_id", "w1", "type", "ESSAY", "prompt", verbatimPrompt)
                                                )
                                        )
                                )
                        )
                )
        );

        TestAttempt attempt = TestAttempt.builder().examSnapshot(snapshot).build();

        WritingHintContextReader.HintContext context = reader.read(attempt, 1, "w1");

        assertThat(context.taskPrompt()).isEqualTo(verbatimPrompt);

        // Kiểm tra đi qua prompt factory được đưa nguyên văn vào userText JSON
        WritingHintPromptFactory promptFactory = new WritingHintPromptFactory();
        WritingHintLanguageResolver.ResolvedLanguages languages =
                new WritingHintLanguageResolver.ResolvedLanguages("en", "en");
        GeminiGenerationRequest request = promptFactory.build(context, languages);

        ObjectMapper mapper = new ObjectMapper();
        assertThat(mapper.readTree(request.userText()).path("task").path("taskPrompt").asText())
                .isEqualTo(verbatimPrompt);
        assertThat(request.userText()).contains("Writing task with emoji \uD83D\uDCDD and accents \u00E0\u00E9\u00EF.");
    }

    @Test
    @DisplayName("P2-01: Kiểm tra ngưỡng biên chính xác 16.000 code points (hợp lệ) và 16.001 code points (bị từ chối)")
    void exactCodePointBoundaries16000And16001() {
        // Emoji \uD83D\uDCDD là 2 chars UTF-16 nhưng là 1 Unicode code point
        String prompt16000 = "a".repeat(15999) + "\uD83D\uDCDD";
        assertThat(prompt16000.codePointCount(0, prompt16000.length())).isEqualTo(16000);

        Map<String, Object> snapshot16000 = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of(Map.of("question_id", "w1", "type", "ESSAY", "prompt", prompt16000)))
                                )
                        )
                )
        );

        TestAttempt attempt16000 = TestAttempt.builder().examSnapshot(snapshot16000).build();
        WritingHintContextReader.HintContext context16000 = reader.read(attempt16000, 1, "w1");
        assertThat(context16000.taskPrompt()).isEqualTo(prompt16000);

        // Vượt quá đúng 1 code point: 16.001 code points
        String prompt16001 = "a".repeat(16000) + "\uD83D\uDCDD";
        assertThat(prompt16001.codePointCount(0, prompt16001.length())).isEqualTo(16001);

        Map<String, Object> snapshot16001 = Map.of(
                "sections", List.of(
                        Map.of(
                                "skill", "WRITING",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of(Map.of("question_id", "w1", "type", "ESSAY", "prompt", prompt16001)))
                                )
                        )
                )
        );

        TestAttempt attempt16001 = TestAttempt.builder().examSnapshot(snapshot16001).build();
        assertThatThrownBy(() -> reader.read(attempt16001, 1, "w1"))
                .isInstanceOf(AppException.class)
                .extracting(ex -> ((AppException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WRITING_HINTS_CONTEXT_UNAVAILABLE);
    }
}
