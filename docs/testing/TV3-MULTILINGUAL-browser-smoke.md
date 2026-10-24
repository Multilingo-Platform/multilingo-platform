# TV3-MULTILINGUAL — Browser / IME Smoke

Status: **PARTIAL PASS — automated/browser smoke complete; final full-feature review pending**.

## Runtime and isolation

- Date: 2026-10-22.
- Frontend was served from a dedicated Vite test runtime at `127.0.0.1:5188`.
- Playwright drove the installed Chrome browser. API responses, auth, Dictionary v2, hints, Flashcard and autosave were intercepted by a local fake runtime; no learner database, Gemini, or media CDN was used.
- The test fixture represented a Japanese generic exam. This checks UI wiring and not translation/provider quality.

## Results

| Viewport / flow | Result | Evidence |
|---|---|---|
| 1366 px Reading | PASS: Japanese passage and workspace panes render | `output/playwright/tv3-ja-desktop.png` |
| 768 px Reading | PASS: Japanese passage remains visible at tablet width; measured passage box 432×26 px at x=24 | Playwright rerun, 2026-10-22 |
| 375 px Reading | PASS: passage/question responsive flow renders | `output/playwright/tv3-ja-mobile.png` |
| CJK dictionary | PASS: selected `水` produced the mocked ja→vi definition in the popup | Browser session `tv3-ml`; fake v2 API |
| Flashcard | PASS: created a private deck and saved the returned lookup; UI confirmed save | Browser session `tv3-ml`; fake API |
| UI locale | PASS: switched Vietnamese → English; labels updated without recreating the workspace | Browser session `tv3-ml` |
| Writing | PASS: Japanese text with combining mark and emoji remained in the editor; UI showed character metric | Browser session `tv3-ml`; no provider call |
| Keyboard | PASS: Tab moved focus to the visible language-switch button; writing textarea accepted text after keyboard focus | Playwright rerun, 2026-10-22 |
| Composition event | PASS as a simulation only: `compositionstart/update/end` delivered Japanese characters to the editor | Playwright DOM event simulation; not native IME |

## Not verified

- Physical Japanese/Korean/Chinese IME composition. Browser inserted Unicode text; this is not equivalent to native IME composition.
- Real Gemini response quality for any language.
- Locale switching while a Dictionary request is pending in a deployed browser-backed environment (locale preservation during lookup display is covered separately; autosave-in-flight, pending-submit, and active-audio state are covered by focused RTL regressions).
- Audio playback; this completion smoke uses a Japanese practice fixture without production media.

Automated checks passed: Vitest **117 files / 1,753 tests**, TypeScript, lint (exit 0 with repository warnings), and production build (exit 0; large-chunk warning). Backend broad suite passed **2,069 tests, 0 failures/errors, 47 skipped**; it excludes `GenerateTemplateTest` and is not the original full suite. Isolated PostgreSQL UTF-8 gate passed **15/15** tests.

Learner rollout still requires human review of actual provider quality per language and physical IME validation. Simulated/browser fixture evidence must not be presented as either of those gates.

## 2026-10-22 — Native IME preflight — BLOCKED

- No native ja/zh/ko input was entered. `Get-InstalledLanguage` reports only `en-US` and `vi-VN`; none of the three requested IME language packs is installed.
- Checking Windows optional language capabilities returned “The requested operation requires elevation”; this session is not Administrator. No OS language pack was installed and no elevation request was attempted.
- Chrome has a listener at `127.0.0.1:9222`, but both `/json/list` and `/` return HTTP 404, and the prior frontend port `5173` is not listening. There is no identifiable project exam page to focus.
- Therefore this is a preflight blocker, not a native IME smoke result. The existing simulated composition evidence remains explicitly separate.

## 2026-10-23 — User-requested native IME retry — BLOCKED

- The user opened the authenticated app at `http://localhost:5173/student/dashboard`. The `Luyện ngôn ngữ` library filter returned 0 exams, so I opened a one-skill Writing Practice session for the available Cambridge IELTS 20 Test 1. Current workspace: `/attempts/87`; source language is English. The attempt is left unsubmitted for a possible manual smoke.
- Current Windows language inventory now lists `ja-JP` with `LpCab`, `zh-CN` and `ko-KR` with `BasicTyping`; this supersedes the 2026-10-22 preflight inventory above.
- Native desktop capture failed twice (`FrameArrived timed out`, then `window capture timed out`). No native key was sent. The in-app browser API exposes DOM-oriented input, which would not establish OS IME composition, so no simulated input is claimed as a pass.
- Result: ja/zh/ko real-IME smoke remains **NOT VERIFIED**. No code defect was reproduced and no code/tests were changed in this retry.

## 2026-10-23 — User-performed native IME smoke — PASS, final review requested

- On the real TV3 Writing textarea in attempt 87, the user reports completing the requested ja/zh/ko entry flows. The attached screenshots show the Japanese OS IME candidate list for `konnichiwa` including `こんにちは`, the Chinese Pinyin candidate list for `ni'hao` including `你好`, and the Korean committed value `안녕하세요` in the textarea.
- The Japanese and Chinese screenshots show the candidate/composition popup still open, so the final commit state for those two is user-reported rather than visible in the captures. Korean committed text is directly visible. The captured workspace is Cambridge IELTS 20 Test 1 (English source); this validates native CJK input in the TV3 Writing control, not multilingual grading or provider quality.
- No app code was changed. Attempt 87 was left unsubmitted. Final full-feature review is now requested with this evidence and the noted screenshot limitation.
