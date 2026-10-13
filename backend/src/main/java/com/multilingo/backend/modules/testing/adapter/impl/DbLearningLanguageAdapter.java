package com.multilingo.backend.modules.testing.adapter.impl;

import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.testing.adapter.LearningLanguageAdapter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DbLearningLanguageAdapter implements LearningLanguageAdapter {

    private final UserRepository userRepository;

    @Override
    public Optional<String> findTargetLanguage(Integer userId) {
        if (userId == null) {
            return Optional.empty();
        }
        return userRepository.findById(userId)
                .map(User::getTargetLanguage);
    }
}
