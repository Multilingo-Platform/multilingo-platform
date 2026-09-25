# 🔀 Multilingo Platform - Quy Tắc Git & Quy Trình PR

## Nhánh (Branching)
- `main`: Nhánh production, luôn sẵn sàng deploy.
- `develop`: Nhánh tích hợp chính.
- Feature: `feature/UC<Mã>-<tên-ngắn>` (ví dụ: `feature/UC11-dictionary-lookup`).
- Fix: `fix/<mô-tả>` (ví dụ: `fix/cors-origin-issue`).
- Refactor: `refactor/<nội-dung>`.

## Commit Message (Conventional Commits)
- `feat:` Tính năng mới.
- `fix:` Sửa lỗi.
- `test:` Thêm / sửa test.
- `refactor:` Tối ưu mã, không thay đổi chức năng.
- `docs:` Cập nhật tài liệu.
- `chore:` Thay đổi config, dependencies.

## Quy trình Rebase & Đồng bộ Nhánh

### Khi nhánh feature bị lạc hậu so với `develop`
**BẮT BUỘC** dùng `rebase` thay vì `merge` để giữ lịch sử Git sạch sẽ, tuyến tính:

```bash
# 1. Lưu công việc hiện tại
git add . && git stash   # (nếu có uncommitted changes)

# 2. Cập nhật nhánh develop mới nhất
git checkout develop
git pull origin develop

# 3. Quay lại nhánh feature và rebase
git checkout feature/UC11-dictionary-lookup
git rebase develop

# 4. Xử lý conflict (nếu có)
#    - Mở file conflict, sửa thủ công, rồi:
git add <file-đã-resolve>
git rebase --continue
#    - Nếu muốn huỷ rebase:
git rebase --abort

# 5. Force push lên remote (BẮT BUỘC sau rebase)
git push --force-with-lease origin feature/UC11-dictionary-lookup
```

### Quy tắc Force Push
- **CHỈ ĐƯỢC** dùng `git push --force-with-lease` (KHÔNG dùng `--force` thuần).
  - `--force-with-lease` an toàn hơn: Nó sẽ từ chối nếu remote đã có commit mới mà bạn chưa fetch.
- **CHỈ ĐƯỢC** force push trên nhánh feature/fix **CÁ NHÂN** của bạn.
- **TUYỆT ĐỐI KHÔNG** force push lên `main` hoặc `develop`.
- **Thông báo team** trên group chat trước khi force push nếu nhánh feature có nhiều người cùng làm.

### Khi nào rebase, khi nào merge
| Tình huống | Dùng | Lệnh |
| :--- | :--- | :--- |
| Cập nhật nhánh feature từ develop | **Rebase** | `git rebase develop` |
| Merge nhánh feature vào develop (qua PR) | **Merge** (Squash hoặc Merge commit) | Qua GitHub PR UI |
| Merge develop vào main (release) | **Merge** | Qua GitHub PR UI |

## Tiêu chí Merge PR (Definition of Done)
- Code tuân thủ Base Architecture (`BaseEntity`, `ApiResponse<T>`, `AppException`).
- `./mvnw clean test` đạt BUILD SUCCESS (100% tests PASS) trên H2 in-memory.
- `npm run lint && npm run build` đạt 0 errors.
- KHÔNG commit mật khẩu, khóa bí mật, `.idea/`, `target/`, `node_modules/`, `dist/`.
- Ít nhất 1 thành viên khác đã review và Approve.
- Nhánh đã rebase lên `develop` mới nhất (không có merge commit rác).
