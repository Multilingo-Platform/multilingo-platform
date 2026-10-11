package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;

import java.util.Optional;

/**
 * Adapter interface for reading exam data.
 * In dev/test profile: backed by JSON fixture files.
 * In production: will be backed by TV2's ExamRepository (to be wired by TV2 or via shared interface).
 */
public interface ExamAdapter {
    Optional<ExamFixture> findById(Integer examId);

    /**
     * Finds exam data intended for persisting an immutable snapshot of the attempt.
     * Retains correct_answer and explanation while removing server-internal secrets
     * (e.g. ai_prompt_context, internal prompt templates).
     */
    default Optional<ExamFixture> findSnapshotById(Integer examId) {
        return findById(examId);
    }
}
