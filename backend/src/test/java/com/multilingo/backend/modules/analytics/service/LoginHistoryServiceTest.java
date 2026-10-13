package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.modules.analytics.entity.LoginHistory;
import com.multilingo.backend.modules.analytics.repository.LoginHistoryRepository;
import com.multilingo.backend.modules.analytics.service.impl.LoginHistoryServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoginHistoryServiceTest {

    @Mock
    private LoginHistoryRepository loginHistoryRepository;

    @InjectMocks
    private LoginHistoryServiceImpl loginHistoryService;

    @Test
    @DisplayName("Should return top 10 login histories for given user")
    void testGetRecentLoginHistory() {
        LoginHistory h1 = LoginHistory.builder()
                .userId(10)
                .ipAddress("192.168.1.1")
                .deviceInfo("Chrome Mac")
                .loginTime(Instant.now())
                .status("SUCCESS")
                .build();

        when(loginHistoryRepository.findTop10ByUserIdOrderByLoginTimeDesc(10)).thenReturn(List.of(h1));

        List<LoginHistory> result = loginHistoryService.getRecentLoginHistory(10);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getIpAddress()).isEqualTo("192.168.1.1");
    }

    @Test
    @DisplayName("Should detect fraud risk when distinct IPs >= 3")
    void testDetectFraudRisk_suspicious() {
        LoginHistory h1 = LoginHistory.builder().userId(10).ipAddress("1.1.1.1").build();
        LoginHistory h2 = LoginHistory.builder().userId(10).ipAddress("2.2.2.2").build();
        LoginHistory h3 = LoginHistory.builder().userId(10).ipAddress("3.3.3.3").build();

        when(loginHistoryRepository.findTop10ByUserIdOrderByLoginTimeDesc(10)).thenReturn(List.of(h1, h2, h3));

        boolean isRisk = loginHistoryService.detectFraudRisk(10);
        assertThat(isRisk).isTrue();
    }

    @Test
    @DisplayName("Should not detect fraud risk when distinct IPs < 3")
    void testDetectFraudRisk_notSuspicious() {
        LoginHistory h1 = LoginHistory.builder().userId(10).ipAddress("1.1.1.1").build();
        LoginHistory h2 = LoginHistory.builder().userId(10).ipAddress("1.1.1.1").build();

        when(loginHistoryRepository.findTop10ByUserIdOrderByLoginTimeDesc(10)).thenReturn(List.of(h1, h2));

        boolean isRisk = loginHistoryService.detectFraudRisk(10);
        assertThat(isRisk).isFalse();
    }

    @Test
    @DisplayName("Should record new login entry")
    void testRecordLogin() {
        loginHistoryService.recordLogin(10, "192.168.1.10", "Firefox Linux", "SUCCESS");

        org.mockito.ArgumentCaptor<LoginHistory> captor = org.mockito.ArgumentCaptor.forClass(LoginHistory.class);
        verify(loginHistoryRepository).save(captor.capture());
        LoginHistory captured = captor.getValue();
        assertThat(captured.getUserId()).isEqualTo(10);
        assertThat(captured.getIpAddress()).isEqualTo("192.168.1.10");
        assertThat(captured.getStatus()).isEqualTo("SUCCESS");
    }
}
