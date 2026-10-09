# TV3-04-03 — Regression và bàn giao

> **Cho Gemini Executor:** Đọc kế hoạch cha và thực hiện tuần tự. Không sửa production code/test, không commit, push, rebase, stage hoặc chuyển nhánh.

**Goal:** Xác minh toàn bộ TV3-04, bảo đảm không ảnh hưởng Admin Exam API hay thay đổi TV3-03, sau đó ghi bằng chứng bàn giao append-only.

**Architecture:** Không thay đổi API, DTO, database hoặc frontend. Chỉ chạy regression tập trung, kiểm tra phạm vi diff và cập nhật handoff.

**Tech Stack:** Java 21, Spring Boot 3.3.4, Maven Wrapper, JUnit 5, Mockito, MockMvc, PowerShell.

**Spec:** `docs/superpowers/plans/ndt/TV3-04-plan.md`

## 1. Trạng thái lưu và kết quả khảo sát

- Nhánh hiện tại: `feature/TV3-00-contract-audit`.
- Sáu file TV3-04 đã có nhưng đang untracked.
- Các thay đổi TV3-03 đang tồn tại phải được giữ nguyên.
- Bộ regression kết hợp đã chạy: **14 tests, 0 failure, 0 error, BUILD SUCCESS**.
- `git diff --check` pass.
- Sáu file untracked không có whitespace error khi kiểm tra riêng.
- Cảnh báo MapStruct, unchecked operation, Redis repository detection và dynamic Java agent là baseline, không phải regression.
- Nhận xét P2 về kiểm tra sensitive fields lồng nhau là follow-up không chặn TV3-04-03.

## 2. API, phạm vi và ma trận file

Không thêm hoặc thay đổi public API. Regression phải giữ nguyên:

```http
GET /api/v1/exams/{id}/structure
```

| Nhóm | File | Hành động |
|---|---|---|
| Kế hoạch | `docs/superpowers/plans/ndt/TV3-04-03-plan.md` | Tạo từ nội dung kế hoạch này |
| Handoff | `docs/superpowers/plans/ndt/TV3-04-03-handoff.md` | Khởi tạo `PLANNED`, sau đó chỉ append |
| TV3-04 | `backend/src/main/java/com/multilingo/backend/modules/testing/controller/LearnerExamStructureController.java` | Chỉ kiểm tra |
| TV3-04 | `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/LearnerExamStructureResponse.java` | Chỉ kiểm tra |
| TV3-04 | `backend/src/main/java/com/multilingo/backend/modules/testing/service/LearnerExamStructureService.java` | Chỉ kiểm tra |
| TV3-04 | `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/LearnerExamStructureServiceImpl.java` | Chỉ kiểm tra |
| TV3-04 test | `backend/src/test/java/com/multilingo/backend/modules/testing/controller/LearnerExamStructureControllerIT.java` | Chạy, không sửa |
| TV3-04 test | `backend/src/test/java/com/multilingo/backend/modules/testing/service/LearnerExamStructureServiceTest.java` | Chạy, không sửa |
| Regression | `backend/src/test/java/com/multilingo/backend/modules/exam/controller/AdminExamControllerTest.java` | Chạy, không sửa |
| TV3-03 | `WorkspaceResponse.java`, `TestAttemptServiceImpl.java`, `TestAttemptWorkspaceResponseTest.java`, `TV3-03-review.patch` | Giữ nguyên tuyệt đối |

Không sửa frontend, entity, repository, migration, `pom.xml`, security config, error contract hoặc kế hoạch cha.

## 3. Các subtask thực thi

### TV3-04-03-01 — Chốt baseline và quyền sở hữu file

**Mục tiêu:** Ghi nhận chính xác worktree trước regression.

**Các bước:**
1. Đọc `GEMINI.md`, `TV3-04-plan.md` và `TV3-04-handoff.md`.
2. Chạy:
```powershell
git branch --show-current
git status --short
git diff --name-only
git ls-files --others --exclude-standard
```
3. Phân loại:
- TV3-04: đúng sáu file code/test trong ma trận.
- TV3-03: hai file tracked modified, một test untracked và patch review.
- Tài liệu: kế hoạch/handoff cha và hai tài liệu TV3-04-03.
- Bất kỳ file ứng dụng nào khác xuất hiện sau khi bắt đầu là thay đổi ngoài phạm vi.

**Acceptance criteria:**
- Vẫn ở nhánh `feature/TV3-00-contract-audit`.
- Không reset, checkout, stash, stage hoặc sửa file.
- Baseline được giữ để so sánh sau regression.

**Stop condition:** Nếu thiếu một trong sáu file TV3-04 hoặc trạng thái có thay đổi không xác định, append `BLOCKED` vào handoff và dừng.

---

### TV3-04-03-02 — Chạy regression tập trung

**Mục tiêu:** Xác minh service, HTTP/security contract và Admin Exam API trong cùng một Maven run.

**Lệnh:**
```powershell
cd backend
.\mvnw.cmd "-Dtest=LearnerExamStructureServiceTest,LearnerExamStructureControllerIT,AdminExamControllerTest" test
```

