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
    ATTEMPT_EXPIRED(409, HttpStatus.CONFLICT, "Bài thi đã hết thời gian làm bài"),
    ATTEMPT_ALREADY_SUBMITTED(409, HttpStatus.CONFLICT, "Bài thi đã được nộp trước đó"),
    VALIDATION_FAILED(422, HttpStatus.UNPROCESSABLE_ENTITY, "Dữ liệu đầu vào không hợp lệ"),
    QUOTA_EXCEEDED(429, HttpStatus.TOO_MANY_REQUESTS, "Đã vượt quá hạn mức sử dụng tính năng"),
    UNCATEGORIZED_EXCEPTION(500, HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi máy chủ nội bộ không xác định"),
    GRADING_DATA_ERROR(422, HttpStatus.UNPROCESSABLE_ENTITY, "Dữ liệu answer key lỗi hoặc không xác định loại câu"),
    
    // Validation Errors cho Auth (900 - 999)
    EMAIL_REQUIRED(900, HttpStatus.BAD_REQUEST, "Email không được để trống"),
    INVALID_EMAIL_FORMAT(901, HttpStatus.BAD_REQUEST, "Định dạng email không hợp lệ"),
    PASSWORD_REQUIRED(902, HttpStatus.BAD_REQUEST, "Mật khẩu không được để trống"),
    INVALID_PASSWORD(903, HttpStatus.BAD_REQUEST, "Mật khẩu phải từ 6 ký tự trở lên"),
    
    // Logic Errors cho Auth
    USER_NOT_FOUND(904, HttpStatus.NOT_FOUND, "Tài khoản không tồn tại"),
    WRONG_PASSWORD(905, HttpStatus.UNAUTHORIZED, "Mật khẩu không chính xác"),
    EMAIL_EXISTED(906, HttpStatus.CONFLICT, "Email đã được sử dụng"),
    INVALID_TOKEN(907, HttpStatus.UNAUTHORIZED, "Token không hợp lệ"),
    TOKEN_EXPIRED(908, HttpStatus.UNAUTHORIZED, "Token đã hết hạn"),
    UNAUTHENTICATED_ACCESS(909, HttpStatus.UNAUTHORIZED, "Bạn cần đăng nhập để thực hiện thao tác này"),
    NAME_REQUIRED(910, HttpStatus.BAD_REQUEST, "Họ và tên không được để trống"),
    INVALID_NAME_LENGTH(911, HttpStatus.BAD_REQUEST, "Độ dài họ và tên không hợp lệ"),
    INVALID_AVATAR_URL_LENGTH(912, HttpStatus.BAD_REQUEST, "Độ dài đường dẫn ảnh không hợp lệ"),
    INVALID_OTP(913, HttpStatus.BAD_REQUEST, "Mã OTP không chính xác"),
    OTP_EXPIRED(914, HttpStatus.BAD_REQUEST, "Mã OTP đã hết hạn"),
    PASSWORD_NOT_MATCH(915, HttpStatus.BAD_REQUEST, "Mật khẩu cũ không chính xác"),
    NEW_PASSWORD_MISMATCH(916, HttpStatus.BAD_REQUEST, "Xác nhận mật khẩu không khớp"),

    // Vocab & Flashcards module (12xx)
    DECK_NAME_REQUIRED(1201, HttpStatus.UNPROCESSABLE_ENTITY, "Tên bộ thẻ không được để trống"),
    DECK_NAME_TOO_LONG(1202, HttpStatus.UNPROCESSABLE_ENTITY, "Tên bộ thẻ không được vượt quá 200 ký tự"),
    DECK_DESCRIPTION_TOO_LONG(1203, HttpStatus.UNPROCESSABLE_ENTITY, "Mô tả không được vượt quá 2000 ký tự"),
    FLASHCARD_WORD_REQUIRED(1204, HttpStatus.UNPROCESSABLE_ENTITY, "Từ vựng không được để trống"),
    FLASHCARD_WORD_TOO_LONG(1205, HttpStatus.UNPROCESSABLE_ENTITY, "Từ vựng không được vượt quá 150 ký tự"),
    FLASHCARD_MEANING_REQUIRED(1206, HttpStatus.UNPROCESSABLE_ENTITY, "Nghĩa từ vựng không được để trống"),
    FLASHCARD_IMAGE_URL_TOO_LONG(1207, HttpStatus.UNPROCESSABLE_ENTITY, "Đường dẫn ảnh không được vượt quá 500 ký tự"),
    FLASHCARD_DECK_NOT_FOUND(1208, HttpStatus.NOT_FOUND, "Không tìm thấy bộ thẻ yêu cầu"),
    FLASHCARD_NOT_FOUND(1209, HttpStatus.NOT_FOUND, "Không tìm thấy thẻ từ vựng yêu cầu"),
    FLASHCARD_WORD_DUPLICATE(1210, HttpStatus.CONFLICT, "Từ vựng này đã tồn tại trong bộ thẻ"),
    FLASHCARD_LANG_INVALID(1211, HttpStatus.UNPROCESSABLE_ENTITY, "Mã ngôn ngữ không hợp lệ"),
    DECK_EMPTY(1212, HttpStatus.BAD_REQUEST, "Bộ thẻ chưa có từ vựng nào để ôn tập"),
    INVALID_SRS_RATING(1213, HttpStatus.BAD_REQUEST, "Mức độ đánh giá SRS không hợp lệ (chỉ chấp nhận REMEMBERED hoặc FORGOTTEN)");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;

    ErrorCode(int code, HttpStatus httpStatus, String message) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.message = message;
    }
}
