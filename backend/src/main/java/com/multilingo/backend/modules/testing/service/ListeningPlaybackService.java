package com.multilingo.backend.modules.testing.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.entity.AttemptListeningPlayback;
import com.multilingo.backend.modules.testing.adapter.repository.AttemptListeningPlaybackRepository;
import com.multilingo.backend.modules.testing.dto.response.ListeningPlaybackResponse;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.support.ListeningPlaybackTimeline;
import com.multilingo.backend.modules.testing.service.support.ListeningPlaybackTimeline.PlaybackTrack;
import com.multilingo.backend.modules.testing.service.support.ListeningPlaybackTimeline.TimelineState;
import com.multilingo.backend.modules.testing.service.support.ToeicListeningMediaProfile;
import com.multilingo.backend.modules.testing.service.support.ToeicWorkspaceProjection;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Service for managing server-authoritative TOEIC listening playback.
 * Enforces ownership, mode, scope, deadline, and section locking.
 * Playback persistence is strictly decoupled from TestAttempt mutation.
 */
@Service
public class ListeningPlaybackService {

    private final TestAttemptRepository testAttemptRepository;
    private final AttemptListeningPlaybackRepository playbackRepository;
    private final IdentityAdapter identityAdapter;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public ListeningPlaybackService(
            TestAttemptRepository testAttemptRepository,
            AttemptListeningPlaybackRepository playbackRepository,
            IdentityAdapter identityAdapter,
            ObjectMapper objectMapper) {
        this(testAttemptRepository, playbackRepository, identityAdapter, objectMapper, Clock.systemUTC());
    }

    @Autowired
    public ListeningPlaybackService(
            TestAttemptRepository testAttemptRepository,
            AttemptListeningPlaybackRepository playbackRepository,
            IdentityAdapter identityAdapter,
            ObjectMapper objectMapper,
            Clock clock) {
        this.testAttemptRepository = Objects.requireNonNull(testAttemptRepository, "testAttemptRepository must not be null");
        this.playbackRepository = Objects.requireNonNull(playbackRepository, "playbackRepository must not be null");
        this.identityAdapter = Objects.requireNonNull(identityAdapter, "identityAdapter must not be null");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper must not be null");
        this.clock = Objects.requireNonNull(clock, "clock must not be null");
    }

    /**
     * Reads current playback status and timeline for the specified attempt.
     * Pure read-only operation: does not mutate state or start playback.
     */
    @Transactional(readOnly = true)
    public ListeningPlaybackResponse getPlayback(Integer attemptId) {
        Integer currentUserId = identityAdapter.getCurrentUserId();
        TestAttempt attempt = validateAttemptAccess(attemptId, currentUserId);

        Instant serverTime = clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);

