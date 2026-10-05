package com.multilingo.backend.modules.testing.dto;

import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class SubmitAttemptRequestTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void testSubmitRequestValidation_missingReason_fails() {
        SubmitAttemptRequest req = new SubmitAttemptRequest();
        Set<ConstraintViolation<SubmitAttemptRequest>> violations = validator.validate(req);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("reason")));
    }

    @Test
    void testSubmitRequestValidation_validReason_passes() {
        SubmitAttemptRequest req = SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL)
                .build();
        Set<ConstraintViolation<SubmitAttemptRequest>> violations = validator.validate(req);
        assertTrue(violations.isEmpty());
    }
}
