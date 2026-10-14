package com.multilingo.backend.modules.auth.dto;

import com.multilingo.backend.modules.auth.dto.request.UserCreationRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserCreationRequestValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUp() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    private UserCreationRequest.UserCreationRequestBuilder validRequestBuilder() {
        return UserCreationRequest.builder()
                .email("student@example.com")
                .passwordHash("password123")
                .fullName("Nguyen Van A")
                .phone("0912345678");
    }

    @Test
    @DisplayName("Valid UserCreationRequest passes all validations")
    void validRequest_shouldPassValidation() {
        UserCreationRequest request = validRequestBuilder().build();
        Set<ConstraintViolation<UserCreationRequest>> violations = validator.validate(request);
        assertTrue(violations.isEmpty(), "Should have no violations for valid request");
    }

    @Test
    @DisplayName("Valid UserCreationRequest with null or empty phone passes validation")
    void validRequest_withNullOrEmptyPhone_shouldPass() {
        UserCreationRequest reqWithNullPhone = validRequestBuilder().phone(null).build();
        assertTrue(validator.validate(reqWithNullPhone).isEmpty());

        UserCreationRequest reqWithEmptyPhone = validRequestBuilder().phone("").build();
        assertTrue(validator.validate(reqWithEmptyPhone).isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "valid.email@example.com",
            "user123@domain.vn",
            "name.surname@company.co.uk",
            "user+tag@gmail.com"
    })
    @DisplayName("Standard valid emails should pass validation")
    void standardValidEmails_shouldPass(String email) {
        UserCreationRequest request = validRequestBuilder().email(email).build();
        assertTrue(validator.validate(request).isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "plainaddress",
            "@missingusername.com",
            "user@.com",
            "user@domain",
            "user@domain.",
            "user@domain..com",
            "user@domain,com",
            "user name@domain.com"
    })
    @DisplayName("Invalid emails should trigger INVALID_EMAIL_FORMAT")
    void invalidEmails_shouldFailValidation(String email) {
        UserCreationRequest request = validRequestBuilder().email(email).build();
        Set<ConstraintViolation<UserCreationRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> "INVALID_EMAIL_FORMAT".equals(v.getMessage())));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "0321234567",
            "0561234567",
            "0771234567",
            "0881234567",
            "0912345678"
    })
    @DisplayName("Valid Vietnamese phone numbers should pass validation")
    void validPhoneNumbers_shouldPass(String phone) {
        UserCreationRequest request = validRequestBuilder().phone(phone).build();
        assertTrue(validator.validate(request).isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "1234567890",
            "0123456789",
            "091234567",     // 9 digits
            "09123456789",   // 11 digits
            "091234abcd",
            "+84912345678"
    })
    @DisplayName("Invalid phone numbers should trigger INVALID_PHONE_FORMAT")
    void invalidPhoneNumbers_shouldFailValidation(String phone) {
        UserCreationRequest request = validRequestBuilder().phone(phone).build();
        Set<ConstraintViolation<UserCreationRequest>> violations = validator.validate(request);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> "INVALID_PHONE_FORMAT".equals(v.getMessage())));
    }
}
