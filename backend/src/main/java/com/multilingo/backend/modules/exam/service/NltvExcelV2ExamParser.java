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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Parses the supplied 20-column NLTV workbook without evaluating formulas or fetching media. */
public final class NltvExcelV2ExamParser {
    private static final String TEMPLATE_SHEET = "Exam Template";
    private static final String INFO_SHEET = "Thông Tin Đề Thi";
    private static final DataFormatter FORMATTER = new DataFormatter(Locale.ROOT);
    private static final Pattern PART = Pattern.compile("^Part\\s+(\\d+)\\s*:", Pattern.CASE_INSENSITIVE);
    private static final Pattern GROUP = Pattern.compile("(?i)^Group\\s+(\\d+)$");
    private static final Pattern QUESTION = Pattern.compile(
            "(?i)^(?:(?:Question|Câu)\\s+(\\d+)|Chỗ trống\\s*\\((\\d+)\\))(?:\\s|:|$)");
    private static final Pattern IMAGE = Pattern.compile("(?is)<img\\b[^>]*?src\\s*=\\s*['\"]([^'\"]+)['\"][^>]*>");
    private static final String[] HEADERS = {
            "Phần (Part)", "Hướng dẫn chung (Phần)", "Nhóm (Group)", "Loại câu hỏi (Type)",
            "Hướng dẫn riêng (Nhóm)", "Nội dung nhóm (Văn bản đọc/nghe)", "Câu hỏi (Question Text)",
            "Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D", "Lựa chọn E", "Lựa chọn F",
            "Lựa chọn G", "Lựa chọn H", "Đáp án đúng", "Giải thích", "Audio/File chung (Phần)",
            "Đính kèm chung (Nhóm)", "Đính kèm riêng (Câu hỏi)"
    };
    private static final int[] EXPECTED_COUNTS = {15, 14, 14, 12, 16, 24, 10, 1, 1};

    public boolean supports(Workbook workbook) {
        Sheet template = workbook.getSheet(TEMPLATE_SHEET);
        Sheet info = workbook.getSheet(INFO_SHEET);
        return template != null && info != null && "NLTV".equals(metadata(info).get("Mã loại chứng chỉ"));
    }

