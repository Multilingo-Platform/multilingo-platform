# Cambridge IELTS 20 Test 1 V2 — Source audit và provenance

**Ngày audit:** 2026-10-19

**Trạng thái:** CIP-01 PASS (source audit, chưa publish)
**Phạm vi:** Chỉ audit workbook nguồn, tạo fixture byte-copy và khóa provenance. Không sửa parser, registry, bundle, database, endpoint hay workbook gốc.

## 1. Nguồn và fixture bất biến

| Trường | Giá trị |
|---|---|
| Workbook nguồn | `backend/Cambridge_Ielts_20_Test_1_(Full_giải_thích).xlsx` |
| SHA-256 nguồn | `d00af9a50c325b85d22cbdcdc2a8205a42da0d2bbe0587985e53575fb4ce549d` |
| Kích thước nguồn | 43.386 byte |
| Fixture test | `backend/src/test/resources/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx` |
| SHA-256 fixture | `d00af9a50c325b85d22cbdcdc2a8205a42da0d2bbe0587985e53575fb4ce549d` |
| Kích thước fixture | 43.386 byte |
| Byte diff | 0 |
| Workbook gốc bị sửa | Không |

Fixture được tạo bằng byte-copy từ nguồn, không mở/ghi lại bằng Excel. Test `CambridgeIeltsFullSourceAuditTest` khóa checksum, kích thước và từ chối một mutation một byte. Khi nguồn đổi checksum, phải audit lại và tạo version/profile mới có chủ đích; không cập nhật constant để test tiếp tục pass.

## 2. Hình dạng workbook

Workbook có 3 sheet:

| Sheet | Vai trò |
|---|---|
| `Thông Tin Đề Thi` | Metadata đề |
| `Exam Template` | 20 cột dữ liệu, 82 hàng câu hỏi |
| `Hướng dẫn điền Form` | Hướng dẫn soạn thảo, không phải dữ liệu đề |

Metadata nguồn:

| Khóa | Giá trị |
|---|---|
| Tên đề thi | `Cambridge Ielts 20 Test 1 (Full giải thích)` |
| Mã loại chứng chỉ | `IELTS_ACADEMIC` |
| Tổng số phần thi (Parts) | `9` |
| Tổng số câu hỏi (Questions) | `82` |

`Exam Template` có header đúng 20 cột theo thứ tự:

`Phần (Part)`, `Hướng dẫn chung (Phần)`, `Nhóm (Group)`, `Loại câu hỏi (Type)`, `Hướng dẫn riêng (Nhóm)`, `Nội dung nhóm (Văn bản đọc/nghe)`, `Câu hỏi (Question Text)`, `Lựa chọn A`–`Lựa chọn H`, `Đáp án đúng`, `Giải thích`, `Audio/File chung (Phần)`, `Đính kèm chung (Nhóm)`, `Đính kèm riêng (Câu hỏi)`.

### 2.1. Số lượng đã khóa

| Chỉ số | Giá trị |
|---|---:|
| Part | 9 |
| Group | 19 |
| Hàng câu hỏi | 82 (hàng 2–83, liên tục) |
| Câu objective | 80 |
| Writing essay | 2 |
| Explanation nonblank | 82/82 |
| Answer key nonblank | 80/80 objective |
| Answer group hai ô | 5 nhóm / 10 hàng |
| Audio URL | 4 |
| Image URL | 4 |
| Tổng media URL duy nhất | 8 |
| Merged region | 89 |

Phân bố source type:

| Source type | Số câu |
|---|---:|
| `FILL_IN_THE_BLANK` | 30 |
| `MULTIPLE_CHOICE` | 14 |
| `MULTIPLE_CHOICE_MULTI` | 10 |
| `MATCHING_FEATURES` | 10 |
| `TRUE_FALSE_NOT_GIVEN` | 6 |
| `MATCHING_INFORMATION` | 5 |
| `YES_NO_NOT_GIVEN` | 5 |
| `WRITING_ESSAY` | 2 |

Không có formula hoặc error cell. Các hàng 2–83 đều có prompt, type, part và group scope; thiếu một hàng sẽ làm test số lượng và mapping ID thất bại.

## 3. Canonical ID và thứ tự

Quy tắc mapping của nguồn mới:

