# IELTS/TOEIC scoring and attempt duration

## Review fixes — 2026-11-03

| AC/test | Input | Expected |
|---|---|---|
| FIX-A | IELTS/TOEIC raw-only, legacy-only, mixed or empty history | No exception; only certificate units enter certificate aggregates |
| FIX-B | Legacy IN_PROGRESS, null scoreUnit, Practice/Mock, manual/timeout | Preserve raw overall and null unit; no new policy markers; duplicate submit stable |
| FIX-C | Completed certificate/raw/legacy attempts and unfinished rows | COUNT all completed; MAX raw/legacy only; certificate-only max null |
| FIX-D | Both time aliases, null/omitted/integer/decimal/string/bool/array/object/overflow | Only integer JSON tokens accepted; null/omitted defaults; invalid returns HTTP400 and inserts nothing |

Execution ledger: regressions will be run RED before fixes, GREEN after fixes, followed by focused review and full backend/frontend checks. No data backfill, regrading or additional migration.

## 1. Goal and context

Provide learner-selected attempt time limits for scoped practice and mock attempts, while preserving configured scope defaults. Full IELTS Academic and TOEIC Listening & Reading attempts use fixed exam durations and certificate scoring. Scoped attempts retain the existing raw objective scoring. Existing attempts and stored raw question results remain unchanged.

## 2. Actors and preconditions

- A learner selects an exam, scope, mode, and optional time limit before creating an attempt.
- The server loads the published exam snapshot and remains authoritative for scope, duration, deadline, and scores.
- IELTS Academic and TOEIC L&R policies apply by canonical exam type; other types retain existing behavior.

## 3. Main flows

### Scoped duration

For `SINGLE_SKILL`, `SINGLE_PART`, and `MULTI_PART`, the learner may use a preset or custom integer duration from 1 to 360 minutes. Leaving the selector on its default uses the existing configured duration: the selected skill duration, counted once per selected skill. A custom duration overrides that default. The server records the resolved duration and policy in the immutable attempt snapshot and enforces the deadline in both Practice and Mock Test.

The UI offers default, 5, 10, 15, 20, 30, 45, 60, 90, 120, 150, and 180 minutes, plus custom 1–360 minutes. It previews the resolved duration. A full exam has no duration input and ignores no invalid client override: the server rejects one.

### Full exam duration

- IELTS Academic: Listening 30 + Reading 60 + Writing 60 = 150 minutes.
- TOEIC L&R: Listening 45 + Reading 75 = 120 minutes.
- Other certificates: retain the current exam-configured duration.

The full-exam timer is authoritative in both modes. Existing autosave, resume, timeout grace, idempotent submission, and mock section locking semantics remain intact.

### Full exam certificate score

Certificate conversion is a separate projection over the already verified raw objective results and completed Writing grades. Raw question marks, verdicts, review keys, and scoped score semantics remain unchanged. The projection and its policy version are persisted with the result/snapshot so a future policy change does not reinterpret historical attempts.

IELTS Academic Listening and Reading use the supplied reference table with 40 questions. Scores below the table's Band 4 threshold are presented as `<4.0`; no numeric band is invented. A skill with a nonstandard question count has no converted band. Writing Task bands are derived from the mean of four equally weighted criteria, rounded to the nearest half band. Writing skill band is `(Task 1 + 2 × Task 2) / 3`, rounded to the nearest half band. A pending, failed, or missing task score does not become zero. Overall requires four valid skill bands; since the current Cambridge full exam has no Speaking section, it shows skill bands and no IELTS Overall.

TOEIC L&R estimates each complete 100-question skill separately on the 5–495 scale and sums both for a 10–990 estimate. The deterministic interpolation anchors are:

