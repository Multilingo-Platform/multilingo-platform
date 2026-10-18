package com.multilingo.backend.modules.exam.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.Counts;
import com.multilingo.backend.modules.exam.dto.response.ExamImportPreviewResponse.Issue;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellReference;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Parses the IELTS Academic v2 workbook into the same canonical request used by the builder. */
public final class IeltsExcelV2ExamParser {
    private static final String TEMPLATE_SHEET = "Exam Template";
    private static final String INFO_SHEET = "Thông Tin Đề Thi";
    private static final String[] HEADERS = {
            "Phần (Part)", "Hướng dẫn chung (Phần)", "Nhóm (Group)", "Loại câu hỏi (Type)",
            "Hướng dẫn riêng (Nhóm)", "Nội dung nhóm (Văn bản đọc/nghe)", "Câu hỏi (Question Text)",
            "Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D", "Lựa chọn E", "Lựa chọn F",
            "Lựa chọn G", "Lựa chọn H", "Đáp án đúng", "Giải thích", "Audio/File chung (Phần)",
            "Đính kèm chung (Nhóm)", "Đính kèm riêng (Câu hỏi)"
    };
    private static final Pattern PART = Pattern.compile("^Part\\s+(\\d+)\\s*:", Pattern.CASE_INSENSITIVE);
    private static final Pattern IMAGE = Pattern.compile("(?is)<img\\b[^>]*?src\\s*=\\s*['\"]([^'\"]+)['\"][^>]*>");
    private static final Pattern EMPTY_PARAGRAPH = Pattern.compile("(?is)<p\\b[^>]*>\\s*</p>");
    private static final DataFormatter FORMATTER = new DataFormatter(Locale.ROOT);

    public boolean supports(Workbook workbook) {
        Sheet template = workbook.getSheet(TEMPLATE_SHEET);
        Sheet info = workbook.getSheet(INFO_SHEET);
        return template != null && info != null && "IELTS_ACADEMIC".equals(metadata(info).get("Mã loại chứng chỉ"));
    }

    public ExamImportPreviewResponse parse(Workbook workbook, String sha256) {
        Sheet sheet = workbook.getSheet(TEMPLATE_SHEET);
        Sheet info = workbook.getSheet(INFO_SHEET);
        if (sheet == null || info == null || sheet.getLastRowNum() > 10000 || sheet.getRow(0) == null) invalid();
        rejectFormulaAndErrorCells(workbook);

        Map<String, Object> metadata = metadata(info);
        OfficialExamSourceProfile sourceProfile = OfficialExamSourceProfile.forSha256(sha256);
        String title = sourceProfile.normalizeCambridgeTitle(String.valueOf(metadata.getOrDefault("Tên đề thi", "")));
        if (title == null || title.isBlank() || !"IELTS_ACADEMIC".equals(metadata.get("Mã loại chứng chỉ"))) invalid();
        Map<String, Integer> columns = columns(sheet);
        Map<Integer, PartBuilderRequest> parts = new LinkedHashMap<>();
        Map<String, Map<String, Object>> groups = new LinkedHashMap<>();
        Map<String, List<SourceQuestion>> groupQuestions = new LinkedHashMap<>();
        List<Issue> issues = new ArrayList<>();
        Map<Integer, Integer> questionsInSourcePart = new HashMap<>();
        Set<String> questionIds = new HashSet<>();
        int currentSourcePart = 0;
        int currentCanonicalPart = 0;
        String currentGroup = "";

        for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (row == null || empty(row)) continue;

            String partName = value(sheet, rowIndex, columns, 0);
            if (!partName.isBlank()) {
                Matcher partMatcher = PART.matcher(partName);
                if (!partMatcher.find()) invalid();
                int parsedPart = Integer.parseInt(partMatcher.group(1));
                if (parsedPart < 1 || parsedPart > 9 || parsedPart < currentSourcePart) invalid();
                if (parsedPart != currentSourcePart) {
                    currentSourcePart = parsedPart;
                    currentCanonicalPart = canonicalPart(parsedPart);
                    currentGroup = "";
                }
            }
            if (currentSourcePart == 0) invalid();
            PartBuilderRequest part = parts.get(currentCanonicalPart);
            if (part == null) {
                part = createPart(sheet, rowIndex, columns, currentSourcePart, issues);
                parts.put(currentCanonicalPart, part);
            }

            String prompt = value(sheet, rowIndex, columns, 6);
            String sourceType = value(sheet, rowIndex, columns, 3).toUpperCase(Locale.ROOT);
            if (prompt.isBlank() || sourceType.isBlank()) {
                addIssue(issues, "QUESTION_INVALID", rowIndex, columns.get(HEADERS[6]), null,
                        "Thiếu nội dung hoặc loại câu hỏi.");
                continue;
            }

            int ordinalInSourcePart = questionsInSourcePart.merge(currentSourcePart, 1, Integer::sum);
            String questionId = questionId(currentSourcePart, ordinalInSourcePart);
            if (!questionIds.add(questionId)) {
                addIssue(issues, "ID_INVALID", rowIndex, columns.get(HEADERS[6]), questionId,
                        "Question ID bị trùng.");
                continue;
            }

            String groupName = value(sheet, rowIndex, columns, 2);
            if (!groupName.isBlank()) currentGroup = groupName;
            if (currentGroup.isBlank()) invalid();
            int groupNumber = groupNumber(currentGroup);
            String groupKey = currentCanonicalPart + ":" + currentGroup;
            Map<String, Object> group = groups.get(groupKey);
            if (group == null) {
                group = createGroup(currentCanonicalPart, groupNumber,
                        value(sheet, rowIndex, columns, 4), value(sheet, rowIndex, columns, 5),
                        value(sheet, rowIndex, columns, 18), issues, rowIndex,
                        columns.get(HEADERS[5]), columns.get(HEADERS[18]));
                groups.put(groupKey, group);
                groupQuestions.put(groupKey, new ArrayList<>());
                ((List<Map<String, Object>>) part.getContentData().get("question_groups")).add(group);
            } else {
                mergeText(group, "instruction", value(sheet, rowIndex, columns, 4));
                mergeGroupContext(group, value(sheet, rowIndex, columns, 5), issues,
                        rowIndex, columns.get(HEADERS[5]));
                mergeGroupMedia(group, value(sheet, rowIndex, columns, 18), issues,
                        rowIndex, columns.get(HEADERS[18]));
            }

            Map<String, Object> question = createQuestion(questionId, prompt, sourceType,
                    sheet, rowIndex, columns, issues);
            String questionMedia = value(sheet, rowIndex, columns, 19);
            if (!questionMedia.isBlank()) putImage(question, "media", questionMedia, issues,
                    rowIndex, columns.get(HEADERS[19]), questionId);
            ((List<Map<String, Object>>) group.get("questions")).add(question);
            groupQuestions.get(groupKey).add(new SourceQuestion(question, sourceType, rowIndex));
        }

