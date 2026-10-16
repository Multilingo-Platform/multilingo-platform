package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfileSummary {
    private Integer id;
    private String fullName;
    private String avatarUrl;
    private String targetLanguage;
}