- Listening Part 1–4: `l_001`–`l_040`.
- Reading Passage 1/2/3: `r_001`–`r_040`, theo đúng thứ tự Passage 1 → 2 → 3 trong nguồn mới.
- Writing Task 1/2: `w_001`, `w_002`.
- ID lấy từ part + thứ tự hàng trong workbook, không suy từ tên file, media hay prompt text.
- Reading prompt number trong nguồn đã chạy liên tục 1–40; mapping canonical vẫn dùng ID `r_001`–`r_040`.

### 3.1. Bảng row nguồn → group → canonical ID

| Part | Group | Hàng nguồn | Số câu | Canonical ID |
|---:|---|---:|---:|---|
| 1 | Group 1 | 2–11 | 10 | `l_001`–`l_010` |
| 2 | Group 1 | 12–17 | 6 | `l_011`–`l_016` |
| 2 | Group 2 | 18–19 | 2 | `l_017`–`l_018` |
| 2 | Group 3 | 20–21 | 2 | `l_019`–`l_020` |
| 3 | Group 1 | 22–23 | 2 | `l_021`–`l_022` |
| 3 | Group 2 | 24–25 | 2 | `l_023`–`l_024` |
| 3 | Group 3 | 26–27 | 2 | `l_025`–`l_026` |
| 3 | Group 4 | 28–31 | 4 | `l_027`–`l_030` |
| 4 | Group 1 | 32–41 | 10 | `l_031`–`l_040` |
| 5 | Group 1 | 42–47 | 6 | `r_001`–`r_006` |
| 5 | Group 2 | 48–54 | 7 | `r_007`–`r_013` |
| 6 | Group 1 | 55–59 | 5 | `r_014`–`r_018` |
| 6 | Group 2 | 60–64 | 5 | `r_019`–`r_023` |
| 6 | Group 3 | 65–67 | 3 | `r_024`–`r_026` |
| 7 | Group 1 | 68–71 | 4 | `r_027`–`r_030` |
| 7 | Group 2 | 72–76 | 5 | `r_031`–`r_035` |
| 7 | Group 3 | 77–81 | 5 | `r_036`–`r_040` |
| 8 | Group 1 | 82 | 1 | `w_001` |
| 9 | Group 1 | 83 | 1 | `w_002` |

Phụ lục A liệt kê đủ 82 hàng. Bảng chính giữ mapping theo group để dễ đối chiếu với merge region.

## 4. Đối chiếu Reading với nguồn cũ

Nguồn cũ `backend/src/test/resources/datasets/official-source/cambridge-ielts-20-test-1.xlsx` có SHA-256 `1427bd88ff54e59d695bc2b3b02bfbe301e0658a3a76b79bfb3f650461402ee1`, 30.254 byte, 0 explanation và thứ tự Reading là Passage 3 → 1 → 2. Nguồn mới đã có đủ explanation và đổi sang thứ tự tự nhiên Passage 1 → 2 → 3.

| Canonical | Nguồn mới | Passage | Nguồn cũ | Thay đổi provenance |
|---|---|---|---|---|
| Reading Passage 1 | Part 5, hàng 42–54, `r_001`–`r_013` | The kākāpō | Part 6, hàng 56–68 | Chuyển lên đầu Reading; giữ nội dung passage |
| Reading Passage 2 | Part 6, hàng 55–67, `r_014`–`r_026` | Bring elms to Britain | Part 7, hàng 69–81 | Chuyển lên trước Passage 3; giữ nội dung passage |
| Reading Passage 3 | Part 7, hàng 68–81, `r_027`–`r_040` | How stress affects our judgement | Part 5, hàng 42–55 | Chuyển xuống cuối Reading; giữ nội dung passage |

Phương pháp đối chiếu: lấy context HTML tại `F42`, `F55`, `F68` của nguồn mới; strip HTML, unescape entity, chuẩn hóa khoảng trắng; so với context cũ tại `F56`, `F69`, `F42`; loại chuỗi quảng cáo bị chèn và chuẩn hóa dấu `ä/ö` về `ā/ō` chỉ để so sánh nội dung.

Kết quả:

- `Bring elms to Britain`: khớp chính xác sau khi loại chuỗi chèn.
- `How stress affects our judgement`: khớp chính xác sau khi loại chuỗi chèn.
- `The kākāpō`: cùng passage; còn khác biệt dấu/khoảng trắng rất nhỏ sau chuẩn hóa (SequenceMatcher ratio 0,9984). Nguồn mới dùng macron nhất quán `kākāpō`; không đổi nội dung kể chuyện.

