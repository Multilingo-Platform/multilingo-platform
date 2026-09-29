package com.multilingo.backend.modules.testing.adapter.dto;

import lombok.Data;

import java.util.List;

@Data
public class PartFixture {
    private Integer id;
    private String title;
    /** Part duration in minutes. Used for SINGLE_PART deadline calculation. */
    private Integer durationMinutes;
    /**
     * Raw question list. Typed loosely as Object in Sprint 01.
     * Sprint 02 will introduce typed QuestionFixture with strict type hierarchy.
     * NOTE: This list MUST NOT contain correct_answer or explanation fields.
     */
    private List<Object> questions;
}
