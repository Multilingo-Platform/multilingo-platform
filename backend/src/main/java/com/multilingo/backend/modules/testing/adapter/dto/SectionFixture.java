package com.multilingo.backend.modules.testing.adapter.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class SectionFixture {
    private Integer id;
    private String name;
    /** Section duration in minutes. Used for SINGLE_SKILL deadline calculation. */
    private Integer durationMinutes;
    private List<PartFixture> parts;

    @JsonProperty("skill_type")
    public String getSkillType() {
        return name;
    }

    @JsonProperty("skill_type")
    public void setSkillType(String skillType) {
        if (skillType != null && !skillType.isBlank()) {
            this.name = skillType;
        }
    }
}
