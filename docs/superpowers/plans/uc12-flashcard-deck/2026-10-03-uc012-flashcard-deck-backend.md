# UC012: Quản lý Sổ tay & Bộ thẻ từ vựng (Backend First) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện 100% phân hệ Backend cho UC012 (Quản lý Sổ tay & Bộ thẻ từ vựng) hỗ trợ đầy đủ mô hình cặp ngôn ngữ đa quốc gia (Target Language & Source Language), tự động trích xuất nghĩa từ điển JSONB `default_meaning`, loại bỏ `audio_url` tĩnh (client dùng Web Speech API / TTS), và cung cấp trọn bộ REST APIs bảo mật chống IDOR với đầy đủ Unit Test & WebMvcTest.

**Architecture:** Áp dụng Modular Monolith package `com.multilingo.backend.modules.vocab`. Toàn bộ Controller kế thừa chuẩn `ResponseEntity<ApiResponse<T>>`, ngoại lệ ném `AppException(ErrorCode)`. Bộ thẻ `flashcard_decks` sở hữu cặp ngôn ngữ (`target_language`, `source_language`). Dữ liệu chuyển đổi qua MapStruct mappers (`FlashcardDeckMapper`, `UserFlashcardMapper`). Kiểm thử phân tầng: Service test với Mockito và Controller test với `@WebMvcTest`.

**Tech Stack:** Java 21, Spring Boot 3.3.3, Spring Data JPA, PostgreSQL (Flyway Migration), H2 (Test), MapStruct 1.5.5.Final, Lombok, JUnit 5, Mockito, MockMvc.

**Spec:** `docs/superpowers/specs/uc12-flashcard-deck/spec.md`
**Test Design:** `docs/superpowers/specs/uc12-flashcard-deck/test-design.md`

## Global Constraints
- Mọi Entity kế thừa `BaseEntity` (Primary Key kiểu `Integer`, tự tăng `GenerationType.IDENTITY`).
- Mọi Controller trả về `ResponseEntity<ApiResponse<T>>`.
- Lỗi nghiệp vụ ném `AppException(ErrorCode.XYZ)` và xử lý tập trung tại `GlobalExceptionHandler`.
- Tuân thủ nghiêm ngặt TDD (Red-Green-Refactor): Viết test trước, code sau.
- Kiểm duyệt trước khi Commit: BẮT BUỘC hiển thị tóm tắt diff và xin xác nhận của người dùng trước khi thực hiện `git commit`.
- Không lưu `audio_url` trong `DictionaryWord` do client sử dụng Web Speech Synthesis API trực tiếp.

## Review Focus
1. **Mô hình Cặp ngôn ngữ (Language Pair):** Bộ thẻ có `target_language` (VD: `en`, `ja`, `zh`) và `source_language` (VD: `vi`, `ko`, `zh`). Mặc định fallback là `en` và `vi`.
2. **Trích xuất nghĩa từ điển tự động:** Khi thêm thẻ có `word_id` mà `custom_meaning` trống, service tự động bốc nghĩa từ `dictionary_words.default_meaning` theo `deck.source_language` (hoặc fallback `vi` / `en`).
3. **Phòng chống IDOR (Security):** User A không được xem/sửa/xóa deck riêng tư hoặc card của User B -> ném `ErrorCode.FORBIDDEN` (HTTP 403).
4. **Chống trùng lặp từ vựng:** Không cho phép tạo 2 thẻ có cùng `custom_word` (case-insensitive) trong cùng một deck -> ném `ErrorCode.FLASHCARD_WORD_DUPLICATE` (HTTP 409).
5. **Hiệu năng Anti-N+1:** Đếm thống kê số lượng thẻ (`totalCards`, `newCards`, `learningCards`, `masteredCards`, `dueReviewCards`) qua một truy vấn tổng hợp duy nhất.

---

## Danh Sách Task Triển Khai (Bite-Sized Tasks)

### Task 1: Cập nhật Migration CSDL & Entity Model cho Cặp ngôn ngữ & Dọn dẹp `audio_url`

**Files:**
- Create: `backend/src/main/resources/db/migration/V2__vocab_multilingual_and_cleanup.sql`
- Modify: `backend/src/main/resources/db/migration/V1__init_schema.sql:190-208`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/entity/FlashcardDeck.java:20-34`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/entity/DictionaryWord.java:40-47`

**Interfaces:**
- Produces: 
  - `FlashcardDeck.targetLanguage` (`String`, default `"en"`)
  - `FlashcardDeck.sourceLanguage` (`String`, default `"vi"`)
  - `DictionaryWord` (đã bỏ `audioUrl`)