    public ExamImportPreviewResponse parse(Workbook workbook, String sha256) {
        Sheet sheet = workbook.getSheet(TEMPLATE_SHEET);
        Sheet info = workbook.getSheet(INFO_SHEET);
        if (sheet == null || info == null || sheet.getLastRowNum() > 10000 || sheet.getRow(0) == null) invalid();
        rejectFormulaAndErrorCells(workbook);

        Map<String, String> metadata = metadata(info);
        if (!"NLTV".equals(metadata.get("Mã loại chứng chỉ")) || metadata.get("Tên đề thi") == null
                || metadata.get("Tên đề thi").isBlank()) invalid();
        Map<String, Integer> columns = columns(sheet);
        NltvExamSourceProfile profile = NltvExamSourceProfile.forSha256(sha256);
        if (!profile.isSample()) invalid();
        List<Issue> issues = new ArrayList<>();
        Map<Integer, String> dictationAnswers = dictationAnswers(sheet, columns);
        Map<Integer, Map<String, Object>> parts = new LinkedHashMap<>();
        Map<String, Map<String, Object>> groups = new LinkedHashMap<>();
        int[] groupOrdinals = new int[10];
        int[] questionOrdinals = new int[10];
        int currentPart = 0;
        String currentGroupName = "";
        int questionCount = 0;

        for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (row == null || empty(row)) continue;

            String partName = value(sheet, rowIndex, columns, 0);
            if (!partName.isBlank()) {
                Matcher partMatcher = PART.matcher(partName);
                if (!partMatcher.find()) invalid();
                int nextPart = Integer.parseInt(partMatcher.group(1));
                if (nextPart < 1 || nextPart > 9 || nextPart < currentPart) invalid();
                if (nextPart != currentPart) {
                    currentPart = nextPart;
                    currentGroupName = "";
                }
            }
            if (currentPart == 0) invalid();

            Map<String, Object> part = parts.get(currentPart);
            if (part == null) {
                part = createPart(sheet, rowIndex, columns, currentPart, profile, sha256, issues);
                parts.put(currentPart, part);
            }
            String groupName = value(sheet, rowIndex, columns, 2);
            if (!groupName.isBlank()) currentGroupName = groupName;
            Matcher groupMatcher = GROUP.matcher(currentGroupName.trim());
            if (!groupMatcher.matches()) invalid();
            int sourceGroupNumber = Integer.parseInt(groupMatcher.group(1));
            String groupKey = currentPart + ":" + sourceGroupNumber;
            Map<String, Object> group = groups.get(groupKey);
            if (group == null) {
                int ordinal = ++groupOrdinals[currentPart];
                group = createGroup(currentPart, ordinal, sheet, rowIndex, columns, profile,
                        dictationAnswers, issues);
                groups.put(groupKey, group);
                ((List<Map<String, Object>>) part.get("question_groups")).add(group);
            } else {
                String groupInstruction = value(sheet, rowIndex, columns, 4);
                mergeText(group, "instruction", currentPart == 7
                        ? profile.partSevenGroupInstruction(groupInstruction) : groupInstruction);
                mergeText(group, "content_html", groupContext(currentPart,
                        value(sheet, rowIndex, columns, 5), profile, dictationAnswers));
                mergeMedia(group, "shared_media", value(sheet, rowIndex, columns, 18), "image", issues,
                        rowIndex, columns.get(HEADERS[18]));
            }

            String prompt = value(sheet, rowIndex, columns, 6);
            Matcher questionMatcher = QUESTION.matcher(prompt);
            String sourceType = value(sheet, rowIndex, columns, 3).toUpperCase(Locale.ROOT);
            boolean essay = "WRITING_ESSAY".equals(sourceType);
            if (prompt.isBlank() || (!essay && !questionMatcher.find()) || sourceType.isBlank()) {
                addIssue(issues, "QUESTION_INVALID", rowIndex, columns.get(HEADERS[6]), null,
                        "Thiếu nội dung hoặc mã câu hỏi.");
                continue;
            }
            int ordinal = ++questionOrdinals[currentPart];
            int sourceQuestionNumber = essay ? ordinal : questionNumber(questionMatcher);
            String questionId = "q_%03d".formatted(ordinal);
            Map<String, Object> question = createQuestion(questionId, prompt, sourceType, currentPart,
                    sourceQuestionNumber, sheet, rowIndex, columns, issues);
            String questionMedia = value(sheet, rowIndex, columns, 19);
            if (!questionMedia.isBlank()) mergeMedia(question, "media", questionMedia, "image", issues,
                    rowIndex, columns.get(HEADERS[19]));
            ((List<Map<String, Object>>) group.get("questions")).add(question);
            questionCount++;
        }

        List<Map<String, Object>> orderedParts = new ArrayList<>();
        for (int number = 1; number <= 9; number++) {
            Map<String, Object> part = parts.get(number);
            if (part == null || questionOrdinals[number] != EXPECTED_COUNTS[number - 1]) {
                addIssue(issues, "SOURCE_COUNTS_INVALID", 0, 0, null,
                        "Số câu hoặc Part NLTV không khớp cấu trúc nguồn tại Part " + number + ".");
                continue;
            }
            orderedParts.add(part);
        }
        if (questionCount != 107 || groups.size() != 27 || !"107".equals(metadata.get("Tổng số câu hỏi (Questions)"))) {
            addIssue(issues, "SOURCE_COUNTS_INVALID", 0, 0, null,
                    "Nguồn NLTV mẫu phải có 107 câu/yêu cầu trong 27 nhóm.");
        }

