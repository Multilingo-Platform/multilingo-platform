# NLTV Sample Test 1 — Source audit

**Trạng thái:** SOURCE STRUCTURE VERIFIED; media and answer content not independently approved.  
**Source:** `backend/Đề_thi_Đánh_giá_Năng_lực_Tiếng_Việt_(NLTV)_Mẫu.xlsx`  
**SHA-256:** `b93b2d2cf13d8139faeabc133c271deec555f12368125e059fb54e9ce167f224`

## Inventory

Workbook sheets: `Thông Tin Đề Thi`, `Exam Template`, `Hướng dẫn điền Form`. The exam template has 20 headers and 107 question/task rows across 9 Parts and 27 groups.

| Part | Skill | Source rows | Count | Source type | Canonical type |
|---:|---|---:|---:|---|---|
| 1 | LISTENING | 2–16 | 15 | MULTIPLE_CHOICE | SINGLE_CHOICE |
| 2 | LISTENING | 17–30 | 14 | MULTIPLE_CHOICE | SINGLE_CHOICE |
| 3 | LISTENING | 31–44 | 14 | MULTIPLE_CHOICE | SINGLE_CHOICE |
| 4 | LISTENING | 45–56 | 12 | MULTIPLE_CHOICE | SINGLE_CHOICE |
| 5 | READING | 57–72 | 16 | MULTIPLE_CHOICE | SINGLE_CHOICE |
| 6 | READING | 73–96 | 24 | MULTIPLE_CHOICE | SINGLE_CHOICE |
| 7 | WRITING | 97–106 | 10 | FILL_IN_THE_BLANK | FILL_IN_THE_BLANK |
| 8 | WRITING | 107 | 1 | WRITING_ESSAY | ESSAY |
| 9 | WRITING | 108 | 1 | WRITING_ESSAY | ESSAY |

Total: 105 objective items and 2 essays. Group counts by Part: `1/5/7/6/2/3/1/1/1`. Source question numbering restarts by Part; IDs must be scoped by `(partNumber, question_id)`.

## Known corrections and missing assets

| Source location | Observation | Canonical handling |
|---|---|---|
| `F97`, keys `P97:P106` | Passage is already completed with all ten answers | For this exact source checksum only, replace each unique `(n) <matching key>` with `(n) ____`. Fail closed if any key is missing, duplicated, or mismatched. Keep the answers only on the private objective question records. |
| `R2:R108` | All part-audio cells are empty | Five source audio assets are absent: Parts 1–4 and 7. Draft can be prepared, publication is blocked. No TTS or invented media metadata. |
| `F107` | Prompt group HTML contains an image element | Extract its HTTPS source to structured group `shared_media`; remove the image element from prompt HTML. Verify the asset and usage rights before publication. |
| `P107`, `P108` | Text describes the task and minimum length; it is not a sample answer | Essay `correct_answer` stays null. Use `min_words=120` and `200` respectively. |
| `F57`, `F67`, `F73`, `F81`, `F89` | Five Reading passages are attached to their groups | Keep the passage with its source group; do not copy it across groups or into a global Part field. |

All 95 multiple-choice keys are present and structurally reference populated options. This check does not establish that the answers are substantively correct. Audio, image loading from learner origin, and provenance/rights approval remain unverified.

## Reproducibility

The workbook fixture is copied byte-for-byte to `backend/src/test/resources/datasets/official-source/nltv-sample-test-1.xlsx`. `NltvWorkbookAuditTest` checks its SHA-256 and basic sheet/row/group/audio facts. The parser fixture checks the canonical row and group counts and the two source-bound transformations.

## Revision R1 source — four original listening tracks

On 2026-10-21 the owner supplied `Đề_thi_Đánh_giá_Năng_lực_Tiếng_Việt_(NLTV)_Mẫu (1).xlsx` for the requested NLTV publication. SHA-256: `e155c3b007cd5f51cf5a73f8652e7d7274aa4a4953cf0c552b05c670a3582d13`. The revised workbook is retained as a separate fixture; the original fixture and hash above are unchanged. Structural diff: the metadata timestamp changed and cells `R2`, `R17`, `R31`, `R45` now contain four HTTPS Cloudinary MP4 URLs. Part 7 `R97` remains empty.

The owner clarified that Part 7 is a WRITING word-bank fill-in, not dictation and not an audio part. Source-bound parser correction changes `B97` from “Viết chính tả (Điền từ vào chỗ trống trong đoạn văn).” to “Chọn từ phù hợp trong danh sách và điền vào chỗ trống trong đoạn văn.” and replaces only the leading “Nghe đoạn văn...” wording in `E97` with “Đọc đoạn văn...”. The supplied choices and order stay unchanged. The ten completed tokens in `F97` are replaced with `(1) ____`…`(10) ____` only after verifying the source-key pairs `P97:P106`. A hash mismatch or unexpected original wording fails import closed.

The original R1 parser expected audio on Part 7; this is superseded. Only Parts 1–4 require audio for publication. Workbook revisions outside the two registered checksums remain rejected.
