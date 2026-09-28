# ĐẶC TẢ THIẾT KẾ TOÀN BỘ ENTITIES CSDL (SPRING DATA JPA ENTITIES SPECIFICATION)

**Dự án:** Nền tảng Thi thử và Đánh giá Năng lực Ngoại ngữ Multilingo (Multilingo Platform)  
**Phân hệ:** Backend Data Architecture (`backend`)  
**Tác giả:** Superpowers Architecture Team  
**Ngày tạo:** 25/09/2026 | **Cập nhật:** 26/09/2026 | **Trạng thái:** APPROVED  
**Tài liệu tham chiếu:**
- Quy chuẩn kiến trúc: [`GEMINI.md`](file:///f:/Working/JavaBackend/multilingo-platform/GEMINI.md)
- CSDL Chuẩn DBML: [`docs/DBDIAGRAM_SCHEMA.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/DBDIAGRAM_SCHEMA.md)
- CSDL Chi tiết: [`docs/DATABASE_SPECIFICATION.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/DATABASE_SPECIFICATION.md)
- Cấu trúc module: [`docs/superpowers/specs/project-modular-packages.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/project-modular-packages.md)

---

## 1. MỤC TIÊU & TỔNG QUAN

Tài liệu này xác lập đặc tả thiết kế chi tiết cho toàn bộ **21 JPA Entities** phân bổ vào **7 phân hệ nghiệp vụ độc lập** (`modules.auth`, `modules.billing`, `modules.exam`, `modules.testing`, `modules.vocab`, `modules.gamification`, `modules.analytics`). Mục tiêu:
1. **Tuân thủ triệt để Base Architecture:** 100% Entity kế thừa `com.multilingo.backend.common.base.BaseEntity`, tự động sinh khóa chính `id: Integer` tự tăng (`GenerationType.IDENTITY`), `createdAt: Instant`, `updatedAt: Instant` qua Spring Data JPA Auditing.
2. **Nguyên tắc phân ranh giới Modular Bounded Contexts:**
   - **Liên kết nội bộ cùng phân hệ:** Sử dụng quan hệ JPA `@ManyToOne` / `@ManyToMany` với Foreign Key vật lý đầy đủ (ví dụ `User` -> `Role`, `UserTarget` -> `User`, `RefreshToken` -> `User`, `Transaction` -> `User` & `SubscriptionPlan` trong `auth`; `ExamSection` -> `Exam`, `ExamPart` -> `ExamSection` trong `exam`; `AttemptAnswer` -> `TestAttempt` trong `testing`; `UserFlashcard` -> `FlashcardDeck` & `DictionaryWord` trong `vocab`).
   - **Liên kết xuyên phân hệ:** Sử dụng **liên kết logic** (`userId`, `examId`, `partId`) thay vì khóa ngoại cứng của JPA nhằm giữ độc lập ranh giới module giữa các thành viên, tránh circular dependencies và N+1 chéo module.
3. **Chuẩn hóa kiểu dữ liệu:**
   - Trường JSON: Áp dụng `@JdbcTypeCode(SqlTypes.JSON)` và kiểu dữ liệu `Map<String, Object>` tích hợp Jackson format mapper.
   - Tiền tệ & Điểm số: Áp dụng `BigDecimal` (`numeric(12,2)` / `numeric(4,2)`).
   - Ngày tháng: Áp dụng `Instant` cho timestamp và `LocalDate` cho các ngày học cụ thể.
   - Lombok: Sử dụng `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@Builder`.

---

## 2. DANH MỤC 21 ENTITIES CHI TIẾT THEO 7 MODULES

---

### 2.1. Phân hệ `modules.auth.entity` (Thành viên 1 - 5 Entities)

#### 1. `Role` (`roles`)
- `id`: `Integer` (BaseEntity)
- `name`: `String` (`varchar(50)`, unique, not null) - Ví dụ: `ROLE_STUDENT`, `ROLE_ADMIN`, `ROLE_TEACHER`
- `description`: `String` (`text`)
- `permissions`: `@ManyToMany` liên kết với `Permission` qua bảng trung gian `role_permissions`
- `createdAt`, `updatedAt`: `Instant` (BaseEntity)

#### 2. `Permission` (`permissions`)
- `id`: `Integer` (BaseEntity)
- `actionCode`: `String` (`varchar(100)`, unique, not null, `@Column(name = "action_code")`) - Ví dụ: `EXAM:CREATE`, `USER:BAN`
- `module`: `String` (`varchar(50)`, not null) - `EXAM`, `USER`, `BILLING`, `VOCAB`
- `description`: `String` (`text`)

#### 3. `User` (`users`)
- `id`: `Integer` (BaseEntity)
- `email`: `String` (`varchar(255)`, unique, not null)
- `passwordHash`: `String` (`varchar(255)`, `@Column(name = "password_hash")`)
- `fullName`: `String` (`varchar(150)`, `@Column(name = "full_name")`)
- `avatarUrl`: `String` (`varchar(500)`, `@Column(name = "avatar_url")`)
- `role`: `@ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "role_id", nullable = false)`
- `nativeLanguage`: `String` (`varchar(10)`, not null, default 'vi', `@Column(name = "native_language")`)
- `targetLanguage`: `String` (`varchar(10)`, not null, default 'en', `@Column(name = "target_language")`)
- `subscriptionTier`: `String` (`varchar(20)`, not null, default 'FREE', `@Column(name = "subscription_tier")`)
- `premiumExpiresAt`: `Instant` (`@Column(name = "premium_expires_at")`)
- `isActive`: `Boolean` (`not null, default true`, `@Column(name = "is_active")`)
- `googleId`: `String` (`varchar(255)`, unique, `@Column(name = "google_id")`)
- `lastLoginAt`: `Instant` (`@Column(name = "last_login_at")`)
- `lastLoginIp`: `String` (`varchar(45)`, `@Column(name = "last_login_ip")`)

#### 4. `UserTarget` (`user_targets`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false)`)
- `targetCertificate`: `String` (`varchar(50)`, not null, `@Column(name = "target_certificate")`) - `IELTS_AC`, `TOEIC_LR`, `VNLTV`
- `targetLanguage`: `String` (`varchar(10)`, not null, default 'en', `@Column(name = "target_language")`)
- `targetScore`: `BigDecimal` (`numeric(4,1)`, not null, `@Column(name = "target_score")`)