        applyPairedAnswerGroups(groupQuestions, issues, columns);
        moveReadingPassagesToPartLevel(parts);
        sourceProfile.verifiedCambridgeElmsPassage().ifPresent(passage -> {
            PartBuilderRequest elmsPart = parts.get(6);
            if (elmsPart == null) invalid();
            elmsPart.getContentData().put("content_html", passage);
        });
        validateCounts(metadata, parts, groups, questionIds.size(), issues);
        reportKnownCambridgeSourceNotes(sheet, sourceProfile, issues);

        List<SectionBuilderRequest> sections = new ArrayList<>();
        addSection(sections, "LISTENING", 30, parts, 1, 4);
        addSection(sections, "READING", 60, parts, 5, 7);
        addSection(sections, "WRITING", 60, parts, 8, 9);
        ExamBuilderRequest request = ExamBuilderRequest.builder()
                .title(title).type("IELTS_ACADEMIC").examLanguage("en").isPublished(false).sections(sections).build();
        return new ExamImportPreviewResponse(request, List.copyOf(issues),
                new Counts(parts.size(), groups.size(), questionIds.size()), sha256, issues.isEmpty());
    }

    private static void reportKnownCambridgeSourceNotes(Sheet sheet, OfficialExamSourceProfile sourceProfile,
            List<Issue> issues) {
        if (!sourceProfile.isCambridgeIelts20()) return;
        for (Row row : sheet) {
            if (row == null) continue;
            for (Cell cell : row) {
                if (cell != null && FORMATTER.formatCellValue(cell).contains("dongan.signs")) {
                    String cellReference = new CellReference(row.getRowNum(), cell.getColumnIndex()).formatAsString();
                    if (sourceProfile.hasVerifiedCambridgeCorrection(cellReference)) continue;
                    issues.add(new Issue("SOURCE_CONTENT_UNVERIFIED", TEMPLATE_SHEET,
                            cellReference, null,
                            "Nguồn Cambridge có ghi chú chưa được xác minh tại ô này."));
                }
            }
        }
    }

    private static PartBuilderRequest createPart(Sheet sheet, int rowIndex, Map<String, Integer> columns,
            int sourcePart, List<Issue> issues) {
        int canonicalPart = canonicalPart(sourcePart);
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("part_title", partTitle(value(sheet, rowIndex, columns, 0)));
        content.put("instruction", value(sheet, rowIndex, columns, 1));
        content.put("question_groups", new ArrayList<Map<String, Object>>());
        if (sourcePart <= 4) {
            String audio = value(sheet, rowIndex, columns, 17);
            if (!audio.isBlank()) {
                if (ExcelV2ExamParser.safeUrl(audio)) content.put("shared_audio", Map.of("url", audio));
                else addIssue(issues, "MEDIA_INVALID", rowIndex, columns.get(HEADERS[17]), null,
                        "Đường dẫn audio không hợp lệ.");
            }
        }
        return PartBuilderRequest.builder().partNumber(canonicalPart).contentData(content).build();
    }

    private static Map<String, Object> createGroup(int partNumber, int groupNumber, String instruction,
            String context, String attachment, List<Issue> issues, int row, int contextColumn, int attachmentColumn) {
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("group_id", "ielts-p" + partNumber + "-g" + groupNumber);
        group.put("instruction", instruction);
        group.put("content_html", "");
        group.put("questions", new ArrayList<Map<String, Object>>());
        mergeGroupContext(group, context, issues, row, contextColumn);
        mergeGroupMedia(group, attachment, issues, row, attachmentColumn);
        return group;
    }

    private static Map<String, Object> createQuestion(String questionId, String prompt, String sourceType,
            Sheet sheet, int row, Map<String, Integer> columns, List<Issue> issues) {
        String canonicalType = canonicalType(sourceType);
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", questionId);
        question.put("question_number", Integer.parseInt(questionId.substring(questionId.lastIndexOf('_') + 1)));
        question.put("type", canonicalType);
        question.put("question_text", prompt);

        List<Map<String, Object>> options = options(sheet, row, columns);
        if (!options.isEmpty()) question.put("options", options);
        if ("ESSAY".equals(canonicalType)) {
            question.put("explanation", "");
            return question;
        }

        String rawAnswer = value(sheet, row, columns, 15);
        if (rawAnswer.isBlank()) {
            addIssue(issues, "ANSWER_REQUIRED", row, columns.get(HEADERS[15]), questionId,
                    "Câu hỏi khách quan chưa có đáp án chuẩn.");
        } else if ("MULTIPLE_CHOICE_MULTI".equals(sourceType)) {
            question.put("correct_answer", answerIds(rawAnswer));
        } else {
            question.put("correct_answer", rawAnswer.trim());
        }
        String explanation = value(sheet, row, columns, 16);
        question.put("explanation", explanation);
        if (("SINGLE_CHOICE".equals(canonicalType) || "MATCHING_FEATURES".equals(canonicalType))
                && options.isEmpty()) {
            addIssue(issues, "OPTIONS_REQUIRED", row, columns.get(HEADERS[7]), questionId,
                    "Câu hỏi cần có danh sách lựa chọn.");
        }
        return question;
    }

    private static List<Map<String, Object>> options(Sheet sheet, int row, Map<String, Integer> columns) {
        List<Map<String, Object>> options = new ArrayList<>();
        for (int index = 0; index < 8; index++) {
            String text = value(sheet, row, columns, 7 + index);
            if (!text.isBlank()) options.add(Map.of("id", String.valueOf((char) ('A' + index)), "text", text));
        }
        return options;
    }

    private static void applyPairedAnswerGroups(Map<String, List<SourceQuestion>> groups, List<Issue> issues,
            Map<String, Integer> columns) {
        for (List<SourceQuestion> questions : groups.values()) {
            for (int index = 0; index < questions.size(); index++) {
                SourceQuestion first = questions.get(index);
                if (!"MULTIPLE_CHOICE_MULTI".equals(first.sourceType())) continue;
                if (index + 1 >= questions.size()) {
                    addIssue(issues, "PAIRED_QUESTION_INVALID", first.row(), columns.get(HEADERS[6]),
                            String.valueOf(first.question().get("question_id")), "Cặp câu hỏi phải có đủ hai ô.");
                    continue;
                }
                SourceQuestion second = questions.get(index + 1);
                Object firstAnswer = first.question().get("correct_answer");
                Object secondAnswer = second.question().get("correct_answer");
                if (!"MULTIPLE_CHOICE_MULTI".equals(second.sourceType())
                        || !(firstAnswer instanceof List<?> answers) || !answers.equals(secondAnswer)) {
                    addIssue(issues, "PAIRED_QUESTION_INVALID", first.row(), columns.get(HEADERS[6]),
                            String.valueOf(first.question().get("question_id")), "Hai ô của cặp phải có cùng answer set.");
                    continue;
                }
                String firstId = String.valueOf(first.question().get("question_id"));
                String secondId = String.valueOf(second.question().get("question_id"));
                String pairId = "listening-" + Integer.parseInt(firstId.substring(2))
                        + "-" + Integer.parseInt(secondId.substring(2));
                Map<String, Object> metadata = Map.of("id", pairId, "mode", "DISTINCT_UNORDERED",
                        "question_ids", List.of(firstId, secondId));
                first.question().put("type", "SINGLE_CHOICE");
                second.question().put("type", "SINGLE_CHOICE");
                first.question().put("answer_group", metadata);
                second.question().put("answer_group", metadata);
                index++;
            }
        }
    }

    private static void moveReadingPassagesToPartLevel(Map<Integer, PartBuilderRequest> parts) {
        for (int partNumber = 5; partNumber <= 7; partNumber++) {
            PartBuilderRequest part = parts.get(partNumber);
            if (part == null) continue;
            List<Map<String, Object>> groups = (List<Map<String, Object>>) part.getContentData().get("question_groups");
            String passage = groups.stream().map(group -> String.valueOf(group.getOrDefault("content_html", "")))
                    .max(Comparator.comparingInt(String::length)).orElse("");
            if (!passage.isBlank()) part.getContentData().put("content_html", passage);
            for (Map<String, Object> group : groups) {
                if (passage.equals(group.get("content_html"))) group.put("content_html", "");
            }
        }
    }

    private static void addSection(List<SectionBuilderRequest> sections, String skill, int duration,
            Map<Integer, PartBuilderRequest> allParts, int firstPart, int lastPart) {
        List<PartBuilderRequest> parts = allParts.entrySet().stream()
                .filter(entry -> entry.getKey() >= firstPart && entry.getKey() <= lastPart)
                .sorted(Map.Entry.comparingByKey()).map(Map.Entry::getValue).toList();
        if (!parts.isEmpty()) sections.add(SectionBuilderRequest.builder()
                .skillType(skill).durationMinutes(duration).parts(parts).build());
    }

    private static void validateCounts(Map<String, Object> metadata, Map<Integer, PartBuilderRequest> parts,
            Map<String, Map<String, Object>> groups, int questionCount, List<Issue> issues) {
        if (parts.size() != 9 || questionCount != 82)
            addIssue(issues, "SOURCE_COUNTS_INVALID", 0, 0, null,
                    "Bộ Cambridge IELTS 20 Test 1 cần đủ 9 Part và 82 câu hỏi.");
        if (!"82".equals(metadata.get("Tổng số câu hỏi (Questions)")))
            addIssue(issues, "SOURCE_METADATA_MISMATCH", 8, 1, null,
                    "Số câu hỏi trong metadata không khớp dữ liệu.");
    }

    private static int canonicalPart(int sourcePart) {
        return switch (sourcePart) {
            case 5 -> 7; // Passage 3 moves after passages 1 and 2.
            case 6 -> 5;
            case 7 -> 6;
            default -> sourcePart;
        };
    }

    private static String questionId(int sourcePart, int ordinal) {
        if (sourcePart <= 4) return "l_%03d".formatted((sourcePart - 1) * 10 + ordinal);
        if (sourcePart == 5) return "r_%03d".formatted(26 + ordinal);
        if (sourcePart == 6) return "r_%03d".formatted(ordinal);
        if (sourcePart == 7) return "r_%03d".formatted(13 + ordinal);
        return "w_%03d".formatted(sourcePart - 7 + ordinal - 1);
    }

    private static String canonicalType(String sourceType) {
        return switch (sourceType) {
            case "MULTIPLE_CHOICE", "MULTIPLE_CHOICE_MULTI" -> "SINGLE_CHOICE";
            case "WRITING_ESSAY" -> "ESSAY";
            case "MATCHING_INFORMATION" -> "MATCHING_FEATURES";
            default -> sourceType;
        };
    }

    private static List<String> answerIds(String raw) {
        return java.util.Arrays.stream(raw.split(",")).map(String::trim)
                .map(value -> value.toUpperCase(Locale.ROOT)).filter(value -> !value.isBlank()).toList();
    }

    private static String partTitle(String value) {
        return value.replaceFirst("(?i)^Part\\s+\\d+\\s*:\\s*", "").trim();
    }

    private static int groupNumber(String groupName) {
        Matcher matcher = Pattern.compile("(?i)^Group\\s+(\\d+)$").matcher(groupName.trim());
        if (!matcher.matches()) invalid();
        return Integer.parseInt(matcher.group(1));
    }

    private static Map<String, Object> metadata(Sheet sheet) {
        Map<String, Object> result = new HashMap<>();
        for (Row row : sheet) {
            String key = text(row.getCell(0));
            if (!key.isBlank()) result.put(key, formatterText(row.getCell(1)));
        }
        return result;
    }

    private static Map<String, Integer> columns(Sheet sheet) {
        Map<String, Integer> columns = new HashMap<>();
        for (Cell cell : sheet.getRow(0)) {
            String header = text(cell);
            if (!header.isBlank() && columns.put(header, cell.getColumnIndex()) != null) invalid();
        }
        for (String header : HEADERS) if (!columns.containsKey(header)) invalid();
        return columns;
    }

    private static void rejectFormulaAndErrorCells(Workbook workbook) {
        for (Sheet sheet : workbook) for (Row row : sheet) for (Cell cell : row) {
            if (cell.getCellType() == CellType.FORMULA || cell.getCellType() == CellType.ERROR) invalid();
        }
    }

    private static boolean empty(Row row) {
        for (Cell cell : row) if (!text(cell).isBlank()) return false;
        return true;
    }

    private static String value(Sheet sheet, int rowIndex, Map<String, Integer> columns, int field) {
        int column = columns.get(HEADERS[field]);
        for (var merged : sheet.getMergedRegions()) {
            if (merged.isInRange(rowIndex, column)) {
                rowIndex = merged.getFirstRow();
                column = merged.getFirstColumn();
                break;
            }
        }
        Row row = sheet.getRow(rowIndex);
        return row == null ? "" : text(row.getCell(column));
    }

    private static String text(Cell cell) {
        if (cell == null || cell.getCellType() == CellType.BLANK) return "";
        if (cell.getCellType() != CellType.STRING && cell.getCellType() != CellType.NUMERIC) invalid();
        return formatterText(cell);
    }

    private static String formatterText(Cell cell) {
        return cell == null ? "" : FORMATTER.formatCellValue(cell).trim();
    }

    private static void mergeText(Map<String, Object> target, String key, String value) {
        if (value.isBlank()) return;
        Object old = target.get(key);
        if (old == null || old.toString().isBlank()) target.put(key, value);
        else if (!old.equals(value)) invalid();
    }

    private static void mergeGroupContext(Map<String, Object> group, String rawContext, List<Issue> issues,
            int row, int column) {
        String context = rawContext == null ? "" : rawContext;
        Matcher imageMatcher = IMAGE.matcher(context);
        List<String> images = new ArrayList<>();
        while (imageMatcher.find()) images.add(imageMatcher.group(1));
        context = EMPTY_PARAGRAPH.matcher(IMAGE.matcher(context).replaceAll("")).replaceAll("").trim();
        if (!context.isBlank()) mergeText(group, "content_html", context);
        for (String image : images) mergeGroupMedia(group, image, issues, row, column);
    }

    private static void mergeGroupMedia(Map<String, Object> group, String rawMedia, List<Issue> issues,
            int row, int column) {
        if (rawMedia == null || rawMedia.isBlank()) return;
        putImage(group, "shared_media", rawMedia, issues, row, column, null);
    }

    private static void putImage(Map<String, Object> target, String field, String url, List<Issue> issues,
            int row, int column, String questionId) {
        if (!ExcelV2ExamParser.safeUrl(url)) {
            addIssue(issues, "MEDIA_INVALID", row, column, questionId, "Đường dẫn media không hợp lệ.");
            return;
        }
        Object existing = target.get(field);
        if (existing != null) {
            addIssue(issues, "MEDIA_DUPLICATE", row, column, questionId,
                    "Mỗi câu hỏi hoặc nhóm chỉ hỗ trợ một ảnh đính kèm trong định dạng này.");
            return;
        }
        target.put(field, Map.of("type", "image", "url", url));
    }

    private static void addIssue(List<Issue> issues, String code, int row, int column, String questionId,
            String message) {
        String cell = row <= 0 || column < 0 ? null : new CellReference(row, column).formatAsString();
        issues.add(new Issue(code, TEMPLATE_SHEET, cell, questionId, message));
    }

    private static void invalid() {
        throw new AppException(ErrorCode.INVALID_IMPORT_FILE);
    }

    private record SourceQuestion(Map<String, Object> question, String sourceType, int row) {}
}
