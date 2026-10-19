package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.testing.adapter.impl.DbLearningLanguageAdapter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DbLearningLanguageAdapterTest {

    @Mock
    private UserRepository userRepository;

    private DbLearningLanguageAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new DbLearningLanguageAdapter(userRepository);
    }

    @Test
    @DisplayName("Trả về targetLanguage khi user tồn tại và có thiết lập targetLanguage")
    void returnsTargetLanguageWhenUserExists() {
        User user = mock(User.class);
        when(user.getTargetLanguage()).thenReturn("en");
        when(userRepository.findById(100)).thenReturn(Optional.of(user));

        Optional<String> result = adapter.findTargetLanguage(100);

        assertThat(result).contains("en");
        verify(user, never()).getNativeLanguage();
    }

    @Test
    @DisplayName("Trả về Optional.empty() khi user có targetLanguage là null")
    void returnsEmptyWhenUserTargetLanguageIsNull() {
        User user = mock(User.class);
        when(user.getTargetLanguage()).thenReturn(null);
        when(userRepository.findById(101)).thenReturn(Optional.of(user));

        Optional<String> result = adapter.findTargetLanguage(101);

        assertThat(result).isEmpty();
        verify(user, never()).getNativeLanguage();
    }

    @Test
    @DisplayName("Trả về Optional.empty() khi không tìm thấy user trong database")
    void returnsEmptyWhenUserNotFound() {
        when(userRepository.findById(999)).thenReturn(Optional.empty());

        Optional<String> result = adapter.findTargetLanguage(999);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Trả về Optional.empty() ngay lập tức khi userId là null mà không truy vấn DB")
    void returnsEmptyWhenUserIdIsNull() {
        Optional<String> result = adapter.findTargetLanguage(null);

        assertThat(result).isEmpty();
        verifyNoInteractions(userRepository);
    }
}