| Raw correct | Listening | Reading |
|---:|---:|---:|
| 0 and 6 | 5 | 5 |
| 20 | 60 | 45 |
| 30 | 110 | 90 |
| 40 | 167.5 | 142.5 |
| 50 | 237.5 | 202.5 |
| 60 | 302.5 | 262.5 |
| 70 | 367.5 | 332.5 |
| 80 | 427.5 | 392.5 |
| 90 | 482.5 | 452.5 |
| 93 | 495 | 470 |
| 95 | 495 | 485 |
| 97 | 495 | 490 |
| 100 | 495 | 495 |

Linear interpolation fills raw values between anchors. Results round to the nearest multiple of five, with ties rounded upward. The UI labels these as unofficial estimates. Incomplete skills have no scaled estimate, and the total remains unavailable unless both skills are complete.

### Result contract and history

Add a nullable `certificateScore` projection containing policy version, score unit, status, skill scores, optional overall/total, and a stable reason when unavailable. The existing objective summary continues to report raw scores. For new full IELTS/TOEIC attempts, `overallScore` stores the certificate total only when available; otherwise it is null. Scoped attempts retain their current raw `overallScore`. History/trend aggregates must filter by certificate policy and unit rather than averaging raw and scaled values together. Legacy results with no policy marker remain readable and are never recalculated.

Writing job completion updates the certificate projection and score in the existing attempt-locked result transaction. A nullable `test_attempts.score_unit` column is required because existing SQL aggregates read `overall_score` directly and cannot reliably separate new scaled scores from legacy raw scores. Leave old rows null; do not backfill or regrade them.

## 4. Side flows and errors

- Reject custom duration for full scope, out-of-range values, decimals, and values conflicting with single-selection fields.
- Reject missing/unresolved configured defaults when the learner requests the default; do not guess a time.
- Enforce deadline on create/resume/autosave/submit/scheduler without resetting it on refresh. Preserve the existing 15-second timeout-client grace.
- Keep unsupported or incomplete certificate scoring explicit in `certificateScore`; never substitute raw points or zero for a missing scaled score.
- Reject malformed/unrecognized public certificate-score structures at API normalization while continuing to accept legacy responses without `certificateScore`.

## 5. API and persistence

- `CreateAttemptRequest`: optional integer `timeLimitMinutes`; JSON aliases `time_limit_minutes` and `timeLimitMinutes`.
- Attempt snapshot: resolved duration and versioned duration/scoring policy metadata.
- Result response: optional, backward-compatible `certificateScore`; raw objective result fields retain their existing types and meaning.
- Add nullable `test_attempts.score_unit` and include it in repository aggregates. Existing rows stay null (legacy); new scoped rows use `RAW_OBJECTIVE`, IELTS full rows use `IELTS_BAND`, and TOEIC full rows use `TOEIC_SCALED`.
- A migration is required because current SQL aggregates read `overall_score` directly and cannot reliably distinguish old raw values from newly scaled values via result JSON. Apply this one nullable column only; do not backfill legacy units.

## 6. Acceptance criteria

- AC-01: Given a scoped attempt and a valid custom time, when created in Practice or Mock, then its server deadline is exactly the selected duration after start.
- AC-02: Given a scoped attempt with default time, when created, then the existing configured duration is resolved and counted once per selected skill.
- AC-03: Given full IELTS Academic/TOEIC L&R, when started, then fixed durations 150/120 are used and client time overrides are rejected.
- AC-04: Given any expired attempt, when autosaving or submitting, then server deadline semantics apply in either mode and the existing 15-second timeout grace is preserved.
- AC-05: Given a full IELTS Academic result, when objective/Writing scores are available, then bands follow the documented per-skill tables/formulas; missing Speaking prevents Overall.
- AC-06: Given a full TOEIC L&R result, when both 100-question skills are complete, then the estimated skill scores and total follow the anchors, interpolation, and rounding above.
- AC-07: Given a scoped attempt or legacy attempt, when results/history are read, then raw scores remain intact and legacy values are not relabeled or recalculated.
- AC-08: Given Writing grading completes asynchronously, when its attempt-locked transaction finalizes, then the certificate projection is refreshed using the stored snapshot policy.