#### 5. `RefreshToken` (`refresh_tokens`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false)`)
- `token`: `String` (`varchar(500)`, unique, not null)
- `deviceInfo`: `String` (`varchar(255)`, `@Column(name = "device_info")`)
- `ipAddress`: `String` (`varchar(45)`, `@Column(name = "ip_address")`)
- `expiresAt`: `Instant` (`@Column(name = "expires_at", nullable = false)`)
- `isRevoked`: `Boolean` (`not null, default false`, `@Column(name = "is_revoked")`)

#### 6. `SubscriptionPlan` (`subscription_plans`)
- `id`: `Integer` (BaseEntity)
- `code`: `String` (`varchar(50)`, unique, not null) - `plan-30-days`, `VIP_1M`
- `name`: `String` (`varchar(100)`, not null)
- `price`: `BigDecimal` (`numeric(12,2)`, not null)
- `durationDays`: `Integer` (`not null`, `@Column(name = "duration_days")`)
- `isActive`: `Boolean` (`not null, default true`, `@Column(name = "is_active")`)

#### 7. `Transaction` (`transactions`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false)`)
- `planId`: `Integer` (`@Column(name = "plan_id", nullable = false)`)
- `vnpTxnRef`: `String` (`varchar(100)`, unique, not null, `@Column(name = "vnp_txn_ref")`)
- `vnpTransactionNo`: `String` (`varchar(100)`, `@Column(name = "vnp_transaction_no")`)
- `amount`: `BigDecimal` (`numeric(12,2)`, not null)
- `bankCode`: `String` (`varchar(20)`, `@Column(name = "bank_code")`)
- `paymentMethod`: `String` (`varchar(50)`, not null, default 'VNPAY', `@Column(name = "payment_method")`)
- `status`: `String` (`varchar(20)`, not null, default 'PENDING') - `PENDING`, `SUCCESS`, `FAILED`
- `paidAt`: `Instant` (`@Column(name = "paid_at")`)

---

### 2.2. Phân hệ `modules.billing.entity` (Thành viên 1 - 2 Entities)

