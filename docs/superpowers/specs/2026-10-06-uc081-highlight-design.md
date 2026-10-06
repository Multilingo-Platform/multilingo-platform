# Spec: UC08.1 – Highlight đoạn văn bài đọc

**Ngày viết:** 2026-10-06  
**Tác giả:** AI + Review (mục B, C) + Grill-me (mục D–G)  
**Trạng thái:** Chờ duyệt

---

## 1. Phạm vi (Scope)

### In-Scope
- Bôi đen văn bản trong vùng `readingContainerRef` (passage bài đọc hiểu).
- Hiển thị `SelectionToolbar` (floating) chứa nút **Highlight** và (tùy điều kiện) nút **Tra từ AI**.
- Đổi nền vùng chọn sang màu vàng (`bg-yellow-200`) bằng thẻ `<mark data-hl-id>`.
- Click vào vùng vàng (selection collapsed): hiện tooltip **Xóa highlight**, bấm xóa cả cụm.
- Persist highlight trong Redux + localStorage (key `exam_draft_{attemptId}`).
- Khi nộp bài: ghi highlight sang key riêng `exam_highlights_{attemptId}` trước khi xóa draft.
- Màn xem lại (ExamResultPage / ExamReviewPage): hiển thị highlight **read-only**.
- Mobile: hỗ trợ long-press + kéo handle, dùng `selectionchange` + `touchend`.

### Out-of-Scope
- Ghi chú (note) trên highlight.
- Nhiều màu highlight.
- Highlight trên phần đề bài câu hỏi (chỉ áp dụng cho passage).
- Đồng bộ highlight lên server (giai đoạn 2 – backlog).

---

## 2. Điều kiện bật tính năng

```ts
const highlightEnabled =
  currentSkill === 'READING' &&
  (mode === 'PRACTICE' || mode === 'MOCK_TEST');
```

- Nút **Tra từ AI** chỉ hiện trong `PRACTICE` và khi `isDictionaryCandidate(text)` (logic cũ giữ nguyên).
- `MOCK_TEST`: chỉ có nút **Highlight**.

---

## 3. Mô hình dữ liệu

### 3.1 Kiểu Highlight

```ts
type Highlight = {
  id: string;        // uuid, dùng làm data-hl-id
  start: number;     // offset tính trên text-content của container (không phải HTML index)
  end: number;
  text: string;      // tối đa 50 ký tự đầu – chỉ để đối chiếu khi debug
};
```

### 3.2 Mở rộng AnswerState

```ts
interface AnswerState {
  // ... hiện có
  highlights: Record<
    string, // passageId
    { contentHash: string; items: Highlight[] }
  >;
}
```

- `contentHash`: hash ngắn của `passageHtml` (ví dụ `CRC32` hay `hashCode` đơn giản).
- Nếu `contentHash` không khớp khi khôi phục → bỏ qua highlight của passage đó, không crash.
- Key theo `passageId`, nằm trong scope của một `attemptId`.

### 3.3 Versioning của draft

Thêm `draftVersion` (số nguyên) vào object localStorage. Draft cũ không có `highlights` → mặc định `{}`, không lỗi.

---

## 4. Module logic thuần (không DOM, dễ unit test)

```ts
// Kiểm tra hai vùng giao nhau
function overlaps(a: Highlight, b: Highlight): boolean {
  return a.start <= b.end && b.start <= a.end;
}

// Kiểm tra liền kề (khoảng trắng giữa KHÔNG tính là liền kề)
function adjacent(a: Highlight, b: Highlight): boolean {
  return a.end === b.start || b.end === a.start;
}

// Merge: sắp xếp và gộp các vùng chồng hoặc liền kề
function normalize(ranges: Highlight[]): Highlight[];

// Thêm vùng mới rồi normalize
function addHighlight(list: Highlight[], range: { start: number; end: number; text: string }): Highlight[];

// Xóa cụm chứa offset
function removeAt(list: Highlight[], offset: number): Highlight[];

// Clip vùng chọn về trong [0, containerLength]
function clip(range: { start: number; end: number }, containerLength: number): { start: number; end: number };
```

