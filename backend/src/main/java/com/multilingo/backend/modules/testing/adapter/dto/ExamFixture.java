package com.multilingo.backend.modules.testing.adapter.dto;

import lombok.Data;

import java.util.List;

/**
 * Fixture DTO representing an exam loaded from JSON fixture file.
 * Mirrors the structure from docs/contracts/content-data-schema contract.
 * Does NOT contain correct_answer or explanation — those are never loaded into this DTO.
 */
@Data
public class ExamFixture {
    private Integer id;
    private String title;
    /** Total exam duration in minutes. Null means not configured — MOCK_TEST with null duration is rejected. */
    private Integer durationMinutes;
    private List<SectionFixture> sections;
}
