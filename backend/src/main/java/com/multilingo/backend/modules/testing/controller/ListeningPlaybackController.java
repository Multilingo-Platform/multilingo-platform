package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.testing.dto.response.ListeningPlaybackResponse;
import com.multilingo.backend.modules.testing.service.ListeningPlaybackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller exposing endpoints for server-authoritative TOEIC listening audio playback.
 */
@RestController
@RequestMapping("/api/v1/attempts/{id}/listening-playback")
@RequiredArgsConstructor
public class ListeningPlaybackController {

    private final ListeningPlaybackService playbackService;

    /**
     * Reads current listening playback status, timeline and tracks.
     * Pure read: does not start playback.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<ListeningPlaybackResponse>> getPlayback(
            @PathVariable("id") Integer id) {
        ListeningPlaybackResponse response = playbackService.getPlayback(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * Idempotently starts listening playback for an in-progress TOEIC Mock attempt.
     * Does not accept any position, URL or duration from the client.
     */
    @PostMapping("/start")
    public ResponseEntity<ApiResponse<ListeningPlaybackResponse>> startPlayback(
            @PathVariable("id") Integer id) {
        ListeningPlaybackResponse response = playbackService.startPlayback(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