#### 6. `SubscriptionPlan` (`subscription_plans`)
- `id`: `Integer` (BaseEntity)
- `code`: `String` (`varchar(50)`, unique, not null) - `plan-30-days`, `VIP_1M`
- `name`: `String` (`varchar(100)`, not null)
- `price`: `BigDecimal` (`numeric(12,2)`, not null)
- `durationDays`: `Integer` (`not null`, `@Column(name = "duration_days")`)
- `isActive`: `Boolean` (`not null, default true`, `@Column(name = "is_active")`)

#### 7. `Transaction` (`transactions`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false)`) - *loose coupling tới `auth.users`*
- `planId`: `Integer` (`@Column(name = "plan_id", nullable = false)`) - *loose coupling tới `billing.subscription_plans`*
- `vnpTxnRef`: `String` (`varchar(100)`, unique, not null, `@Column(name = "vnp_txn_ref")`)
- `vnpTransactionNo`: `String` (`varchar(100)`, `@Column(name = "vnp_transaction_no")`)
- `amount`: `BigDecimal` (`numeric(12,2)`, not null)
- `bankCode`: `String` (`varchar(20)`, `@Column(name = "bank_code")`)
- `paymentMethod`: `String` (`varchar(50)`, not null, default 'VNPAY', `@Column(name = "payment_method")`)
- `status`: `String` (`varchar(20)`, not null, default 'PENDING') - `PENDING`, `SUCCESS`, `FAILED`
- `paidAt`: `Instant` (`@Column(name = "paid_at")`)

---

### 2.3. Phân hệ `modules.exam.entity` (Thành viên 2 - 3 Entities)

#### 8. `Exam` (`exams`)
- `id`: `Integer` (BaseEntity)
- `code`: `String` (`varchar(100)`, unique, not null) - `cam-18-test-1`, `toeic-2024-01`
- `title`: `String` (`varchar(255)`, not null)
- `type`: `String` (`varchar(50)`, not null) - `IELTS`, `TOEIC`, `VNLTV`
- `examLanguage`: `String` (`varchar(10)`, not null, default 'en', `@Column(name = "exam_language")`)
- `isPublished`: `Boolean` (`not null, default false`, `@Column(name = "is_published")`)
- `isVipOnly`: `Boolean` (`not null, default false`, `@Column(name = "is_vip_only")`)
- `durationMinutes`: `Integer` (`not null, default 60`, `@Column(name = "duration_minutes")`)
- `thumbnailUrl`: `String` (`varchar(500)`, `@Column(name = "thumbnail_url")`)
- `createdBy`: `Integer` (`@Column(name = "created_by")`)

#### 9. `ExamSection` (`exam_sections`)
- `id`: `Integer` (BaseEntity)
- `examId`: `Integer` (`@Column(name = "exam_id", nullable = false)`)
- `skillType`: `String` (`varchar(50)`, not null, `@Column(name = "skill_type")`) - `READING`, `LISTENING`, `WRITING`
- `title`: `String` (`varchar(150)`, not null)
- `durationMinutes`: `Integer` (`not null, default 60`, `@Column(name = "duration_minutes")`)
- `audioUrl`: `String` (`varchar(500)`, `@Column(name = "audio_url")`)
- `orderIndex`: `Integer` (`not null, default 1`, `@Column(name = "order_index")`)

#### 10. `ExamPart` (`exam_parts`)
- `id`: `Integer` (BaseEntity)
- `sectionId`: `Integer` (`@Column(name = "section_id", nullable = false)`)
- `partNumber`: `Integer` (`not null, default 1`, `@Column(name = "part_number")`)
- `contentData`: `Object` (`@JdbcTypeCode(SqlTypes.JSON)`, `@Column(name = "content_data", columnDefinition = "jsonb", nullable = false)`)

---

### 2.4. Phân hệ `modules.testing.entity` (Thành viên 3 - 2 Entities)

#### 11. `TestAttempt` (`test_attempts`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false)`)
- `examId`: `Integer` (`@Column(name = "exam_id", nullable = false)`)
- `testScope`: `String` (`varchar(50)`, not null, default 'FULL_EXAM', `@Column(name = "test_scope")`)
- `testMode`: `String` (`varchar(50)`, not null, default 'MOCK_TEST', `@Column(name = "test_mode")`)
- `status`: `String` (`varchar(30)`, not null, default 'IN_PROGRESS') - `IN_PROGRESS`, `AI_GRADING`, `COMPLETED`, `ABANDONED`
- `startTime`: `Instant` (`@Column(name = "start_time", nullable = false)`)
- `endTime`: `Instant` (`@Column(name = "end_time")`)
- `timeSpentSeconds`: `Integer` (`not null, default 0`, `@Column(name = "time_spent_seconds")`)
- `overallScore`: `BigDecimal` (`numeric(4,2)`, `@Column(name = "overall_score")`)
- `sectionScores`: `Object` (`@JdbcTypeCode(SqlTypes.JSON)`, `@Column(name = "section_scores", columnDefinition = "jsonb")`)

