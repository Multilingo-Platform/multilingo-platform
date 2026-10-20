# Cambridge IELTS 20 Test 1 V2 — Release record

Ngày: 2026-10-19 (Asia/Saigon). Subtask: **CIP-06 — IMPLEMENTED, chờ review**.

## Target và kết quả

| Thuộc tính | Evidence |
|---|---|
| Datasource được cấu hình | `jdbc:postgresql://localhost:5434/multilingodb` |
| Database / schema | `multilingodb` / `public` |
| Server fingerprint | PostgreSQL `16.15`, `172.22.0.3/32:5432` từ server; đây là endpoint nội bộ trả về trên kết nối client port5434, không phải đổi target sang localhost5432 |
| Preflight | JDBC transaction `readOnly=true`, rollback; target code count0 |
| Dataset/version | `cambridge-ielts-20-test-1` / `2` |
| Exam code / DB ID | `IELTS-CAMBRIDGE-20-T1-V2` / **3** |
| State | **DRAFT — is_published=false**; target code count1 sau seed |
| Structure | 3 sections, 9 parts, 19 groups, 82 questions (80 objective + 2 essay), 82 nonblank explanations |
| Duration | 150 phút |
| Canonical SHA-256 | `8c39ae138f78137411d4d9a6adcdb2256590f73bf6c78815ee3a084d08ae2563` |
| Seed process | PID20088, bắt đầu khoảng21:51:45+07:00, verify/đóng context và connection pool21:51:50+07:00, exit0 |

Không publish, tạo/submit attempt hoặc thực thi CIP-07. Không đổi cờ mặc định trong repository, schema/migration, credentials, media hoặc data cũ. Tên plan thực tế là `CAMBRIDGE-IELTS-20-T1-PUBLISH-plan.md`; tên `CAMBRIGE-IELST` trong request được đối chiếu với file này.

## Quy trình đã thực hiện

1. Đọc application.properties và environment hiện hữu; không có datasource override. TCP5434 và JDBC fingerprint xác nhận đúng database/schema. Lấy counts và row fingerprints trong transaction chỉ đọc; không dump essay/answer hoặc credentials.
2. Chạy focused tests của runner/service/runtime bundle trước khi seed. Không phát hiện thiếu version/allowlist; giữ nguyên production code.
3. Khởi chạy **một process Spring Boot/JPA non-web cô lập** từ scratch `DraftSeed.java`, import chính các production `DefaultExamDatasetRunner`, `DefaultExamDatasetService`, `AdminExamServiceImpl`, exam entities và ba repositories. Không component-scan application: không chạy auth/mock seeders, expiration scheduler, AI grading workers hoặc controllers. Đây là bootstrap vận hành tạm, không thay implementation seeding bằng SQL.
4. Dùng đúng bốn cờ process:

```text
EXAM_DEFAULT_DATASET_ENABLED=true
EXAM_DEFAULT_DATASET_KEYS=cambridge-ielts-20-test-1
EXAM_DEFAULT_DATASET_PUBLISH_APPROVED=false
EXAM_MOCK_DATA_ENABLED=false
```

5. `spring.jpa.hibernate.ddl-auto=validate`, `spring.flyway.enabled=false`, SQL body logging tắt để không đổi schema hoặc lộ nội dung. Runner đọc classpath allowlist bundle V2 và gọi service transaction thật. Không dùng direct INSERT/UPDATE/bypass validator. Seed tạo mới một code; publish flag tắt.
6. Sau runner commit, đọc lại bằng repository/admin service và tính `ExamDatasetBundle.digest(detail)`. Assert draft, 3/9/19/82/82, 150 phút và checksum đúng; đóng context bằng try-with-resources.
7. JDBC readonly postflight xác nhận code count1, draft và đối chiếu fingerprints của toàn bộ dữ liệu cũ. Không chạy seed lần hai trên target; kiểm tra idempotency thực tế/publish/rollback thuộc CIP-07.

