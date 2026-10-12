package com.multilingo.backend.modules.vocab.security;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Trình trích xuất danh tính người dùng an toàn từ SecurityContext cho phân hệ Vocab.
 * Ngăn chặn tuyệt đối việc giả mạo định danh qua HTTP Header (chống IDOR).
 */
@Slf4j
@Component
public class VocabIdentityResolver {

    /**
     * Lấy ID của người dùng hiện tại từ CustomUserDetails trong SecurityContext.
     * Ném AppException(ErrorCode.UNAUTHENTICATED_ACCESS) nếu chưa đăng nhập hoặc token không hợp lệ.
     *
     * @return ID người dùng hợp lệ
     */
    public Integer requireUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
                && auth.getPrincipal() instanceof CustomUserDetails details
                && details.getUser() != null
                && details.getUser().getId() != null) {
            return details.getUser().getId();
        }
        log.warn("Từ chối truy cập: Không tìm thấy CustomUserDetails hợp lệ trong SecurityContext");
        throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
    }
}
