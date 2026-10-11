package com.multilingo.backend.modules.billing.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.HashMap;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class VNPayServiceTest {
    private VNPayService vnPayService;

    @BeforeEach
    void setUp() {
        vnPayService = new VNPayService();
        ReflectionTestUtils.setField(vnPayService, "vnpTmnCode", "DUMMYCODE");
        ReflectionTestUtils.setField(vnPayService, "vnpHashSecret", "DUMMYSECRET");
        ReflectionTestUtils.setField(vnPayService, "vnpPayUrl", "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        ReflectionTestUtils.setField(vnPayService, "vnpReturnUrl", "http://localhost:3000/payment/vnpay-return");
    }

    @Test
    void createPaymentUrl_shouldReturnValidUrl() {
        String url = vnPayService.createPaymentUrl("12345", 100000, "VNPAYQR", "127.0.0.1");
        assertTrue(url.contains("vnp_TxnRef=12345"));
        assertTrue(url.contains("vnp_Amount=10000000")); // amount * 100
        assertTrue(url.contains("vnp_SecureHash="));
    }
}
