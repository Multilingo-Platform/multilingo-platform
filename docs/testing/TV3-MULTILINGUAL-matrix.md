# TV3-MULTILINGUAL Completion — Verification Matrix

Status: **BLOCKED — native OS IME validation pending**. The independent full-feature review found no code defects; this matrix records automated, PostgreSQL, and browser evidence separately. Real-provider language quality remains a distinct learner-rollout gate.

| Area | Evidence | Result | Remaining |
|---|---|---|---|
| Dictionary v2 / Hints / Flashcard | Focused Vitest and browser fake-provider flow | PASS; v2 lookup, Japanese `水`, ja→vi lookup and private deck save/read UI verified | Real-provider quality not verified |
| Writing policy/context/parser/worker | Broad Maven suite and isolated PostgreSQL worker test | PASS; default-off policy, frozen context, worker fencing and generic scoring covered | Real-provider quality not verified |
| Feedback/result contracts | Broad Maven suite and lifecycle test | PASS; legacy/new result discriminator and historical unavailable result covered | — |
| Result/feedback rubric projection | `AttemptResultSummaryMapperTest`, `WritingFeedbackContractIT`, `WritingFeedbackMultilingualMapperTest` | PASS; only validated schema v2 score is exposed and Japanese generic 10/10 reconstructs | — |
| Frontend submit/result | Full Vitest | PASS, 117 files / 1,753 tests | — |
| TypeScript / lint / build | `npx tsc -b --pretty false`; `npm run lint`; `npm run build` | PASS; lint emits repository warnings, build emits large-chunk warning | Warnings are non-blocking; no new failure |
| Backend broad suite | `.\mvnw.cmd clean '-Dtest=*,!GenerateTemplateTest' test` | PASS, 2,069 tests; 0 failures/errors, 47 skipped | Not the original full suite; skipped tests remain skips even though dedicated PostgreSQL gates ran |
| PostgreSQL | `MultilingualTv3LifecycleIT,MultilingualDictionaryPostgresIT,MultilingualWritingPostgresIT` against disposable PostgreSQL 17 UTF-8 database `tv3_multilingual_test` | PASS, 15 tests; 0 failures/errors/skips | Test DB was temporary and is not the application DB |
| Browser / IME | Isolated Vite runtime with mocked API/provider, Playwright/Chrome, 375/768/1366 px; RTL locale/audio regressions | PASS for responsive passage visibility, keyboard focus, simulated composition events, UI locale switch, Japanese selection, Dictionary v2 popup, Flashcard save UI, writing text/length rendering; RTL confirms locale switch during in-flight autosave, pending submit, and active AudioPlayer preserves state | Physical OS IME and real provider quality are NOT VERIFIED |
| Provider language quality | No real Gemini calls | NOT VERIFIED | Human-review per-language quality before learner rollout |

Generic multilingual grading remains disabled by default. `ML-FULL-01` remains open.
