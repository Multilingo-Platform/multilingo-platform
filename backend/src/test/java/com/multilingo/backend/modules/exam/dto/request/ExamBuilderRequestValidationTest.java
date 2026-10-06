package com.multilingo.backend.modules.exam.dto.request;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ExamBuilderRequestValidationTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            validator = factory.getValidator();
        }
    }

    @Test
    void testValidation_MissingTitleAndEmptySections() {
        ExamBuilderRequest req = new ExamBuilderRequest();
        req.setTitle("");
        req.setSections(new ArrayList<>());
        
        Set<ConstraintViolation<ExamBuilderRequest>> violations = validator.validate(req);
        
        assertThat(violations).isNotEmpty();
        assertThat(violations).anyMatch(v -> v.getPropertyPath().toString().equals("title"));
        assertThat(violations).anyMatch(v -> v.getPropertyPath().toString().equals("sections"));
    }
}
