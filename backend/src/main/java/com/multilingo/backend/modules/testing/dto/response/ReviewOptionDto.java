package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReviewOptionDto {
    private String id;
    @JsonAlias({"content"})
    private String text;
    private String content;
    private Boolean isCorrect;

    public String getContent() {
        return content != null ? content : text;
    }

    public void setContent(String content) {
        this.content = content;
        if (this.text == null) {
            this.text = content;
        }
    }
}