**Quy tắc merge:**
- Hai vùng giao nhau (`a.start <= b.end && b.start <= a.end`) **hoặc** liền kề (`a.end === b.start`): merge.
- Hai vùng chỉ cách nhau khoảng trắng: KHÔNG merge (giữ hai bản ghi riêng).
- Kết quả: `start = min`, `end = max`, giữ `id` của vùng cũ đầu tiên, tính lại `text`.
- Vùng mới nằm trọn trong vùng cũ: idempotent, không tạo bản ghi mới.
- Vùng mới bao trùm nhiều vùng cũ: gộp tất cả.

**Quy tắc xóa:** `removeAt(list, offset)` → xóa cả cụm chứa `offset`, các cụm khác không đổi.

---

## 5. Module DOM

### 5.1 Tính offset từ Selection

```ts
function rangeToOffsets(container: Node, range: Range): { start: number; end: number }
```

Duyệt `TreeWalker(SHOW_TEXT)`, cộng dồn `textNode.data.length` đến khi gặp `startContainer`/`endContainer`, rồi cộng thêm `startOffset`/`endOffset`.

### 5.2 Chiều ngược: offset → Range

```ts
function offsetsToRanges(container: Node, start: number, end: number): Range[]
```

Trả về một hoặc nhiều `Range` (nếu vùng đi qua nhiều text node).

### 5.3 Hook useTextSelection

```ts
function useTextSelection(containerRef: RefObject<HTMLElement>): {
  start: number;
  end: number;
  rect: DOMRect;
  text: string;
} | null
```

- Lắng nghe `selectionchange` trên `document` (debounce ~100ms).
- Desktop: `mouseup` / Mobile: `touchend` làm tín hiệu "đã chọn xong" → hiện toolbar.
- Nếu selection ổn định > 300ms và không có `touchend` (edge case mobile) → cũng coi là xong.
- Kiểm tra selection có nằm trong `containerRef` không (`container.contains(range.commonAncestorContainer)`).
- Bỏ qua: selection rỗng, collapsed, chỉ whitespace.
- Lưu `{ start, end }` vào ref ngay khi toolbar hiện (tránh mất selection khi bấm nút).

---

## 6. Render Highlight (Phương án B – DOMParser + inject mark)

**Flow:**
1. Từ `highlights[passageId].items` lấy danh sách `Highlight[]` đã normalize.
2. Dùng `DOMParser` parse `passageHtml`.
3. Duyệt text node bằng `TreeWalker`, cộng dồn offset, bọc phần giao nhau với từng `Highlight` trong `<mark data-hl-id="{id}" class="bg-yellow-200 rounded-sm">`.
4. Serialize thành chuỗi HTML mới → truyền vào `dangerouslySetInnerHTML`.

> **Tại sao không sai nesting:** mỗi `<mark>` nằm trọn trong một text node, không bao giờ cắt qua thẻ HTML cha.

**Sanitization:** Passage HTML đã được render từ server (content quản trị), `DOMPurify` hiện dùng trong `HtmlContent.tsx`. Khi bọc `<mark>`, cần đảm bảo `<mark>` nằm trong whitelist của DOMPurify hoặc sanitize sau khi inject.

---

## 7. SelectionToolbar (Floating Tooltip)

### 7.1 Điều kiện hiển thị nút

| Điều kiện | Nút hiện |
|---|---|
| READING + (PRACTICE hoặc MOCK_TEST), vùng chọn hợp lệ | **Highlight** |
| PRACTICE + 1–35 ký tự tiếng Anh thuần | **Highlight** + **Tra từ AI** |
| MOCK_TEST | Chỉ **Highlight** |
| Vùng chọn nằm trọn trong highlight có sẵn | Không hiện **Highlight** (idempotent); **Tra từ AI** vẫn theo điều kiện |

Không có nút nào thỏa điều kiện → không render toolbar.

### 7.2 Vị trí

- Đặt theo `rect` của vùng chọn; tự lật khi sát mép màn hình.
- Mobile: đặt **dưới** vùng chọn để tránh menu native iOS/Android đè.
- Tránh `user-select: none` trên container bài đọc. iOS: `-webkit-touch-callout`.

### 7.3 Đóng toolbar

- Click ra ngoài container / scroll / resize / `Esc` / selection thu về rỗng.

### 7.4 Giữ selection khi bấm nút

- `onPointerDown` + `preventDefault()` trên các nút.
- Sau **Highlight**: `window.getSelection()?.removeAllRanges()`, đóng toolbar.
- Sau **Tra từ AI**: giữ hành vi hiện tại.