## 7. Test matrix

| ID | Type | Scenario / steps | Input | Expected result |
|---|---|---|---|---|
| TC_TIME_CREATE_01 | Happy | Create Practice scoped attempt with custom time | 45 minutes | Deadline and stored policy equal 45 minutes |
| TC_TIME_CREATE_02 | Happy | Create Mock MULTI_PART using default duration | Two skills, omitted time | Sum each selected skill once |
| TC_TIME_CREATE_03 | Negative | Attempt to override full exam time | Full scope + 60 minutes | Request rejected |
| TC_TIME_CREATE_04 | Boundary | Validate duration bounds | 0, 1, 360, 361 | Reject, accept, accept, reject |
| TC_TIME_CREATE_05 | Negative | Validate noninteger duration | 1.5 | Request rejected |
| TC_TIME_CREATE_06 | Negative | Default unavailable | Missing configured selected-skill time | Request rejected with clear error |
| TC_TIME_DEADLINE_01 | Edge | Resume after refresh | Existing deadline | Deadline is not reset |
| TC_TIME_DEADLINE_02 | Edge | Autosave after deadline | Practice and Mock | Rejected after deadline |
| TC_TIME_DEADLINE_03 | Edge | Timeout submission around grace | At deadline +15s / beyond | Existing boundary behavior preserved |
| TC_TIME_DEADLINE_04 | Concurrency | Scheduler and submit race | Same expired attempt | Single finalization/grading |
| TC_SCORE_IELTS_01 | Boundary | Evaluate all Listening/Academic/General Reading raw thresholds | Every table boundary | Exact documented band |
| TC_SCORE_IELTS_02 | Negative | Evaluate below minimum band | Raw below Band 4 threshold | `<4.0`, raw count retained |
| TC_SCORE_IELTS_03 | Negative | Evaluate nonstandard skill count | IELTS skill not 40 questions | Raw only; conversion unavailable |
| TC_SCORE_IELTS_04 | Edge | Complete Writing with task weighting | Two tasks/four criteria | Formula and half-band rounding applied |
| TC_SCORE_IELTS_05 | Edge | Writing pending/failed or Speaking absent | Missing score | No zero substitution; Overall withheld |
| TC_SCORE_IELTS_06 | Boundary | Round IELTS values at quarter-band boundaries | `.125`, `.25`, `.375`, `.5`, `.625`, `.75`, `.875` | Official half-band result |
| TC_SCORE_TOEIC_01 | Boundary | Map all raw counts 0–100 | Listening and Reading | Monotone, 5–495, multiple of 5 |
| TC_SCORE_TOEIC_02 | Happy | Complete both TOEIC skills | 100 questions each | Skill estimates plus 10–990 total |
| TC_SCORE_TOEIC_03 | Negative | Incomplete TOEIC skill | Fewer than 100 questions | That skill/total unavailable |
| TC_SCORE_COMPAT_01 | Regression | Full selection under scoped scope | SINGLE_SKILL/MULTI_PART | Raw score policy retained |
| TC_SCORE_COMPAT_02 | Regression | Read existing legacy result | No policy marker | Original raw interpretation retained |
| TC_SCORE_HISTORY_01 | Integrity | Aggregate history and trends | Raw, band, TOEIC, legacy scores | Only comparable certificate units aggregated |
| TC_TIME_UI_01 | Accessibility | Operate selector on keyboard/mobile | Presets/custom/invalid entry | Labeled controls, visible inline error, correct preview |
| TC_TIME_UI_02 | Edge | Switch full/scoped modes and scopes | Prior custom value | Full hides selector; stale custom value not submitted |

Coverage includes happy path, invalid input/security, bounds, Unicode-independent history/state handling, concurrency/data integrity, and responsive/accessibility behavior.
