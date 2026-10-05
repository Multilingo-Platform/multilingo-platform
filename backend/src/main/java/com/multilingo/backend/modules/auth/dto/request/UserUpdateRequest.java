package com.multilingo.backend.modules.auth.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;
import jakarta.validation.constraints.Size;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserUpdateRequest {

    @Size(max = 150, message = "INVALID_NAME_LENGTH")
    String fullName;

    @Size(max = 500, message = "INVALID_AVATAR_URL_LENGTH")
    String avatarUrl;

    @Size(min = 6, max = 255, message = "INVALID_PASSWORD")
    String passwordHash;
}
