---
name: tv3-code-review
description: "Review Multilingo Platform TV3 changes against their approved plan, handoff, API/security contracts, and focused tests. Use for TV3 subtask or full-feature code reviews; not for implementing fixes."
---

# TV3 Code Review

Use this skill when asked to review a TV3 subtask or feature in the Multilingo Platform repository. It is review-only: do not edit production code, tests, or the approved plan. Append to a handoff only when the user explicitly requests that update or makes it part of the review task.

## Review workflow

1. Read `GEMINI.md` and applicable repository instructions (`AGENTS.override.md`, `AGENTS.md`, or configured equivalents) for the files in scope. Read the approved TV3 plan and latest matching handoff entries under `docs/superpowers/plans/ndt/`.
2. Record `git status --short`, staged and unstaged diffs, and untracked paths before reviewing. Inspect untracked files directly; ordinary `git diff` does not include them. If a base branch/commit is specified, compare against it. Preserve unrelated working-tree changes.
3. Establish the requested scope from the plan and handoff: exact subtask, implementation status, acceptance criteria, dependencies, and explicit out-of-scope items. If the requested completed work cannot be identified or essential plan/implementation evidence is missing, stop and report BLOCKED rather than guessing.
4. Review only changed files and the directly relevant production/test call paths. Check whether each candidate defect was introduced or worsened by the change. Do not turn future subtasks, known unrelated defects, or pre-existing behavior into findings for the current subtask.
5. Compare implementation and tests to the applicable acceptance criteria. Inspect production behavior, not just test names or executor-reported results. Run focused tests only when they resolve a concrete uncertainty; do not run the full backend/frontend suite unless explicitly requested or the plan requires final verification.
6. Report findings in-scope and out-of-scope separately. Each actionable finding needs severity (P0/P1/P2), exact file and line/function, a reproducible failure scenario, and the smallest corrective action. Include a focused regression test when one is needed. Omit speculative, style-only, or non-actionable comments.
7. Choose exactly one decision for the requested scope: PASS when its required criteria are met; NEED_FIX when confirmed in-scope P0/P1 issues remain; BLOCKED when evidence or an approved decision is missing. Do not reject a completed subtask merely because later planned subtasks are unfinished. For a full-feature review, assess integration across all feature subtasks.

## TV3 invariants to apply when relevant

- Authorization comes from authenticated identity and persisted attempt state, never request-supplied owner, mode, or status.
- Use the approved API/DTO contract and the attempt's historical snapshot where required. Keep question identity scoped by both real `partId` and `questionId`; do not silently fall back to current authoring data when a historical snapshot is invalid or incomplete.
- Enforce the plan's access mode/status gates before returning learner feedback or sensitive data. Responses must use an allowlist and must not expose snapshots, grading-key objects, admin-only fields, or unrelated question content.
- Read-only preview paths must not persist answers or alter attempt version, status, timestamps, grading flags, or result summaries. Autosave/resume/submission paths must preserve their planned concurrency and stale-response semantics.
- Reuse existing grading behavior when required by the plan; verify aliases, alternate answers, blank handling, and partial credit without changing grading rules in the review.
- Error responses and logs must not reveal answers, keys, explanations, tokens, or raw sensitive payloads where the plan forbids them.

These are review checks, not authorization to broaden the implementation or override a more specific approved plan decision.

## Handoff update

When the user asks to record the review, append a dated entry to the exact requested `*-handoff.md`; preserve all prior entries and do not edit the plan. Include reviewer, reviewed scope, one decision, verified criteria, findings with severity/location, test commands and observed results (separate reviewer-run evidence from reported evidence), out-of-scope follow-ups, and the next action. Do not commit or push unless separately requested.

Respond in Vietnamese by default in this repository. Keep the final review concise and distinguish the subtask decision from whole-feature acceptance.