Scratch scripts, classpath command và logs: `C:/Users/admin/AppData/Local/Temp/cip-06-20261019-214819/` (`TargetPreflight.java`, `DraftSeed.java`, `before-seed.log`, `seed.log`, `after-seed.log`). Classpath lấy bằng `mvnw.cmd dependency:build-classpath`; Java21 chạy bootstrap với `target/classes` và dependency classpath. Không lưu password vào script/release hoặc truyền trên CLI.

## Existing data integrity

Truy vấn PostgreSQL tính fingerprint dạng `md5(string_agg(md5(to_jsonb(row)::text), '' order by id))`, chỉ xuất count/hash. Các bảng exam/section/part loại đúng code V2 mới để so sánh cùng tập rows trước/sau.

| Scope cũ | Count trước = sau | Fingerprint trước = sau |
|---|---:|---|
| Exams ngoài V2 | 2 | `2c6e9de99368b7ac046b15be2081929a` |
| Sections ngoài V2 | 4 | `178fb4301268f88d9f6f39c25080cb47` |
| Parts ngoài V2 | 11 | `a51e75f7a9741e6bdeeb913805114d64` |
| Toàn bộ test_attempts | 54 | `1dc4f1f1cab2ccda11a1e1a2ae2c911c` |
| Toàn bộ attempt_answers | 63 | `d077fead21b031ad897dd0e8251d3f22` |

`Compare-Object` các baseline lines trước/sau: **0 differences**. Hai mã cũ `TOEIC-ETS-2024-T1-V2` (TOEIC_LR) và `TOEIC_MOCK_01` (TOEIC) vẫn published, mỗi đề120 phút. Fingerprint trên là kiểm tra toàn rows DB, không nhầm với canonical SHA-256 của bundle. TOEIC runtime bundle/source giữ nguyên theo filesystem manifest.

## Focused verification

Tại `backend/`:

```powershell
.\mvnw.cmd '-Dtest=DefaultExamDatasetRunnerTest,DefaultExamDatasetServiceTest,CambridgeIeltsDatasetTest' test
```

**10 tests, 0 failures/errors/skipped, BUILD SUCCESS**, 40.797s, kết thúc21:51:26+07:00. Gồm runner3, service5, runtime/source bundle2. Bao phủ runner flags/allowlist, create draft, skip cùng checksum, conflict không overwrite và rollback behavior của service theo tests có sẵn. Không claim Mockito unit tests là PostgreSQL concurrency/transaction integration; seed thật và readonly postflight là target operational evidence.

Lần chạy đầu không discover tests do compiled `ExamBuilderRequest.class` cũ trong target bị `ClassFormatError: Invalid method Code length 0`. Đổi runtime đơn thuần không sửa được; đã giữ các thư mục classes/test-classes cũ trong scratch baseline rồi biên dịch lại từ source bằng Java21, không sửa source/pom hoặc xóa artifact người dùng. Đây không phải behavior RED hay test failure của seeding contract. Không chạy GenerateTemplateTest, full backend/frontend hoặc test profile trên database đích.

## Review gate

- AC-07 / CIP-T08: target tạo draft thành công; cùng-checksum skip/conflict covered by focused tests. Target rerun deferred CIP-07.
- AC-08: draft chưa được publish, chưa xác nhận catalog smoke CIP-07.
- AC-05 / CIP-T09: 54 historical attempts và63 answer rows có fingerprint nguyên vẹn; không sửa snapshot/deadline/answer version.
- AC-10: focused/backend target evidence, git diff checks và filesystem preservation ghi trong handoff. Không claim whole-feature PASS.
- CIP-05 re-FIX lần5 còn chờ independent re-review theo latest handoff; không tự đóng review findings của task đó. Publish chỉ được tiếp tục sau các gate/review phù hợp.
- Không có rollback bằng DELETE. Nếu review yêu cầu điều chỉnh, giữ exam/attempt/snapshot và sử dụng workflow đã duyệt; draft hiện không được catalog public trả về theo contract, chưa chạy browser smoke trong CIP-06.

**Next:** Codex Reviewer review CIP-06 và target evidence. Không commit/push. CIP-07 chưa thực hiện.

