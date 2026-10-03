# UC012: Quản lý Sổ tay & Bộ thẻ từ vựng Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh tính năng Quản lý Sổ tay và bộ thẻ từ vựng (UC012), bao gồm REST API backend (Spring Boot 3, JPA, PostgreSQL, Base Architecture) và Giao diện frontend (React Vite TypeScript, Tailwind/Vanilla CSS), sẵn sàng kết nối các chế độ học tập (UC12.1 - UC12.6).

**Architecture:** Áp dụng mô hình Modular Monolith package `com.multilingo.backend.modules.vocab`. Toàn bộ Controller kế thừa chuẩn `ResponseEntity<ApiResponse<T>>`, ngoại lệ xử lý qua `AppException(ErrorCode)`. Database truy vấn thông qua Spring Data JPA với Custom Query đếm thống kê thẻ tối ưu (tránh N+1 query). Frontend tách biệt View component, Custom hooks và API client.

**Tech Stack:** Java 17, Spring Boot 3.3, Spring Data JPA, PostgreSQL, JUnit 5, Mockito, React 18, TypeScript, Vite.

**Spec:** `docs/superpowers/specs/uc12-flashcard-deck/spec.md`

## Global Constraints
- Mọi Entity kế thừa `BaseEntity` (Primary Key kiểu `Integer`, tự tăng `GenerationType.IDENTITY`).
- Mọi Controller trả về `ResponseEntity<ApiResponse<T>>`.
- Lỗi nghiệp vụ ném `AppException(ErrorCode.XYZ)` và xử lý tập trung tại `GlobalExceptionHandler`.
- Tuân thủ nghiêm ngặt TDD (Red-Green-Refactor): Phải viết test đỏ trước khi viết code sản phẩm.
- Kiểm duyệt trước khi Commit: BẮT BUỘC hiển thị tóm tắt diff và xin xác nhận của người dùng trước khi thực hiện `git commit`.

## Review Focus
1. **Truy cập trái phép (IDOR):** User cố gắng đọc, sửa hoặc xóa bộ thẻ / thẻ từ vựng của người dùng khác -> Hệ thống ném `AppException(ErrorCode.FORBIDDEN)`.
2. **Xóa Cascade:** Khi xóa một bộ thẻ (`flashcard_decks`), toàn bộ các bản ghi `user_flashcards` thuộc về bộ thẻ đó phải bị xóa hoàn toàn khỏi DB.
3. **Hiệu năng đếm thống kê:** Endpoint danh sách bộ thẻ phải tính toán số lượng thẻ (`totalCards`, `newCards`, `learningCards`, `masteredCards`, `dueReviewCards`) qua một truy vấn tổng hợp duy nhất (GROUP BY / Projection), tuyệt đối không query loop từng deck (chống N+1).
4. **Validation biên:** Tên bộ thẻ vượt quá 200 ký tự hoặc từ vựng vượt quá 150 ký tự phải trả về lỗi `422 VALIDATION_FAILED` với message tiếng Việt rõ ràng.
5. **Tìm kiếm không dấu & không phân biệt hoa thường:** Tìm kiếm từ vựng trong deck phải hỗ trợ `ILIKE` hoặc `LOWER()` trên cả `custom_word` và `custom_meaning`.

---

## Danh Sách Task Triển Khai (Bite-Sized Tasks)

### Task 1: Định nghĩa Request/Response DTOs cho Vocab Decks & Flashcards

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/CreateDeckRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/UpdateDeckRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/CreateFlashcardRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/UpdateFlashcardRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/DeckResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/DeckSummaryResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/DeckDetailResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/FlashcardResponse.java`

**Interfaces:**
- Produces: DTOs chứa Bean Validation (`@NotBlank`, `@Size`) cho controller và service, phân tách rõ ràng trong `dto/request` và `dto/response`.
- Lưu ý: Unit tests trong dự án tập trung 100% vào kiểm thử nghiệp vụ tầng Service (`FlashcardDeckServiceTest`, `UserFlashcardServiceTest`). Bean Validation DTO được kiểm thử xác thực tại Controller (`@WebMvcTest`).

- [x] **Step 1: Tạo các Request DTOs trong package `com.multilingo.backend.modules.vocab.dto.request`**
- [x] **Step 2: Tạo các Response DTOs trong package `com.multilingo.backend.modules.vocab.dto.response`**
- [x] **Step 3: Biên dịch dự án xác nhận không có lỗi syntax**
Run: `cd backend && ./mvnw test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Xin xác nhận người dùng và commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/vocab/dto/
git commit -m "feat(vocab): add request and response DTOs for decks and flashcards"
```

---

### Task 2: Xây dựng Repository Layer cho FlashcardDeck & UserFlashcard

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/repository/FlashcardDeckRepository.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/repository/UserFlashcardRepository.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/DeckStatsProjection.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/vocab/repository/FlashcardRepositoryTest.java`

