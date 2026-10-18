package com.multilingo.backend.modules.exam.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/** Source-hash-bound corrections for the two reviewed workbooks. */
public final class OfficialExamSourceProfile {
    public static final String CAMBRIDGE_IELTS_20_SHA256 =
            "1427bd88ff54e59d695bc2b3b02bfbe301e0658a3a76b79bfb3f650461402ee1";
    public static final String ETS_2024_COMPLETED_SHA256 =
            "990f8aa1d8190302e469aa021c50ea30e3a65817b4db698c30d47463c08a7fde";
    public static final String ETS_2024_LEGACY_SHA256 =
            "5d0a4415c3c1d49dc55d8150e6454e7144eda843d1a7c3aacb20efbc095699ce";
    public static final String ETS_2024_SUPPLEMENT_SHA256 =
            "b3abb7c09150f4f04022af1a96f3b3e335766d9daa1bdd4a4b217b301a76c3d1";

    private static final String ANSWER_KEY_CLUE_MARKER = "ANSWER-KEY-DERIVED CLUES";
    private static final String CAMBRIDGE_ELMS_PASSAGE_RESOURCE =
            "/datasets/source-corrections/cambridge-ielts-20-test-1/elms-to-britain.txt";
    private static final Set<String> CAMBRIDGE_ELMS_CORRECTED_CELLS = Set.of("F69", "F74", "F79");
    private static final String GROUP_EIGHT_PASSAGE = """
            <b>Great Dishwasher!   </b>

            I never had a dishwasher before. After remodeling my kitchen, I finally had room for a compact dishwasher. I did a lot of research, and the Dish Magic 300 seemed to be the best choice. It was pricier than other models, but all of the reviews were excellent. So, I decided to spend the extra money. I have had the dishwasher for one month now, and I could not be happier with my decision. Most importantly, the dishes come out sparkling clean, no matter how dirty they were going in. Also, the machine is so quiet, you do not even know it is running. Lastly, it is designed to use water efficiently, which is very important to me. Overall, I am very pleased with this dishwasher.

            — Anna Yakovleva""";

    private enum Kind { CAMBRIDGE_IELTS_20, ETS_2024_COMPLETED, ETS_2024_LEGACY, UNKNOWN }

    private final Kind kind;

    private OfficialExamSourceProfile(Kind kind) {
        this.kind = kind;
    }

    public static OfficialExamSourceProfile forSha256(String sha256) {
        String normalized = sha256 == null ? "" : sha256.toLowerCase(Locale.ROOT);
        if (CAMBRIDGE_IELTS_20_SHA256.equals(normalized)) return new OfficialExamSourceProfile(Kind.CAMBRIDGE_IELTS_20);
        if (ETS_2024_COMPLETED_SHA256.equals(normalized)) return new OfficialExamSourceProfile(Kind.ETS_2024_COMPLETED);
        if (ETS_2024_LEGACY_SHA256.equals(normalized)) return new OfficialExamSourceProfile(Kind.ETS_2024_LEGACY);
        return new OfficialExamSourceProfile(Kind.UNKNOWN);
    }

    public boolean isCambridgeIelts20() {
        return kind == Kind.CAMBRIDGE_IELTS_20;
    }

    public String normalizeCambridgeTitle(String value) {
        if (!isCambridgeIelts20() || value == null) return value;
        return value.equals("Cambridge Ielts 20 Test 1 (Chưa giải thích)")
                ? "Cambridge Ielts 20 Test 1"
                : value;
    }

    public Optional<String> verifiedCambridgeElmsPassage() {
        if (!isCambridgeIelts20()) return Optional.empty();
        try (InputStream input = OfficialExamSourceProfile.class.getResourceAsStream(CAMBRIDGE_ELMS_PASSAGE_RESOURCE)) {
            if (input == null) throw new IllegalStateException("Verified Cambridge passage correction is missing.");
            return Optional.of(new String(input.readAllBytes(), StandardCharsets.UTF_8).strip());
        } catch (IOException exception) {
            throw new IllegalStateException("Verified Cambridge passage correction cannot be read.", exception);
        }
    }

    public boolean hasVerifiedCambridgeCorrection(String cellReference) {
        return isCambridgeIelts20() && CAMBRIDGE_ELMS_CORRECTED_CELLS.contains(cellReference);
    }

    public boolean isCompletedToeic() {
        return kind == Kind.ETS_2024_COMPLETED;
    }

    public boolean hasLegacyToeicPlaceholders() {
        return kind == Kind.ETS_2024_LEGACY;
    }

    public boolean hasToeicPlaceholderMarkers() {
        return isCompletedToeic() || hasLegacyToeicPlaceholders();
    }

    public String normalizeToeicCell(int columnIndex, String value) {
        if (!isCompletedToeic() || !"44".equals(value)) return value;
        if (columnIndex == 4 || columnIndex >= 7 && columnIndex <= 10
                || columnIndex >= 13 && columnIndex <= 15) return "";
        return value;
    }

    public String normalizeToeicContext(String value) {
        if (isCompletedToeic() && value != null && value.contains(ANSWER_KEY_CLUE_MARKER)) return "";
        return value == null ? "" : value;
    }

    public String toeicGroupName(int sourcePart, int questionNumber, String sourceValue) {
        if (isCompletedToeic() && sourcePart == 7 && questionNumber == 165) return "Group 8";
        return sourceValue;
    }

    public String toeicGroupContext(int sourcePart, int questionNumber, String sourceValue) {
        if (isCompletedToeic() && sourcePart == 7 && questionNumber == 165) return GROUP_EIGHT_PASSAGE;
        return normalizeToeicContext(sourceValue);
    }

    public boolean isPlaceholderToeicColumn(int columnIndex) {
        return Set.of(4, 7, 8, 9, 10, 13, 14, 15).contains(columnIndex);
    }
}