## 2026-10-19 — CIP-07 — Published, smoke và rollback verification

**Trạng thái hiện tại: PUBLISHED — IELTS-CAMBRIDGE-20-T1-V2, exam ID3.** CIP-07 IMPLEMENTED, chờ independent review; không tự gán final PASS. Phần draft/CIP-06 phía trên là evidence lịch sử trước publish.

### Publication và catalog thật

- CIP-05 re-review lần5 và CIP-06 đều có latest Reviewer PASS trước thao tác.
- Target vẫn localhost:5434/multilingodb, schema public. Preflight draft catalog count0; 54 attempts/63 answer rows lịch sử có fingerprint khớp CIP-06.
- Đăng nhập bằng auth endpoint thật với tài khoản admin hiện hữu; không tạo user, không sửa role/password hoặc tự dựng JWT. Publish qua `PATCH /api/v1/admin/exams/3/status?isPublished=true` có method-security ADMIN/CONTENT_CREATOR và validator production. Không SQL UPDATE/bypass publication path.
- Catalog `GET /api/v1/student/exams?search=Cambridge&size=100` trả đúng một code `IELTS-CAMBRIDGE-20-T1-V2`, IELTS_ACADEMIC,150 phút, tags Listening/Reading/Writing; không trả V1. Catalog summary không có field partCount; 9 parts được xác minh bằng actual workspace, không giả định DTO có field mới.
- Canonical checksum giữ nguyên `8c39ae138f78137411d4d9a6adcdb2256590f73bf6c78815ee3a084d08ae2563`.

### Browser và attempt smoke thật

- Tạo duy nhất **attempt55**, FULL_EXAM/PRACTICE qua POST API thật dưới JWT hiện hữu; không dùng attempt lịch sử. Workspace sanitized không có correct_answer/correctAnswer/explanation/grading_key. Actual snapshot chứa9 parts/82 questions.
- Chrome/Playwright dùng frontend Vite localhost5173 và backend localhost8088 trên target thật, không mock HTTP hoặc model response. Backend process smoke chỉ tắt unrelated seeders/schedulers/AI workers, giữ auth/controllers/services/JPA thật, ORM validate/Flyway off. Không gọi Gemini thật.
- Viewports **375×900 và1366×900**: Listening, paired controls, cả ba Reading passage, Writing Task1/2, result và review. Có **22 screenshots**. Listening Part1 audio phát thật: readyState4, duration501.318821s, currentTime tăng; sau kiểm tra pause. Đây là một audio UI smoke; coverage media8 asset đầy đủ nằm ở CIP-04 đã review, không mô tả lần này là phát đủ cả4 track.
- Hai ô answer-group Listening Part2 chọn độc lập; focus + Space chọn radio thứ nhất, radio thứ hai giữ selection. Ba Reading passage có nội dung thực >200 ký tự và khác nhau. Task1 structured Cloudinary image naturalWidth>0, editor enabled; Task2 có editor riêng. Không nhập essay để gọi grading thật.
- Submit từ UI qua confirm modal, autosave/submit production và redirect result thành công. Attempt55 kết thúc **COMPLETED**. Review API cả9 parts trả **82 questions/82 nonblank explanations**. Browser review Part1/Task1/Task2 hiện explanation ở hai widths.
- Screenshots workspace/reading/writing đã xem; document không tràn ngang trong smoke assertions. Mobile workspace dùng internal scroll + sidebar hiện có nên một screenshot không hiển thị toàn pane/editor cùng lúc; không redesign layout hoặc claim exhaustive accessibility audit. Đã kiểm tra native focus/Space, chưa chạy human screen reader.

### Seed rerun và rollback thật