        List<SectionBuilderRequest> sections = List.of(
                section("LISTENING", 1, 4, orderedParts),
                section("READING", 5, 6, orderedParts),
                section("WRITING", 7, 9, orderedParts));
        ExamBuilderRequest request = ExamBuilderRequest.builder()
                .title("Đề thi Đánh giá Năng lực Tiếng Việt (NLTV) Mẫu")
                .type("NLTV").examLanguage("vi").isPublished(false).sections(sections).build();
        return new ExamImportPreviewResponse(request, List.copyOf(issues),
                new Counts(9, groups.size(), questionCount), sha256, issues.isEmpty());
    }

    private static Map<String, Object> createPart(Sheet sheet, int row, Map<String, Integer> columns,
            int partNumber, NltvExamSourceProfile profile, String sha256, List<Issue> issues) {
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("part_title", partTitle(value(sheet, row, columns, 0)));
        String instruction = value(sheet, row, columns, 1);
        content.put("instruction", partNumber == 7 ? profile.partSevenPartInstruction(instruction) : instruction);
        content.put("question_groups", new ArrayList<Map<String, Object>>());
        content.put("import_source_sha256", sha256);
        String audio = value(sheet, row, columns, 17);
        if (!audio.isBlank()) mergeMedia(content, "shared_audio", audio, "audio", issues,
                row, columns.get(HEADERS[17]));
        else if (partNumber <= 4) {
            addIssue(issues, "AUDIO_REQUIRED", row, columns.get(HEADERS[17]), null,
                    "Part này cần audio gốc trước khi xuất bản.");
        }
        return content;
    }

    private static Map<String, Object> createGroup(int part, int ordinal, Sheet sheet, int row,
            Map<String, Integer> columns, NltvExamSourceProfile profile, Map<Integer, String> dictationAnswers,
            List<Issue> issues) {
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("group_id", "nltv-p" + part + "-g" + ordinal);
        String instruction = value(sheet, row, columns, 4);
        group.put("instruction", part == 7 ? profile.partSevenGroupInstruction(instruction) : instruction);
        String rawContext = value(sheet, row, columns, 5);
        group.put("content_html", groupContext(part, rawContext, profile, dictationAnswers));
        group.put("questions", new ArrayList<Map<String, Object>>());
        Matcher embeddedImage = IMAGE.matcher(rawContext == null ? "" : rawContext);
        if (embeddedImage.find()) mergeMedia(group, "shared_media", embeddedImage.group(1), "image", issues,
                row, columns.get(HEADERS[5]));
        mergeMedia(group, "shared_media", value(sheet, row, columns, 18), "image", issues,
                row, columns.get(HEADERS[18]));
        return group;
    }

    private static String groupContext(int part, String context, NltvExamSourceProfile profile,
            Map<Integer, String> dictationAnswers) {
        String result = context == null ? "" : context;
        Matcher imageMatcher = IMAGE.matcher(result);
        if (imageMatcher.find()) result = IMAGE.matcher(result).replaceAll("");
        if (part == 7 && profile.isSample()) result = profile.maskDictationPassage(result, dictationAnswers);
        return result.trim();
    }

    private static Map<String, Object> createQuestion(String id, String prompt, String sourceType, int part,
            int sourceQuestionNumber, Sheet sheet, int row, Map<String, Integer> columns, List<Issue> issues) {
        String type = switch (sourceType) {
            case "MULTIPLE_CHOICE" -> "SINGLE_CHOICE";
            case "WRITING_ESSAY" -> "ESSAY";
            case "FILL_IN_THE_BLANK" -> "FILL_IN_THE_BLANK";
            default -> "INVALID";
        };
        if ("INVALID".equals(type)) {
            addIssue(issues, "QUESTION_TYPE_INVALID", row, columns.get(HEADERS[3]), id,
                    "Loại câu hỏi không thuộc profile NLTV đã hỗ trợ.");
            type = sourceType;
        }
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", id);
        question.put("question_number", sourceQuestionNumber);
        question.put("type", type);
        question.put("question_text", prompt);

        List<Map<String, String>> options = new ArrayList<>();
        for (int option = 0; option < 8; option++) {
            String optionText = value(sheet, row, columns, 7 + option);
            if (!optionText.isBlank()) options.add(Map.of("id", String.valueOf((char) ('A' + option)), "text", optionText));
        }
        if (!options.isEmpty()) question.put("options", options);
        question.put("explanation", value(sheet, row, columns, 16));

        if ("ESSAY".equals(type)) {
            question.put("min_words", part == 8 ? 120 : 200);
            return question;
        }
        String answer = value(sheet, row, columns, 15);
        if (answer.isBlank()) {
            addIssue(issues, "ANSWER_REQUIRED", row, columns.get(HEADERS[15]), id,
                    "Câu hỏi khách quan chưa có đáp án chuẩn.");
        } else {
            question.put("correct_answer", answer.trim());
        }
        if ("SINGLE_CHOICE".equals(type) && options.isEmpty()) {
            addIssue(issues, "OPTIONS_REQUIRED", row, columns.get(HEADERS[7]), id,
                    "Câu trắc nghiệm cần có options.");
        }
        return question;
    }

    private static Map<Integer, String> dictationAnswers(Sheet sheet, Map<String, Integer> columns) {
        Map<Integer, String> answers = new HashMap<>();
        int part = 0;
        for (int row = 1; row <= sheet.getLastRowNum(); row++) {
            String partName = value(sheet, row, columns, 0);
            if (!partName.isBlank()) {
                Matcher match = PART.matcher(partName);
                if (match.find()) part = Integer.parseInt(match.group(1));
            }
            if (part != 7) continue;
            String prompt = value(sheet, row, columns, 6);
            Matcher question = QUESTION.matcher(prompt);
            if (!question.find()) continue;
            answers.put(questionNumber(question), value(sheet, row, columns, 15));
        }
        return answers;
    }

    private static SectionBuilderRequest section(String skill, int first, int last, List<Map<String, Object>> parts) {
        List<PartBuilderRequest> sectionParts = new ArrayList<>();
        for (int number = first; number <= last; number++) {
            Map<String, Object> content = parts.get(number - 1);
            sectionParts.add(PartBuilderRequest.builder().partNumber(number).contentData(content).build());
        }
        return SectionBuilderRequest.builder().skillType(skill).durationMinutes(60).parts(sectionParts).build();
    }

    private static Map<String, String> metadata(Sheet sheet) {
        Map<String, String> result = new HashMap<>();
        for (Row row : sheet) {
            String key = text(row.getCell(0));
            if (!key.isBlank()) result.put(key, text(row.getCell(1)));
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

    private static void rejectFormulaAndErrorCells(Workbook workbook) {
        for (Sheet sheet : workbook) for (Row row : sheet) for (Cell cell : row)
            if (cell.getCellType() == CellType.FORMULA || cell.getCellType() == CellType.ERROR) invalid();
    }

    private static boolean empty(Row row) {
        for (Cell cell : row) if (!text(cell).isBlank()) return false;
        return true;
    }

    private static String text(Cell cell) {
        if (cell == null || cell.getCellType() == CellType.BLANK) return "";
        if (cell.getCellType() != CellType.STRING && cell.getCellType() != CellType.NUMERIC) invalid();
        return FORMATTER.formatCellValue(cell).trim();
    }

    private static String partTitle(String value) {
        return value.replaceFirst("(?i)^Part\\s+\\d+\\s*:\\s*", "").trim();
    }

    private static int questionNumber(Matcher matcher) {
        String number = matcher.group(1) == null ? matcher.group(2) : matcher.group(1);
        return Integer.parseInt(number);
    }

    private static void mergeText(Map<String, Object> target, String key, String value) {
        if (value == null || value.isBlank()) return;
        String old = String.valueOf(target.getOrDefault(key, ""));
        if (old.isBlank()) target.put(key, value);
        else if (!old.equals(value)) invalid();
    }

    private static void mergeMedia(Map<String, Object> target, String field, String raw, String type,
            List<Issue> issues, int row, int column) {
        if (raw == null || raw.isBlank()) return;
        if (!safeUrl(raw)) {
            addIssue(issues, "MEDIA_INVALID", row, column, null, "Đường dẫn media không hợp lệ.");
            return;
        }
        Object current = target.get(field);
        if (current instanceof Map<?, ?> existing && raw.equals(String.valueOf(existing.get("url")))) return;
        if (current != null) {
            addIssue(issues, "MEDIA_CONFLICT", row, column, null, "Có nhiều media khác nhau trong cùng scope.");
            return;
        }
        target.put(field, Map.of("type", type, "url", raw));
    }

    private static boolean safeUrl(String value) {
        try {
            URI uri = URI.create(value.trim());
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                    && uri.getUserInfo() == null && uri.getFragment() == null;
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private static void addIssue(List<Issue> issues, String code, int row, int column,
            String questionId, String message) {
        String cell = row <= 0 || column < 0 ? null : new CellReference(row, column).formatAsString();
        issues.add(new Issue(code, TEMPLATE_SHEET, cell, questionId, message));
    }

    private static void invalid() {
        throw new AppException(ErrorCode.INVALID_IMPORT_FILE);
    }
}
