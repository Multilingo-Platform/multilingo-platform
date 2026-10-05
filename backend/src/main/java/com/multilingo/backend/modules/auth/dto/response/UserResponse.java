package com.multilingo.backend.modules.auth.dto.response;

import com.multilingo.backend.modules.auth.entity.enums.RoleName;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserResponse {
    String id;
    String email;
    String fullName;
    String avatarUrl;
    RoleName role;
}