# Xác minh playback TOEIC ETS 2024 Test 1

**Ngày:** 2026-10-18T19:58:09+07:00  
**Dataset/profile:** `TOEIC-ETS-2024-T1-V2` / `toeic-listening-media-profile.json`  
**Quyền sử dụng:** `OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17`.

## Phương pháp

1. Tải bốn URL `shared_audio` Part 1–4 vào thư mục tạm ngoài repository, không thêm MP3 vào Git.
2. Ghi HTTP status, MIME, ETag, Content-Length, kích thước thực và SHA-256.
3. Dùng Chromium thật với `audio.crossOrigin = 'anonymous'`, `loadedmetadata`, seek và muted playback ngắn. `fetch(..., { mode: 'cors' })` cũng trả 200/audio-mpeg ở cả bốn asset. Điều này xác nhận endpoint cho phép CORS anonymous; deployment vẫn cần bảo đảm CSP không chặn Cloudinary.
4. Đối chiếu URL trong profile với `shared_audio` của Part 1–4 trong bundle canonical; duration/order khớp phân bố Listening `6/25/39/30`. Không thêm transcript hoặc khẳng định nội dung lời thoại không có trong nguồn.

## Kết quả

| Part | HTTP/MIME | ETag | Bytes | SHA-256 | `loadedmetadata` | Seek/play kỹ thuật |
|---|---|---|---:|---|---:|---|
| 1 | 200 / `audio/mpeg` | `"f495717bad8dd57e6b9f67ffa901eaac"` | 2,836,938 | `00fbaecc34e0087130e7b30e99971da86a06ab97557b829d4fc468b10799a86c` | 173,505 ms | PASS |
| 2 | 200 / `audio/mpeg` | `"a21e2beac383ae0408ec35dc359d5848"` | 8,634,489 | `3afbb86bf3d755342f3a7af896e03119d2723a73247c5220b44120dc957dbd36` | 536,686 ms | PASS |
| 3 | 200 / `audio/mpeg` | `"3d5dc379bec1f79fa9e850a5de44288b"` | 17,720,085 | `85263e93fb28c08c1a7fed26eb3ee9175d3d28957d5f4d539f9fc9c59ffd532e` | 1,105,842 ms | PASS |
| 4 | 200 / `audio/mpeg` | `"3ef3232fb11f652f41a286927ca47d0a"` | 13,415,811 | `f3489941917da4850ec140fc9ad3bcb0a637c7c30034306fad09b18a44f7e171` | 836,206 ms | PASS |

Offsets là `0`, `173505`, `710191`, `1816033`; tổng duration là `2652239` ms. `metadataSha256` tính bằng Jackson sau khi bỏ riêng `verification.metadataSha256`, sắp key object đệ quy, giữ thứ tự array, rồi SHA-256: `b8858d8ef53ffd2c9033c8b15bf9fef906f7e2e0cfd5acdd08d95ad14cd5a64a`.

## Phạm vi và rủi ro còn lại

- Đây là xác minh kỹ thuật availability, media type, CORS anonymous, duration/seek/play và binding bundle/profile; không thay thế kiểm duyệt toàn bộ lời thoại hoặc DRM.
- Profile runtime fail closed nếu URL, hash, metadata checksum hoặc snapshot binding không khớp.
- Không có MP3, token hoặc response body nào được lưu vào repository.
