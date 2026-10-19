package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;

/**
 * Profile loader and validator for official TOEIC listening audio tracks.
 * Reads durations, offsets and checksums from verified media profile JSON.
 */
@Getter
public final class ToeicListeningMediaProfile {

    public static final String DEFAULT_PROFILE_PATH = "/testing/toeic-listening-media-profile.json";

    public record TrackProfile(
            @JsonProperty("partNumber") int partNumber,
            @JsonProperty("audioUrl") String audioUrl,
            @JsonProperty("durationMs") long durationMs,
            @JsonProperty("startOffsetMs") long startOffsetMs,
            @JsonProperty("etag") String etag,
            @JsonProperty("contentLength") Long contentLength,
            @JsonProperty("sha256") String sha256
    ) {
        public TrackProfile(int partNumber, String audioUrl, long durationMs, long startOffsetMs,
                String etag, Long contentLength) {
            this(partNumber, audioUrl, durationMs, startOffsetMs, etag, contentLength, null);
        }

        public TrackProfile {
            if (partNumber < 1 || partNumber > 4) {
                throw new IllegalArgumentException("TOEIC listening partNumber must be 1..4: " + partNumber);
            }
            if (audioUrl == null || audioUrl.isBlank()) {
                throw new IllegalArgumentException("audioUrl must not be blank for part " + partNumber);
            }
            if (durationMs <= 0) {
                throw new IllegalArgumentException("durationMs must be positive: " + durationMs);
            }
            if (startOffsetMs < 0) {
                throw new IllegalArgumentException("startOffsetMs cannot be negative: " + startOffsetMs);
            }
        }
    }

    public record Verification(int version, String status, String durationEvidenceReference, String metadataSha256) {}

    private final Verification verification;
    private final String examCode;
    private final String source;
    private final String approvalReference;
    private final long totalDurationMs;
    private final List<TrackProfile> tracks;

    public ToeicListeningMediaProfile(String examCode, String source, String approvalReference,
            long totalDurationMs, List<TrackProfile> tracks) {
        this(examCode, source, approvalReference, totalDurationMs, tracks, null);
    }

    @JsonCreator
    public ToeicListeningMediaProfile(
            @JsonProperty("examCode") String examCode,
            @JsonProperty("source") String source,
            @JsonProperty("approvalReference") String approvalReference,
            @JsonProperty("totalDurationMs") long totalDurationMs,
            @JsonProperty("tracks") List<TrackProfile> tracks,
            @JsonProperty("verification") Verification verification
    ) {
        this.verification = verification;
        this.examCode = examCode;
        this.source = source;
        this.approvalReference = approvalReference;
        this.totalDurationMs = totalDurationMs;
        this.tracks = tracks != null ? List.copyOf(tracks) : List.of();
        validate();
    }

