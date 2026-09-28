package com.multilingo.backend.modules.vocab.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;

@Entity
@Table(name = "dictionary_words")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DictionaryWord extends BaseEntity {

    @Column(name = "word", length = 150, nullable = false)
    private String word;

    @Builder.Default
    @Column(name = "language_code", length = 10, nullable = false)
    private String languageCode = "en";

    @Column(name = "phonetic", length = 150)
    private String phonetic;

    @Column(name = "pos", length = 50)
    private String pos;

    @Column(name = "level", length = 10)
    private String level;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "default_meaning", nullable = false)
    private Map<String, Object> defaultMeaning;

    @Column(name = "example_sentence", columnDefinition = "text")
    private String exampleSentence;

    @Column(name = "audio_url", length = 500)
    private String audioUrl;
}