**Interfaces:**
- Produces: 
  - `FlashcardDeckRepository.findAllByUserId(Integer userId)`
  - `FlashcardDeckRepository.findByIdAndUserId(Integer id, Integer userId)`
  - `UserFlashcardRepository.countStatsByDeckIds(List<Integer> deckIds)` (Projection: deckId, total, newCount, learningCount, masteredCount, dueCount)
  - `UserFlashcardRepository.searchCards(Integer deckId, String keyword, String status)`
  - `UserFlashcardRepository.existsByDeckIdAndCustomWordIgnoreCase(Integer deckId, String customWord)`
  - `UserFlashcardRepository.deleteByDeckId(Integer deckId)`

- [ ] **Step 1: Viết DataJpaTest cho Repository queries**
Kiểm tra tìm kiếm Deck theo userId, đếm thống kê thẻ nhóm theo Deck, tìm kiếm từ vựng theo từ khóa `custom_word` hoặc `custom_meaning`, kiểm tra trùng lặp từ và xóa thẻ theo deckId.

- [ ] **Step 2: Chạy test xác nhận FAIL**
Run: `cd backend && ./mvnw test -Dtest=FlashcardRepositoryTest`
Expected: FAIL.

- [ ] **Step 3: Viết mã nguồn Spring Data JPA Repository và Projection Interface**
```java
public interface FlashcardDeckRepository extends JpaRepository<FlashcardDeck, Integer> {
    List<FlashcardDeck> findAllByUserIdOrderByCreatedAtDesc(Integer userId);
    Optional<FlashcardDeck> findByIdAndUserId(Integer id, Integer userId);
    boolean existsByIdAndUserId(Integer id, Integer userId);
}
```
Kèm JPQL query tổng hợp đếm thẻ cho `UserFlashcardRepository` và các phương thức `existsByDeckIdAndCustomWordIgnoreCase` và `deleteByDeckId`.

- [ ] **Step 4: Chạy test xác nhận PASS**
Run: `cd backend && ./mvnw test -Dtest=FlashcardRepositoryTest`
Expected: PASS.

- [ ] **Step 5: Xin xác nhận người dùng và commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/vocab/repository/ backend/src/test/java/com/multilingo/backend/modules/vocab/repository/
git commit -m "feat(vocab): add repository interfaces and projection queries for decks and cards"
```

---

### Task 3: Triển khai Service Layer & Unit Tests cho FlashcardDeck (Deck Management)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/FlashcardDeckService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/impl/FlashcardDeckServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/vocab/service/FlashcardDeckServiceTest.java`

**Interfaces:**
- Consumes: `FlashcardDeckRepository`, `UserFlashcardRepository`
- Produces: 
  - `List<DeckSummaryResponse> getUserDecks(Integer userId)`
  - `DeckDetailResponse getDeckDetail(Integer deckId, Integer userId)`
  - `DeckResponse createDeck(CreateDeckRequest req, Integer userId)`
  - `DeckResponse updateDeck(Integer deckId, UpdateDeckRequest req, Integer userId)`
  - `void deleteDeck(Integer deckId, Integer userId)`

- [ ] **Step 1: Viết Unit Test (Mockito) cho FlashcardDeckService**
Kiểm thử các kịch bản:
- `TC_VOCAB_DECK_01`: Lấy danh sách thành công kèm thống kê số thẻ.
- `TC_VOCAB_DECK_02`: Tạo deck mới thành công gán đúng `userId`.
- `TC_VOCAB_DECK_05`: User B sửa/xóa deck của User A -> ném `AppException(ErrorCode.FORBIDDEN)`.
- `TC_VOCAB_DECK_06`: Xóa deck chủ động gọi xóa các thẻ con để an toàn cascade trên mọi DB.
- Deck không tồn tại -> ném `AppException(ErrorCode.RESOURCE_NOT_FOUND)`.

- [ ] **Step 2: Chạy test xác nhận FAIL**
Run: `cd backend && ./mvnw test -Dtest=FlashcardDeckServiceTest`
Expected: FAIL.

