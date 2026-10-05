package com.multilingo.backend.modules.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserCreationRequest {

    @NotBlank(message = "EMAIL_REQUIRED")
    @Email(message = "INVALID_EMAIL_FORMAT")
    String email;

    @NotBlank(message = "PASSWORD_REQUIRED")
    @Size(min = 6, max = 255, message = "INVALID_PASSWORD")
    String passwordHash;

    @NotBlank(message = "NAME_REQUIRED")
    @Size(max = 150, message = "INVALID_NAME_LENGTH")
    String fullName;

    @Size(max = 500, message = "INVALID_AVATAR_URL_LENGTH")
    String avatarUrl;
}