#### 12. `AttemptAnswer` (`attempt_answers`)
- `id`: `Integer` (BaseEntity)
- `attemptId`: `Integer` (`@Column(name = "attempt_id", nullable = false)`)
- `partId`: `Integer` (`@Column(name = "part_id", nullable = false)`)
- `userAnswers`: `Object` (`@JdbcTypeCode(SqlTypes.JSON)`, `@Column(name = "user_answers", columnDefinition = "jsonb", nullable = false)`)
- `isCorrectFlags`: `Object` (`@JdbcTypeCode(SqlTypes.JSON)`, `@Column(name = "is_correct_flags", columnDefinition = "jsonb")`)
- `aiFeedback`: `Object` (`@JdbcTypeCode(SqlTypes.JSON)`, `@Column(name = "ai_feedback", columnDefinition = "jsonb")`)
- `skillStats`: `Object` (`@JdbcTypeCode(SqlTypes.JSON)`, `@Column(name = "skill_stats", columnDefinition = "jsonb")`)
- `earnedScore`: `BigDecimal` (`numeric(4,2)`, `@Column(name = "earned_score")`)

---

### 2.5. Phân hệ `modules.analytics.entity` (Thành viên 4 - 3 Entities)

#### 13. `UserQuota` (`user_quotas`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false)`)
- `featureCode`: `String` (`varchar(50)`, not null, `@Column(name = "feature_code")`) - `AI_WRITING_GRADING`, `AI_DICTIONARY`
- `usedCount`: `Integer` (`not null, default 0`, `@Column(name = "used_count")`)
- `maxLimit`: `Integer` (`not null, default 1`, `@Column(name = "max_limit")`)
- `resetDate`: `Instant` (`@Column(name = "reset_date", nullable = false)`)

#### 14. `AuditLog` (`audit_logs`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id")`)
- `action`: `String` (`varchar(100)`, not null) - `DELETE_EXAM`, `UPDATE_QUOTA`, `BAN_USER`
- `entityType`: `String` (`varchar(50)`, not null, `@Column(name = "entity_type")`) - `EXAM`, `USER`, `TRANSACTION`
- `entityId`: `String` (`varchar(100)`, `@Column(name = "entity_id")`)
- `details`: `Object` (`@JdbcTypeCode(SqlTypes.JSON)`, `@Column(name = "details", columnDefinition = "jsonb")`)
- `ipAddress`: `String` (`varchar(45)`, `@Column(name = "ip_address")`)

#### 15. `LoginHistory` (`login_history`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id")`)
- `ipAddress`: `String` (`varchar(45)`, not null, `@Column(name = "ip_address")`)
- `deviceInfo`: `String` (`varchar(255)`, `@Column(name = "device_info")`)
- `loginTime`: `Instant` (`@Column(name = "login_time", nullable = false)`)
- `status`: `String` (`varchar(20)`, not null, default 'SUCCESS') - `SUCCESS`, `FAILED`

---

### 2.6. Phân hệ `modules.vocab.entity` (Thành viên 5 - 3 Entities)

#### 16. `DictionaryWord` (`dictionary_words`)
- `id`: `Integer` (BaseEntity)
- `word`: `String` (`varchar(150)`, not null)
- `languageCode`: `String` (`varchar(10)`, not null, default 'en', `@Column(name = "language_code")`)
- `phonetic`: `String` (`varchar(150)`)
- `pos`: `String` (`varchar(50)`) - `noun`, `verb`, `adj`
- `level`: `String` (`varchar(10)`) - `A1`, `B2`, `C1`
- `defaultMeaning`: `Object` (`@JdbcTypeCode(SqlTypes.JSON)`, `@Column(name = "default_meaning", columnDefinition = "jsonb", nullable = false)`)
- `exampleSentence`: `String` (`@Column(name = "example_sentence", columnDefinition = "text")`)
- `audioUrl`: `String` (`varchar(500)`, `@Column(name = "audio_url")`)

