package com.multilingo.backend.modules.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoogleTokenPayload {
    private String sub;
    private String email;
    private String fullName;
    private String avatarUrl;
    private boolean emailVerified;
}
