# 📡 Đặc Tả Hợp Đồng Giao Diện API (API Contract Specification)
## Phân Hệ: UC012 - Quản Lý Sổ Tay & Bộ Thẻ Từ Vựng

- **Tiêu chuẩn Response Base:** Mọi endpoint đều trả về `ResponseEntity<ApiResponse<T>>`.
- **Cấu trúc JSON chung:**
  ```json
  {
    "success": true,
    "code": 200,
    "message": "Thao tác thành công",
    "data": { ... },
    "timestamp": "2026-10-03T14:30:00Z"
  }
  ```
- **Xác thực Context:** Header `X-User-Id: <id>` (tạm thời cho giai đoạn phát triển trước khi tích hợp JWT filter hoàn chỉnh).

---

## 1. Endpoints Quản Lý Bộ Thẻ (Decks)

### 1.1. Lấy danh sách bộ thẻ kèm thống kê
- **Method:** `GET`
- **Path:** `/api/v1/vocab/decks`
- **Headers:** `X-User-Id: 1`
- **Response HTTP 200 OK:**
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách bộ thẻ thành công",
  "data": [
    {
      "id": 1,
      "name": "IELTS Academic Core",
      "description": "500 từ vựng cốt lõi cho kỳ thi IELTS",
      "isPublic": false,
      "totalCards": 25,
      "newCards": 5,
      "learningCards": 12,
      "masteredCards": 8,
      "dueReviewCards": 7,
      "createdAt": "2026-10-01T08:00:00Z",
      "updatedAt": "2026-10-02T10:30:00Z"
    }
  ],
  "timestamp": "2026-10-03T14:30:00Z"
}
```

### 1.2. Tạo bộ thẻ mới
- **Method:** `POST`
- **Path:** `/api/v1/vocab/decks`
- **Headers:** `Content-Type: application/json`, `X-User-Id: 1`
- **Request Body:**
```json
{
  "name": "TOEIC 800+ Vocabulary",
  "description": "Từ vựng thương mại và văn phòng",
  "isPublic": false
}
```
- **Validation Rules:**
  - `name`: `@NotBlank(message = "Tên bộ thẻ không được để trống")`, `@Size(max = 200, message = "Tên bộ thẻ không được vượt quá 200 ký tự")`
  - `description`: `@Size(max = 2000, message = "Mô tả không được vượt quá 2000 ký tự")`
- **Response HTTP 201 Created:**
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo bộ thẻ thành công",
  "data": {
    "id": 2,
    "userId": 1,
    "name": "TOEIC 800+ Vocabulary",
    "description": "Từ vựng thương mại và văn phòng",
    "isPublic": false,
    "clonesCount": 0,
    "createdAt": "2026-10-03T14:32:00Z",
    "updatedAt": "2026-10-03T14:32:00Z"
  },
  "timestamp": "2026-10-03T14:32:00Z"
}
```

### 1.3. Chi tiết bộ thẻ
- **Method:** `GET`
- **Path:** `/api/v1/vocab/decks/{id}`
- **Headers:** `X-User-Id: 1`
- **Response HTTP 200 OK:**
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy chi tiết bộ thẻ thành công",
  "data": {
    "id": 1,
    "userId": 1,
    "name": "IELTS Academic Core",
    "description": "500 từ vựng cốt lõi cho kỳ thi IELTS",
    "isPublic": false,
    "totalCards": 25,
    "newCards": 5,
    "learningCards": 12,
    "masteredCards": 8,
    "dueReviewCards": 7,
    "createdAt": "2026-10-01T08:00:00Z",
    "updatedAt": "2026-10-02T10:30:00Z"
  },
  "timestamp": "2026-10-03T14:30:00Z"
}
```

### 1.4. Chỉnh sửa thông tin bộ thẻ
- **Method:** `PUT`
- **Path:** `/api/v1/vocab/decks/{id}`
- **Headers:** `Content-Type: application/json`, `X-User-Id: 1`
- **Request Body:**
```json
{
  "name": "IELTS Academic Core (Updated)",
  "description": "Bộ từ vựng cập nhật năm 2026",
  "isPublic": true
}
```
- **Response HTTP 200 OK:** Trả về `DeckResponse` mới nhất.

### 1.5. Xóa bộ thẻ
- **Method:** `DELETE`
- **Path:** `/api/v1/vocab/decks/{id}`
- **Headers:** `X-User-Id: 1`
- **Response HTTP 200 OK:**
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa bộ thẻ thành công",
  "data": null,
  "timestamp": "2026-10-03T14:35:00Z"
}
```

---

## 2. Endpoints Quản Lý Thẻ Từ Vựng (Flashcards)

### 2.1. Lấy danh sách thẻ từ vựng trong bộ thẻ (hỗ trợ tìm kiếm & lọc)
- **Method:** `GET`
- **Path:** `/api/v1/vocab/decks/{deckId}/cards?keyword=&status=`
- **Headers:** `X-User-Id: 1`
- **Query Params:**
  - `keyword` (Optional, string): Tìm kiếm theo từ hoặc nghĩa.
  - `status` (Optional, string): `NEW` | `LEARNING` | `MASTERED` | `ALL`.