Nguồn mới không còn chuỗi `dongan.signs` hoặc đoạn quảng cáo `nhận chấm 35k`; nguồn cũ có chuỗi này tại 7 ô. Đây là thay đổi đã nằm trong workbook nguồn mới, không phải correction runtime. Vì vậy correction Elms cũ chỉ được áp dụng cho hash nguồn cũ; hash mới không được dùng correction ngầm.

Media của Reading cũng đi theo thứ tự mới: ảnh Kākāpō từ `F62` cũ chuyển thành `F48` mới với cùng URL; audio Listening giữ nguyên hàng.

## 5. Năm answer group hai ô

| Nhóm | Hàng nguồn | Canonical ID | Part / Group | Answer set | Pair id dự kiến |
|---|---:|---|---|---|---|
| 1 | 18–19 | `l_017`, `l_018` | Part 2 / Group 2 | `A,E` | `listening-17-18` |
| 2 | 20–21 | `l_019`, `l_020` | Part 2 / Group 3 | `C,E` | `listening-19-20` |
| 3 | 22–23 | `l_021`, `l_022` | Part 3 / Group 1 | `C,E` | `listening-21-22` |
| 4 | 24–25 | `l_023`, `l_024` | Part 3 / Group 2 | `A,C` | `listening-23-24` |
| 5 | 26–27 | `l_025`, `l_026` | Part 3 / Group 3 | `A,B` | `listening-25-26` |

Mỗi nhóm có đúng 2 hàng liên tiếp, cùng answer set, hai ID khác nhau và không có nhóm trùng. Hai thành viên phải dùng cùng metadata `DISTINCT_UNORDERED`; evaluator không được cộng hai lần nếu người học chọn cùng một đáp án cho cả hai ô. Việc chuyển source type sang canonical type thuộc CIP-02.

## 6. Media inventory

| Hàng | Cột | Scope | Loại | URL |
|---:|---|---|---|---|
| 2 | F | Part 1 / Group 1 | Image | `https://res.cloudinary.com/j5on4xwq/image/upload/v1792136948/mgadgw3of8p2ewo17yr0.png` |
| 2 | R | Part 1 | Audio | `https://res.cloudinary.com/j5on4xwq/video/upload/v1792136936/fbkdrjpbwxqwitisgf5v.m4a` |
| 12 | R | Part 2 | Audio | `https://res.cloudinary.com/j5on4xwq/video/upload/v1792137047/jqfiajpxuejrdlreoa82.m4a` |
| 22 | R | Part 3 | Audio | `https://res.cloudinary.com/j5on4xwq/video/upload/v1792137056/u2hfekgnnnmd6ie8d6sp.m4a` |
| 32 | F | Part 4 / Group 1 | Image | `https://res.cloudinary.com/j5on4xwq/image/upload/v1792137144/wb1j4dchqkdokxa8ljgc.png` |
| 32 | R | Part 4 | Audio | `https://res.cloudinary.com/j5on4xwq/video/upload/v1792137116/mrxqow1dufmmh2t2mkq4.m4a` |
| 48 | F | Part 5 / Group 2 | Image | `https://res.cloudinary.com/j5on4xwq/image/upload/v1792137358/eswgy2vrwfji29su3q80.png` |
| 82 | F | Part 8 / Group 1 | Image | `https://res.cloudinary.com/j5on4xwq/image/upload/v1792140708/wp6bfysbo8ulybsgl8i4.png` |

- 4 audio URL và 4 image URL, tất cả duy nhất, cùng host Cloudinary hiện có.
- Cột `S` (group attachment) và `T` (question attachment) trống; 4 ảnh nằm trong HTML context `F`. CIP-02 phải tách `<img>` thành structured media thay vì giữ HTML trong prompt.
- Ảnh Writing Task 1 nằm tại `F82`; không nhúng vào prompt text sau canonical hóa.
- Chưa kiểm tra HTTP status, MIME, kích thước, SHA-256 binary, CORS, playback/render hoặc quyền sử dụng. Các bước đó thuộc CIP-04; không được ghi `VERIFIED` trước audit thật.

## 7. Explanation và Writing

