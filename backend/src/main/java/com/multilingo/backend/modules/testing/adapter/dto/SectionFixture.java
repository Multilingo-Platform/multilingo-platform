package com.multilingo.backend.modules.testing.adapter.dto;

import lombok.Data;

import java.util.List;

@Data
public class SectionFixture {
    private Integer id;
    private String name;
    /** Section duration in minutes. Used for SINGLE_SKILL deadline calculation. */
    private Integer durationMinutes;
    private List<PartFixture> parts;
}