- [x] **Step 1: Tạo file migration `V2__vocab_multilingual_and_cleanup.sql`**
```sql
-- Migration: V2__vocab_multilingual_and_cleanup.sql
-- Thêm cặp ngôn ngữ cho flashcard_decks và loại bỏ audio_url khỏi dictionary_words
ALTER TABLE flashcard_decks 
    ADD COLUMN IF NOT EXISTS target_language VARCHAR(10) DEFAULT 'en' NOT NULL,
    ADD COLUMN IF NOT EXISTS source_language VARCHAR(10) DEFAULT 'vi' NOT NULL;

ALTER TABLE dictionary_words 
    DROP COLUMN IF EXISTS audio_url;
```

- [x] **Step 2: Cập nhật `FlashcardDeck.java` bổ sung `targetLanguage` và `sourceLanguage`**
```java
@Builder.Default
@Column(name = "target_language", length = 10, nullable = false)
private String targetLanguage = "en";

@Builder.Default
@Column(name = "source_language", length = 10, nullable = false)
private String sourceLanguage = "vi";
```

- [x] **Step 3: Xóa trường `audioUrl` khỏi `DictionaryWord.java`**
Xóa dòng `private String audioUrl;` và column annotation tương ứng.

- [x] **Step 4: Chạy biên dịch để xác nhận không có lỗi biên dịch**
Run: `cd backend && ./mvnw test-compile`
Expected: BUILD SUCCESS.

- [x] **Step 5: Xin xác nhận người dùng và commit Task 1**
```bash
git add backend/src/main/resources/db/migration/ backend/src/main/java/com/multilingo/backend/modules/vocab/entity/
git commit -m "feat(vocab): add target and source language to FlashcardDeck and remove audioUrl from DictionaryWord"
```

---

### Task 2: Cập nhật DTOs và MapStruct Mappers cho Đa ngôn ngữ

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/CreateDeckRequest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/UpdateDeckRequest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/DeckResponse.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/DeckSummaryResponse.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/DeckDetailResponse.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/FlashcardResponse.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/mapper/FlashcardDeckMapper.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/mapper/UserFlashcardMapper.java`

**Interfaces:**
- Produces:
  - DTOs có thêm `targetLanguage`, `sourceLanguage`
  - `FlashcardResponse` có thêm `phonetic`, `pos`, `languageCode`, `defaultMeaning`
  - `UserFlashcardMapper` map từ điển sang `FlashcardResponse`

- [x] **Step 1: Cập nhật `CreateDeckRequest` & `UpdateDeckRequest`**
Bổ sung:
```java
@Size(max = 10, message = "FLASHCARD_LANG_INVALID")
private String targetLanguage;

@Size(max = 10, message = "FLASHCARD_LANG_INVALID")
private String sourceLanguage;
```

- [x] **Step 2: Cập nhật `DeckResponse`, `DeckSummaryResponse`, `DeckDetailResponse`**
Bổ sung `targetLanguage` và `sourceLanguage`.

- [x] **Step 3: Cập nhật `FlashcardResponse` bổ sung thông tin từ điển**
```java
private String phonetic;
private String pos;
private String languageCode;
private Map<String, Object> defaultMeaning;
```

- [x] **Step 4: Cập nhật `UserFlashcardMapper.java` để ánh xạ thông tin từ `word` sang `FlashcardResponse`**
```java
@Mapping(target = "deckId", source = "deck.id")
@Mapping(target = "wordId", source = "word.id")
@Mapping(target = "phonetic", source = "word.phonetic")
@Mapping(target = "pos", source = "word.pos")
@Mapping(target = "languageCode", source = "word.languageCode")
@Mapping(target = "defaultMeaning", source = "word.defaultMeaning")
FlashcardResponse toResponse(UserFlashcard flashcard);
```

- [x] **Step 5: Biên dịch kiểm tra**
Run: `cd backend && ./mvnw test-compile`
Expected: BUILD SUCCESS.

- [x] **Step 6: Xin xác nhận người dùng và commit Task 2**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/vocab/dto/ backend/src/main/java/com/multilingo/backend/modules/vocab/mapper/
git commit -m "feat(vocab): update DTOs and mappers with multilingual language pairs and dictionary metadata"
```

---

