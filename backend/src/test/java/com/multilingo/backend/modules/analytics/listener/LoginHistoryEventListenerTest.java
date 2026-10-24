package com.multilingo.backend.modules.analytics.listener;

import com.multilingo.backend.modules.analytics.service.LoginHistoryService;
import com.multilingo.backend.modules.auth.event.UserLoginEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoginHistoryEventListenerTest {

    @Mock
    private LoginHistoryService loginHistoryService;

    @InjectMocks
    private LoginHistoryEventListener listener;

    @Test
    @DisplayName("Should invoke loginHistoryService.recordLogin when UserLoginEvent is received")
    void testOnUserLogin_success() {
        UserLoginEvent event = new UserLoginEvent(10, "user@test.com", "192.168.1.50", "Mozilla Chrome", "SUCCESS");

        listener.onUserLogin(event);

        verify(loginHistoryService).recordLogin(10, "192.168.1.50", "Mozilla Chrome", "SUCCESS");
    }

    @Test
    @DisplayName("Should use fallback defaults when ipAddress or deviceInfo are null")
    void testOnUserLogin_defaults() {
        UserLoginEvent event = new UserLoginEvent(10, "user@test.com", null, null, null);

        listener.onUserLogin(event);

        verify(loginHistoryService).recordLogin(10, "127.0.0.1", "Unknown Device", "SUCCESS");
    }

    @Test
    @DisplayName("Should ignore event when event is null or userId is null")
    void testOnUserLogin_nullEvent() {
        listener.onUserLogin(null);
        listener.onUserLogin(new UserLoginEvent(null, null, null, null, null));

        verifyNoInteractions(loginHistoryService);
    }
}