- [ ] **Step 3: Triển khai `FlashcardDeckServiceImpl`**
Xử lý logic kiểm tra quyền sở hữu (`deck.getUserId().equals(userId)`), tính toán thống kê thẻ cho từng deck, ném ngoại lệ chuẩn hóa `AppException`. Trong `deleteDeck`: thực hiện `@Transactional` và gọi `userFlashcardRepository.deleteByDeckId(deckId)` trước khi xóa deck.

- [ ] **Step 4: Chạy test xác nhận PASS**
Run: `cd backend && ./mvnw test -Dtest=FlashcardDeckServiceTest`
Expected: PASS.

- [ ] **Step 5: Xin xác nhận người dùng và commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/vocab/service/ backend/src/test/java/com/multilingo/backend/modules/vocab/service/
git commit -m "feat(vocab): implement deck management service with ownership checks and stats aggregation"
```

---

### Task 4: Triển khai Service Layer & Unit Tests cho UserFlashcard (Card Management)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/UserFlashcardService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/impl/UserFlashcardServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/vocab/service/UserFlashcardServiceTest.java`

**Interfaces:**
- Consumes: `UserFlashcardRepository`, `FlashcardDeckRepository`
- Produces:
  - `List<FlashcardResponse> getCardsInDeck(Integer deckId, String keyword, String status, Integer userId)`
  - `FlashcardResponse addCard(Integer deckId, CreateFlashcardRequest req, Integer userId)`
  - `FlashcardResponse updateCard(Integer cardId, UpdateFlashcardRequest req, Integer userId)`
  - `void deleteCard(Integer cardId, Integer userId)`

- [ ] **Step 1: Viết Unit Test cho UserFlashcardService**
Kiểm thử các kịch bản:
- `TC_VOCAB_CARD_01`: Lọc thẻ theo status `NEW`/`LEARNING`/`MASTERED`.
- `TC_VOCAB_CARD_02`: Tìm kiếm theo từ khóa.
- `TC_VOCAB_CARD_03`: Thêm thẻ mới thành công với giá trị khởi tạo SRS (`status="NEW"`, `easeFactor=2.50`, `intervalDays=0`).
- `TC_VOCAB_CARD_05`: Thêm thẻ bị trùng lặp trong cùng một deck -> ném `AppException(ErrorCode.CONFLICT, "Từ vựng này đã tồn tại trong bộ thẻ")`.
- Kiểm tra quyền sở hữu deck trước khi thêm thẻ (Security IDOR check).

- [ ] **Step 2: Chạy test xác nhận FAIL**
Run: `cd backend && ./mvnw test -Dtest=UserFlashcardServiceTest`
Expected: FAIL.

- [ ] **Step 3: Triển khai `UserFlashcardServiceImpl`**
Thực hiện tạo thẻ, kiểm tra trùng lặp từ bằng `userFlashcardRepository.existsByDeckIdAndCustomWordIgnoreCase(deckId, req.getCustomWord().trim())`, gán giá trị mặc định cho thuật toán SRS, kiểm tra quyền sở hữu deck và thẻ.

- [ ] **Step 4: Chạy test xác nhận PASS**
Run: `cd backend && ./mvnw test -Dtest=UserFlashcardServiceTest`
Expected: PASS.

- [ ] **Step 5: Xin xác nhận người dùng và commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/vocab/service/ backend/src/test/java/com/multilingo/backend/modules/vocab/service/
git commit -m "feat(vocab): implement user flashcard service for card management in deck"
```

---

### Task 5: Triển khai REST Controller cho Deck Management

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/controller/FlashcardDeckController.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/vocab/controller/FlashcardDeckControllerTest.java`

**Interfaces:**
- Endpoints: `GET /api/v1/vocab/decks`, `POST /api/v1/vocab/decks`, `GET /api/v1/vocab/decks/{id}`, `PUT /api/v1/vocab/decks/{id}`, `DELETE /api/v1/vocab/decks/{id}`.
- Response: `ResponseEntity<ApiResponse<T>>`.

- [ ] **Step 1: Viết WebMvcTest cho FlashcardDeckController**
Kiểm tra các response status:
- GET decks -> 200 OK với `ApiResponse<List<DeckSummaryResponse>>`.
- POST deck hợp lệ -> 201 Created.
- POST deck với tên trống -> 422 Unprocessable Entity.
- DELETE deck -> 200 OK.

- [ ] **Step 2: Chạy test xác nhận FAIL**
Run: `cd backend && ./mvnw test -Dtest=FlashcardDeckControllerTest`
Expected: FAIL.

