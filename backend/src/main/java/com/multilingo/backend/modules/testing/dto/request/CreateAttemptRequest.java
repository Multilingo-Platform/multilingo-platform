package com.multilingo.backend.modules.testing.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request DTO for creating a new test attempt.
 * userId is NOT accepted from client — always resolved from IdentityAdapter.
 */
@Data
public class CreateAttemptRequest {

    @NotNull(message = "examId is required")
    @JsonAlias({"exam_id", "examId"})
    private Integer examId;

    @NotNull(message = "testScope is required")
    @JsonAlias({"test_scope", "testScope"})
    private TestScope testScope;

    @NotNull(message = "testMode is required")
    @JsonAlias({"test_mode", "testMode"})
    private TestMode testMode;

    /** Required when testScope = SINGLE_SKILL */
    @JsonAlias({"section_id", "targetSectionId"})
    private Integer targetSectionId;

    /** Required when testScope = SINGLE_PART */
    @JsonAlias({"part_id", "targetPartId"})
    private Integer targetPartId;
}
