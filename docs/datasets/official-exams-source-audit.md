# Kiểm kê nguồn bộ đề chính thức

Ngày kiểm tra: 2026-10-17. Workbook gốc không bị sửa. Các bản test trong `backend/src/test/resources/datasets/official-source/` là byte-copy để kiểm tra checksum và cấu trúc ổn định.

## Nguồn và checksum

| Nguồn | SHA-256 | Sheet dữ liệu |
|---|---|---|
| `E:/Downloads/Cambridge_Ielts_20_Test_1_(Chưa_giải_thích).xlsx` | `1427bd88ff54e59d695bc2b3b02bfbe301e0658a3a76b79bfb3f650461402ee1` | `Exam Template`, 83 hàng × 20 cột |
| `E:/Downloads/ETS_2024_Test_1_completed.xlsx` | `990f8aa1d8190302e469aa021c50ea30e3a65817b4db698c30d47463c08a7fde` | `Exam Template`, 201 hàng × 16 cột |
| `backend/ETS_2024_Test_1 (có giải thích).xlsx` | `b3abb7c09150f4f04022af1a96f3b3e335766d9daa1bdd4a4b217b301a76c3d1` | `Exam Template`, nguồn bổ sung passage |

Test khóa checksum và invariant. Khi nguồn chính đổi checksum, task import phải dừng để audit/cập nhật profile có chủ đích. Dùng POI qua `InputStream`; không mở source bằng `WorkbookFactory.create(File)` vì package file có thể bị ghi lại khi đóng. Không đánh giá formula, chạy macro hay tải media.

## Cambridge IELTS 20 Test 1

`Thông Tin Đề Thi` ghi `IELTS_ACADEMIC`; `Exam Template` dùng A–T: Part, instructions, group, type, group instructions, context, prompt, options A–H, answer, explanation, audio, group media và question media. Có 9 Part, 19 nhóm, 82 prompt; 80 câu khách quan và 2 `WRITING_ESSAY`. Phân bố nhóm theo Part nguồn là `1/3/4/1/3/2/3/1/1`; sau khi sắp Reading Passage 1/2/3 thành canonical Part 5/6/7, phân bố canonical là `1/3/4/1/2/3/3/1/1`. Đối chiếu từ ranh giới `Group` trong workbook. Cả 80 objective answer key đã có; cả 82 explanation đang trống.

Metadata đặt tên là `Cambridge Ielts 20 Test 1 (Chưa giải thích)`. Parser profile chỉ khi checksum nguồn khớp sẽ chuẩn hóa tên hiển thị về `Cambridge Ielts 20 Test 1`; hậu tố mô tả trạng thái biên tập không thuộc tên đề chính thức.

| Hàng nguồn | Nội dung | Question ID canonical |
|---|---|---|
| 2–11 | Listening Part 1, 10 câu | `l_001`–`l_010` |
| 12–21 | Listening Part 2, 10 câu | `l_011`–`l_020` |
| 22–31 | Listening Part 3, 10 câu | `l_021`–`l_030` |
| 32–41 | Listening Part 4, 10 câu | `l_031`–`l_040` |
| 42–55 | Reading Passage 3 — Stress, 14 câu | `r_027`–`r_040` |
| 56–68 | Reading Passage 1 — Kākāpō, 13 câu | `r_001`–`r_013` |
| 69–81 | Reading Passage 2 — Elms, 13 câu | `r_014`–`r_026` |
| 82 | Writing Task 1 — New York population tables | `w_001` |
| 83 | Writing Task 2 — clean water | `w_002` |

Canonical Reading order là Passage 1, 2, 3; bảng trên giữ mapping ngược về thứ tự/hàng nguồn. Bốn audio nằm ở `R2`, `R12`, `R22`, `R32`. Bốn HTML image block nằm trong context `F2`, `F32`, `F62`, `F82`; phải chuyển URL đã kiểm tra sang `shared_media`, không giữ HTML image trong Writing Task 1 context.

**Cập nhật xác minh passage Elms (2026-10-17):** workbook gốc vẫn chứa chuỗi lạ tại cả bảy ô nêu trên và không bị sửa. Chủ dự án đã cung cấp nguyên văn passage “Bring elms to Britain” làm nguồn hiệu chỉnh. Nội dung sau khi chuẩn hóa khoảng trắng khớp với attachment SHA-256 `B412F154A891A868E4E88C7CCEA6C1398DA620F225A68253E734F21189821512`; bản lưu trong repository là `backend/src/main/resources/datasets/source-corrections/cambridge-ielts-20-test-1/elms-to-britain.txt` (SHA-256 của file lưu: `83F8882FF7153D564E3B1F56A3623734C13D5D52E9AFDECF492BFDB020FB4C57`). Hai checksum khác nhau do định dạng xuống dòng/khoảng trắng; phần văn bản sau chuẩn hóa trùng khớp.

