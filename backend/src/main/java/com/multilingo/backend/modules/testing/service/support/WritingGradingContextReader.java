package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContext;
import com.multilingo.backend.modules.testing.ai.grading.WritingImageRef;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import com.multilingo.backend.modules.testing.util.WritingWordCounter;
import com.multilingo.backend.modules.testing.util.WritingLengthCounter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Đọc và đóng băng ngữ cảnh đề bài Writing, ngôn ngữ học tập, và tham chiếu hình ảnh
 * từ attempt snapshot bất biến và danh sách bài nộp của thí sinh.
 * Tuân thủ phạm vi phân quyền, giới hạn kích thước ký tự, và quy tắc multimodal Revision R2.
 */
@Component
public class WritingGradingContextReader {

    public static final int MAX_CONTEXT_CODE_POINTS = 16000;
    public static final int MAX_ESSAY_CODE_POINTS = 8000;
    public static final int MAX_IMAGES_PER_TASK = 2;
    public static final int MAX_IMAGE_URL_LENGTH = 2048;
    public static final String SUPPORTED_LEARNING_LANGUAGE = "en";
    private static final LearningLanguageCatalog LANGUAGE_CATALOG = new LearningLanguageCatalog();
    private final WritingLengthCounter lengthCounter = new WritingLengthCounter();

    private static final Pattern IMG_TAG_PATTERN = Pattern.compile("(?i)<img\\b");

    private static final List<String> MEDIA_KEYS = List.of(
            "shared_media", "sharedMedia",
            "image_url", "imageUrl", "images", "image",
            "media", "diagram", "chart_url", "chartUrl",
            "attachments", "attachment"
    );

    private static final List<String> UNSUPPORTED_MEDIA_KEYS = List.of(
            "shared_audio", "sharedAudio",
            "audio_url", "audioUrl", "audio",
            "video_url", "videoUrl", "video"
    );

    private static final Set<String> NON_IMAGE_EXTENSIONS = Set.of(
            ".mp3", ".wav", ".aac", ".ogg", ".flac",
            ".mp4", ".avi", ".mov", ".mkv", ".webm",
            ".pdf", ".doc", ".docx", ".zip"
    );

    private final boolean imagesEnabled;
    private final WritingHintContextReader hintContextReader;

    @Autowired
    public WritingGradingContextReader(
            @Value("${testing.writing-grading.images-enabled:false}") boolean imagesEnabled,
            @Autowired(required = false) WritingHintContextReader hintContextReader) {
        this.imagesEnabled = imagesEnabled;
        this.hintContextReader = hintContextReader != null ? hintContextReader : new WritingHintContextReader();
    }

    public WritingGradingContextReader(boolean imagesEnabled) {
        this(imagesEnabled, new WritingHintContextReader());
    }

    public WritingGradingContextReader() {
        this(false, new WritingHintContextReader());
    }

    /**
     * Đọc và đánh giá tính đủ điều kiện (eligibility) của câu hỏi Writing theo cờ images-enabled mặc định của cấu hình.
     */
    public ContextDecision read(TestAttempt attempt, Integer partId, String questionId, List<AttemptAnswer> answers) {
        return read(attempt, partId, questionId, answers, this.imagesEnabled);
    }