- **Response HTTP 200 OK:**
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách thẻ từ vựng thành công",
  "data": [
    {
      "id": 101,
      "deckId": 1,
      "wordId": null,
      "customWord": "Ubiquitous",
      "customMeaning": "Có mặt ở khắp mọi nơi",
      "exampleSentence": "Smartphones have become ubiquitous in modern society.",
      "customImageUrl": "https://example.com/images/ubiquitous.jpg",
      "status": "LEARNING",
      "reviewCount": 3,
      "easeFactor": 2.50,
      "intervalDays": 3,
      "nextReviewDate": "2026-10-04T08:00:00Z",
      "createdAt": "2026-10-01T09:00:00Z",
      "updatedAt": "2026-10-02T11:00:00Z"
    }
  ],
  "timestamp": "2026-10-03T14:36:00Z"
}
```

### 2.2. Thêm thẻ từ vựng vào bộ thẻ
- **Method:** `POST`
- **Path:** `/api/v1/vocab/decks/{deckId}/cards`
- **Headers:** `Content-Type: application/json`, `X-User-Id: 1`
- **Request Body:**
```json
{
  "customWord": "Ephemeral",
  "customMeaning": "Phù du, chóng tàn",
  "exampleSentence": "Fame in the internet age can be quite ephemeral.",
  "customImageUrl": null,
  "wordId": null
}
```
- **Validation Rules:**
  - `customWord`: `@NotBlank(message = "Từ vựng không được để trống")`, `@Size(max = 150)`
  - `customMeaning`: `@NotBlank(message = "Nghĩa từ vựng không được để trống")`
- **Response HTTP 201 Created:**
```json
{
  "success": true,
  "code": 201,
  "message": "Thêm thẻ từ vựng thành công",
  "data": {
    "id": 102,
    "deckId": 1,
    "wordId": null,
    "customWord": "Ephemeral",
    "customMeaning": "Phù du, chóng tàn",
    "exampleSentence": "Fame in the internet age can be quite ephemeral.",
    "customImageUrl": null,
    "status": "NEW",
    "reviewCount": 0,
    "easeFactor": 2.50,
    "intervalDays": 0,
    "nextReviewDate": "2026-10-03T14:37:00Z",
    "createdAt": "2026-10-03T14:37:00Z",
    "updatedAt": "2026-10-03T14:37:00Z"
  },
  "timestamp": "2026-10-03T14:37:00Z"
}
```

### 2.3. Chỉnh sửa thẻ từ vựng
- **Method:** `PUT`
- **Path:** `/api/v1/vocab/cards/{cardId}`
- **Headers:** `Content-Type: application/json`, `X-User-Id: 1`
- **Request Body:**
```json
{
  "customWord": "Ephemeral",
  "customMeaning": "Phù du, tồn tại trong thời gian ngắn ngủi",
  "exampleSentence": "Fashions are ephemeral, changing with every season.",
  "customImageUrl": null
}
```
- **Response HTTP 200 OK:** Trả về `FlashcardResponse` đã cập nhật.

### 2.4. Xóa thẻ từ vựng
- **Method:** `DELETE`
- **Path:** `/api/v1/vocab/cards/{cardId}`
- **Headers:** `X-User-Id: 1`
- **Response HTTP 200 OK:**
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa thẻ từ vựng thành công",
  "data": null,
  "timestamp": "2026-10-03T14:38:00Z"
}
```

---

## 3. Mã Lỗi Chuẩn (Standard Error Responses)

### 3.1. Lỗi Validation (HTTP 422 Unprocessable Entity)
```json
{
  "success": false,
  "code": 422,
  "message": "Dữ liệu đầu vào không hợp lệ",
  "data": {
    "name": "Tên bộ thẻ không được để trống"
  },
  "timestamp": "2026-10-03T14:39:00Z"
}
```

### 3.2. Lỗi Không tìm thấy (HTTP 404 Not Found)
```json
{
  "success": false,
  "code": 404,
  "message": "Không tìm thấy bộ thẻ yêu cầu",
  "data": null,
  "timestamp": "2026-10-03T14:39:00Z"
}
```

### 3.3. Lỗi Không có quyền truy cập / IDOR (HTTP 403 Forbidden)
```json
{
  "success": false,
  "code": 403,
  "message": "Không có quyền thực hiện thao tác trên tài nguyên này",
  "data": null,
  "timestamp": "2026-10-03T14:39:00Z"
}
```

### 3.4. Lỗi Trùng lặp dữ liệu (HTTP 409 Conflict)
```json
{
  "success": false,
  "code": 409,
  "message": "Từ vựng này đã tồn tại trong bộ thẻ",
  "data": null,
  "timestamp": "2026-10-03T14:39:00Z"
}
```