---

## 8. Tooltip Xóa Highlight

- **Trigger:** click vào `<mark>` khi `selection.isCollapsed`.
- Tìm cụm bằng `closest('mark[data-hl-id]')`.
- Nút **Xóa highlight** gần điểm click.
- Đóng: click ra ngoài / scroll / `Esc`.
- **Hai tooltip không được mở đồng thời:** mở Xóa → đóng SelectionToolbar, và ngược lại.
- Mobile: vùng chạm ≥ 44px. Desktop: `cursor: pointer`.
- Kéo chọn bắt đầu từ trong vùng vàng → hiện **SelectionToolbar** (Highlight), không phải Xóa.

---

## 9. Persistence

### 9.1 Giai đoạn 1 (làm ngay)

- `highlights` trong `AnswerState` (Redux).
- Persist offline cùng `exam_draft_{attemptId}` trong localStorage.
- Không ghi localStorage mỗi dispatch; debounce hoặc ghi cùng nhịp autosave (15s) + `beforeunload`/`visibilitychange`.
- Khôi phục: validate `draftVersion`, `contentHash`, `0 <= start < end <= textLength`.
- **Khi nộp bài:** ghi `exam_highlights_{attemptId}` TRƯỚC, rồi mới xóa draft.
- Dọn dẹp: xóa key quá hạn (≥ 90 ngày) hoặc giới hạn số attempt khi app khởi động.
- Đa tab: last-write-wins – Known limitation v1.

### 9.2 Giai đoạn 2 (backlog)

- Đồng bộ highlight lên server cùng autosave hoặc payload nộp bài. Cần xác nhận API backend.

---

## 10. Màn xem lại kết quả

- Đọc `exam_highlights_{attemptId}` từ localStorage.
- Validate `contentHash` trước khi render.
- Render `<mark>` theo pipeline mục 6, **read-only**: không listener, không tooltip, không `cursor: pointer`.
- Không có dữ liệu → hiện bình thường, không lỗi.
- **Cần xác minh trước khi code:** ExamResultPage/ReviewPage có dùng chung component render passage không; có đánh dấu đáp án riêng không (tránh xung đột hai loại `<mark>`).

---

## 11. Refactor AI Dictionary (2 PR)

- **PR (a):** Refactor AI Dictionary sang `SelectionToolbar` chung, không đổi hành vi. Test hồi quy.
- **PR (b):** Thêm Highlight action lên `SelectionToolbar`.
- Thứ tự nút: **Highlight** trước, **Tra từ AI** sau.
- Giữ nguyên ngưỡng 1–35 ký tự tiếng Anh thuần và cách gọi API AI.

---

## 12. Known Limitations (v1)

- Highlight chỉ tồn tại trên thiết bị đã làm bài; đổi máy hoặc xóa cache → mất.
- Đa tab cùng một attempt: last-write-wins.
- Keyboard accessibility cho `<mark>` (tabindex, Enter) chưa làm.

---

## 13. Điểm cần xác nhận trước khi code

- [ ] `passageId`: field nào trong data model hiện tại xác định một passage?
- [ ] ExamResultPage / ExamReviewPage có dùng chung component render passage với WorkspacePage không?
- [ ] Màn xem lại có đánh dấu đáp án riêng (ví dụ `<mark class="correct">`) không?
- [ ] Luồng nộp bài xóa draft ở đâu trong code? (cần chèn ghi `exam_highlights_*` đúng thứ tự)

---

## 14. Kế hoạch triển khai

1. Xác nhận 4 điểm ở mục 13.
2. Viết module logic thuần (mục 4) + unit test đủ 8 case merge/clip/remove.
3. Viết `rangeToOffsets` / `offsetsToRanges` + test với passage mẫu.
4. Viết `useTextSelection` hook.
5. Viết `applyHighlights(html, highlights)`: DOMParser → inject → serialize.
6. **PR (a):** Refactor AI Dictionary → `SelectionToolbar`, test hồi quy.
7. **PR (b):** Gắn Highlight action, Xóa tooltip, nối store, persist.
8. Màn xem lại read-only.
9. Test manual theo 32 test cases (mục 15).

---

## 15. Test Cases (32 cases)

**Test data mẫu:** passage có `<b>`, `<i>`, `<br>`, entity `&amp;`, tiếng Việt có dấu tổ hợp.

