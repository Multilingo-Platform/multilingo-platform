package com.multilingo.backend.modules.testing.dto.request;

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
    private Integer examId;

    @NotNull(message = "testScope is required")
    private TestScope testScope;

    @NotNull(message = "testMode is required")
    private TestMode testMode;

    /** Required when testScope = SINGLE_SKILL */
    private Integer targetSectionId;

    /** Required when testScope = SINGLE_PART */
    private Integer targetPartId;
}
