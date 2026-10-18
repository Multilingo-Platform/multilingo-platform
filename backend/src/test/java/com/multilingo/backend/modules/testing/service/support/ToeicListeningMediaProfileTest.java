package com.multilingo.backend.modules.testing.service.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ToeicListeningMediaProfileTest {

    @Test
    @DisplayName("Loads a synthetic verified fixture without approving production assets")
    void loadsVerifiedSyntheticProfile() {
        ToeicListeningMediaProfile profile = verifiedFixture();

        assertThat(profile).isNotNull();
        assertThat(profile.getExamCode()).isEqualTo("TOEIC-ETS-2024-T1-V2");
        assertThat(profile.getSource()).isEqualTo("ETS 2024 Test 1");
        assertThat(profile.getApprovalReference()).isEqualTo("TEST-ONLY-SYNTHETIC");
        assertThat(profile.getTracks()).hasSize(4);

        // Part 1
        ToeicListeningMediaProfile.TrackProfile p1 = profile.getTrack(1);
        assertThat(p1.partNumber()).isEqualTo(1);
        assertThat(p1.startOffsetMs()).isZero();
        assertThat(p1.durationMs()).isEqualTo(173505L);
        assertThat(p1.audioUrl()).contains("p1.mp3");
        assertThat(p1.etag()).isNotBlank();
        assertThat(p1.contentLength()).isPositive();

        // Part 2
        ToeicListeningMediaProfile.TrackProfile p2 = profile.getTrack(2);
        assertThat(p2.partNumber()).isEqualTo(2);
        assertThat(p2.startOffsetMs()).isEqualTo(173505L);
        assertThat(p2.durationMs()).isEqualTo(536686L);
        assertThat(p2.audioUrl()).contains("p2.mp3");

        // Part 3
        ToeicListeningMediaProfile.TrackProfile p3 = profile.getTrack(3);
        assertThat(p3.partNumber()).isEqualTo(3);
        assertThat(p3.startOffsetMs()).isEqualTo(710191L);
        assertThat(p3.durationMs()).isEqualTo(1105842L);
        assertThat(p3.audioUrl()).contains("p3.mp3");

        // Part 4
        ToeicListeningMediaProfile.TrackProfile p4 = profile.getTrack(4);
        assertThat(p4.partNumber()).isEqualTo(4);
        assertThat(p4.startOffsetMs()).isEqualTo(1816033L);
        assertThat(p4.durationMs()).isEqualTo(836206L);
        assertThat(p4.audioUrl()).contains("p4.mp3");

        // Total duration
        assertThat(profile.getTotalDurationMs()).isEqualTo(2652239L);
        assertThat(p1.durationMs() + p2.durationMs() + p3.durationMs() + p4.durationMs())
                .isEqualTo(profile.getTotalDurationMs());
    }

    @Test
    @DisplayName("validate từ chối khi số lượng track khác 4")
    void validateRejectsInvalidTrackCount() {
        List<ToeicListeningMediaProfile.TrackProfile> threeTracks = List.of(
                new ToeicListeningMediaProfile.TrackProfile(1, "https://audio/1.mp3", 10000L, 0L, "etag1", 100L),
                new ToeicListeningMediaProfile.TrackProfile(2, "https://audio/2.mp3", 20000L, 10000L, "etag2", 200L),
                new ToeicListeningMediaProfile.TrackProfile(3, "https://audio/3.mp3", 30000L, 30000L, "etag3", 300L)
        );

        assertThatThrownBy(() -> new ToeicListeningMediaProfile("CODE", "SRC", "APP", 60000L, threeTracks))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exactly 4 tracks");
    }

    @Test
    @DisplayName("validate từ chối khi startOffset không cộng dồn đúng")
    void validateRejectsNonCumulativeOffsets() {
        List<ToeicListeningMediaProfile.TrackProfile> invalidOffsets = List.of(
                new ToeicListeningMediaProfile.TrackProfile(1, "https://audio/1.mp3", 10000L, 0L, "etag1", 100L),
                new ToeicListeningMediaProfile.TrackProfile(2, "https://audio/2.mp3", 20000L, 9999L, "etag2", 200L), // Sai offset
                new ToeicListeningMediaProfile.TrackProfile(3, "https://audio/3.mp3", 30000L, 30000L, "etag3", 300L),
                new ToeicListeningMediaProfile.TrackProfile(4, "https://audio/4.mp3", 40000L, 60000L, "etag4", 400L)
        );

        assertThatThrownBy(() -> new ToeicListeningMediaProfile("CODE", "SRC", "APP", 100000L, invalidOffsets))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("startOffsetMs mismatch");
    }

    @Test
    @DisplayName("validate từ chối khi totalDurationMs không khớp tổng duration")
    void validateRejectsMismatchedTotalDuration() {
        List<ToeicListeningMediaProfile.TrackProfile> validTracks = List.of(
                new ToeicListeningMediaProfile.TrackProfile(1, "https://audio/1.mp3", 10000L, 0L, "etag1", 100L),
                new ToeicListeningMediaProfile.TrackProfile(2, "https://audio/2.mp3", 20000L, 10000L, "etag2", 200L),
                new ToeicListeningMediaProfile.TrackProfile(3, "https://audio/3.mp3", 30000L, 30000L, "etag3", 300L),
                new ToeicListeningMediaProfile.TrackProfile(4, "https://audio/4.mp3", 40000L, 60000L, "etag4", 400L)
        );

        assertThatThrownBy(() -> new ToeicListeningMediaProfile("CODE", "SRC", "APP", 999999L, validTracks))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("totalDurationMs mismatch");
    }

    @Test
    @DisplayName("createPlaylist liên kết partId từ attempt snapshot khi có sẵn")
    void createPlaylistResolvesPartIdsFromSnapshot() {
        ToeicListeningMediaProfile profile = verifiedFixture();

        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "skillType", "LISTENING",
                                "parts", List.of(
                                        Map.of("id", 101, "partNumber", 1),
                                        Map.of("id", 102, "partNumber", 2),
                                        Map.of("id", 103, "partNumber", 3),
                                        Map.of("id", 104, "partNumber", 4)
                                )
                        )
                )
        );

        List<ListeningPlaybackTimeline.PlaybackTrack> playlist = profile.createPlaylist(snapshot);

        assertThat(playlist).hasSize(4);
        assertThat(playlist.get(0).partId()).isEqualTo("101");
        assertThat(playlist.get(0).partNumber()).isEqualTo(1);
        assertThat(playlist.get(1).partId()).isEqualTo("102");
        assertThat(playlist.get(2).partId()).isEqualTo("103");
        assertThat(playlist.get(3).partId()).isEqualTo("104");
    }

    @Test
    @DisplayName("createPlaylist fails closed when snapshot has no real part IDs")
    void createPlaylistFailsClosedWhenSnapshotEmpty() {
        ToeicListeningMediaProfile profile = verifiedFixture();

        List<ListeningPlaybackTimeline.PlaybackTrack> playlist = profile.createPlaylist(Map.of());

        assertThat(playlist).isEmpty();
    }

    @Test
    @DisplayName("bindsToSnapshot chỉ chấp nhận đúng examCode và đúng media reference của từng Listening Part")
    void bindsToSnapshotRequiresExactIdentityAndMediaReferences() {
        ToeicListeningMediaProfile profile = verifiedFixture();

        // Matching identity and media references (camelCase and snake_case aliases)
        assertThat(profile.bindsToSnapshot(listeningSnapshot("TOEIC-ETS-2024-T1-V2", "sharedAudio", "https://media.test/"))).isTrue();
        assertThat(profile.bindsToSnapshot(listeningSnapshot("TOEIC-ETS-2024-T1-V2", "shared_audio", "https://media.test/"))).isTrue();

        // Different exam code must fail closed
        assertThat(profile.bindsToSnapshot(listeningSnapshot("TOEIC-OTHER-EXAM", "sharedAudio", "https://media.test/"))).isFalse();

        // Same exam code but a media reference not present in the verified profile
        assertThat(profile.bindsToSnapshot(listeningSnapshot("TOEIC-ETS-2024-T1-V2", "sharedAudio", "https://other.test/"))).isFalse();

        // Missing media reference cannot be verified
        assertThat(profile.bindsToSnapshot(listeningSnapshot("TOEIC-ETS-2024-T1-V2", "sharedAudio", null))).isFalse();

        // Snapshot without sections or null snapshot
        assertThat(profile.bindsToSnapshot(Map.of("code", "TOEIC-ETS-2024-T1-V2"))).isFalse();
        assertThat(profile.bindsToSnapshot(null)).isFalse();
    }

    private static Map<String, Object> listeningSnapshot(String examCode, String audioKey, String urlPrefix) {
        java.util.List<Map<String, Object>> parts = new java.util.ArrayList<>();
        for (int part = 1; part <= 4; part++) {
            Map<String, Object> p = new java.util.LinkedHashMap<>();
            p.put("id", 100 + part);
            p.put("partNumber", part);
            if (urlPrefix != null) {
                p.put(audioKey, Map.of("url", urlPrefix + "p" + part + ".mp3"));
            }
            parts.add(p);
        }
        return Map.of("code", examCode, "sections", List.of(Map.of("skillType", "LISTENING", "parts", parts)));
    }

    @Test
    void defaultProfileIsBlockedUntilRealVerificationEvidenceExists() {
        assertThatThrownBy(ToeicListeningMediaProfile::loadDefault).isInstanceOf(IllegalStateException.class);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"approval", "status", "version", "evidence", "checksum", "assetHash", "tamperedUrl"})
    void rejectsUnverifiedOrTamperedMetadata(String mutation) throws Exception {
        var mapper = mapper();
        var tree = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(
                getClass().getResourceAsStream("/testing/toeic-listening-verified-fixture.json"));
        var verification = (com.fasterxml.jackson.databind.node.ObjectNode) tree.get("verification");
        switch (mutation) {
            case "approval" -> tree.put("approvalReference", " ");
            case "status" -> verification.put("status", "BLOCKED");
            case "version" -> verification.put("version", 0);
            case "evidence" -> verification.remove("durationEvidenceReference");
            case "checksum" -> verification.remove("metadataSha256");
            case "assetHash" -> ((com.fasterxml.jackson.databind.node.ObjectNode) tree.get("tracks").get(0)).remove("sha256");
            case "tamperedUrl" -> ((com.fasterxml.jackson.databind.node.ObjectNode) tree.get("tracks").get(0)).put("audioUrl", "https://other.test/audio.mp3");
        }
        assertThatThrownBy(() -> mapper.treeToValue(tree, ToeicListeningMediaProfile.class)).isInstanceOf(Exception.class);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"missing", "duplicateId", "duplicatePart", "blank", "invalid"})
    void requiresCompleteUniqueRealPartIdentities(String mutation) {
        var parts = new java.util.ArrayList<Map<String, Object>>();
        for (int i = 1; i <= 4; i++) parts.add(new java.util.HashMap<>(Map.of("id", 100 + i, "partNumber", i)));
        switch (mutation) {
            case "missing" -> parts.get(3).remove("id");
            case "duplicateId" -> parts.get(3).put("id", 101);
            case "duplicatePart" -> parts.get(3).put("partNumber", 1);
            case "blank" -> parts.get(3).put("id", " ");
            case "invalid" -> parts.get(3).put("id", "not-an-id");
        }
        assertThat(verifiedFixture().createPlaylist(Map.of("sections", List.of(Map.of("skillType", "LISTENING", "parts", parts))))).isEmpty();
    }

    private static com.fasterxml.jackson.databind.ObjectMapper mapper() {
        return new com.fasterxml.jackson.databind.ObjectMapper()
                .configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    private static ToeicListeningMediaProfile verifiedFixture() {
        try (var input = ToeicListeningMediaProfileTest.class.getResourceAsStream("/testing/toeic-listening-verified-fixture.json")) {
            return mapper().readValue(input, ToeicListeningMediaProfile.class);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