### Task 3: Cập nhật Logic Service & Unit Test cho Cặp ngôn ngữ & Tự động trích xuất nghĩa

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/impl/FlashcardDeckServiceImpl.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/impl/UserFlashcardServiceImpl.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/vocab/service/FlashcardDeckServiceTest.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/vocab/service/UserFlashcardServiceTest.java`

**Interfaces:**
- Consumes: `FlashcardDeckMapper`, `UserFlashcardMapper`, `DictionaryWordRepository`
- Produces: Service xử lý default language (`targetLanguage="en"`, `sourceLanguage="vi"`) và tự động trích xuất nghĩa từ `defaultMeaning` theo `deck.getSourceLanguage()`.

- [x] **Step 1: Viết test mới trong `UserFlashcardServiceTest` kiểm tra tự động trích xuất nghĩa theo source_language**
```java
@Test
@DisplayName("addCard - Khi có wordId và customMeaning rỗng, tự động lấy nghĩa theo sourceLanguage của deck")
void addCard_AutoExtractMeaning_Success() {
    // Deck có sourceLanguage = "ko"
    FlashcardDeck deck = FlashcardDeck.builder()
            .userId(1)
            .name("TOEIC for Korean")
            .targetLanguage("en")
            .sourceLanguage("ko")
            .build();
    deck.setId(10);

    DictionaryWord dictWord = DictionaryWord.builder()
            .word("apple")
            .languageCode("en")
            .defaultMeaning(Map.of("ko", "사과", "vi", "Quả táo"))
            .build();
    dictWord.setId(1);

    CreateFlashcardRequest request = CreateFlashcardRequest.builder()
            .customWord("apple")
            .customMeaning(null) // Để trống để test auto-extract
            .wordId(1)
            .build();
    ...
}
```

- [x] **Step 2: Chạy test để thấy test FAIL**
Run: `cd backend && ./mvnw test -Dtest=UserFlashcardServiceTest#addCard_AutoExtractMeaning_Success`
Expected: FAIL

- [x] **Step 3: Cập nhật `FlashcardDeckServiceImpl` và `UserFlashcardServiceImpl`**
- Trong `FlashcardDeckServiceImpl`: gán mặc định `targetLanguage="en"` và `sourceLanguage="vi"` nếu request không truyền.
- Trong `UserFlashcardServiceImpl.addCard()`:
```java
if ((request.getCustomMeaning() == null || request.getCustomMeaning().trim().isEmpty()) && request.getWordId() != null) {
    DictionaryWord dictionaryWord = dictionaryWordRepository.findById(request.getWordId()).orElse(null);
    if (dictionaryWord != null && dictionaryWord.getDefaultMeaning() != null) {
        String sourceLang = deck.getSourceLanguage();
        Object meaningObj = dictionaryWord.getDefaultMeaning().get(sourceLang);
        if (meaningObj == null) {
            meaningObj = dictionaryWord.getDefaultMeaning().get("vi"); // fallback
        }
        if (meaningObj == null) {
            meaningObj = dictionaryWord.getDefaultMeaning().get("en"); // fallback 2
        }
        card.setCustomMeaning(meaningObj != null ? meaningObj.toString() : request.getCustomWord());
    }
}
```

- [x] **Step 4: Chạy lại toàn bộ Unit Tests**
Run: `cd backend && ./mvnw test -Dtest=FlashcardDeckServiceTest,UserFlashcardServiceTest`
Expected: PASS (Tất cả test cases đều xanh).

- [x] **Step 5: Xin xác nhận người dùng và commit Task 3**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/vocab/service/ backend/src/test/java/com/multilingo/backend/modules/vocab/service/
git commit -m "feat(vocab): implement language pair defaults and dictionary auto-meaning extraction in services"
```

---

### Task 4: Triển khai REST Controller Quản lý Bộ thẻ (`FlashcardDeckController`) & WebMvcTest

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/controller/FlashcardDeckController.java`
- Create: `backend/src/test/java/com/multilingo/backend/modules/vocab/controller/FlashcardDeckControllerTest.java`

**Interfaces:**
- Endpoints:
  - `GET /api/v1/vocab/decks`
  - `POST /api/v1/vocab/decks`
  - `GET /api/v1/vocab/decks/{id}`
  - `PUT /api/v1/vocab/decks/{id}`
  - `DELETE /api/v1/vocab/decks/{id}`
- Response: `ResponseEntity<ApiResponse<T>>`
- Auth Header: `@RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId`

- [x] **Step 1: Viết test WebMvcTest cho `FlashcardDeckControllerTest`**
Kiểm tra các kịch bản:
- `GET /api/v1/vocab/decks`: trả về 200 OK kèm danh sách `DeckSummaryResponse`.
- `POST /api/v1/vocab/decks`: payload hợp lệ -> 201 Created; tên rỗng -> 422 Unprocessable Entity.
- `GET /api/v1/vocab/decks/{id}`: ID tồn tại -> 200 OK; ID của người khác -> 403 Forbidden; không tồn tại -> 404 Not Found.
- `PUT /api/v1/vocab/decks/{id}`: 200 OK khi sửa thành công.
- `DELETE /api/v1/vocab/decks/{id}`: 200 OK.

