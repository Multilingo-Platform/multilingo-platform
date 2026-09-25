package com.multilingo.backend.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    SUCCESS(200, HttpStatus.OK, "Thao tác thành công"),
    INVALID_REQUEST(400, HttpStatus.BAD_REQUEST, "Yêu cầu không hợp lệ"),
    UNAUTHORIZED(401, HttpStatus.UNAUTHORIZED, "Chưa xác thực hoặc token không hợp lệ"),
    FORBIDDEN(403, HttpStatus.FORBIDDEN, "Không có quyền thực hiện thao tác"),
    RESOURCE_NOT_FOUND(404, HttpStatus.NOT_FOUND, "Không tìm thấy tài nguyên yêu cầu"),
    METHOD_NOT_ALLOWED(405, HttpStatus.METHOD_NOT_ALLOWED, "Phương thức HTTP không được hỗ trợ"),
    CONFLICT(409, HttpStatus.CONFLICT, "Dữ liệu bị trùng lặp hoặc xung đột"),
    VALIDATION_FAILED(422, HttpStatus.UNPROCESSABLE_ENTITY, "Dữ liệu đầu vào không hợp lệ"),
    QUOTA_EXCEEDED(429, HttpStatus.TOO_MANY_REQUESTS, "Đã vượt quá hạn mức sử dụng tính năng"),
    UNCATEGORIZED_EXCEPTION(500, HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi máy chủ nội bộ không xác định");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;

    ErrorCode(int code, HttpStatus httpStatus, String message) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.message = message;
    }
}