- [ ] **Step 3: Viết mã nguồn `FlashcardDeckController`**
Sử dụng `@RestController`, `@RequestMapping("/api/v1/vocab/decks")`, `@Valid`. Trích xuất `userId` linh hoạt qua `@RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId` (với fallback kiểm tra `SecurityContextHolder`), đóng gói dữ liệu vào `ApiResponse.success()`.

- [ ] **Step 4: Chạy test xác nhận PASS**
Run: `cd backend && ./mvnw test -Dtest=FlashcardDeckControllerTest`
Expected: PASS.

- [ ] **Step 5: Xin xác nhận người dùng và commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/vocab/controller/ backend/src/test/java/com/multilingo/backend/modules/vocab/controller/
git commit -m "feat(vocab): add REST controller for flashcard decks with standardized ApiResponse"
```

---

### Task 6: Triển khai REST Controller cho Flashcard Management

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/controller/UserFlashcardController.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/vocab/controller/UserFlashcardControllerTest.java`

**Interfaces:**
- Endpoints: `GET /api/v1/vocab/decks/{deckId}/cards`, `POST /api/v1/vocab/decks/{deckId}/cards`, `PUT /api/v1/vocab/cards/{cardId}`, `DELETE /api/v1/vocab/cards/{cardId}`.
- Response: `ResponseEntity<ApiResponse<T>>`.

- [ ] **Step 1: Viết WebMvcTest cho UserFlashcardController**
Kiểm thử gọi API lấy danh sách từ, tạo từ mới và xóa từ.

- [ ] **Step 2: Chạy test xác nhận FAIL**
Run: `cd backend && ./mvnw test -Dtest=UserFlashcardControllerTest`
Expected: FAIL.

- [ ] **Step 3: Viết mã nguồn `UserFlashcardController`**
Kết nối `UserFlashcardService`, lấy `userId` qua `@RequestHeader(value = "X-User-Id", defaultValue = "1") Integer userId` và trả về `ApiResponse.success()`.

- [ ] **Step 4: Chạy test xác nhận PASS**
Run: `cd backend && ./mvnw test -Dtest=UserFlashcardControllerTest`
Expected: PASS.