    public void validate() {
        if (tracks.size() != 4) {
            throw new IllegalStateException("TOEIC listening profile must contain exactly 4 tracks, found: " + tracks.size());
        }
        long cumulativeOffset = 0;
        for (int i = 0; i < tracks.size(); i++) {
            TrackProfile t = tracks.get(i);
            int expectedPart = i + 1;
            if (t.partNumber() != expectedPart) {
                throw new IllegalStateException("Track at index " + i + " must have partNumber " + expectedPart + ", found: " + t.partNumber());
            }
            if (t.startOffsetMs() != cumulativeOffset) {
                throw new IllegalStateException("Track " + expectedPart + " startOffsetMs mismatch: expected " + cumulativeOffset + ", got " + t.startOffsetMs());
            }
            cumulativeOffset += t.durationMs();
        }
        if (totalDurationMs != cumulativeOffset) {
            throw new IllegalStateException("totalDurationMs mismatch: expected " + cumulativeOffset + ", got " + totalDurationMs);
        }
        if (examCode == null || examCode.isBlank() || source == null || source.isBlank()
                || approvalReference == null || approvalReference.isBlank()
                || verification == null || verification.version() != 1 || !"VERIFIED".equals(verification.status())
                || verification.durationEvidenceReference() == null || verification.durationEvidenceReference().isBlank()
                || verification.metadataSha256() == null || !verification.metadataSha256().matches("[a-f0-9]{64}")
                || tracks.stream().anyMatch(track -> track.sha256() == null || !track.sha256().matches("[a-f0-9]{64}")
                    || track.etag() == null || track.etag().isBlank() || track.contentLength() == null || track.contentLength() <= 0)) {
            throw new IllegalStateException("TOEIC listening media verification is unavailable");
        }
        try {
            ObjectMapper mapper = new ObjectMapper();
            com.fasterxml.jackson.databind.node.ObjectNode metadata = mapper.valueToTree(this);
            ((com.fasterxml.jackson.databind.node.ObjectNode) metadata.get("verification")).remove("metadataSha256");
            String checksum = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(mapper.writeValueAsBytes(sortedMetadata(metadata))));
            if (!checksum.equals(verification.metadataSha256())) throw new IllegalStateException("Media metadata checksum mismatch");
        } catch (IOException | java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("Cannot verify media metadata", e);
        }
    }

    public static ToeicListeningMediaProfile loadDefault() {
        return loadFromResource(DEFAULT_PROFILE_PATH);
    }

    public static ToeicListeningMediaProfile loadFromResource(String path) {
        try (InputStream in = ToeicListeningMediaProfile.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("Media profile resource not found at " + path);
            }
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(in, ToeicListeningMediaProfile.class);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load TOEIC listening media profile from " + path, e);
        }
    }

    public TrackProfile getTrack(int partNumber) {
        if (partNumber < 1 || partNumber > tracks.size()) {
            return null;
        }
        return tracks.get(partNumber - 1);
    }

    /**
     * Creates tracks only when the snapshot supplies four unique real Listening Part IDs.
     */
    public List<ListeningPlaybackTimeline.PlaybackTrack> createPlaylist(Map<String, Object> examSnapshot) {
        Map<Integer, String> partIdMap = resolvePartIds(examSnapshot);
        if (partIdMap.size() != 4) return List.of();
        List<ListeningPlaybackTimeline.PlaybackTrack> playlist = new ArrayList<>();
        for (TrackProfile tp : tracks) {
            String resolvedPartId = partIdMap.get(tp.partNumber());
            playlist.add(new ListeningPlaybackTimeline.PlaybackTrack(
                    tp.partNumber(),
                    resolvedPartId,
                    tp.audioUrl(),
                    tp.durationMs(),
                    tp.startOffsetMs(),
                    tp.etag(),
                    tp.contentLength()
            ));
        }
        return List.copyOf(playlist);
    }

    /**
     * Binds this verified profile to a real attempt snapshot: the snapshot exam code must equal
     * the profile examCode and every Listening Part 1..4 must reference exactly the verified
     * audio URL for that part (camelCase and snake_case aliases accepted). Fails closed on any
     * missing, duplicated or mismatched reference.
     */
    public boolean bindsToSnapshot(Map<String, Object> examSnapshot) {
        if (examSnapshot == null) return false;
        String snapshotCode = stringValue(examSnapshot, "code", "exam_code", "examCode");
        if (examCode == null || !examCode.equals(snapshotCode)) return false;
        if (!(examSnapshot.get("sections") instanceof List<?> sections)) return false;

        Map<Integer, String> audioUrlByPart = new HashMap<>();
        for (Object rawSection : sections) {
            if (!(rawSection instanceof Map<?, ?> section)) return false;
            Object skill = section.get("skillType");
            if (skill == null) skill = section.get("name");
            if (!"LISTENING".equals(skill)) continue;
            if (!(section.get("parts") instanceof List<?> parts)) return false;
            for (Object rawPart : parts) {
                if (!(rawPart instanceof Map<?, ?> part)) return false;
                Integer number = positiveInteger(part.containsKey("partNumber") ? part.get("partNumber") : part.get("part_number"));
                if (number == null || number > 4) return false;
                Object audio = part.get("sharedAudio");
                if (audio == null) audio = part.get("shared_audio");
                if (!(audio instanceof Map<?, ?> audioMap)) return false;
                String url = stringValue(audioMap, "url");
                if (url == null || audioUrlByPart.putIfAbsent(number, url) != null) return false;
            }
        }

        for (TrackProfile track : tracks) {
            if (!track.audioUrl().equals(audioUrlByPart.get(track.partNumber()))) return false;
        }
        return true;
    }

    private static String stringValue(Map<?, ?> source, String... keys) {
        for (String key : keys) {
            Object value = source.get(key);
            if (value != null && !value.toString().isBlank()) return value.toString();
        }
        return null;
    }

    private Map<Integer, String> resolvePartIds(Map<String, Object> examSnapshot) {
        Map<Integer, String> map = new HashMap<>();
        Set<Integer> ids = new HashSet<>();
        if (examSnapshot == null || !(examSnapshot.get("sections") instanceof List<?> sections)) return Map.of();
        for (Object rawSection : sections) {
            if (!(rawSection instanceof Map<?, ?> section)) return Map.of();
            Object skill = section.get("skillType");
            if (skill == null) skill = section.get("name");
            if (!"LISTENING".equals(skill)) continue;
            if (!(section.get("parts") instanceof List<?> parts)) return Map.of();
            for (Object rawPart : parts) {
                if (!(rawPart instanceof Map<?, ?> part)) return Map.of();
                Integer number = positiveInteger(part.containsKey("partNumber") ? part.get("partNumber") : part.get("part_number"));
                Integer id = positiveInteger(part.get("id"));
                if (number == null || number > 4 || id == null || !ids.add(id)
                        || map.putIfAbsent(number, id.toString()) != null) return Map.of();
            }
        }
        return map;
    }

    private static Integer positiveInteger(Object value) {
        if (value == null || !value.toString().matches("[1-9][0-9]*")) return null;
        try { return Integer.valueOf(value.toString()); }
        catch (NumberFormatException e) { return null; }
    }

    private static com.fasterxml.jackson.databind.JsonNode sortedMetadata(com.fasterxml.jackson.databind.JsonNode node) {
        if (node.isObject()) {
            var result = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
            var names = new TreeSet<String>(); node.fieldNames().forEachRemaining(names::add);
            names.forEach(name -> result.set(name, sortedMetadata(node.get(name))));
            return result;
        }
        if (node.isArray()) {
            var result = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
            node.forEach(item -> result.add(sortedMetadata(item)));
            return result;
        }
        return node;
    }
}
