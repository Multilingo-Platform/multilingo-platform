# Hướng Dẫn Dữ Liệu Kiểm Thử - UC012.2: Ôn Tập Flashcard (SRS)

Thư mục này chứa 2 file JSON chính để phục vụ kiểm thử:
1. [uc12.2-flashcard-study-postman-collection.json](file:///f:/Working/JavaBackend/multilingo-platform/docs/test-data/uc12.2-flashcard-study-postman-collection.json): Bộ sưu tập Postman Collection v2.1 đầy đủ request và mock response (Import trực tiếp vào Postman / Bruno / Insomnia).
2. [uc12.2-flashcard-study-sample-data.json](file:///f:/Working/JavaBackend/multilingo-platform/docs/test-data/uc12.2-flashcard-study-sample-data.json): Dữ liệu mẫu hoàn chỉnh (Bộ thẻ, 5 từ vựng học thuật, câu ví dụ đã che từ `maskedSentence`, payload request và kết quả mong đợi).

---

## 1. Cách 1: Import vào Postman / Bruno
1. Mở Postman hoặc Bruno.
2. Chọn **Import** ➔ Kéo thả file `uc12.2-flashcard-study-postman-collection.json`.
3. Kiểm tra biến môi trường Collection:
   - `baseUrl`: `http://localhost:8088`
   - `userId`: `1`
   - `deckId`: `1`
   - `cardId`: `1`

---

## 2. Cách 2: Chạy trực tiếp bằng cURL (PowerShell / Terminal)

### Bước 1: Khởi tạo phiên ôn tập (Lấy thẻ và câu ví dụ che từ)
```bash
curl -X GET "http://localhost:8088/api/v1/vocab/decks/1/study-session" \
  -H "X-User-Id: 1" \
  -H "Accept: application/json"
```

### Bước 2: Đánh giá thẻ "Đã thuộc" (REMEMBERED)
```bash
curl -X POST "http://localhost:8088/api/v1/vocab/cards/1/review" \
  -H "X-User-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"rating": "REMEMBERED"}'
```

### Bước 3: Đánh giá thẻ "Quên" (FORGOTTEN)
```bash
curl -X POST "http://localhost:8088/api/v1/vocab/cards/1/review" \
  -H "X-User-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"rating": "FORGOTTEN"}'
```

### Bước 4: Hoàn tất phiên học (Cập nhật streak & lưu daily log)
```bash
curl -X POST "http://localhost:8088/api/v1/vocab/decks/1/finish-session" \
  -H "X-User-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "cardsReviewed": 10,
    "cardsRemembered": 8,
    "cardsForgotten": 2,
    "durationSeconds": 150
  }'
```
