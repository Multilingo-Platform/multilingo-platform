package com.multilingo.backend.modules.analytics.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.dto.response.AdminTransactionResponse;
import com.multilingo.backend.modules.analytics.service.TransactionReconciliationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/admin/transactions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminTransactionController {

    private final TransactionReconciliationService transactionReconciliationService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminTransactionResponse>>> getTransactions(
            @RequestParam(required = false) String vnpTxnRef,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        PageResponse<AdminTransactionResponse> result = transactionReconciliationService.getTransactions(
                vnpTxnRef, status, from, to, pageable
        );
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/export")
    public ResponseEntity<ApiResponse<List<AdminTransactionResponse>>> exportTransactions(
            @RequestParam(required = false) String vnpTxnRef,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
    ) {
        List<AdminTransactionResponse> list = transactionReconciliationService.getAllTransactionsForExport(
                vnpTxnRef, status, from, to
        );
        return ResponseEntity.ok(ApiResponse.success(list));
    }
}