    /**
     * Đọc và đánh giá tính đủ điều kiện của câu hỏi Writing với cờ imagesEnabled tùy chỉnh.
     */
    public ContextDecision read(TestAttempt attempt, Integer partId, String questionId, List<AttemptAnswer> answers, boolean imagesEnabledOverride) {
        if (attempt == null || attempt.getExamSnapshot() == null) {
            return new ContextDecision.Unavailable("MISSING_ATTEMPT_OR_SNAPSHOT", "Attempt or exam snapshot not found");
        }
        if (partId == null || questionId == null || questionId.isBlank()) {
            return new ContextDecision.Unavailable("INVALID_TARGET", "partId and questionId must not be null or blank");
        }

        Map<String, Object> snapshot = attempt.getExamSnapshot();

        // 1. Resolve language strictly from the immutable attempt snapshot.
        Object langObj = snapshot.get("examLanguage");
        if (langObj == null) {
            langObj = snapshot.get("exam_language");
        }
        if (langObj == null || !(langObj instanceof String langStr) || langStr.isBlank()) {
            return new ContextDecision.Unavailable("MISSING_LANGUAGE", "Exam language is missing from attempt snapshot");
        }
        String canonicalLang = LANGUAGE_CATALOG.findNormalized(langStr).orElse(null);
        if (canonicalLang == null) {
            return new ContextDecision.Unavailable("UNSUPPORTED_LANGUAGE", "Exam language is not supported for writing grading");
        }

        // 2. Xác thực phạm vi và kiểu câu hỏi thông qua AttemptResultScope
        List<AttemptResultScope.ScopedPart> scopedParts;
        try {
            scopedParts = AttemptResultScope.read(snapshot);
        } catch (AppException e) {
            return new ContextDecision.Unavailable("INVALID_SCOPE", "Invalid attempt snapshot scope");
        }

        AttemptResultScope.ScopedPart targetScopedPart = scopedParts.stream()
                .filter(sp -> Objects.equals(sp.getPartId(), partId))
                .findFirst()
                .orElse(null);

        if (targetScopedPart == null) {
            return new ContextDecision.Unavailable("PART_NOT_FOUND", "Part not found in attempt snapshot");
        }

        if (!"WRITING".equalsIgnoreCase(targetScopedPart.getSkill())) {
            return new ContextDecision.Unavailable("NOT_WRITING_SECTION", "Part does not belong to WRITING section");
        }

        AttemptResultScope.ScopedQuestion targetScopedQuestion = targetScopedPart.getQuestions().stream()
                .filter(sq -> Objects.equals(sq.getQuestionId(), questionId))
                .findFirst()
                .orElse(null);

        if (targetScopedQuestion == null) {
            return new ContextDecision.Unavailable("QUESTION_NOT_FOUND", "Question not found in part");
        }

        String qType = targetScopedQuestion.getType();
        boolean isEssay = "ESSAY".equalsIgnoreCase(qType);
        if (!isEssay || targetScopedQuestion.isObjective()) {
            return new ContextDecision.Unavailable("NOT_AN_ESSAY", "Question is not an ESSAY task");
        }

        // 3. Tái sử dụng WritingHintContextReader.read() để lấy text context đã được allowlist và validate
        WritingHintContextReader.HintContext hintContext;
        try {
            hintContext = this.hintContextReader.read(attempt, partId, questionId);
        } catch (AppException e) {
            String msg = e.getMessage();
            if (msg != null && msg.contains("Part not found")) {
                return new ContextDecision.Unavailable("PART_NOT_FOUND", "Part not found in attempt snapshot");
            } else if (msg != null && msg.contains("Question not found")) {
                return new ContextDecision.Unavailable("QUESTION_NOT_FOUND", "Question not found in part");
            } else if (msg != null && msg.contains("not an ESSAY/WRITING task")) {
                return new ContextDecision.Unavailable("NOT_AN_ESSAY", "Question is not an ESSAY task");
            } else if (msg != null && msg.contains("prompt is missing")) {
                return new ContextDecision.Unavailable("MISSING_PROMPT", "Writing task prompt is missing or blank");
            } else if (msg != null && msg.contains("Context exceeds 16,000")) {
                return new ContextDecision.Unavailable("CONTEXT_TOO_LONG", "Context exceeds 16,000 code points");
            } else {
                return new ContextDecision.Unavailable("CONTEXT_UNAVAILABLE", "Writing context is unavailable");
            }
        }

        ProjectedWritingContext projectedContext = projectContext(snapshot, partId, questionId, hintContext);
        if (projectedContext.error() != null) return projectedContext.error();
        String partTitle = projectedContext.partTitle();
        String partInstruction = projectedContext.partInstruction();
        String groupInstruction = projectedContext.groupInstruction();
        String prompt = projectedContext.taskPrompt();

        // 4. Trích xuất bài nộp của thí sinh từ answers
        String originalText = extractSubmittedEssay(answers, partId, questionId);

        // 5. Kiểm tra giới hạn bài nộp tối đa 8.000 Unicode code points
        if (originalText.codePointCount(0, originalText.length()) > MAX_ESSAY_CODE_POINTS) {
            return new ContextDecision.Unavailable("ESSAY_TOO_LONG", "Essay exceeds 8,000 code points");
        }

        // 6. Đếm số từ theo quy tắc chuẩn hóa \S+ (UNICODE_CHARACTER_CLASS)
        int legacyWordCount = WritingWordCounter.count(originalText);
        WritingLengthCounter.WritingLengthMetric metric = lengthCounter.count(originalText, canonicalLang);
        int wordCount = legacyWordCount;

        // The English rubric preserves its legacy short-essay rule; multilingual jobs only short-circuit empty text.
        boolean englishRubric = "en".equals(canonicalLang.split("-", 2)[0])
                && !"LANGUAGE_PRACTICE".equalsIgnoreCase(String.valueOf(snapshot.get("type")));
        if ((englishRubric && legacyWordCount <= 10) || (!englishRubric && legacyWordCount == 0)) {
            WritingGradingContext shortContext = new WritingGradingContext(
                    partId,
                    questionId,
                    partTitle,
                    partInstruction,
                    groupInstruction,
                    prompt,
                    originalText,
                    canonicalLang,
                    wordCount,
                    List.of(),
                    null, null, metric
            );
            return new ContextDecision.Eligible(shortContext);
        }

        // 8. Với bài >10 từ: Trích xuất và xác thực tham chiếu hình ảnh multimodal (Revision R2)
        MediaExtractionResult mediaResult = extractImageReferences(snapshot, partId, questionId, projectedContext, imagesEnabledOverride);
        if (mediaResult.error() != null) {
            return mediaResult.error();
        }

        WritingGradingContext context = new WritingGradingContext(
                partId,
                questionId,
                partTitle,
                partInstruction,
                groupInstruction,
                prompt,
                originalText,
                canonicalLang,
                wordCount,
                mediaResult.images(),
                null, null, metric
        );

        return new ContextDecision.Eligible(context);
    }