Correction chỉ áp dụng khi SHA-256 workbook khớp chính xác profile Cambridge `1427bd88ff54e59d695bc2b3b02bfbe301e0658a3a76b79bfb3f650461402ee1`, và chỉ thay context canonical của Reading Passage 2 (canonical Reading Part 6). Vì vậy F69, F74 và F79 được khôi phục trong parser output; không sửa workbook nguồn. Các ô `F42`, `F46`, `F51` của Passage Stress và `F56` của Passage Kākāpō vẫn chưa có bản gốc xác minh. **IELTS vẫn bị chặn phát hành** cho đến khi bốn ô này được xác minh; các kiểm tra media/content/rights vẫn là gate riêng.

Năm cặp hai ô là các hàng/answer sets sau:

| Hàng / câu | ID | Answer set nguồn | Canonical group |
|---|---|---|---|
| 18–19 / 17–18 | `l_017`, `l_018` | `A,E` | `listening-17-18` |
| 20–21 / 19–20 | `l_019`, `l_020` | `C,E` | `listening-19-20` |
| 22–23 / 21–22 | `l_021`, `l_022` | `C,E` | `listening-21-22` |
| 24–25 / 23–24 | `l_023`, `l_024` | `A,C` | `listening-23-24` |
| 26–27 / 25–26 | `l_025`, `l_026` | `A,B` | `listening-25-26` |

Mỗi member giữ SINGLE_CHOICE và metadata group chung. Cả hai server-side grading keys dùng cùng answer set. Prompt có nhãn `(Option 1)/(Option 2)` cần trình bày thành hai ô cho một chỉ dẫn chung.

## ETS 2024 Test 1 completed

Có 200 prompt, answer và explanation; Part lần lượt có `6/25/39/30/30/16/54` câu. Có 49 group markers rõ trong nguồn; Group 8 Part 7 cần phục hồi. Nguồn bổ sung ở trên có `C166=Group 8`, `F166` chứa passage “Great Dishwasher!”, và options/answer cho câu 165–167 khớp chính xác nguồn completed.

Block cần chỉnh: Part 7 Group 7 gồm câu 161–164. Câu 164 ở hàng 165 dùng từ “judged” thuộc email trước. Group 8 bắt đầu câu 165 ở hàng 166, kéo dài câu 165–167 (hàng 166–168); `C166:C168` và `F166:F168` bị trống trong nguồn completed. Không kéo câu 164 sang passage máy rửa bát.

Part 3–4 có 23 context block bắt đầu tại `F33`, `F36`, …, `F99`, chứa marker `ANSWER-KEY-DERIVED CLUES` và chỉ dẫn ra đáp án cho 69 câu. Xóa các clue này khỏi public context; chúng không phải transcript và không được đổi nhãn thành transcript.

Chuỗi literal `44` được xác nhận theo source checksum ở các cột/ranges sau; mapping phải xóa placeholder có kiểm soát, không áp dụng replace toàn hệ thống:

| Cột | Số ô `44` | Ý nghĩa cần xử lý |
|---|---:|---|
| `E2:E201` (ô group instructions có dữ liệu) | 50 | Placeholder instructions |
| `H2:K201` | 31 mỗi cột | Options audio-only Part 1–2; giữ option IDs A–D ở Part 1, A–C ở Part 2, bỏ D Part 2 |
| `N2:N201` | 3 | Placeholder audio Part 5–7; không gửi vào runtime media |
| `O2:O201` | 39 | Placeholder group images; giữ 11 URL ảnh thật |
| `P2:P201` | 200 | Placeholder question attachment; không gửi vào runtime media |

Nguồn có 4 URL audio và 11 URL ảnh group thật. Khả năng tải, MIME, playback/render, CORS, Part mapping, quyền sử dụng và nội dung media chưa được xác minh tại bước audit nguồn. Hai URL web trong passage không phải media.

## Quy tắc tiếp nhận

- Không điền đáp án/lời giải thiếu bằng suy đoán và không đưa clue answer key vào đề học viên.
- IELTS thiếu explanation là trạng thái `PARTIAL`, được publish theo quyết định đã chốt; UI phải ghi “Chưa có giải thích”. Khi member 2 hoàn tất, tạo bundle version mới.
- Tạo bundle từ canonical request đã validate, không từ dữ liệu DB cũ hoặc snapshot lệch schema.
- Không coi test checksum là chứng nhận bản quyền hay xác nhận nội dung/media; hai việc này cần approval reference riêng trước publish.
- Local PostgreSQL lúc kiểm tra chỉ có mini TOEIC; attempt 8 snapshot tên “IELTS Mock Test - Full”. Không dùng ID đó để sửa dữ liệu và chưa xác nhận DB khác.