- Cả 82 hàng có explanation nonblank.
- 80 câu objective có answer key; 2 Writing essay không có answer key.
- Explanation Writing tại `Q82` và `Q83` là hướng dẫn đạt điểm (`[EN]`/`[VI]`), không phải model answer, không phải điểm đã chấm và không phải đáp án chuẩn.
- Explanation Writing là dữ liệu review/guidance; không đưa vào prompt gửi AI grading. Việc tách prompt grading thuộc CIP-02/CIP-05.
- Không sinh hoặc suy đoán thêm nội dung explanation.

## 8. Merged cells và boundary

Có 89 merged region, tất cả là single-column:

| Scope | Cột | Số region | Ghi chú |
|---|---|---:|---|
| Part | A, B | 7 mỗi cột | Part 1–7; Part 8/9 chỉ 1 hàng nên không merge |
| Part audio | R | 7 | Part 1–7 |
| Group | C, E, F, S | 17 mỗi cột | 17 group nhiều hàng; 2 group Writing 1 hàng nên không merge |

Mỗi merge bắt đầu đúng hàng đầu scope và kết thúc đúng hàng cuối scope; không merge nào cắt qua part hoặc group boundary. Test quét toàn bộ 89 region, không chỉ các region mẫu. Các group Reading có context lặp lại theo group (Elms/Stress) hoặc ảnh tại group 2 (Kākāpō); CIP-02 phải gom context/media theo part/group đúng contract, không coi việc lặp là media duplicate.

## 9. Test evidence

Test class: `backend/src/test/java/com/multilingo/backend/modules/exam/service/CambridgeIeltsFullSourceAuditTest.java`.

| Test | Nội dung khóa |
|---|---|
| `fixtureIsAnImmutableByteCopyWithApprovedChecksum` | Kích thước, SHA-256 và mutation một byte bị từ chối |
| `workbookHasApprovedSheetsHeadersAndMetadata` | 3 sheet, 20 header, metadata, không formula/error cell |
| `questionRowsAreContiguousAndMatchApprovedCounts` | 82 hàng liên tục, 9 part/19 group, 80 objective/2 essay/82 explanation, type counts |
| `canonicalIdsFollowTheNewReadingOrder` | `l_001..l_040`, `r_001..r_040`, `w_001..w_002`; Reading Passage 1/2/3 đúng hàng và title |
| `fiveAnswerGroupsAreDistinctAndConsistent` | 5 nhóm duy nhất, mỗi nhóm 2 hàng, cùng answer set, đúng ID/answer set |
| `everyObjectiveAnswerIsWithinDeclaredOptions` | Answer nằm trong option ID/text; pair có đúng 2 đáp án khác nhau |
| `mergedRegionsStayInsidePartAndGroupBoundaries` | 89 merge region, đúng scope/boundary part và group |
| `unicodeMediaAndSourceContentAreUnchanged` | Unicode tiếng Việt/macron, không còn text chèn, 4 audio + 4 image duy nhất |
| `writingExplanationsAreGuidanceNotModelAnswers` | Writing không có answer key; explanation là guidance, không phải model answer |

Lệnh đã chạy:

~~~powershell
.\mvnw.cmd '-Dtest=CambridgeIeltsFullSourceAuditTest,OfficialExamWorkbookAuditTest' test
~~~

Kết quả thực tế:

- `CambridgeIeltsFullSourceAuditTest`: `Tests run: 9, Failures: 0, Errors: 0, Skipped: 0`.
- `OfficialExamWorkbookAuditTest`: `Tests run: 5, Failures: 0, Errors: 0, Skipped: 0`.
- Tổng: `Tests run: 14, Failures: 0, Errors: 0, Skipped: 0`; `BUILD SUCCESS`.

Test đọc fixture trực tiếp, không dùng mạng, không gọi CDN, không kết nối database và không chạy parser V2. Việc `OfficialExamWorkbookAuditTest` vẫn PASS xác nhận fixture Cambridge cũ và TOEIC cũ không bị thay đổi.

## 10. Giới hạn và bước tiếp theo

