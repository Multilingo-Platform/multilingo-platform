package com.multilingo.backend.modules.testing.ai.grading;

import java.util.Objects;

/**
 * Đại diện cho một tham chiếu URL hình ảnh cấu trúc được đóng băng từ attempt snapshot.
 * Phương thức toString() tuyệt đối không in chuỗi URL thô để ngăn chặn rò rỉ
 * chữ ký, token bảo mật, hoặc tham số nhạy cảm vào log hệ thống.
 */
public record WritingImageRef(String url) {

    public WritingImageRef {
        Objects.requireNonNull(url, "Image URL must not be null");
        if (url.isBlank()) {
            throw new IllegalArgumentException("Image URL must not be blank");
        }
        if (url.length() > 2048) {
            throw new IllegalArgumentException("Image URL must not exceed 2048 characters");
        }
    }

    @Override
    public String toString() {
        return "WritingImageRef[urlLength=" + url.length() + "]";
    }
}