| Mã TC | Phân loại | Mô tả | Kết quả mong đợi |
|:---|:---|:---|:---|
| TC_EXAM_HL_01 | Happy Path | Bôi đen 1 câu → Highlight | Màu vàng, persist đúng |
| TC_EXAM_HL_02 | Happy Path | Click vùng vàng → Xóa | Màu về bình thường, xóa khỏi store |
| TC_EXAM_HL_03 | Edge Case | Highlight qua thẻ `<b>`, `<br>`, entity | Không vỡ giao diện, màu đúng |
| TC_EXAM_HL_04 | Boundary | Bôi đen vượt container | Auto clip, chỉ highlight phần trong container |
| TC_EXAM_HL_05 | Overlap | Vùng mới chồng một phần vùng cũ | Merge thành 1 cụm |
| TC_EXAM_HL_06 | Overlap | Vùng mới chồng hai phía | Merge |
| TC_EXAM_HL_07 | Overlap | Vùng mới nằm trọn trong cụm cũ | Không thay đổi (idempotent) |
| TC_EXAM_HL_08 | Overlap | Vùng mới bao trùm 2 cụm cũ | Gộp cả 2 thành 1 |
| TC_EXAM_HL_09 | Overlap | Hai vùng liền kề (a.end === b.start) | Merge |
| TC_EXAM_HL_10 | Overlap | Hai vùng cách nhau đúng 1 khoảng trắng | Không merge |
| TC_EXAM_HL_11 | Delete | Xóa cụm đã merge từ 3 vùng | Mất cả cụm, các highlight khác nguyên |
| TC_EXAM_HL_12 | Delete | Click ngoài vùng highlight | Tooltip Xóa không hiện |
| TC_EXAM_HL_13 | Delete | Kéo chọn bắt đầu từ trong vùng vàng | Hiện toolbar Highlight, không phải Xóa |
| TC_EXAM_HL_14 | Delete | Xóa rồi reload | Không còn highlight, persist đúng |
| TC_EXAM_HL_15 | State | Reload giữa chừng | Highlight vẫn còn đúng vị trí |
| TC_EXAM_HL_16 | State | Load draft cũ không có `highlights` | Mặc định `{}`, không lỗi |
| TC_EXAM_HL_17 | State | contentHash không khớp | Highlight bị bỏ qua, không crash |
| TC_EXAM_HL_18 | State | localStorage bị chặn/đầy | App vẫn chạy, highlight hoạt động trong memory |
| TC_EXAM_HL_19 | State | Nộp bài → vào màn xem lại | Highlight hiện read-only, không sửa được |
| TC_EXAM_HL_20 | State | Làm lại bài | Không còn highlight cũ |
| TC_EXAM_HL_21 | State | Key cũ dọn dẹp | Key quá hạn bị xóa đúng |
| TC_EXAM_HL_22 | Tooltip | PRACTICE, chọn 1 từ tiếng Anh | 2 nút: Highlight + Tra từ AI |
| TC_EXAM_HL_23 | Tooltip | PRACTICE, chọn câu dài > 35 ký tự | Chỉ nút Highlight |
| TC_EXAM_HL_24 | Tooltip | MOCK_TEST | Chỉ nút Highlight, không AI |
| TC_EXAM_HL_25 | Tooltip | Hai tooltip không mở cùng lúc | Mở Xóa thì SelectionToolbar đóng |
| TC_EXAM_HL_26 | Tooltip | Tooltip sát mép trên/phải | Tự lật, không bị cắt |
| TC_EXAM_HL_27 | Mobile | Long-press + kéo handle iOS | Tooltip hiện, bấm Highlight có màu |
| TC_EXAM_HL_28 | Mobile | Menu native không che nút | Tooltip dưới vùng chọn, nhìn thấy đủ |
| TC_EXAM_HL_29 | Mobile | Bấm nút không mất selection | Highlight đúng đoạn đã chọn |
| TC_EXAM_HL_30 | Mobile | Xoay màn hình khi tooltip mở | Tooltip đóng hoặc tính lại vị trí |
| TC_EXAM_HL_31 | Selection | Triple-click, double-click (trim whitespace), Shift+mũi tên | Tooltip hiện đúng sau mỗi kiểu chọn |
| TC_EXAM_HL_32 | Regression | Luồng AI Dictionary sau refactor | Kết quả y hệt trước refactor |
