package com.multilingo.backend.modules.billing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.billing.dto.request.SubscriptionPlanRequest;
import com.multilingo.backend.modules.billing.dto.response.SubscriptionPlanResponse;
import com.multilingo.backend.modules.billing.service.SubscriptionPlanService;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/plans")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubscriptionPlanController {

    SubscriptionPlanService planService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SubscriptionPlanResponse>>> getAllPlans() {
        List<SubscriptionPlanResponse> responses = planService.getAllPlans();
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách gói cước thành công", responses));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SubscriptionPlanResponse>> createPlan(@RequestBody @Valid SubscriptionPlanRequest request) {
        SubscriptionPlanResponse response = planService.createPlan(request);
        return ResponseEntity.ok(ApiResponse.success("Tạo gói cước thành công", response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<SubscriptionPlanResponse>> updatePlan(
            @PathVariable Integer id,
            @RequestBody @Valid SubscriptionPlanRequest request) {
        SubscriptionPlanResponse response = planService.updatePlan(id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật gói cước thành công", response));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<SubscriptionPlanResponse>> changeStatus(
            @PathVariable Integer id,
            @RequestParam boolean isActive) {
        SubscriptionPlanResponse response = planService.changeStatus(id, isActive);
        return ResponseEntity.ok(ApiResponse.success("Đổi trạng thái thành công", response));
    }
}
