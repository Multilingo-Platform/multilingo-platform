package com.multilingo.backend.modules.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardStatsResponse {

    private long dau;
    private long mau;
    private long totalUsers;
    private long vipUsers;
    private double vipConversionRate;
    private BigDecimal totalRevenue;
    private BigDecimal monthlyRevenue;
    private long totalExamsAttempted;
}
