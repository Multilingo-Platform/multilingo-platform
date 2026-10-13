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
    CANNOT_LOCK_SELF(400, HttpStatus.BAD_REQUEST, "Không thể tự khóa tài khoản quản trị của chính mình"),

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
    INVALID_PHONE_FORMAT(917, HttpStatus.BAD_REQUEST, "Định dạng số điện thoại không hợp lệ"),
    ACCOUNT_INACTIVE(918, HttpStatus.FORBIDDEN, "Tài khoản đã bị khóa liên hệ admin để được hỗ trợ"),
    INVALID_EMAIL_OR_PASSWORD(919, HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu không chính xác"),
    INVALID_GOOGLE_TOKEN(920, HttpStatus.UNAUTHORIZED, "Mã xác thực Google không hợp lệ hoặc đã hết hạn"),
    GOOGLE_EMAIL_NOT_VERIFIED(921, HttpStatus.BAD_REQUEST, "Email Google của bạn chưa được xác thực"),
    ID_TOKEN_REQUIRED(922, HttpStatus.BAD_REQUEST, "ID Token Google không được để trống"),

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
    INVALID_SRS_RATING(1213, HttpStatus.BAD_REQUEST,
            "Mức độ đánh giá SRS không hợp lệ (chỉ chấp nhận REMEMBERED hoặc FORGOTTEN)"),
    QUIZ_INVALID_REQUEST(1214, HttpStatus.BAD_REQUEST, "Yêu cầu luyện tập không hợp lệ"),
    QUIZ_INSUFFICIENT_CONTENT(1215, HttpStatus.UNPROCESSABLE_ENTITY,
            "Không đủ từ vựng để tạo bài luyện tập (tối thiểu 4 từ vựng)"),
    QUIZ_SESSION_NOT_FOUND(1216, HttpStatus.NOT_FOUND, "Không tìm thấy phiên luyện tập"),
    QUIZ_SESSION_EXPIRED(1217, HttpStatus.GONE, "Phiên luyện tập đã hết hạn"),
    QUIZ_IDEMPOTENCY_CONFLICT(1218, HttpStatus.CONFLICT, "Khóa thao tác bị xung đột dữ liệu"),
    QUIZ_ALREADY_SUBMITTED(1219, HttpStatus.CONFLICT, "Phiên luyện tập đã được nộp trước đó"),

    // Vocab Mock Test & Assessment (122x)
    VOCAB_TEST_NOT_FOUND(1220, HttpStatus.NOT_FOUND, "Không tìm thấy bài thi thử"),
    VOCAB_TEST_VERSION_CONFLICT(1221, HttpStatus.CONFLICT, "Phiên bản tiến độ bài thi bị xung đột"),
    VOCAB_TEST_ALREADY_FINISHED(1222, HttpStatus.CONFLICT, "Bài thi thử đã kết thúc hoặc đã nộp"),
    VOCAB_TEST_DEADLINE_PASSED(1223, HttpStatus.GONE, "Đã quá thời gian làm bài thi thử"),
    VOCAB_TEST_STILL_IN_PROGRESS(1224, HttpStatus.BAD_REQUEST, "Bài thi đang diễn ra, chưa thể xem lại đáp án"),
    VOCAB_TEST_INSUFFICIENT_CARDS(1225, HttpStatus.UNPROCESSABLE_ENTITY, "Bộ thẻ cần tối thiểu 4 từ vựng để tạo bài thi thử"),

    // Exam Builder Errors (14xx)
    EXAM_NOT_FOUND(1401, HttpStatus.NOT_FOUND, "Không tìm thấy đề thi yêu cầu"),
    INVALID_IMPORT_FILE(1402, HttpStatus.BAD_REQUEST, "Định dạng file không hợp lệ hoặc cấu trúc sai"),

    // Billing & Subscriptions (15xx)
    PLAN_CODE_REQUIRED(1501, HttpStatus.BAD_REQUEST, "Mã gói không được để trống"),
    PLAN_NAME_REQUIRED(1502, HttpStatus.BAD_REQUEST, "Tên gói không được để trống"),
    PLAN_PRICE_REQUIRED(1503, HttpStatus.BAD_REQUEST, "Giá tiền không được để trống"),
    PLAN_PRICE_MIN(1504, HttpStatus.BAD_REQUEST, "Giá tiền phải lớn hơn 0"),
    PLAN_DURATION_REQUIRED(1505, HttpStatus.BAD_REQUEST, "Thời hạn không được để trống"),
    PLAN_DURATION_MIN(1506, HttpStatus.BAD_REQUEST, "Thời hạn phải lớn hơn 0"),
    PLAN_CODE_EXISTED(1507, HttpStatus.CONFLICT, "Mã gói đã tồn tại"),
    PLAN_NOT_FOUND(1508, HttpStatus.NOT_FOUND, "Không tìm thấy gói cước yêu cầu"),

    // Testing & Attempts (16xx)
    VERSION_CONFLICT(1601, HttpStatus.CONFLICT, "Phiên bản bài làm không khớp hoặc đã có thay đổi mới"),
    WRITING_HINTS_UNAVAILABLE(1602, HttpStatus.SERVICE_UNAVAILABLE, "Dịch vụ gợi ý viết hiện không khả dụng"),
    WRITING_HINTS_INVALID_RESPONSE(1603, HttpStatus.BAD_GATEWAY, "Phản hồi gợi ý viết không hợp lệ"),
    WRITING_HINTS_IN_PROGRESS(1604, HttpStatus.CONFLICT, "Yêu cầu gợi ý viết đang được xử lý"),
    WRITING_HINTS_REQUEST_CONFLICT(1605, HttpStatus.CONFLICT, "Xung đột thông tin yêu cầu gợi ý viết"),
    WRITING_HINTS_RATE_LIMITED(1606, HttpStatus.TOO_MANY_REQUESTS, "Bạn đang gửi yêu cầu quá nhanh, vui lòng thử lại sau"),
    WRITING_HINTS_LANGUAGE_UNSUPPORTED(1607, HttpStatus.UNPROCESSABLE_ENTITY, "Ngôn ngữ không được hỗ trợ"),
    WRITING_HINTS_LANGUAGE_REQUIRED(1608, HttpStatus.UNPROCESSABLE_ENTITY, "Vui lòng chỉ định ngôn ngữ học tập"),
    WRITING_HINTS_CONTEXT_UNAVAILABLE(1609, HttpStatus.UNPROCESSABLE_ENTITY, "Nội dung bài viết không khả dụng để tạo gợi ý"),
    WRITING_HINTS_TIMEOUT(1610, HttpStatus.GATEWAY_TIMEOUT, "Yêu cầu gợi ý viết đã quá thời gian chờ"),
    WRITING_HINTS_REQUEST_TOO_LARGE(1611, HttpStatus.PAYLOAD_TOO_LARGE, "Dung lượng yêu cầu vượt quá giới hạn cho phép");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;

    ErrorCode(int code, HttpStatus httpStatus, String message) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.message = message;
    }
}
