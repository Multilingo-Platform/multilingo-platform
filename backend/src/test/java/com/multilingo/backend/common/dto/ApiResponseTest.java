package com.multilingo.backend.common.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ApiResponseTest {

    @Test
    @DisplayName("ApiResponse.success(data) should set default success fields")
    void shouldCreateDefaultSuccessResponse() {
        String payload = "Sample Payload";

        ApiResponse<String> response = ApiResponse.success(payload);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getCode()).isEqualTo(200);
        assertThat(response.getMessage()).isEqualTo("Success");
        assertThat(response.getData()).isEqualTo(payload);
        assertThat(response.getTimestamp()).isNotNull();
    }

    @Test
    @DisplayName("ApiResponse.success(message, data) should preserve custom message")
    void shouldCreateSuccessResponseWithCustomMessage() {
        Integer payload = 100;
        String message = "Custom Success Message";

        ApiResponse<Integer> response = ApiResponse.success(message, payload);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getCode()).isEqualTo(200);
        assertThat(response.getMessage()).isEqualTo(message);
        assertThat(response.getData()).isEqualTo(payload);
        assertThat(response.getTimestamp()).isNotNull();
    }

    @Test
    @DisplayName("ApiResponse.error(code, message) should set error fields and null data")
    void shouldCreateErrorResponse() {
        int errorCode = 404;
        String errorMessage = "Resource not found";

        ApiResponse<Void> response = ApiResponse.error(errorCode, errorMessage);

        assertThat(response.isSuccess()).isFalse();
        assertThat(response.getCode()).isEqualTo(errorCode);
        assertThat(response.getMessage()).isEqualTo(errorMessage);
        assertThat(response.getData()).isNull();
        assertThat(response.getTimestamp()).isNotNull();
    }
}