        // 1. Check if attempt is closed/submitted
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return buildClosedResponse(attemptId, serverTime);
        }

        // 2. Check if attempt has expired past deadline
        if (attempt.getDeadline() != null && serverTime.isAfter(attempt.getDeadline().plusSeconds(15))) {
            return buildClosedResponse(attemptId, serverTime);
        }

        // 3. Check if listening section is locked
        if (isListeningSectionLocked(attempt)) {
            return buildLockedResponse(attemptId, serverTime);
        }

        // 4. Resolve media profile
        ToeicListeningMediaProfile profile = resolveMediaProfile(attempt);
        if (profile == null) {
            return buildUnavailableResponse(attemptId, serverTime);
        }

        // 5. Check if playback record exists
        Optional<AttemptListeningPlayback> playbackOpt = playbackRepository.findByAttemptId(attemptId);
        if (playbackOpt.isEmpty()) {
            List<PlaybackTrack> playlist = profile.createPlaylist(attempt.getExamSnapshot());
            TimelineState state = ListeningPlaybackTimeline.compute(playlist, null, serverTime);
            return toResponse(attemptId, state, serverTime);
        }

        AttemptListeningPlayback playback = playbackOpt.get();
        List<PlaybackTrack> playlist = parsePlaylist(playback.getPlaylistFrozen());
        TimelineState state = ListeningPlaybackTimeline.compute(playlist, playback.getStartedAt(), serverTime);
        return toResponse(attemptId, state, serverTime);
    }

    /**
     * Idempotently starts listening playback for an in-progress TOEIC Mock attempt.
     * Concurrent starts serialize on the attempt row lock (held until commit) so every caller
     * observes the same frozen playlist and startedAt; never mutates TestAttempt version.
     */
    @Transactional
    public ListeningPlaybackResponse startPlayback(Integer attemptId) {
        Integer currentUserId = identityAdapter.getCurrentUserId();
        // Serialize concurrent starts on the attempt row: the lock is held until commit, so a
        // second caller observes the first caller's frozen playlist instead of racing the INSERT.
        TestAttempt attempt = validateAttemptAccess(attemptId, currentUserId, true);

        // Status check: must be in progress
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED, "Bài thi đã kết thúc, không thể bắt đầu nghe");
        }

        Instant serverTime = clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);

        // Deadline check
        if (attempt.getDeadline() != null && serverTime.isAfter(attempt.getDeadline().plusSeconds(15))) {
            throw new AppException(ErrorCode.ATTEMPT_EXPIRED, "Bài thi đã hết thời gian làm bài");
        }

        // Section lock check
        if (isListeningSectionLocked(attempt)) {
            throw new AppException(ErrorCode.CONFLICT, "Phần thi nghe đã bị khóa");
        }

        ToeicListeningMediaProfile profile = resolveMediaProfile(attempt);
        if (profile == null) {
            return buildUnavailableResponse(attemptId, serverTime);
        }

        Optional<AttemptListeningPlayback> existingOpt = playbackRepository.findByAttemptId(attemptId);
        if (existingOpt.isPresent()) {
            AttemptListeningPlayback existing = existingOpt.get();
            if (existing.getStartedAt() != null) {
                // Idempotent: already running, return current timeline without resetting startedAt
                List<PlaybackTrack> playlist = parsePlaylist(existing.getPlaylistFrozen());
                TimelineState state = ListeningPlaybackTimeline.compute(playlist, existing.getStartedAt(), serverTime);
                return toResponse(attemptId, state, serverTime);
            } else {
                existing.setStartedAt(serverTime);
                existing = playbackRepository.save(existing);
                List<PlaybackTrack> playlist = parsePlaylist(existing.getPlaylistFrozen());
                TimelineState state = ListeningPlaybackTimeline.compute(playlist, existing.getStartedAt(), serverTime);
                return toResponse(attemptId, state, serverTime);
            }
        }

        // Not created yet: freeze the verified, snapshot-bound playlist
        List<PlaybackTrack> playlist = profile.createPlaylist(attempt.getExamSnapshot());
        String playlistJson = serializePlaylist(playlist);

        AttemptListeningPlayback newPlayback = AttemptListeningPlayback.builder()
                .attemptId(attemptId)
                .startedAt(serverTime)
                .playlistFrozen(playlistJson)
                .totalDurationMs(profile.getTotalDurationMs())
                .build();

        try {
            newPlayback = playbackRepository.saveAndFlush(newPlayback);
        } catch (DataIntegrityViolationException e) {
            // Concurrent start race condition: reload existing record
            newPlayback = playbackRepository.findByAttemptId(attemptId)
                    .orElseThrow(() -> e);
        }

        TimelineState state = ListeningPlaybackTimeline.compute(playlist, newPlayback.getStartedAt(), serverTime);
        return toResponse(attemptId, state, serverTime);
    }

    /**
     * Builds safe playback summary for inclusion in WorkspaceResponse.
     */
    public WorkspaceResponse.ListeningPlaybackSummary getPlaybackSummary(TestAttempt attempt) {
        if (attempt == null || attempt.getTestMode() != TestMode.MOCK_TEST
                || !ToeicWorkspaceProjection.isToeicExam(attempt.getExamSnapshot())) {
            return null;
        }

        Instant now = clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return WorkspaceResponse.ListeningPlaybackSummary.builder()
                    .status("CLOSED")
                    .available(false)
                    .build();
        }

        if (attempt.getDeadline() != null && now.isAfter(attempt.getDeadline().plusSeconds(15))) {
            return WorkspaceResponse.ListeningPlaybackSummary.builder()
                    .status("CLOSED")
                    .available(false)
                    .build();
        }

        if (isListeningSectionLocked(attempt)) {
            return WorkspaceResponse.ListeningPlaybackSummary.builder()
                    .status("LOCKED")
                    .available(false)
                    .build();
        }

        if (resolveMediaProfile(attempt) == null) {
            return WorkspaceResponse.ListeningPlaybackSummary.builder()
                    .status("UNAVAILABLE").available(false).build();
        }

        Optional<AttemptListeningPlayback> opt = playbackRepository.findByAttemptId(attempt.getId());
        if (opt.isEmpty()) {
            return WorkspaceResponse.ListeningPlaybackSummary.builder()
                    .status("NOT_STARTED")
                    .available(true)
                    .build();
        }

        AttemptListeningPlayback playback = opt.get();
        if (playback.getStartedAt() == null) {
            return WorkspaceResponse.ListeningPlaybackSummary.builder()
                    .status("NOT_STARTED")
                    .available(true)
                    .build();
        }

        long elapsed = Math.max(0L, Duration.between(playback.getStartedAt(), now).toMillis());
        String status = elapsed >= playback.getTotalDurationMs() ? "FINISHED" : "RUNNING";
        return WorkspaceResponse.ListeningPlaybackSummary.builder()
                .status(status)
                .available(true)
                .build();
    }

    private TestAttempt validateAttemptAccess(Integer attemptId, Integer currentUserId) {
        return validateAttemptAccess(attemptId, currentUserId, false);
    }

    private TestAttempt validateAttemptAccess(Integer attemptId, Integer currentUserId, boolean forUpdate) {
        TestAttempt attempt = (forUpdate
                ? testAttemptRepository.findByIdForUpdate(attemptId)
                : testAttemptRepository.findById(attemptId))
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy bài thi"));

        if (!attempt.getUserId().equals(currentUserId)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Không có quyền truy cập bài thi này");
        }

        if (attempt.getTestMode() != TestMode.MOCK_TEST) {
            throw new AppException(ErrorCode.FORBIDDEN, "Tính năng nghe chỉ hỗ trợ trong chế độ MOCK_TEST");
        }

        if (!ToeicWorkspaceProjection.isToeicExam(attempt.getExamSnapshot())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Tính năng nghe chỉ hỗ trợ cho đề thi TOEIC");
        }

        return attempt;
    }

    private boolean isListeningSectionLocked(TestAttempt attempt) {
        if (attempt.getLockedSections() == null || attempt.getLockedSections().isEmpty()) {
            return false;
        }
        Integer listeningSectionId = getListeningSectionId(attempt.getExamSnapshot());
        return listeningSectionId != null && attempt.getLockedSections().contains(listeningSectionId);
    }

    private Integer getListeningSectionId(Map<String, Object> snapshot) {
        if (snapshot == null) return null;
        Object sectionsObj = snapshot.get("sections");
        if (!(sectionsObj instanceof List<?> sections)) return null;
        for (Object sObj : sections) {
            if (!(sObj instanceof Map<?, ?> section)) continue;
            Object skill = section.get("skillType");
            if (skill == null) skill = section.get("name");
            if (skill != null && skill.toString().toUpperCase(Locale.ROOT).contains("LISTENING")) {
                Object idObj = section.get("id");
                if (idObj != null) {
                    try {
                        return Integer.parseInt(idObj.toString());
                    } catch (NumberFormatException ignored) {}
                }
            }
        }
        return null;
    }

    private ToeicListeningMediaProfile resolveMediaProfile(TestAttempt attempt) {
        try {
            ToeicListeningMediaProfile profile = ToeicListeningMediaProfile.loadDefault();
            if (!profile.bindsToSnapshot(attempt.getExamSnapshot())) {
                return null;
            }
            return profile.createPlaylist(attempt.getExamSnapshot()).isEmpty() ? null : profile;
        } catch (Exception e) {
            return null;
        }
    }

    private List<PlaybackTrack> parsePlaylist(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<List<PlaybackTrack>>() {});
        } catch (IOException e) {
            throw new IllegalStateException("Failed to parse frozen playlist", e);
        }
    }

    private String serializePlaylist(List<PlaybackTrack> playlist) {
        try {
            return objectMapper.writeValueAsString(playlist);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to serialize playlist", e);
        }
    }

    private ListeningPlaybackResponse toResponse(Integer attemptId, TimelineState state, Instant serverTime) {
        List<ListeningPlaybackResponse.TrackDto> trackDtos = state.tracks().stream()
                .map(t -> ListeningPlaybackResponse.TrackDto.builder()
                        .partId(t.partId())
                        .partNumber(t.partNumber())
                        .audioUrl(t.audioUrl())
                        .durationMs(t.durationMs())
                        .startOffsetMs(t.startOffsetMs())
                        .build())
                .toList();

        ListeningPlaybackResponse.Status status = switch (state.status()) {
            case NOT_STARTED -> ListeningPlaybackResponse.Status.NOT_STARTED;
            case RUNNING -> ListeningPlaybackResponse.Status.RUNNING;
            case FINISHED -> ListeningPlaybackResponse.Status.FINISHED;
            case UNAVAILABLE -> ListeningPlaybackResponse.Status.UNAVAILABLE;
        };

        return ListeningPlaybackResponse.builder()
                .attemptId(attemptId)
                .status(status)
                .serverTime(serverTime)
                .startedAt(state.startedAt())
                .activePartId(state.activePartId())
                .activePartNumber(state.activePartNumber())
                .positionMs(state.positionMs())
                .elapsedMs(state.elapsedMs())
                .remainingMs(state.remainingMs())
                .totalDurationMs(state.totalDurationMs())
                .tracks(trackDtos)
                .build();
    }

    private ListeningPlaybackResponse buildClosedResponse(Integer attemptId, Instant serverTime) {
        return ListeningPlaybackResponse.builder()
                .attemptId(attemptId)
                .status(ListeningPlaybackResponse.Status.CLOSED)
                .serverTime(serverTime)
                .positionMs(0L)
                .tracks(List.of())
                .build();
    }

    private ListeningPlaybackResponse buildLockedResponse(Integer attemptId, Instant serverTime) {
        return ListeningPlaybackResponse.builder()
                .attemptId(attemptId)
                .status(ListeningPlaybackResponse.Status.LOCKED)
                .serverTime(serverTime)
                .positionMs(0L)
                .tracks(List.of())
                .build();
    }

    private ListeningPlaybackResponse buildUnavailableResponse(Integer attemptId, Instant serverTime) {
        return ListeningPlaybackResponse.builder()
                .attemptId(attemptId)
                .status(ListeningPlaybackResponse.Status.UNAVAILABLE)
                .serverTime(serverTime)
                .positionMs(0L)
                .tracks(List.of())
                .build();
    }
}
