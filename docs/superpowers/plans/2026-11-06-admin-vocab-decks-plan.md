# Kế hoạch Thực thi: Quản lý Bộ thẻ Từ vựng (Admin Flashcard Deck Management)

**Mã kế hoạch:** `PLAN-ADMIN-VOCAB-001`  
**Dựa trên tài liệu Spec:** [`docs/superpowers/specs/2026-11-06-admin-vocab-decks-spec.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/2026-11-06-admin-vocab-decks-spec.md)  
**Thời gian ước tính:** ~30-40 phút (chia thành các task nguyên tử 2-5 phút)

---

## Danh sách Task Thực thi Chi tiết

### Phase 1: Backend Architecture & Implementation

- [x] **Task 1: Tạo DTOs cho Admin Deck**
  - File: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/AdminDeckResponse.java`
  - File: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/AdminDeckDetailResponse.java`
  - Gồm các trường: ID, Tên, Mô tả, Ngôn ngữ nguồn/đích, Trạng thái Public, Lượt clone, Tên & Email người tạo, Tổng số thẻ con, Ngày tạo/sửa.

- [x] **Task 2: Bổ sung Query trong FlashcardDeckRepository**
  - File: `backend/src/main/java/com/multilingo/backend/modules/vocab/repository/FlashcardDeckRepository.java`
  - File: `backend/src/main/java/com/multilingo/backend/modules/vocab/repository/UserFlashcardRepository.java`
  - Query hỗ trợ lọc phân trang `Page<FlashcardDeck>` theo `keyword`, `targetLanguage`, `isPublic`.

- [x] **Task 3: Triển khai AdminFlashcardDeckService & ServiceImpl**
  - File: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/AdminFlashcardDeckService.java`
  - File: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/impl/AdminFlashcardDeckServiceImpl.java`
  - Các hàm: `getDecks(...)`, `getDeckDetail(id)`, `createDeck(request, adminId)`, `updateDeck(id, request)`, `togglePublic(id)`, `deleteDeck(id)`, `addCard(deckId, request, adminId)`, `deleteCard(cardId)`.

- [x] **Task 4: Triển khai AdminFlashcardDeckController**
  - File: `backend/src/main/java/com/multilingo/backend/modules/vocab/controller/AdminFlashcardDeckController.java`
  - Endpoint prefix: `/api/v1/admin/vocab/decks`
  - Bảo vệ qua `@PreAuthorize("hasRole('ADMIN')")`.

- [x] **Task 5: Biên dịch Backend & Kiểm chứng DTO / Service**
  - Đã compile thành công với `mvn -f backend/pom.xml compile` (User chỉ định bỏ qua viết unit test để tiết kiệm thời gian).

---

### Phase 2: Frontend Implementation (React + TypeScript)

- [x] **Task 6: Tạo TypeScript Interfaces & API Client**
  - File: `frontend/src/features/admin/vocab/types/adminVocab.types.ts`
  - File: `frontend/src/features/admin/vocab/api/adminVocabApi.ts`
  - Gọi các endpoint backend bằng `axiosClient`.

- [x] **Task 7: Xây dựng các UI Components Quản lý Bộ thẻ**
  - File: `frontend/src/features/admin/vocab/components/AdminDeckFilterBar.tsx` (Thanh tìm kiếm & dropdown lọc ngôn ngữ, trạng thái công khai, nút thêm mới)
  - File: `frontend/src/features/admin/vocab/components/AdminDeckTable.tsx` (Bảng hiển thị kèm phân trang, toggle public, xem/sửa/xóa)
  - File: `frontend/src/features/admin/vocab/components/AdminDeckModal.tsx` (Modal Thêm/Sửa bộ thẻ)
  - File: `frontend/src/features/admin/vocab/components/AdminDeckDetailDrawer.tsx` (Drawer xem chi tiết & quản lý/thêm/xóa từ vựng con)

- [x] **Task 8: Xây dựng Trang AdminVocabDeckPage & Đăng ký Router**
  - File: `frontend/src/features/admin/vocab/pages/AdminVocabDeckPage.tsx`
  - File: `frontend/src/app/router.tsx` (Đăng ký path `/admin/vocab`)
  - File: `frontend/src/components/layout/AdminLayout.tsx` (Thêm mục "Bộ thẻ Từ vựng" kèm icon `BookOpen` vào menu "Nội dung & Gói")

- [x] **Task 9: Bổ sung Đa ngôn ngữ (i18n)**
  - File: `frontend/src/locales/vi/translation.json`
  - File: `frontend/src/locales/en/translation.json`
  - Các key: `adminVocab.*`

---

### Phase 3: Nghiệm thu & Verification

- [x] **Task 10: Chạy kiểm thử toàn diện**
  - Backend: `mvn -f backend/pom.xml compile` thành công (0 errors).
  - Frontend: `npm --prefix frontend run build` (tsc + vite) thành công trong 2.01s (0 errors).
  - Frontend Lint: `npm --prefix frontend run lint` 0 errors.
  - Sẵn sàng trình bày tóm tắt diff thay đổi và xin ý kiến người dùng trước khi commit.

