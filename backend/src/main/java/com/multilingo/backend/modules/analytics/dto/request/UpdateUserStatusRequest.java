package com.multilingo.backend.modules.analytics.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserStatusRequest {

    @NotNull(message = "Trạng thái kích hoạt không được để trống")
    private Boolean isActive;

    @Size(max = 500, message = "Lý do không được vượt quá 500 ký tự")
    private String reason;
}