    private String extractSubmittedEssay(List<AttemptAnswer> answers, Integer partId, String questionId) {
        if (answers == null || answers.isEmpty() || partId == null || questionId == null) {
            return "";
        }
        for (AttemptAnswer ans : answers) {
            if (partId.equals(ans.getPartId()) && ans.getUserAnswers() != null) {
                Object rawVal = ans.getUserAnswers().get(questionId);
                if (rawVal instanceof String s) {
                    return s;
                }
                return ""; // Non-string is not stringified
            }
        }
        return "";
    }

    private ProjectedWritingContext projectContext(
            Map<String, Object> snapshot,
            Integer partId,
            String questionId,
            WritingHintContextReader.HintContext source) {
        Map<?, ?> part = findRawPartMap(snapshot, partId);
        if (part == null) return ProjectedWritingContext.error(new ContextDecision.Unavailable("PART_NOT_FOUND", "Part not found in attempt snapshot"));
        PartMediaScope scope = locateMediaScope(part, questionId);
        if (scope == null) return ProjectedWritingContext.error(new ContextDecision.Unavailable("QUESTION_NOT_FOUND", "Question not found in part"));

        WritingHtmlProjector.Projection title = WritingHtmlProjector.project(source.partTitle());
        WritingHtmlProjector.Projection instruction = WritingHtmlProjector.project(source.partInstruction());
        WritingHtmlProjector.Projection groupInstruction = WritingHtmlProjector.project(source.groupInstruction());
        WritingHtmlProjector.Projection prompt = WritingHtmlProjector.project(source.taskPrompt());
        WritingHtmlProjector.Projection partHtml = WritingHtmlProjector.project(firstText(part, "contentHtml", "content_html"));
        WritingHtmlProjector.Projection groupHtml = WritingHtmlProjector.project(scope.groupMap() == null
                ? null : firstText(scope.groupMap(), "contentHtml", "content_html"));
        WritingHtmlProjector.Projection questionHtml = WritingHtmlProjector.project(firstText(scope.questionMap(), "contentHtml", "content_html"));

        String partInstruction = joinContext(instruction.text(), partHtml.text());
        String groupText = joinContext(groupInstruction.text(), groupHtml.text());
        String taskPrompt = joinContext(prompt.text(), questionHtml.text());
        int codePoints = codePointLength(title.text()) + codePointLength(partInstruction)
                + codePointLength(groupText) + codePointLength(taskPrompt);
        if (codePoints > MAX_CONTEXT_CODE_POINTS) {
            return ProjectedWritingContext.error(new ContextDecision.Unavailable("CONTEXT_TOO_LONG", "Context exceeds 16,000 code points"));
        }

        Set<String> htmlImageUrls = new LinkedHashSet<>();
        List<WritingHtmlProjector.Projection> projections = List.of(title, instruction, groupInstruction, prompt, partHtml, groupHtml, questionHtml);
        for (WritingHtmlProjector.Projection projection : projections) htmlImageUrls.addAll(projection.imageUrls());
        boolean invalidHtmlImage = projections.stream().anyMatch(WritingHtmlProjector.Projection::invalidImageReference);
        return new ProjectedWritingContext(title.text(), partInstruction, groupText, taskPrompt,
                List.copyOf(htmlImageUrls), invalidHtmlImage, null);
    }

