package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SuggestedActionDto {
    private String type;
    private String title;
    private String description;
    private String badge;
    private String actionUrl;
    private String buttonText;
}
