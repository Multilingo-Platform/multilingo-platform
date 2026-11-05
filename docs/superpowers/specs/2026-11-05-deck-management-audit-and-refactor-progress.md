# Báo cáo Rà soát Toàn diện & Tiến độ Refactor Chức năng Quản lý / Tạo Bộ thẻ Từ vựng (Flashcard Deck Management)

> **Mã Module:** `VOCAB_DECK`  
> **Ngày lập:** 05/11/2026  
> **Trạng thái:** Sẵn sàng nghiệm thu thiết kế trước khi lập trình (Pre-Implementation Audit)

---

## 1. Tổng quan Kiến trúc Hiện tại (Current Architecture Overview)

Chức năng Quản lý & Tạo danh mục bộ thẻ từ vựng hiện tại chạy xuyên suốt từ Cơ sở dữ liệu, Backend Spring Boot đến Frontend React:

```
┌────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React + TypeScript + Tailwind)                               │
│ - DeckModal.tsx (Form Tạo / Sửa bộ thẻ)                                │
│ - DeckListView.tsx (Lưới hiển thị danh mục bộ thẻ)                    │
│ - FlashcardsPage.tsx (Trang điều phối chính, quản lý state decks)      │
│ - vocabApi.ts (Client API Axios)                                       │
│ - vocab.types.ts (Interfaces DTO frontend)                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST (JSON)
┌───────────────────────────────────▼────────────────────────────────────┐
│ BACKEND (Spring Boot 3 + Spring Data JPA + PostgreSQL)                 │
│ - FlashcardDeckController.java (/api/v1/vocab/decks)                   │
│ - FlashcardDeckService & FlashcardDeckServiceImpl.java                 │
│ - FlashcardDeckRepository.java                                         │
│ - FlashcardDeckMapper.java (MapStruct)                                 │
│ - DTOs: CreateDeckRequest, UpdateDeckRequest, DeckResponse,            │
│         DeckDetailResponse, DeckSummaryResponse                        │
│ - Entity: FlashcardDeck.java (Bảng flashcard_decks)                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Kết quả Rà soát Chi tiết theo Từng Tầng (Detailed Audit Findings)

### 2.1. Tầng Cơ sở dữ liệu & Entity (`FlashcardDeck.java` & Migrations)

| Vấn đề phát hiện | Mức độ nghiêm trọng | Hiện trạng | Khuyến nghị Refactor |
| :--- | :--- | :--- | :--- |
| **Thiếu Index trên cột `user_id`** | 🟡 **Trung bình (Performance)** | Bảng `flashcard_decks` trong `V1__init_schema.sql` chưa có index cho `user_id` hay `(user_id, created_at)`. | Tạo Flyway migration bổ sung: `CREATE INDEX idx_flashcard_decks_user_created ON flashcard_decks(user_id, created_at DESC);` giúp câu query danh sách nhanh vượt trội khi lượng data lớn. |
| **Thiếu Metadata trực quan (Màu sắc / Icon)** | 🔵 **Thấp (UI/UX)** | Entity chỉ lưu `name`, `description`, `target_language`, `source_language`, `is_public`, `clones_count`. | Bổ sung các trường tùy chọn: `color` (VARCHAR(30)), `icon` (VARCHAR(50)) để phân loại trực quan danh mục bộ thẻ. |
| **Ràng buộc Foreign Key `user_id`** | 🔵 **Thấp (Data Integrity)** | `user_id INT NOT NULL` nhưng chưa khai báo `REFERENCES users(id) ON DELETE CASCADE`. | Bổ sung Foreign Key an toàn để dữ liệu nhất quán. |

---

### 2.2. Tầng DTO (Data Transfer Objects)

| DTO | Vấn đề phát hiện | Chi tiết phân tích & Tác động | Giải pháp Refactor đề xuất |
| :--- | :--- | :--- | :--- |
| `DeckSummaryResponse` & `DeckDetailResponse` | 🔴 **Nghiêm trọng (Vi phạm DRY / Duplicate Code)** | Cả 2 class DTO có **100% thuộc tính giống hệt nhau** (15 trường: `id`, `userId`, `name`, `description`, `targetLanguage`, `sourceLanguage`, `isPublic`, `clonesCount`, `totalCards`, `newCards`, `learningCards`, `masteredCards`, `dueReviewCards`, `createdAt`, `updatedAt`). | Hợp nhất thành một DTO duy nhất: `DeckResponse` (hoặc `DeckDetailResponse`) dùng chung, xóa bỏ DTO thừa. |
| `CreateDeckRequest` & `UpdateDeckRequest` | 🟡 **Trung bình (Trùng lặp code)** | Trùng lặp hoàn toàn các trường `name`, `description`, `targetLanguage`, `sourceLanguage`. Điểm khác duy nhất là `isPublic` (CreateDeckRequest mặc định false, UpdateDeckRequest là Boolean nullable). | Tạo class cơ sở `BaseDeckRequest` chứa validation chung, `CreateDeckRequest` và `UpdateDeckRequest` kế thừa lại. |
| Validation độ dài `description` | 🟡 **Trung bình (Mismatch FE vs BE)** | Backend cho phép `@Size(max = 2000)`, nhưng Frontend `DeckModal.tsx` lại chặn `maxLength={1000}`. | Đồng bộ thống nhất giới hạn mô tả tối đa **1000 ký tự** ở cả FE và BE. |
| Validation mã ngôn ngữ (`targetLanguage`, `sourceLanguage`) | 🔴 **Nghiêm trọng (Thiếu Whitelist Validation)** | Backend chỉ kiểm tra `@Size(max = 10)`. User có thể gửi các giá trị rác như `"abc"`, `"1234"` và vẫn lưu thành công. | Thêm Annotation `@Pattern` hoặc Custom Validator kiểm tra mã ngôn ngữ hợp lệ theo chuẩn ISO 639-1 (`en`, `vi`, `ja`, `ko`, `zh`, `fr`, `de`, `es`). |
| Validation trùng lặp ngôn ngữ | 🟡 **Trung bình (Logic nghiệp vụ)** | Không kiểm tra `targetLanguage == sourceLanguage` (Ví dụ: chọn học tiếng Việt giải nghĩa bằng tiếng Việt có hợp lý không?). | Bổ sung kiểm tra logic: Nếu học ngoại ngữ, `targetLanguage` không được trùng với `sourceLanguage`. |

---

### 2.3. Tầng Service & Controller (`FlashcardDeckService` & `FlashcardDeckController`)

| Endpoint / Method | Hiện trạng | Lỗ hổng / Bất cập | Đề xuất Cải tiến |
| :--- | :--- | :--- | :--- |
| `POST /api/v1/vocab/decks` (Tạo bộ thẻ) | Lưu deck, trả về `DeckResponse` cơ bản (không có các trường `totalCards`, `masteredCards`...). | 1. **Chưa kiểm tra trùng tên:** Một user có thể tạo 10 bộ thẻ cùng tên là "IELTS 1".<br>2. **Payload Response không đầy đủ:** Frontend phải gọi lại toàn bộ `GET /api/v1/vocab/decks` để đồng bộ. | 1. Kiểm tra `existsByUserIdAndNameIgnoreCase(userId, name.trim())`, nếu trùng ném `DECK_NAME_ALREADY_EXISTS`.<br>2. Trả về `DeckResponse` đầy đủ với các giá trị thống kê khởi tạo (`0` thẻ) để frontend chèn trực tiếp vào state. |
| `GET /api/v1/vocab/decks` (Lấy danh sách) | Query toàn bộ deck của user rồi chạy `countStatsByDeckIds`. | Khi user có nhiều bộ thẻ (hàng chục đến hàng trăm), việc trả về tất cả không phân trang sẽ tốn băng thông và RAM. | Bổ sung tham số tùy chọn: `keyword` (tìm kiếm tại server), `page`, `size` (phân trang khi cần). |
| `GET /api/v1/vocab/decks/{id}` (Chi tiết) | Endpoint hoạt động chuẩn, kiểm tra IDOR tốt. | Frontend **chưa từng gọi** endpoint này trong toàn bộ codebase (lấy dữ liệu từ state cache). | Giữ nguyên endpoint để phục vụ deep-linking (truy cập thẳng qua URL `/student/flashcards?deckId=12` khi F5 hoặc mở tab mới). |
| `PUT /api/v1/vocab/decks/{id}` (Sửa bộ thẻ) | Cập nhật thông tin, chặn IDOR tốt. | 1. Chưa kiểm tra trùng tên với các deck khác của cùng user.<br>2. Nếu đổi `targetLanguage` khi bộ thẻ đã có hàng chục từ vựng, dữ liệu từ vựng cũ sẽ bị sai lệch ngữ cảnh. | 1. Kiểm tra tên không trùng với deck khác: `existsByUserIdAndNameIgnoreCaseAndIdNot(userId, name, deckId)`.<br>2. Nếu `totalCards > 0`, đưa ra cảnh báo hoặc khóa đổi cặp ngôn ngữ. |
| `DELETE /api/v1/vocab/decks/{id}` (Xóa bộ thẻ) | Xóa cascade an toàn qua `userFlashcardRepository.deleteByDeckId(deckId)`. | Xử lý tốt, đã chống IDOR. | Giữ nguyên luồng xử lý này. |

---

### 2.4. Tầng Frontend (`vocabApi.ts`, `DeckModal.tsx`, `FlashcardsPage.tsx`)

| File / Thành phần | Hiện trạng | Bất cập & Cơ hội Tối ưu |
| :--- | :--- | :--- |
| [vocabApi.ts](file:///f:/Working/JavaBackend/multilingo-platform/frontend/src/features/vocab/api/vocabApi.ts) | Có hàm `getDeckDetail(deckId)` nhưng chưa dùng. | Chuẩn hóa hàm này để khi người dùng F5 tại trang chi tiết, hệ thống gọi API này nạp dữ liệu độc lập thay vì phụ thuộc mảng `decks` từ trang ngoài. |
| [DeckModal.tsx](file:///f:/Working/JavaBackend/multilingo-platform/frontend/src/features/vocab/components/deck/DeckModal.tsx) | Modal tạo/sửa bộ thẻ: Validate rỗng, maxLength=1000, 2 dropdown ngôn ngữ. | 1. Bổ sung validate tên tối thiểu 2 ký tự, tối đa 200 ký tự.<br>2. Bổ sung cảnh báo nếu `targetLanguage === sourceLanguage`.<br>3. Bổ sung bảng chọn màu sắc (Color Tag) để phân loại danh mục sinh động hơn. |
| [FlashcardsPage.tsx](file:///f:/Working/JavaBackend/multilingo-platform/frontend/src/features/vocab/pages/FlashcardsPage.tsx) | `handleSaveDeck` luôn gọi lại `fetchDecks()`. | Tối ưu: Cập nhật state trực tiếp (chèn deck mới vào đầu danh sách `setDecks([newDeck, ...decks])`), tránh thêm 1 roundtrip network request. |

---

## 3. Bảng Tiến độ Triển khai Refactor (Progress Tracker)

| Giai đoạn (Phase) | Hạng mục công việc | Người phụ trách | Trạng thái |
| :--- | :--- | :--- | :--- |
| **Phase 0: Rà soát & Thiết kế** | Rà soát toàn bộ DTO, API, Entity, DB Index, Frontend Code | AI Agent | ✅ **Hoàn thành (05/11/2026)** |
| | Lập tài liệu Acceptance Criteria (AC) & Ma trận Test Cases 6 khía cạnh | AI Agent | ✅ **Hoàn thành (05/11/2026)** |
| | Lập kế hoạch chi tiết từng bước (Implementation Plan) | AI Agent | ✅ **Hoàn thành (05/11/2026)** |
| **Phase 1: Chuẩn hóa DTO & Validation** | Hợp nhất DTO trùng lặp (`DeckDetailResponse` / `DeckSummaryResponse`) | AI Agent | ⏳ Chờ người dùng duyệt |
| | Thêm validation whitelist mã ngôn ngữ và kiểm tra trùng tên | AI Agent | ⏳ Chờ người dùng duyệt |
| **Phase 2: Nâng cấp Backend Service & Controller** | Cập nhật `createDeck` & `updateDeck` (Chống trùng tên, trả về DTO chuẩn) | AI Agent | ⏳ Chờ người dùng duyệt |
| | Viết Unit Test & Integration Test (TDD Red -> Green) | AI Agent | ⏳ Chờ người dùng duyệt |
| **Phase 3: Tinh gọn Frontend UI & API Client** | Bỏ khối 3 thẻ thống kê trên `DeckListView.tsx` | AI Agent | ⏳ Chờ người dùng duyệt |
| | Nâng cấp form `DeckModal.tsx` (Validation chuẩn, tối ưu update state) | AI Agent | ⏳ Chờ người dùng duyệt |
| **Phase 4: Nghiệm thu & Chạy Test** | Chạy toàn bộ test suite backend `mvn test` và kiểm tra UI | AI Agent | ⏳ Chờ người dùng duyệt |