#### 17. `FlashcardDeck` (`flashcard_decks`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false)`)
- `name`: `String` (`varchar(200)`, not null)
- `description`: `String` (`columnDefinition = "text"`)
- `isPublic`: `Boolean` (`not null, default false`, `@Column(name = "is_public")`)
- `clonesCount`: `Integer` (`not null, default 0`, `@Column(name = "clones_count")`)

#### 18. `UserFlashcard` (`user_flashcards`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false)`)
- `deckId`: `Integer` (`@Column(name = "deck_id", nullable = false)`)
- `wordId`: `Integer` (`@Column(name = "word_id")`)
- `customWord`: `String` (`varchar(150)`, not null, `@Column(name = "custom_word")`)
- `customMeaning`: `String` (`not null, columnDefinition = "text"`, `@Column(name = "custom_meaning")`)
- `exampleSentence`: `String` (`columnDefinition = "text"`, `@Column(name = "example_sentence")`)
- `customImageUrl`: `String` (`varchar(500)`, `@Column(name = "custom_image_url")`)
- `status`: `String` (`varchar(30)`, not null, default 'NEW') - `NEW`, `LEARNING`, `MASTERED`
- `reviewCount`: `Integer` (`not null, default 0`, `@Column(name = "review_count")`)
- `easeFactor`: `BigDecimal` (`numeric(4,2)`, not null, default 2.50, `@Column(name = "ease_factor")`)
- `intervalDays`: `Integer` (`not null, default 0`, `@Column(name = "interval_days")`)
- `nextReviewDate`: `Instant` (`@Column(name = "next_review_date", nullable = false)`)

---

### 2.7. Phân hệ `modules.gamification.entity` (Thành viên 5 - 3 Entities)

> **Lưu ý:** Module `gamification` được tách riêng khỏi `vocab` để đảm bảo độc lập nghiệp vụ. Chức năng Streak/Stats khác biệt với chức năng Flashcard/Dictionary.

#### 19. `UserStudyStat` (`user_study_stats`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false, unique = true)`)
- `currentStreak`: `Integer` (`not null, default 0`, `@Column(name = "current_streak")`)
- `highestStreak`: `Integer` (`not null, default 0`, `@Column(name = "highest_streak")`)
- `totalLearningMinutes`: `Integer` (`not null, default 0`, `@Column(name = "total_learning_minutes")`)
- `lastStudyDate`: `LocalDate` (`@Column(name = "last_study_date")`)

#### 20. `DailyStudyLog` (`daily_study_logs`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false)`)
- `studyDate`: `LocalDate` (`@Column(name = "study_date", nullable = false)`)
- `learningMinutes`: `Integer` (`not null, default 0`, `@Column(name = "learning_minutes")`)
- `flashcardsDue`: `Integer` (`not null, default 0`, `@Column(name = "flashcards_due")`)
- `flashcardsReviewed`: `Integer` (`not null, default 0`, `@Column(name = "flashcards_reviewed")`)

#### 21. `Notification` (`notifications`)
- `id`: `Integer` (BaseEntity)
- `userId`: `Integer` (`@Column(name = "user_id", nullable = false)`)
- `title`: `String` (`varchar(200)`, not null)
- `content`: `String` (`not null, columnDefinition = "text"`)
- `isRead`: `Boolean` (`not null, default false`, `@Column(name = "is_read")`)

---

## 3. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

1. [x] Cài đặt đầy đủ 21 Entity classes phân bổ vào **7 modules** (`auth`×5, `billing`×2, `exam`×3, `testing`×2, `analytics`×3, `vocab`×3, `gamification`×3).
2. [x] 100% Entity kế thừa `BaseEntity`, khai báo rõ ràng `@Table(name = "...")` và các `@Column`.
3. [x] FK vật lý chỉ tồn tại nội bộ module — liên kết xuyên module dùng `Integer` ID (loose coupling).
4. [x] `JpaEntitiesMappingTest` khởi tạo thành công toàn bộ 21 Entity trong môi trường H2 in-memory, 21/21 tests PASS.
5. [x] Lệnh `./mvnw clean test` chạy thành công, không có lỗi mapping Hibernate.