**Kết quả bắt buộc:**
- `LearnerExamStructureServiceTest`: 4 pass.
- `LearnerExamStructureControllerIT`: 4 pass.
- `AdminExamControllerTest`: 6 pass.
- Tổng: `Tests run: 14, Failures: 0, Errors: 0, Skipped: 0`.
- Maven: `BUILD SUCCESS`.

**Các hành vi được regression bảo vệ:**
- Published exam, kể cả VIP, trả cấu trúc có ID và thứ tự thật.
- Missing/unpublished exam trả `EXAM_NOT_FOUND`.
- Anonymous request trả 403 và không gọi service.
- Response không lộ question, answer, grading hoặc `contentData`.
- Admin create/update/delete/import vẫn hoạt động.

**Stop condition:** Nếu test fail, không sửa code trong subtask này. Append `NEED_FIX` với test class, test method, lỗi đầu tiên và command đã chạy.

---

### TV3-04-03-03 — Kiểm tra diff, whitespace và phạm vi

**Mục tiêu:** Chứng minh regression không làm thay đổi repository và kiểm tra được cả file untracked.

**Kiểm tra tracked diff:**
```powershell
cd ..
git diff --check
git status --short
```

**Kiểm tra sáu file TV3-04 untracked:**
```powershell
$tv304Files = @(
  'backend/src/main/java/com/multilingo/backend/modules/testing/controller/LearnerExamStructureController.java',
  'backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/LearnerExamStructureResponse.java',
  'backend/src/main/java/com/multilingo/backend/modules/testing/service/LearnerExamStructureService.java',
  'backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/LearnerExamStructureServiceImpl.java',
  'backend/src/test/java/com/multilingo/backend/modules/testing/controller/LearnerExamStructureControllerIT.java',
  'backend/src/test/java/com/multilingo/backend/modules/testing/service/LearnerExamStructureServiceTest.java'
)

$whitespaceIssues = @()
foreach ($file in $tv304Files) {
  $result = git -c core.autocrlf=false diff --no-index --check -- NUL $file 2>&1
  if ($result) {
    $whitespaceIssues += "${file}: $result"
  }
}
$whitespaceIssues
"whitespace_issue_count=$($whitespaceIssues.Count)"
```

**Acceptance criteria:**
- `git diff --check` không có lỗi.
- `whitespace_issue_count=0`.
- Không có migration, dependency, frontend, entity hoặc repository diff.
- Không thay đổi các file TV3-03.
- Không có file ứng dụng mới ngoài sáu file TV3-04 đã biết.

---

### TV3-04-03-04 — Bàn giao append-only

**Mục tiêu:** Ghi lại bằng chứng đầy đủ để Codex Reviewer kiểm tra độc lập.

Append một entry vào `TV3-04-03-handoff.md`:
- `PASS` nếu toàn bộ acceptance criteria đạt.
- `NEED_FIX` nếu test hoặc contract regression fail.
- `BLOCKED` nếu thiếu file, sai nhánh hoặc không thể phân biệt thay đổi ngoài phạm vi.

Entry phải chứa:
- Agent role và thời gian.
- Task ID `TV3-04-03`.
- Trạng thái.
- Command regression chính xác.
- Số test theo từng class và tổng.
- Kết quả `BUILD SUCCESS` hoặc lỗi đầu tiên.
- Kết quả tracked/untracked whitespace check.
- Tóm tắt `git status --short`.
- Xác nhận không sửa TV3-03, frontend, DB, dependency hoặc API.
- Cảnh báo baseline nếu xuất hiện.
- Next action: Codex Reviewer kiểm tra độc lập.

**Acceptance criteria:**
- Không ghi đè lịch sử handoff.
- Không tuyên bố full suite pass.
- Không tuyên bố P2 whitelist test-hardening đã được xử lý.
- Không commit hoặc push.

## 4. Test matrix và Definition of Done

| Test ID | Kịch bản | Kết quả |
|---|---|---|
| `TC_TV304_REG_01` | Service regression | 4/4 pass |
| `TC_TV304_REG_02` | HTTP, auth và serialization regression | 4/4 pass |
| `TC_TV304_REG_03` | Admin API regression | 6/6 pass |
| `TC_TV304_REG_04` | Combined Maven execution | 14/14 pass, BUILD SUCCESS |
| `TC_TV304_REG_05` | Tracked whitespace | `git diff --check` sạch |
| `TC_TV304_REG_06` | Untracked TV3-04 whitespace | `whitespace_issue_count=0` |
| `TC_TV304_REG_07` | Existing-work protection | TV3-03 và thay đổi người dùng được giữ nguyên |
| `TC_TV304_REG_08` | Append-only handoff | Có entry đầy đủ, không mất lịch sử |

Hoàn thành khi:
- Tất cả 14 test pass trong một lần chạy.
- Không có whitespace hoặc scope violation.
- Handoff có bằng chứng kiểm chứng.
- Không có production/test implementation mới.
- Không commit, push, rebase hoặc chạy full suite.
