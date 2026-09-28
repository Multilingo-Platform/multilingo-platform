/**
 * Phân hệ Gói cước & Cổng thanh toán trực tuyến VNPAY (Billing & Payment Service).
 * <p>
 * <b>Thành viên phụ trách:</b> Thành viên 1 (TV1)<br>
 * <b>Các Use Case:</b> UC06 (Mua gói VIP & Thanh toán VNPAY), UC16.1 (Cấu hình bảng giá), UC16.2 (Đối soát giao dịch)<br>
 * <b>Các bảng CSDL sở hữu:</b> subscription_plans, transactions<br>
 * <b>Quan hệ nội bộ:</b> transactions.plan_id -> subscription_plans.id (FK)<br>
 * <b>Quan hệ liên service:</b> transactions.user_id (ID số nguyên tham chiếu Auth Service)
 * </p>
 */
package com.multilingo.backend.modules.billing;