- [ ] **Step 5: Xin xác nhận người dùng và commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/vocab/controller/ backend/src/test/java/com/multilingo/backend/modules/vocab/controller/
git commit -m "feat(vocab): add REST controller for user flashcards CRUD and filter endpoints"
```

---

### Task 7: Xây dựng Frontend API Client & Types cho Vocab Module

**Files:**
- Create: `web-ui/src/services/vocabService.ts`
- Create: `web-ui/src/types/vocab.ts`
- Test: `web-ui/src/services/__tests__/vocabService.test.ts` (Unit test với Mock API/axios)

**Interfaces:**
- Tuân thủ quy tắc `frontend-architecture.md`: **Bắt buộc** import và sử dụng `axiosClient` từ `src/api/axiosClient.ts`.
- Produces: Các hàm `getDecks()`, `createDeck()`, `updateDeck()`, `deleteDeck()`, `getCards(deckId, params)`, `createCard(deckId, data)`, `updateCard(cardId, data)`, `deleteCard(cardId)`.

- [ ] **Step 1: Viết unit test cho vocabService**
Kiểm tra hàm gọi đúng endpoint URL, query parameters và parse `data` từ `ApiResponse`.

- [ ] **Step 2: Triển khai TypeScript types & API service**
- [ ] **Step 3: Chạy test kiểm thử API client**
Run: `cd web-ui && npm test src/services/__tests__/vocabService.test.ts`
Expected: PASS.

- [ ] **Step 4: Xin xác nhận người dùng và commit**
```bash
git add web-ui/src/services/vocabService.ts web-ui/src/types/vocab.ts web-ui/src/services/__tests__/
git commit -m "feat(ui): add vocab API service client and TypeScript interfaces"
```

---

### Task 8: Hoàn thiện Giao diện Quản lý Danh sách Bộ thẻ (`Flashcards.tsx`)

**Files:**
- Modify: `web-ui/src/pages/student/Flashcards.tsx`
- Create: `web-ui/src/pages/student/flashcards/CreateDeckModal.tsx`
- Create: `web-ui/src/pages/student/flashcards/DeckCardItem.tsx`
- Create: `web-ui/src/pages/student/flashcards/EmptyDeckState.tsx`

**Features:**
- Hiển thị danh sách bộ thẻ dạng lưới (Grid), mỗi card hiển thị: Tên, mô tả, badge tiến độ (Total, New, Learning, Mastered), số thẻ cần ôn hôm nay (Due today).
- Nút `+ Tạo bộ thẻ` mở modal tạo mới với validation.
- Menu 3 chấm trên mỗi bộ thẻ: Sửa, Xóa (kèm popup xác nhận xóa cascade).
- Xử lý trạng thái Loading spinner và Empty State khi chưa có bộ thẻ nào.
- Nhấp vào card chuyển sang trang chi tiết bộ thẻ `/student/flashcards/:deckId`.

- [ ] **Step 1: Triển khai các sub-components (`DeckCardItem`, `CreateDeckModal`, `EmptyDeckState`)**
- [ ] **Step 2: Cập nhật `Flashcards.tsx` kết nối dữ liệu từ `vocabService`**
- [ ] **Step 3: Chạy build & test frontend**
Run: `cd web-ui && npm run build`
Expected: Build thành công không có lỗi type.

- [ ] **Step 4: Xin xác nhận người dùng và commit**
```bash
git add web-ui/src/pages/student/Flashcards.tsx web-ui/src/pages/student/flashcards/
git commit -m "feat(ui): implement vocab decks list view with create/edit modal and empty state"
```

---

### Task 9: Hoàn thiện Giao diện Chi tiết Bộ thẻ & Hub Điều hướng (`DeckDetailView.tsx`)

**Files:**
- Create: `web-ui/src/pages/student/flashcards/DeckDetailView.tsx`
- Create: `web-ui/src/pages/student/flashcards/DeckDetailView.css`
- Create: `web-ui/src/pages/student/flashcards/AddFlashcardModal.tsx`
- Modify: `web-ui/src/App.tsx` (Thêm route `/student/flashcards/:deckId`)

**Features:**
- Header thống kê chi tiết bộ thẻ (Tổng từ, Tỷ lệ thuộc bài, Đang học, Thẻ mới).
- **Study Mode Launchpad (Khung điều hướng sang 4 chế độ học):**
  - Nút *Thẻ ghi nhớ* (Lật thẻ SRS - chuẩn bị cho UC12.2).
  - Nút *Học từ vựng* (Trắc nghiệm - chuẩn bị cho UC12.3).
  - Nút *Kiểm tra* (Test nộp bài - chuẩn bị cho UC12.4).
  - Nút *Ghép thẻ tốc độ* (Minigame - chuẩn bị cho UC12.5).
- Thanh công cụ tìm kiếm và lọc từ vựng theo trạng thái (`Tất cả`, `Mới`, `Đang học`, `Đã thuộc`).
- Danh sách thẻ từ vựng trực quan (Từ, nghĩa, phiên âm, ví dụ, trạng thái badge).
- Nút `+ Thêm từ vựng` mở modal thêm từ nhanh (UC12.1), nút Sửa/Xóa từng thẻ từ (UC12.6).

- [ ] **Step 1: Tạo component `AddFlashcardModal.tsx`**
- [ ] **Step 2: Triển khai `DeckDetailView.tsx` và gắn route trong `App.tsx`**
- [ ] **Step 3: Chạy kiểm thử TypeScript và build frontend**
Run: `cd web-ui && npm run build`
Expected: Build thành công 100%.

- [ ] **Step 4: Xin xác nhận người dùng và commit**
```bash
git add web-ui/src/pages/student/flashcards/ web-ui/src/App.tsx
git commit -m "feat(ui): implement deck detail view with search, filter, card CRUD modal and study launchpad"
```

---

### Task 10: Nghiệm thu tổng thể (Verification Before Completion)

**Files:**
- N/A (Chạy toàn bộ test suites)

- [ ] **Step 1: Chạy toàn bộ backend unit & integration tests**
Run: `cd backend && ./mvnw clean test`
Expected: `BUILD SUCCESS`, Tests run: >= 20, Failures: 0, Errors: 0, Skipped: 0.

- [ ] **Step 2: Chạy kiểm tra lint & build frontend**
Run: `cd web-ui && npm run build`
Expected: `✓ built in ...ms` không có lỗi.

- [ ] **Step 3: Đối chiếu 100% tiêu chí AC và bảng Test Cases trong Spec**
Kiểm tra đối chiếu `TC_VOCAB_DECK_01` -> `TC_VOCAB_DECK_06` và `TC_VOCAB_CARD_01` -> `TC_VOCAB_CARD_05`.
