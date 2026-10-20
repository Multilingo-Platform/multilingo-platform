package com.multilingo.backend.modules.testing.ai.dictionary;

public record DictionaryLookupDefinition(
        String meaningVi,
        String phonetic,
        String partOfSpeech,
        String exampleEn,
        String exampleVi
) { }
