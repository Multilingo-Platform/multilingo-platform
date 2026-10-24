# Kế Hoạch Triển Khai: Chức Năng Quên Mật Khẩu Qua Brevo Email OTP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai hoàn chỉnh tính năng Quên mật khẩu & Đặt lại mật khẩu sử dụng mã OTP 6 số gửi qua Brevo Transactional Email REST API, quản lý phiên & rate limiting bằng Redis, cùng giao diện Wizard 2 bước tại `/forgot-password`.

**Architecture:** Frontend Single Page Application (React 19 + TypeScript + Tailwind) gọi REST API Backend Spring Boot 3.3.4. Backend sử dụng Spring `RestClient` kết nối Brevo API v3 (`https://api.brevo.com/v3/smtp/email`), kết hợp `StringRedisTemplate` để quản lý vòng đời OTP (TTL 5 phút), cooldown 60 giây và giới hạn 5 lần nhập sai chống brute-force.

**Tech Stack:** Spring Boot 3.3.4, Java 21, Spring Security (BCrypt), Spring `RestClient`, Redis (`StringRedisTemplate`), Brevo REST API v3, React 19, Vite, TanStack Query, React Router v6, Tailwind CSS, Lucide Icons, i18next.

**Spec:** [docs/superpowers/specs/2026-10-22-forgot-password-brevo-spec.md](file:///d:/backup/UTC_programming/semeter_7/PTPM_MNM\Multilingo\multilingo-platform\docs\superpowers\specs\2026-10-22-forgot-password-brevo-spec.md)  
**AC & Test Design:** [docs/superpowers/specs/2026-10-22-forgot-password-brevo-AC.md](file:///d:/backup/UTC_programming\semeter_7\PTPM_MNM\Multilingo\multilingo-platform\docs\superpowers\specs\2026-10-22-forgot-password-brevo-AC.md)

---

## Global Constraints

- Mọi Controller trả về `ResponseEntity<ApiResponse<T>>`.
- Mọi ngoại lệ nghiệp vụ ném qua `AppException(ErrorCode.XYZ)`.
- Tất cả các trường hợp cập nhật mật khẩu bắt buộc dùng `PasswordEncoder.encode()` (BCrypt).
- Tuyệt đối không để lộ mã OTP trong API response body hay console log Production.
- Tương thích hoàn toàn Java 21 và Spring Boot 3.3.4 (sử dụng Spring `RestClient`, không dùng thư viện bên ngoài không cần thiết).
- Frontend tuân thủ Feature-based Architecture trong `frontend/src/features/auth/`.

## Review Focus

1. **Email không tồn tại trong DB:** Trả về HTTP 404 `USER_NOT_FOUND`, không sinh mã OTP hay gọi Brevo.
2. **Spam gửi mã OTP liên tục:** Khi cooldown 60s chưa kết thúc, trả về HTTP 429 `OTP_COOLDOWN_ACTIVE`.
3. **Tấn công dò mã OTP (Brute-force):** Nhập sai OTP lần thứ 5 lập tức xóa key OTP khỏi Redis và trả về HTTP 400 `OTP_MAX_ATTEMPTS_EXCEEDED`.
4. **Mã OTP đã hết hạn sau 5 phút:** Trả về HTTP 400 `OTP_EXPIRED`.
5. **Gửi lại mã OTP trên UI:** Khi hết 60s đếm ngược, kích hoạt nút gửi lại mã, gọi lại API và reset bộ đếm về 60s.

---

### Task 1: Thiết Lập Cấu Hình Brevo, Bổ Sung Dependency Thymeleaf & ErrorCode

**Files:**
- Modify: `backend/pom.xml` (thêm `spring-boot-starter-thymeleaf`)
- Create: `backend/src/main/java/com/multilingo/backend/config/BrevoProperties.java`
- Create: `backend/src/main/java/com/multilingo/backend/config/BrevoConfig.java`
- Modify: `backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java:48-50`
- Modify: `backend/src/main/resources/application.properties:50-53`
- Test: `backend/src/test/java/com/multilingo/backend/config/BrevoConfigTest.java`

**Interfaces:**
- Consumes: Cấu hình `brevo.api-key`, `brevo.api-url`, `brevo.sender.email`, `brevo.sender.name` từ `application.properties`.
- Produces: Bean `RestClient brevoRestClient` được cấu hình base URL và header `api-key`. Thư viện `TemplateEngine` sẵn sàng từ Thymeleaf starter. Các ErrorCode mới: `OTP_COOLDOWN_ACTIVE`, `OTP_MAX_ATTEMPTS_EXCEEDED`.

- [ ] **Step 1: Viết test cho cấu hình Brevo**

```java
package com.multilingo.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class BrevoConfigTest {

    @Test
    void brevoRestClient_ShouldBeCreatedSuccessfully() {
        BrevoProperties properties = new BrevoProperties();
        properties.setApiKey("test-api-key");
        properties.setApiUrl("https://api.brevo.com/v3/smtp/email");
        properties.setSenderEmail("no-reply@multilingo.com");
        properties.setSenderName("Multilingo");

        BrevoConfig config = new BrevoConfig(properties);
        RestClient restClient = config.brevoRestClient();

        assertNotNull(restClient);
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `cd backend && ./mvnw test -Dtest=BrevoConfigTest`
Expected: FAIL (Class `BrevoProperties` và `BrevoConfig` chưa tồn tại).

- [ ] **Step 3: Triển khai BrevoProperties, BrevoConfig, bổ sung ErrorCode và application.properties**

Trong `ErrorCode.java`:
```java
    OTP_COOLDOWN_ACTIVE(923, HttpStatus.TOO_MANY_REQUESTS, "Vui lòng đợi 60 giây trước khi yêu cầu gửi lại mã"),
    OTP_MAX_ATTEMPTS_EXCEEDED(924, HttpStatus.BAD_REQUEST, "Bạn đã nhập sai OTP quá 5 lần, mã xác nhận đã bị hủy"),
```

Trong `application.properties`:
```properties
# Brevo Email Configuration
brevo.api-key=${BREVO_API_KEY:}
brevo.api-url=${BREVO_API_URL:https://api.brevo.com/v3/smtp/email}
brevo.sender.email=${BREVO_SENDER_EMAIL:no-reply@multilingo.com}
brevo.sender.name=${BREVO_SENDER_NAME:Multilingo Platform}
```

Tạo `BrevoProperties.java`:
```java
package com.multilingo.backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "brevo")
@Data
public class BrevoProperties {
    private String apiKey = "";
    private String apiUrl = "https://api.brevo.com/v3/smtp/email";
    private String senderEmail = "no-reply@multilingo.com";
    private String senderName = "Multilingo Platform";
}
```

Tạo `BrevoConfig.java`:
```java
package com.multilingo.backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

@Configuration
@RequiredArgsConstructor
public class BrevoConfig {

    private final BrevoProperties brevoProperties;

    @Bean
    public RestClient brevoRestClient() {
        return RestClient.builder()
                .baseUrl(brevoProperties.getApiUrl())
                .defaultHeader("api-key", brevoProperties.getApiKey())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `cd backend && ./mvnw test -Dtest=BrevoConfigTest`
Expected: `BUILD SUCCESS`, Tests run: 1, Failures: 0, Errors: 0.

- [ ] **Step 5: Tóm tắt thay đổi và xin ý kiến commit**

Hiển thị tóm tắt diff cho người dùng và xin xác nhận trước khi commit.

---

### Task 2: Triển Khai Brevo Email Service & Giao Diện Mail Thymeleaf

**Files:**
- Create: `backend/src/main/resources/templates/email/reset-password-otp.html`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/service/EmailService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/service/impl/BrevoEmailServiceImpl.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/dto/brevo/BrevoEmailPayload.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/auth/service/BrevoEmailServiceTest.java`

**Interfaces:**
- Consumes: `RestClient brevoRestClient`, `BrevoProperties`, `TemplateEngine templateEngine`.
- Produces: `void sendResetPasswordOtp(String recipientEmail, String recipientName, String otp)` (render template Thymeleaf và dispatch qua Brevo REST API).

- [ ] **Step 1: Viết Unit Test cho BrevoEmailServiceImpl với TemplateEngine**

```java
package com.multilingo.backend.modules.auth.service;

import com.multilingo.backend.config.BrevoProperties;
import com.multilingo.backend.modules.auth.service.impl.BrevoEmailServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BrevoEmailServiceTest {

    @Mock
    private RestClient brevoRestClient;

    @Mock
    private TemplateEngine templateEngine;

    @Mock
    private RestClient.RequestBodyUriSpec requestBodyUriSpec;

    @Mock
    private RestClient.RequestBodySpec requestBodySpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    private BrevoProperties properties;
    private BrevoEmailServiceImpl emailService;

    @BeforeEach
    void setUp() {
        properties = new BrevoProperties();
        properties.setApiKey("test-key");
        properties.setSenderEmail("no-reply@multilingo.com");
        properties.setSenderName("Multilingo");
        emailService = new BrevoEmailServiceImpl(brevoRestClient, properties, templateEngine);
    }

    @Test
    void sendResetPasswordOtp_Success() {
        when(templateEngine.process(eq("email/reset-password-otp"), any(Context.class)))
                .thenReturn("<html><body>Mock Email Content</body></html>");
        when(brevoRestClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.body(any(Object.class))).thenReturn(requestBodySpec);
        when(requestBodySpec.retrieve()).thenReturn(responseSpec);

        assertDoesNotThrow(() -> emailService.sendResetPasswordOtp("student@example.com", "Học viên", "123456"));

        verify(templateEngine).process(eq("email/reset-password-otp"), any(Context.class));
        verify(brevoRestClient).post();
    }

    @Test
    void sendResetPasswordOtp_EmptyApiKey_LogsWarningWithoutCallingBrevoApi() {
        properties.setApiKey(""); // Không có API key (local env)
        assertDoesNotThrow(() -> emailService.sendResetPasswordOtp("student@example.com", "Học viên", "123456"));
        verifyNoInteractions(brevoRestClient);
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `cd backend && ./mvnw test -Dtest=BrevoEmailServiceTest`
Expected: FAIL (chưa có `EmailService`, `BrevoEmailServiceImpl` và template).

- [ ] **Step 3: Triển khai Template HTML Thymeleaf, EmailService, BrevoEmailPayload và BrevoEmailServiceImpl**

Tạo file template `backend/src/main/resources/templates/email/reset-password-otp.html`:
```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org" lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã xác thực đặt lại mật khẩu - Multilingo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 32px 16px;
      color: #1e293b;
    }
    .email-container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #c25e2e 0%, #ea580c 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .brand-icon {
      font-size: 40px;
      line-height: 1;
      margin-bottom: 8px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 12px;
    }
    .desc {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-card {
      background: #fff7ed;
      border: 2px dashed #f97316;
      border-radius: 12px;
      padding: 24px 16px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #c25e2e;
      display: inline-block;
      padding-left: 10px;
    }
    .notes-box {
      background-color: #f1f5f9;
      border-radius: 8px;
      padding: 14px 16px;
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .footer {
      border-top: 1px solid #f1f5f9;
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      background-color: #f8fafc;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="brand-icon">🌐</div>
      <h1 class="brand-title">Multilingo Platform</h1>
    </div>
    
    <div class="content">
      <div class="greeting">
        Xin chào <span th:text="${recipientName}">Học viên</span>,
      </div>
      <div class="desc">
        Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản Multilingo của bạn. Vui lòng sử dụng mã xác thực OTP dưới đây để hoàn tất quá trình:
      </div>

      <div class="otp-card">
        <div class="otp-code" th:text="${otp}">123456</div>
      </div>

      <div class="notes-box">
        <div>⏱️ Mã OTP có hiệu lực trong vòng <strong th:text="${validMinutes}">5</strong> phút.</div>
        <div style="margin-top: 6px;">🔒 Tuyệt đối không chia sẻ mã này cho bất kỳ ai để đảm bảo an toàn tài khoản.</div>
      </div>

      <div style="font-size: 13px; color: #64748b; line-height: 1.5;">
        Nếu bạn không thực hiện yêu cầu này, bạn có thể yên tâm bỏ qua email. Mật khẩu của bạn vẫn được giữ an toàn.
      </div>
    </div>

    <div class="footer">
      <div>&copy; 2026 Multilingo Platform. Mọi quyền được bảo lưu.</div>
    </div>
  </div>
</body>
</html>
```

Tạo `EmailService.java`:
```java
package com.multilingo.backend.modules.auth.service;

public interface EmailService {
    void sendResetPasswordOtp(String recipientEmail, String recipientName, String otp);
}
```

Tạo `BrevoEmailPayload.java`:
```java
package com.multilingo.backend.modules.auth.dto.brevo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BrevoEmailPayload {
    private Sender sender;
    private List<Recipient> to;
    private String subject;
    private String htmlContent;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Sender {
        private String name;
        private String email;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Recipient {
        private String email;
        private String name;
    }
}
```

Tạo `BrevoEmailServiceImpl.java`:
```java
package com.multilingo.backend.modules.auth.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.BrevoProperties;
import com.multilingo.backend.modules.auth.dto.brevo.BrevoEmailPayload;
import com.multilingo.backend.modules.auth.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BrevoEmailServiceImpl implements EmailService {

    private final RestClient brevoRestClient;
    private final BrevoProperties brevoProperties;
    private final TemplateEngine templateEngine;

    @Override
    public void sendResetPasswordOtp(String recipientEmail, String recipientName, String otp) {
        if (brevoProperties.getApiKey() == null || brevoProperties.getApiKey().isBlank()) {
            log.warn("BREVO_API_KEY is not configured. Emulating email sending to {}: OTP={}", recipientEmail, otp);
            return;
        }

        String displayName = (recipientName != null && !recipientName.isBlank()) ? recipientName : "Học viên";
        
        Context context = new Context();
        context.setVariable("recipientName", displayName);
        context.setVariable("otp", otp);
        context.setVariable("validMinutes", 5);

        String htmlContent = templateEngine.process("email/reset-password-otp", context);

        BrevoEmailPayload payload = BrevoEmailPayload.builder()
                .sender(new BrevoEmailPayload.Sender(brevoProperties.getSenderName(), brevoProperties.getSenderEmail()))
                .to(List.of(new BrevoEmailPayload.Recipient(recipientEmail, displayName)))
                .subject("Mã xác nhận đặt lại mật khẩu - Multilingo")
                .htmlContent(htmlContent)
                .build();

        try {
            brevoRestClient.post()
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Reset password OTP successfully dispatched via Brevo to {}", recipientEmail);
        } catch (Exception ex) {
            log.error("Failed to send OTP email via Brevo to {}: {}", recipientEmail, ex.getMessage(), ex);
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `cd backend && ./mvnw test -Dtest=BrevoEmailServiceTest`
Expected: `BUILD SUCCESS`, Tests run: 2, Failures: 0, Errors: 0.

- [ ] **Step 5: Tóm tắt thay đổi và xin ý kiến commit**

Hiển thị tóm tắt diff cho người dùng và xin xác nhận trước khi commit.

---

### Task 3: Tích Hợp EmailService, Rate Limiting & Brute-force Protection Vào UserServiceImpl

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/service/impl/UserServiceImpl.java:140-173`
- Test: `backend/src/test/java/com/multilingo/backend/modules/auth/service/UserServiceTest.java`

**Interfaces:**
- Consumes: `EmailService`, `StringRedisTemplate`, `UserRepository`, `PasswordEncoder`.
- Produces: `forgotPassword(ForgotPasswordRequest request)` (với check cooldown 60s, gửi OTP qua `emailService.sendResetPasswordOtp`), `resetPassword(ResetPasswordRequest request)` (với max 5 attempts, xóa cache khi thành công).

- [ ] **Step 1: Viết test cho toàn bộ kịch bản nghiệp vụ mới trong UserServiceTest**

Bổ sung các test case:
- `forgotPassword_CooldownActive_ThrowsException()`
- `resetPassword_MaxAttemptsExceeded_DeletesOtpAndThrows()`
- `resetPassword_IncrementsAttempts_OnWrongOtp()`

```java
    @Mock
    private EmailService emailService;

    @Test
    void forgotPassword_CooldownActive_ThrowsException() {
        ForgotPasswordRequest request = new ForgotPasswordRequest("test@gmail.com");
        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(mockUser));
        when(stringRedisTemplate.hasKey("OTP_RESET_COOLDOWN:test@gmail.com")).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> userService.forgotPassword(request));
        assertEquals(ErrorCode.OTP_COOLDOWN_ACTIVE, ex.getErrorCode());
        verifyNoInteractions(emailService);
    }

    @Test
    void resetPassword_WrongOtp_IncrementsAttempts() {
        ResetPasswordRequest request = new ResetPasswordRequest("test@gmail.com", "123456", "newPassword");
        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(mockUser));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("OTP_RESET_PWD:test@gmail.com")).thenReturn("654321"); // otp khac
        when(valueOperations.increment("OTP_RESET_ATTEMPTS:test@gmail.com")).thenReturn(2L);

        AppException ex = assertThrows(AppException.class, () -> userService.resetPassword(request));
        assertEquals(ErrorCode.INVALID_OTP, ex.getErrorCode());
    }

    @Test
    void resetPassword_MaxAttemptsExceeded_DeletesOtp() {
        ResetPasswordRequest request = new ResetPasswordRequest("test@gmail.com", "123456", "newPassword");
        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(mockUser));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("OTP_RESET_PWD:test@gmail.com")).thenReturn("654321");
        when(valueOperations.increment("OTP_RESET_ATTEMPTS:test@gmail.com")).thenReturn(5L);

        AppException ex = assertThrows(AppException.class, () -> userService.resetPassword(request));
        assertEquals(ErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED, ex.getErrorCode());
        verify(stringRedisTemplate).delete("OTP_RESET_PWD:test@gmail.com");
    }
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `cd backend && ./mvnw test -Dtest=UserServiceTest`
Expected: FAIL (do `UserServiceImpl` chưa kiểm tra cooldown và đếm attempts).

- [ ] **Step 3: Triển khai logic mới trong UserServiceImpl**

Cập nhật `UserServiceImpl.java`:
- Thêm trường `EmailService emailService;`
- Cập nhật `forgotPassword`:
  ```java
    @Override
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        String cooldownKey = "OTP_RESET_COOLDOWN:" + request.getEmail();
        if (Boolean.TRUE.equals(stringRedisTemplate.hasKey(cooldownKey))) {
            throw new AppException(ErrorCode.OTP_COOLDOWN_ACTIVE);
        }

        java.security.SecureRandom secureRandom = new java.security.SecureRandom();
        String otp = String.format("%06d", secureRandom.nextInt(1_000_000));

        stringRedisTemplate.opsForValue().set("OTP_RESET_PWD:" + request.getEmail(), otp, 5, TimeUnit.MINUTES);
        stringRedisTemplate.opsForValue().set(cooldownKey, "1", 60, TimeUnit.SECONDS);
        stringRedisTemplate.delete("OTP_RESET_ATTEMPTS:" + request.getEmail());

        emailService.sendResetPasswordOtp(user.getEmail(), user.getFullName(), otp);
    }
  ```
- Cập nhật `resetPassword`:
  ```java
    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        String otpKey = "OTP_RESET_PWD:" + request.getEmail();
        String otpInRedis = stringRedisTemplate.opsForValue().get(otpKey);

        if (otpInRedis == null) {
            throw new AppException(ErrorCode.OTP_EXPIRED);
        }

        if (!otpInRedis.equals(request.getOtp())) {
            String attemptKey = "OTP_RESET_ATTEMPTS:" + request.getEmail();
            Long attempts = stringRedisTemplate.opsForValue().increment(attemptKey);
            stringRedisTemplate.expire(attemptKey, 5, TimeUnit.MINUTES);

            if (attempts != null && attempts >= 5) {
                stringRedisTemplate.delete(otpKey);
                throw new AppException(ErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED);
            }
            throw new AppException(ErrorCode.INVALID_OTP);
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        stringRedisTemplate.delete(otpKey);
        stringRedisTemplate.delete("OTP_RESET_COOLDOWN:" + request.getEmail());
        stringRedisTemplate.delete("OTP_RESET_ATTEMPTS:" + request.getEmail());
    }
  ```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `cd backend && ./mvnw test -Dtest=UserServiceTest`
Expected: `BUILD SUCCESS`, tất cả test cases đều PASS 100%.

- [ ] **Step 5: Tóm tắt thay đổi và xin ý kiến commit**

Hiển thị tóm tắt diff cho người dùng và xin xác nhận trước khi commit.

---

### Task 4: Củng Cố AuthenController & Controller Test

**Files:**
- Modify/Verify: `backend/src/main/java/com/multilingo/backend/modules/auth/controller/AuthenController.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/auth/controller/AuthenControllerTest.java`

**Interfaces:**
- Consumes: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
- Produces: `ResponseEntity<ApiResponse<Void>>`.

- [ ] **Step 1: Viết test cho forgot-password và reset-password endpoints trong AuthenControllerTest**

```java
    @Test
    void forgotPassword_Success() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest("student@example.com");
        doNothing().when(userService).forgotPassword(any(ForgotPasswordRequest.class));

        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void resetPassword_Success() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest("student@example.com", "123456", "NewPassword123");
        doNothing().when(userService).resetPassword(any(ResetPasswordRequest.class));

        mockMvc.perform(post("/api/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }
```

- [ ] **Step 2: Chạy test xác nhận PASS**

Run: `cd backend && ./mvnw test -Dtest=AuthenControllerTest`
Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Tóm tắt thay đổi và xin ý kiến commit**

Hiển thị tóm tắt diff cho người dùng và xin xác nhận trước khi commit.

---

### Task 5: Frontend API Client & i18n Translations

**Files:**
- Modify: `frontend/src/features/auth/types/index.ts`
- Modify: `frontend/src/features/auth/api/authApi.ts`
- Modify: `frontend/src/locales/vi/translation.json`
- Modify: `frontend/src/locales/en/translation.json`

**Interfaces:**
- Consumes: Endpoint `/api/auth/forgot-password` và `/api/auth/reset-password`.
- Produces: `authApi.forgotPassword(data: ForgotPasswordRequest)`, `authApi.resetPassword(data: ResetPasswordRequest)`.

- [ ] **Step 1: Khai báo types trong `types/index.ts`**

```typescript
export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}
```

- [ ] **Step 2: Bổ sung API calls vào `authApi.ts`**

```typescript
  forgotPassword: async (data: ForgotPasswordRequest) => {
    const res = await axiosClient.post<any, ApiResponse<null>>('/auth/forgot-password', data);
    return res;
  },
  resetPassword: async (data: ResetPasswordRequest) => {
    const res = await axiosClient.post<any, ApiResponse<null>>('/auth/reset-password', data);
    return res;
  },
```

- [ ] **Step 3: Thêm các khóa dịch i18n vào `vi/translation.json` và `en/translation.json`**

Trong `vi/translation.json`:
```json
    "forgot_password_title": "Quên mật khẩu",
    "forgot_password_desc_step1": "Nhập email của bạn để nhận mã OTP đặt lại mật khẩu.",
    "forgot_password_desc_step2": "Nhập mã OTP vừa được gửi về email và mật khẩu mới của bạn.",
    "send_otp_btn": "Gửi mã xác nhận",
    "otp_sent_to": "Mã xác thực OTP đã được gửi đến",
    "change_email": "Đổi email khác",
    "otp_label": "Mã xác nhận (OTP)",
    "otp_placeholder": "Nhập 6 chữ số OTP",
    "new_password_label": "Mật khẩu mới",
    "confirm_new_password_label": "Xác nhận mật khẩu mới",
    "save_new_password_btn": "Lưu thay đổi",
    "resend_otp_countdown": "Gửi lại mã sau ({{count}}s)",
    "resend_otp_now": "Gửi lại mã OTP",
    "back_to_login": "Quay lại Đăng nhập",
    "reset_password_success": "Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.",
    "otp_required": "Vui lòng nhập đầy đủ mã OTP 6 số"
```

- [ ] **Step 4: Kiểm tra build frontend**

Run: `cd frontend && npm run build`
Expected: Build thành công không có lỗi TypeScript.

- [ ] **Step 5: Tóm tắt thay đổi và xin ý kiến commit**

Hiển thị tóm tắt diff cho người dùng và xin xác nhận trước khi commit.

---

### Task 6: Giao Diện Wizard Quên Mật Khẩu (ForgotPasswordPage) & Định Tuyến

**Files:**
- Create: `frontend/src/features/auth/pages/ForgotPasswordPage.tsx`
- Modify: `frontend/src/app/router.tsx:75-80`
- Modify: `frontend/src/features/auth/components/LoginForm.tsx:113-115`
- Test: `frontend/src/features/auth/pages/ForgotPasswordPage.test.tsx`

**Interfaces:**
- Consumes: `authApi.forgotPassword`, `authApi.resetPassword`, `AuthLayout`.
- Produces: Route `/forgot-password` với form 2 bước, đếm ngược 60s, validation realtime.

- [ ] **Step 1: Viết test cho `ForgotPasswordPage`**

Kiểm tra:
1. Render form bước 1 (nhập email).
2. Khi submit bước 1 thành công -> chuyển sang bước 2.
3. Bước 2 có các trường OTP, Mật khẩu mới, Xác nhận mật khẩu và bộ đếm ngược 60s.

- [ ] **Step 2: Triển khai Component `ForgotPasswordPage.tsx`**

Component sử dụng `AuthLayout`:
- State: `step: 1 | 2`, `email`, `otp`, `newPassword`, `confirmPassword`, `countdown: 60`, `isCounting: boolean`, `showNewPassword`, `showConfirmPassword`.
- Hiệu ứng `useEffect` đếm lùi `countdown` khi `isCounting = true`.
- Nút "Gửi lại mã" chỉ kích hoạt khi `countdown === 0`.
- Validation: mật khẩu tối thiểu 6 ký tự, mật khẩu và xác nhận mật khẩu phải trùng khớp.
- Xử lý lỗi: hiển thị Toast lỗi từ response server.

- [ ] **Step 3: Cập nhật `router.tsx` và `LoginForm.tsx`**

Trong `router.tsx`:
```tsx
import ForgotPasswordPage from "../features/auth/pages/ForgotPasswordPage";
...
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
```

Trong `LoginForm.tsx`:
Thay đổi:
```tsx
<span 
  onClick={() => navigate('/forgot-password')}
  style={{ fontSize: '0.825rem', color: '#c25e2e', cursor: 'pointer', fontWeight: 600 }}
>
  {t('auth.forgot_password')}
</span>
```

- [ ] **Step 4: Chạy test Frontend & Build**

Run: `cd frontend && npm run test && npm run build`
Expected: PASS 100%.

- [ ] **Step 5: Tóm tắt thay đổi và xin ý kiến commit**

Hiển thị tóm tắt diff cho người dùng và xin xác nhận trước khi commit.

---

### Task 7: Nghiệm Thu Toàn Diện & Quality Gate (Verification Before Completion)

**Files:**
- N/A (Testing & Evidence generation)

- [ ] **Step 1: Chạy toàn bộ Test Suite Backend**

Run: `cd backend && ./mvnw clean test`
Expected: `BUILD SUCCESS`, `Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Step 2: Chạy Lint và Build Frontend**

Run: `cd frontend && npm run lint && npm run build`
Expected: Không có cảnh báo hoặc lỗi lint, bundle được build thành công.

- [ ] **Step 3: Đối chiếu 12 Test Cases trong `TC_AUTH_RESET_PWD` và tổng kết nghiệm thu**

Tổng hợp báo cáo nghiệm thu chi tiết đối soát từng mục trong AC & Test Design gửi người dùng.