- CIP-01 không chứng minh đáp án đúng về mặt ngôn ngữ, quyền sử dụng nội dung/media, hay khả năng tải media.
- CIP-01 không seed, không publish, không tạo bundle và không sửa attempt lịch sử.
- Nguồn cũ vẫn giữ correction Elms riêng; nguồn mới không được áp correction cũ. CIP-02 phải dispatch theo hash/metadata và dùng natural Reading order.
- CIP-02 phải chuẩn hóa pair, options/answer, explanation Writing và structured media theo AC-02–AC-04.
- CIP-04 phải kiểm tra 8 media thật và ghi BLOCKED nếu không đo được; không fake checksum.
- Không chạy `GenerateTemplateTest` vì test này ghi workbook.

## Phụ lục A — Mapping đầy đủ 82 hàng

| Hàng | Canonical ID | Part | Group | Source type |
|---:|---|---:|---|---|
| 2 | `l_001` | 1 | Group 1 | `FILL_IN_THE_BLANK` |
| 3 | `l_002` | 1 | Group 1 | `FILL_IN_THE_BLANK` |
| 4 | `l_003` | 1 | Group 1 | `FILL_IN_THE_BLANK` |
| 5 | `l_004` | 1 | Group 1 | `FILL_IN_THE_BLANK` |
| 6 | `l_005` | 1 | Group 1 | `FILL_IN_THE_BLANK` |
| 7 | `l_006` | 1 | Group 1 | `FILL_IN_THE_BLANK` |
| 8 | `l_007` | 1 | Group 1 | `FILL_IN_THE_BLANK` |
| 9 | `l_008` | 1 | Group 1 | `FILL_IN_THE_BLANK` |
| 10 | `l_009` | 1 | Group 1 | `FILL_IN_THE_BLANK` |
| 11 | `l_010` | 1 | Group 1 | `FILL_IN_THE_BLANK` |
| 12 | `l_011` | 2 | Group 1 | `MULTIPLE_CHOICE` |
| 13 | `l_012` | 2 | Group 1 | `MULTIPLE_CHOICE` |
| 14 | `l_013` | 2 | Group 1 | `MULTIPLE_CHOICE` |
| 15 | `l_014` | 2 | Group 1 | `MULTIPLE_CHOICE` |
| 16 | `l_015` | 2 | Group 1 | `MULTIPLE_CHOICE` |
| 17 | `l_016` | 2 | Group 1 | `MULTIPLE_CHOICE` |
| 18 | `l_017` | 2 | Group 2 | `MULTIPLE_CHOICE_MULTI` |
| 19 | `l_018` | 2 | Group 2 | `MULTIPLE_CHOICE_MULTI` |
| 20 | `l_019` | 2 | Group 3 | `MULTIPLE_CHOICE_MULTI` |
| 21 | `l_020` | 2 | Group 3 | `MULTIPLE_CHOICE_MULTI` |
| 22 | `l_021` | 3 | Group 1 | `MULTIPLE_CHOICE_MULTI` |
| 23 | `l_022` | 3 | Group 1 | `MULTIPLE_CHOICE_MULTI` |
| 24 | `l_023` | 3 | Group 2 | `MULTIPLE_CHOICE_MULTI` |
| 25 | `l_024` | 3 | Group 2 | `MULTIPLE_CHOICE_MULTI` |
| 26 | `l_025` | 3 | Group 3 | `MULTIPLE_CHOICE_MULTI` |
| 27 | `l_026` | 3 | Group 3 | `MULTIPLE_CHOICE_MULTI` |
| 28 | `l_027` | 3 | Group 4 | `MULTIPLE_CHOICE` |
| 29 | `l_028` | 3 | Group 4 | `MULTIPLE_CHOICE` |
| 30 | `l_029` | 3 | Group 4 | `MULTIPLE_CHOICE` |
| 31 | `l_030` | 3 | Group 4 | `MULTIPLE_CHOICE` |
| 32 | `l_031` | 4 | Group 1 | `FILL_IN_THE_BLANK` |
| 33 | `l_032` | 4 | Group 1 | `FILL_IN_THE_BLANK` |
| 34 | `l_033` | 4 | Group 1 | `FILL_IN_THE_BLANK` |
| 35 | `l_034` | 4 | Group 1 | `FILL_IN_THE_BLANK` |
| 36 | `l_035` | 4 | Group 1 | `FILL_IN_THE_BLANK` |
| 37 | `l_036` | 4 | Group 1 | `FILL_IN_THE_BLANK` |
| 38 | `l_037` | 4 | Group 1 | `FILL_IN_THE_BLANK` |
| 39 | `l_038` | 4 | Group 1 | `FILL_IN_THE_BLANK` |
| 40 | `l_039` | 4 | Group 1 | `FILL_IN_THE_BLANK` |
| 41 | `l_040` | 4 | Group 1 | `FILL_IN_THE_BLANK` |
| 42 | `r_001` | 5 | Group 1 | `TRUE_FALSE_NOT_GIVEN` |
| 43 | `r_002` | 5 | Group 1 | `TRUE_FALSE_NOT_GIVEN` |
| 44 | `r_003` | 5 | Group 1 | `TRUE_FALSE_NOT_GIVEN` |
| 45 | `r_004` | 5 | Group 1 | `TRUE_FALSE_NOT_GIVEN` |
| 46 | `r_005` | 5 | Group 1 | `TRUE_FALSE_NOT_GIVEN` |
| 47 | `r_006` | 5 | Group 1 | `TRUE_FALSE_NOT_GIVEN` |
| 48 | `r_007` | 5 | Group 2 | `FILL_IN_THE_BLANK` |
| 49 | `r_008` | 5 | Group 2 | `FILL_IN_THE_BLANK` |
| 50 | `r_009` | 5 | Group 2 | `FILL_IN_THE_BLANK` |
| 51 | `r_010` | 5 | Group 2 | `FILL_IN_THE_BLANK` |
| 52 | `r_011` | 5 | Group 2 | `FILL_IN_THE_BLANK` |
| 53 | `r_012` | 5 | Group 2 | `FILL_IN_THE_BLANK` |
| 54 | `r_013` | 5 | Group 2 | `FILL_IN_THE_BLANK` |
| 55 | `r_014` | 6 | Group 1 | `MATCHING_INFORMATION` |
| 56 | `r_015` | 6 | Group 1 | `MATCHING_INFORMATION` |
| 57 | `r_016` | 6 | Group 1 | `MATCHING_INFORMATION` |
| 58 | `r_017` | 6 | Group 1 | `MATCHING_INFORMATION` |
| 59 | `r_018` | 6 | Group 1 | `MATCHING_INFORMATION` |
| 60 | `r_019` | 6 | Group 2 | `MATCHING_FEATURES` |
| 61 | `r_020` | 6 | Group 2 | `MATCHING_FEATURES` |
| 62 | `r_021` | 6 | Group 2 | `MATCHING_FEATURES` |
| 63 | `r_022` | 6 | Group 2 | `MATCHING_FEATURES` |
| 64 | `r_023` | 6 | Group 2 | `MATCHING_FEATURES` |
| 65 | `r_024` | 6 | Group 3 | `FILL_IN_THE_BLANK` |
| 66 | `r_025` | 6 | Group 3 | `FILL_IN_THE_BLANK` |
| 67 | `r_026` | 6 | Group 3 | `FILL_IN_THE_BLANK` |
| 68 | `r_027` | 7 | Group 1 | `MULTIPLE_CHOICE` |
| 69 | `r_028` | 7 | Group 1 | `MULTIPLE_CHOICE` |
| 70 | `r_029` | 7 | Group 1 | `MULTIPLE_CHOICE` |
| 71 | `r_030` | 7 | Group 1 | `MULTIPLE_CHOICE` |
| 72 | `r_031` | 7 | Group 2 | `MATCHING_FEATURES` |
| 73 | `r_032` | 7 | Group 2 | `MATCHING_FEATURES` |
| 74 | `r_033` | 7 | Group 2 | `MATCHING_FEATURES` |
| 75 | `r_034` | 7 | Group 2 | `MATCHING_FEATURES` |
| 76 | `r_035` | 7 | Group 2 | `MATCHING_FEATURES` |
| 77 | `r_036` | 7 | Group 3 | `YES_NO_NOT_GIVEN` |
| 78 | `r_037` | 7 | Group 3 | `YES_NO_NOT_GIVEN` |
| 79 | `r_038` | 7 | Group 3 | `YES_NO_NOT_GIVEN` |
| 80 | `r_039` | 7 | Group 3 | `YES_NO_NOT_GIVEN` |
| 81 | `r_040` | 7 | Group 3 | `YES_NO_NOT_GIVEN` |
| 82 | `w_001` | 8 | Group 1 | `WRITING_ESSAY` |
| 83 | `w_002` | 9 | Group 1 | `WRITING_ESSAY` |
