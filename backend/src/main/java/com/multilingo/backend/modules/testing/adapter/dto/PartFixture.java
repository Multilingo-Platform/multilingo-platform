package com.multilingo.backend.modules.testing.adapter.dto;

import lombok.Data;

import java.util.List;

@Data
public class PartFixture {
    private Integer id;
    private Integer partNumber;
    private String title;
    private String partTitle;
    /** Part duration in minutes. Used for SINGLE_PART deadline calculation. */
    private Integer durationMinutes;
    private String contentHtml;
    private String instruction;
    private java.util.Map<String, Object> sharedAudio;
    private java.util.Map<String, Object> sharedMedia;
    private List<Object> questionGroups;
    /**
     * Raw question list. Typed loosely as Object in Sprint 01.
     * Sprint 02 will introduce typed QuestionFixture with strict type hierarchy.
     * NOTE: This list MUST NOT contain correct_answer or explanation fields.
     */
    private List<Object> questions;
}