    private static String firstText(Map<?, ?> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value instanceof String text && !text.isBlank()) return text;
        }
        return null;
    }

    private static String joinContext(String first, String second) {
        String a = first == null ? "" : first.strip();
        String b = second == null ? "" : second.strip();
        if (a.isEmpty()) return b;
        if (b.isEmpty() || a.equals(b)) return a;
        return a + " " + b;
    }

    private static int codePointLength(String value) {
        return value == null ? 0 : value.codePointCount(0, value.length());
    }

    private record MediaExtractionResult(List<WritingImageRef> images, ContextDecision.Unavailable error) {}

    private record ProjectedWritingContext(
            String partTitle,
            String partInstruction,
            String groupInstruction,
            String taskPrompt,
            List<String> htmlImageUrls,
            boolean invalidHtmlImageReference,
            ContextDecision.Unavailable error
    ) {
        static ProjectedWritingContext error(ContextDecision.Unavailable error) {
            return new ProjectedWritingContext(null, null, null, null, List.of(), false, error);
        }
    }

    private MediaExtractionResult extractImageReferences(
            Map<String, Object> snapshot,
            Integer partId,
            String questionId,
            ProjectedWritingContext projectedContext,
            boolean imagesEnabled) {
        Map<?, ?> rawPartMap = findRawPartMap(snapshot, partId);
        if (rawPartMap == null) {
            return new MediaExtractionResult(null, new ContextDecision.Unavailable("PART_NOT_FOUND", "Part not found in attempt snapshot"));
        }

        PartMediaScope mediaScope = locateMediaScope(rawPartMap, questionId);
        if (mediaScope == null) {
            return new MediaExtractionResult(null, new ContextDecision.Unavailable("QUESTION_NOT_FOUND", "Question not found in part"));
        }

        // HTML image references are projected from this part and the target question/group only.
        if (projectedContext.invalidHtmlImageReference()) {
            return new MediaExtractionResult(null, new ContextDecision.Unavailable("INVALID_IMAGE_URL", "HTML image is missing a valid src"));
        }

        // Kiểm tra media không phải ảnh có cấu trúc (audio, video, pdf)
        if (hasUnsupportedMedia(rawPartMap)
                || (mediaScope.groupMap != null && hasUnsupportedMedia(mediaScope.groupMap))
                || hasUnsupportedMedia(mediaScope.questionMap)) {
            return new MediaExtractionResult(null, new ContextDecision.Unavailable("UNSUPPORTED_MEDIA", "Non-image media detected"));
        }

        // C. Trích xuất danh sách URL theo thứ tự xác định: Part -> Group -> Question, dedupe bằng LinkedHashSet
        Set<String> distinctUrls = new LinkedHashSet<>();
        List<ContextDecision.Unavailable> errors = new ArrayList<>();

        for (String url : projectedContext.htmlImageUrls()) {
            processUrlString(url, distinctUrls, errors);
            if (!errors.isEmpty()) return new MediaExtractionResult(null, errors.getFirst());
        }

        collectMediaUrls(rawPartMap, distinctUrls, errors);
        if (!errors.isEmpty()) {
            return new MediaExtractionResult(null, errors.getFirst());
        }

        if (mediaScope.groupMap != null) {
            collectMediaUrls(mediaScope.groupMap, distinctUrls, errors);
            if (!errors.isEmpty()) {
                return new MediaExtractionResult(null, errors.getFirst());
            }
        }

        collectMediaUrls(mediaScope.questionMap, distinctUrls, errors);
        if (!errors.isEmpty()) {
            return new MediaExtractionResult(null, errors.getFirst());
        }

        // D. Kiểm tra giới hạn số lượng ảnh
        if (distinctUrls.size() > MAX_IMAGES_PER_TASK) {
            return new MediaExtractionResult(null, new ContextDecision.Unavailable("TOO_MANY_IMAGES", "Task contains too many images, exceeding maximum of 2"));
        }

        // E. Nếu có ảnh nhưng imagesEnabled = false -> VISUAL_CONTEXT_UNSUPPORTED
        if (!distinctUrls.isEmpty() && !imagesEnabled) {
            return new MediaExtractionResult(null, new ContextDecision.Unavailable("VISUAL_CONTEXT_UNSUPPORTED", "Task contains visual context but image grading is disabled"));
        }

        List<WritingImageRef> images = distinctUrls.stream()
                .map(WritingImageRef::new)
                .toList();

        return new MediaExtractionResult(images, null);
    }

    private boolean containsImgTag(Object textObj) {
        if (textObj instanceof String text && !text.isBlank()) {
            return IMG_TAG_PATTERN.matcher(text).find();
        }
        return false;
    }

    private boolean hasUnsupportedMedia(Map<?, ?> map) {
        if (map == null) return false;

        for (String key : UNSUPPORTED_MEDIA_KEYS) {
            Object val = map.get(key);
            if (val instanceof String s && !s.isBlank()) {
                return true;
            }
            if (val instanceof Map<?, ?> m && !m.isEmpty()) {
                return true;
            }
            if (val instanceof Collection<?> c && !c.isEmpty()) {
                return true;
            }
        }
        return false;
    }

    private void collectMediaUrls(Map<?, ?> map, Set<String> distinctUrls, List<ContextDecision.Unavailable> errors) {
        if (map == null || !errors.isEmpty()) return;

        for (String key : MEDIA_KEYS) {
            Object val = map.get(key);
            if (val == null) continue;

            if (val instanceof String s) {
                processUrlString(s, distinctUrls, errors);
            } else if (val instanceof Map<?, ?> m) {
                if (m.isEmpty()) continue;
                processMediaMap(m, distinctUrls, errors);
            } else if (val instanceof List<?> list) {
                if (list.isEmpty()) continue;
                for (Object item : list) {
                    if (item == null) {
                        errors.add(new ContextDecision.Unavailable("INVALID_IMAGE_URL", "Image URL must not be null"));
                        return;
                    } else if (item instanceof String s) {
                        processUrlString(s, distinctUrls, errors);
                    } else if (item instanceof Map<?, ?> m) {
                        if (m.isEmpty()) {
                            errors.add(new ContextDecision.Unavailable("INVALID_IMAGE_URL", "Empty media element in image list"));
                            return;
                        }
                        processMediaMap(m, distinctUrls, errors);
                    } else {
                        errors.add(new ContextDecision.Unavailable("UNSUPPORTED_MEDIA", "Unsupported media element type"));
                        return;
                    }
                    if (!errors.isEmpty()) return;
                }
            } else {
                errors.add(new ContextDecision.Unavailable("UNSUPPORTED_MEDIA", "Unsupported media property type"));
                return;
            }
            if (!errors.isEmpty()) return;
        }
    }

    private void processUrlString(String rawUrl, Set<String> distinctUrls, List<ContextDecision.Unavailable> errors) {
        if (rawUrl == null || rawUrl.isBlank()) {
            errors.add(new ContextDecision.Unavailable("INVALID_IMAGE_URL", "Image URL must not be blank"));
            return;
        }
        String normalizedUrl = rawUrl.trim();
        if (normalizedUrl.length() > MAX_IMAGE_URL_LENGTH) {
            errors.add(new ContextDecision.Unavailable("INVALID_IMAGE_URL", "Image URL exceeds 2048 characters"));
            return;
        }
        try {
            URI uri = new URI(normalizedUrl);
            if (!uri.isAbsolute() || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
                errors.add(new ContextDecision.Unavailable("INVALID_IMAGE_URL", "Image URL must be an absolute HTTPS URL"));
                return;
            }
        } catch (URISyntaxException e) {
            errors.add(new ContextDecision.Unavailable("INVALID_IMAGE_URL", "Image URL is malformed"));
            return;
        }
        String lower = normalizedUrl.toLowerCase(Locale.ROOT);
        for (String ext : NON_IMAGE_EXTENSIONS) {
            if (lower.endsWith(ext) || lower.contains(ext + "?") || lower.contains(ext + "#")) {
                errors.add(new ContextDecision.Unavailable("UNSUPPORTED_MEDIA", "Non-image media file extension detected"));
                return;
            }
        }
        distinctUrls.add(normalizedUrl);
    }

    private void processMediaMap(Map<?, ?> mediaMap, Set<String> distinctUrls, List<ContextDecision.Unavailable> errors) {
        if (mediaMap.isEmpty()) return;

        // Kiểm tra loại media type nếu có khai báo
        Object typeObj = mediaMap.get("type");
        if (typeObj == null) typeObj = mediaMap.get("media_type");
        if (typeObj == null) typeObj = mediaMap.get("mime_type");
        if (typeObj == null) typeObj = mediaMap.get("contentType");

        if (typeObj instanceof String typeStr && !typeStr.isBlank()) {
            String lower = typeStr.trim().toLowerCase(Locale.ROOT);
            if (lower.startsWith("audio") || lower.startsWith("video") || lower.contains("pdf")) {
                errors.add(new ContextDecision.Unavailable("UNSUPPORTED_MEDIA", "Non-image media type detected"));
                return;
            }
            if (!lower.startsWith("image") && !lower.equals("diagram") && !lower.equals("chart")) {
                errors.add(new ContextDecision.Unavailable("UNSUPPORTED_MEDIA", "Unsupported media type detected"));
                return;
            }
        }

        // Tìm trường URL
        Object urlObj = mediaMap.get("url");
        if (urlObj == null) urlObj = mediaMap.get("imageUrl");
        if (urlObj == null) urlObj = mediaMap.get("image_url");
        if (urlObj == null) urlObj = mediaMap.get("src");
        if (urlObj == null) urlObj = mediaMap.get("link");
        if (urlObj == null) urlObj = mediaMap.get("chart_url");
        if (urlObj == null) urlObj = mediaMap.get("chartUrl");

        if (urlObj == null) {
            errors.add(new ContextDecision.Unavailable("INVALID_IMAGE_URL", "Missing or invalid URL in media map"));
            return;
        }
        if (!(urlObj instanceof String rawUrl)) {
            errors.add(new ContextDecision.Unavailable("INVALID_IMAGE_URL", "Image URL must be a string"));
            return;
        }
        processUrlString(rawUrl, distinctUrls, errors);
    }

    /** Read-only visual metadata from the historical task, independent of feature/eligibility flags. */
    public boolean hasVisualContext(Map<String, Object> snapshot, Integer partId, String questionId) {
        if (snapshot == null) return false;
        Map<?, ?> part = findRawPartMap(snapshot, partId);
        if (part == null) return false;
        PartMediaScope scope = locateMediaScope(part, questionId);
        if (scope == null) return false;
        List<Map<?, ?>> levels = new ArrayList<>();
        levels.add(part);
        if (scope.groupMap() != null) levels.add(scope.groupMap());
        levels.add(scope.questionMap());
        for (Map<?, ?> level : levels) {
            Set<String> urls = new LinkedHashSet<>();
            List<ContextDecision.Unavailable> errors = new ArrayList<>();
            collectMediaUrls(level, urls, errors);
            if (!urls.isEmpty() || errors.stream().anyMatch(error -> "INVALID_IMAGE_URL".equals(error.reasonCode()))) return true;
            for (String field : List.of("title", "partTitle", "part_title", "instruction", "prompt", "contentHtml", "content_html")) {
                if (containsImgTag(level.get(field))) return true;
            }
        }
        return false;
    }

    private record PartMediaScope(Map<?, ?> groupMap, Map<?, ?> questionMap) {}

    private PartMediaScope locateMediaScope(Map<?, ?> partMap, String questionId) {
        Object groupsObj = partMap.get("questionGroups");
        if (groupsObj == null) {
            groupsObj = partMap.get("question_groups");
        }

        if (groupsObj != null) {
            if (groupsObj instanceof List<?> groupList) {
                for (Object gObj : groupList) {
                    if (!(gObj instanceof Map<?, ?> groupMap)) continue;
                    Object qListObj = groupMap.get("questions");
                    if (qListObj instanceof List<?> qList) {
                        for (Object qObj : qList) {
                            if (qObj instanceof Map<?, ?> qMap && matchesQuestionId(qMap, questionId)) {
                                return new PartMediaScope(groupMap, qMap);
                            }
                        }
                    }
                }
            }
            return null;
        }

        Object qListObj = partMap.get("questions");
        if (qListObj instanceof List<?> qList) {
            for (Object qObj : qList) {
                if (qObj instanceof Map<?, ?> qMap && matchesQuestionId(qMap, questionId)) {
                    return new PartMediaScope(null, qMap);
                }
            }
        }
        return null;
    }

    private Map<?, ?> findRawPartMap(Map<String, Object> snapshot, Integer partId) {
        Object sectionsObj = snapshot.get("sections");
        if (!(sectionsObj instanceof List<?> sectionList)) {
            return null;
        }

        for (Object sObj : sectionList) {
            if (!(sObj instanceof Map<?, ?> sectionMap)) {
                continue;
            }
            Object partsObj = sectionMap.get("parts");
            if (!(partsObj instanceof List<?> partList)) {
                continue;
            }
            for (Object pObj : partList) {
                if (!(pObj instanceof Map<?, ?> partMap)) {
                    continue;
                }
                Integer pid = resolvePartId(partMap);
                if (Objects.equals(pid, partId)) {
                    return partMap;
                }
            }
        }
        return null;
    }

    private Integer resolvePartId(Map<?, ?> partMap) {
        Object idObj = partMap.get("id");
        if (idObj == null) idObj = partMap.get("part_id");
        if (idObj == null) idObj = partMap.get("partId");
        if (idObj == null) {
            return null;
        }
        if (idObj instanceof Number n) {
            int val = n.intValue();
            return val > 0 ? val : null;
        }
        try {
            int val = Integer.parseInt(idObj.toString().trim());
            return val > 0 ? val : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private boolean matchesQuestionId(Map<?, ?> qMap, String targetQuestionId) {
        String resolvedId = resolveQuestionId(qMap);
        return resolvedId != null && resolvedId.equals(targetQuestionId);
    }

    private String resolveQuestionId(Map<?, ?> qMap) {
        Object idObj = qMap.get("question_id");
        if (idObj == null) idObj = qMap.get("questionId");
        if (idObj == null) idObj = qMap.get("id");
        if (idObj == null) {
            return null;
        }
        if (idObj instanceof String s && !s.isBlank()) {
            return s.trim();
        }
        if (idObj instanceof Number n) {
            return String.valueOf(n);
        }
        return null;
    }
}