- [x] **Step 2: Chạy test để thấy test FAIL**
Run: `cd backend && ./mvnw test -Dtest=FlashcardDeckControllerTest`
Expected: FAIL (Controller chưa tồn tại).

- [x] **Step 3: Triển khai mã nguồn `FlashcardDeckController.java`**
Triển khai 5 endpoints với đầy đủ `@Valid`, chú thích tiếng Việt và trả về `ResponseEntity.ok(ApiResponse.success(...))` hoặc `ResponseEntity.status(HttpStatus.CREATED).body(...)`.

- [x] **Step 4: Chạy lại test `FlashcardDeckControllerTest`**
Run: `cd backend && ./mvnw test -Dtest=FlashcardDeckControllerTest`
Expected: PASS.

- [x] **Step 5: Xin xác nhận người dùng và commit Task 4**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/vocab/controller/FlashcardDeckController.java backend/src/test/java/com/multilingo/backend/modules/vocab/controller/FlashcardDeckControllerTest.java
git commit -m "feat(vocab): implement FlashcardDeckController with full WebMvc tests"
```

---

### Task 5: Triển khai REST Controller Quản lý Thẻ Từ Vựng (`UserFlashcardController`) & WebMvcTest

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/controller/UserFlashcardController.java`
- Create: `backend/src/test/java/com/multilingo/backend/modules/vocab/controller/UserFlashcardControllerTest.java`

**Interfaces:**
- Endpoints:
  - `GET /api/v1/vocab/decks/{deckId}/cards` (hỗ trợ `@RequestParam(required = false) String keyword`, `@RequestParam(required = false) String status`)
  - `POST /api/v1/vocab/decks/{deckId}/cards`
  - `PUT /api/v1/vocab/cards/{cardId}`
  - `DELETE /api/v1/vocab/cards/{cardId}`
- Response: `ResponseEntity<ApiResponse<T>>`

- [x] **Step 1: Viết test WebMvcTest cho `UserFlashcardControllerTest`**
Kiểm tra các kịch bản:
- `GET /api/v1/vocab/decks/{deckId}/cards`: 200 OK kèm danh sách cards.
- `POST /api/v1/vocab/decks/{deckId}/cards`: 201 Created; trùng từ -> 409 Conflict; thiếu từ/nghĩa -> 422 Unprocessable Entity.
- `PUT /api/v1/vocab/cards/{cardId}`: 200 OK khi sửa thẻ thành công.
- `DELETE /api/v1/vocab/cards/{cardId}`: 200 OK khi xóa thẻ thành công; cố tình xóa thẻ người khác -> 403 Forbidden.

- [x] **Step 2: Chạy test để thấy test FAIL**
Run: `cd backend && ./mvnw test -Dtest=UserFlashcardControllerTest`
Expected: FAIL (Controller chưa tồn tại).

- [x] **Step 3: Triển khai mã nguồn `UserFlashcardController.java`**
Triển khai 4 endpoints với validation và comment giải thích luồng nghiệp vụ.

- [x] **Step 4: Chạy lại test `UserFlashcardControllerTest`**
Run: `cd backend && ./mvnw test -Dtest=UserFlashcardControllerTest`
Expected: PASS.

- [x] **Step 5: Xin xác nhận người dùng và commit Task 5**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/vocab/controller/UserFlashcardController.java backend/src/test/java/com/multilingo/backend/modules/vocab/controller/UserFlashcardControllerTest.java
git commit -m "feat(vocab): implement UserFlashcardController with full WebMvc tests"
```

---

### Task 6: Toàn diện Kiểm thử Nghiệm thu & Verification Before Completion

**Files:**
- Audit toàn bộ test suite: `mvn clean test`

- [x] **Step 1: Chạy toàn bộ test suite backend**
Run: `cd backend && ./mvnw clean test`
Expected: BUILD SUCCESS (100% tests PASS, bao gồm Unit tests service, Controller WebMvcTests, Repository tests, Auth/Exam tests hiện có).

- [x] **Step 2: Kiểm tra đối soát với Test Design (14 test cases trong `test-design.md`)**
Xác nhận toàn bộ các kịch bản Happy Path, Boundary, IDOR Security, Duplicate Conflict, Multilingual Language Pair, và Cascade Delete đều có bằng chứng chạy PASS.

- [x] **Step 3: Hiển thị báo cáo nghiệm thu hoàn thành Backend UC012 cho người dùng**
Trình bày tóm tắt kết quả kiểm thử thực tế và sẵn sàng cho giai đoạn Frontend tiếp theo.

