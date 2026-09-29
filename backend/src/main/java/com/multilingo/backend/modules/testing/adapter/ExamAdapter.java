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
}