- Chạy production DefaultExamDatasetRunner/DefaultExamDatasetService lần hai bằng non-web bootstrap cô lập, allowlist chỉ Cambridge V2, seed=true/mock=false/publish-approved=false. Same checksum skip, vẫn **ID3, published=true, 3/9/19/82/82,150 phút, cùng canonical SHA-256**; không tạo exam thứ hai, không unpublish exam đã publish.
- Unpublish bằng cùng admin endpoint isPublished=false: Cambridge catalog count0. Sau đó gọi result/review và browser review attempt55 vẫn hoạt động, đủ82 explanations.
- Fingerprint toàn row attempt55 trước unpublish/sau unpublish/sau restore đều `a3d774ff68a3b506419d09a15542a6ad` (bao gồm snapshot/status/version/deadline/result). Không xóa exam/attempt/answers.
- Publish lại bằng admin endpoint sau rollback test; **final catalog count1**, state published. Đây là trạng thái bàn giao, không để dataset draft do rollback test.
- So baseline nguyên row trước/sau (loại đúng smoke attempt55 và answers của55): hai TOEIC exams,4 sections,11 parts cũ, **54 historical attempts và63 historical answers**, tất cả **0 fingerprint differences**, hashes khớp bảng CIP-06 phía trên. Hai mã TOEIC vẫn published/120 phút. Auth login/logout có thể tạo audit/session side effects thông thường; không claim toàn bộ database không có thay đổi.

### Verification thực chạy

- Backend focused command theo plan, thêm OfficialCatalogPostgresIT vào cùng lượt; dedicated `OFFICIAL_EXAM_POSTGRES_TEST_URL=jdbc:postgresql://localhost:5434/official_exams_test`: **118 tests,0 failures/errors/skips, BUILD SUCCESS**,1m57s, kết thúc22:06:26+07:00. Bao gồm Cambridge contract6 và writing fake-provider tests; test logs worker không phải live Gemini trên target.
- Frontend command theo plan: CambridgeIeltsWorkspaceContract, OfficialExamWorkspaceContract, ExamContentMapping, ExamBuilderRoundTrip, maxWorkers2: **4 files/8 tests PASS**,13.20s.
- `npx tsc -b --pretty false`: exit0; `npm run build`: exit0, Vite2.02s, existing bundle >500kB advisory.
- `npm run lint`: exit0,57 warnings trong source có sẵn. Task này không đổi production/test source; không sửa lint ngoài phạm vi hoặc claim warning-free.
- git diff --check exit0. Release/handoff append-only; SHA256 manifest xác minh work ngoài hai docs giữ nguyên; staged rỗng/HEAD không đổi. Không chạy full suite/GenerateTemplateTest, không commit/push/rebase.

### Residual issues và cleanup

- **OUT-OF-SCOPE observed:** cuối smoke, POST /api/auth/logout trả500. Đã xóa localStorage token/user và file token tạm, đóng browser; không claim server-side JWT revocation thành công, chưa xác định root cause và không sửa auth/infrastructure trong CIP-07. Cần task auth riêng nếu cần xử lý lỗi logout. Không còn token trong release/handoff hoặc code/log evidence được trình bày.
- First temporary bootstrap thiếu entity scan đúng cho auth; thêm explicit entity scan trong helper ngoài repo rồi application khởi động bằng schema validate. Một script review ban đầu dùng sai field partId thay vì id của result navigation, gây GET404; đã sửa script và xác minh đủ82. Hai lỗi harness này không được claim là production defects/behavior RED.
- Browser storage/token file đã dọn; process backend8088, frontend5173, one-shot localhost5199 và browser session cip07 đã dừng. Không bật seed/publish flags trong repository; chỉ code V2 được publish bằng API.
- Artifacts: `C:/Users/admin/AppData/Local/Temp/cip-07-20261019-220408/` giữ manifests, before/rollback/final readonly hashes, server/test/browser logs, scripts và22 screenshots. CLI artifacts tạo bởi task đã chuyển khỏi repo vào thư mục này sau khi xác minh đường dẫn/timestamps. Private auth file đã xóa; scripts không hardcode JWT/password.

**Next action:** Codex Reviewer review CIP-07 và evidence toàn feature. AC-07 seed/idempotency, AC-08 publication/catalog, AC-09 browser media và AC-10 focused verification có evidence trong các gate; không tự gán final feature PASS. Dừng để review; không commit/push.
