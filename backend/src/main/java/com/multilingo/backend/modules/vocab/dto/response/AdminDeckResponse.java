package com.multilingo.backend.modules.vocab.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDeckResponse {
    private Integer id;
    private String name;
    private String description;
    private String targetLanguage;
    private String sourceLanguage;
    private Boolean isPublic;
    private Integer clonesCount;
    private Integer ownerId;
    private String ownerName;
    private String ownerEmail;
    private Long totalCards;
    private Instant createdAt;
    private Instant updatedAt;
}

