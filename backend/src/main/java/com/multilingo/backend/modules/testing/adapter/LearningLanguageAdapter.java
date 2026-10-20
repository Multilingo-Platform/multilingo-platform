package com.multilingo.backend.modules.testing.adapter;

import java.util.Optional;

public interface LearningLanguageAdapter {
    Optional<String> findTargetLanguage(Integer userId);
}
