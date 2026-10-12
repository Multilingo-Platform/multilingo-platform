---
name: tv3-plan-executor
description: Execute an explicitly requested TV3 implementation plan from docs/superpowers/plans/ndt, preserving attempt security, historical snapshots, and the plan handoff.
---

# TV3 Plan Executor

Use this skill when the user explicitly asks to implement or execute a TV3 plan in docs/superpowers/plans/ndt. It covers TV3 exam attempts, Practice/mock-test flows, workspace, autosave/resume, grading, result, and review.

Do not use it to author a plan, review completed work, or diagnose/fix one isolated bug. Use the relevant planning, review, or TV3 bug-fix skill for those tasks. A plan marked PLANNED is eligible for execution only when the user asks to execute it.

## Start from the current repository state

1. Read GEMINI.md, applicable AGENTS.md files, the requested plan, and its latest handoff entries. Follow the exact acceptance criteria, global constraints, task order, and out-of-scope boundaries in that plan.
2. Inspect branch, HEAD, staged/unstaged changes, and untracked files before editing. Treat existing work as user-owned. Do not reset, clean, overwrite, or stage unrelated files.
3. Check whether each planned task is already implemented. If so, inspect its source and tests, record verified evidence, and avoid reimplementing it.
4. Compare the plan with the current code and latest handoff. If an interface or dependency has changed, resolve it from approved artifacts and repository code. If that would change security, persistence, API contract, or product behavior without an approved decision, stop at that boundary and report the specific conflict.
5. Keep execution in the user's current authorized workspace. Follow repository instructions for branch/worktree handling; preserve dirty files when moving work would omit them.

## Execute the plan

- Use executing-plans for inline work or subagent-driven-development when the user selected that method and the tool is available. Load test-driven-development before implementing code.
- Work in the plan's dependency order. Before each task, append an IN_PROGRESS handoff entry; after completing it, append IMPLEMENTED with changed files, test commands/results, and acceptance-criteria mapping. The handoff is append-only.
- For each behavior change, write a focused regression test first, run it to observe failure, make the smallest implementation change, then rerun the test and relevant regressions. Do not claim RED unless the test actually failed for the intended behavior.
- Use the plan's exact contracts and tests. Reuse existing TV3 services, reducers, API clients, snapshot readers, and grading rules when the plan calls for them. Do not introduce a parallel implementation without recording why the existing path cannot satisfy the contract.
- Keep changes limited to files and behavior authorized by the plan. Preserve unrelated changes, do not install dependencies or change schema/API/auth architecture unless the plan explicitly requires it.
- If implementation reveals an unapproved decision about ownership, attempt mode/status, snapshot compatibility, answer persistence, grading semantics, or data exposure, stop before making that decision and report the evidence needed to resolve it.

## TV3 invariants

- Determine access from authenticated identity and the persisted attempt. Request fields such as userId, mode, owner, or status never grant access.
- Keep question identity scoped by both partId and questionId. Use IDs from the attempt's recorded scope; do not infer IDs from ordering.
- Use the attempt snapshot for historical exam content and grading keys where the plan requires historical consistency. Do not silently fall back to the current TV2 exam when snapshot data is missing or invalid; fail closed according to the plan's error contract.
- Preserve the existing grading engine's verdicts, aliases, blank handling, alternates, and partial-credit behavior unless an approved plan explicitly changes them.
- Keep preview feedback separate from autosave and submit when the plan defines feedback as read-only. A preview must not write answers, increment version, alter status/timestamps, or mutate grading/result fields.
- Return only fields allowed for the current actor and attempt state. Do not expose an entire snapshot, unrelated parts, grading-key objects, private prompt data, or arbitrary stored JSON.
- Do not place answers, essays, answer keys, explanations, tokens, or raw request bodies in logs or error responses.
- Preserve autosave/resume version semantics and reject stale completions from changing newer attempt context or edits.

These invariants are guardrails, not permission to expand a plan. If a specific TV3 plan makes an approved exception, follow that plan and record the relevant decision in the handoff.

## Verification and handoff

1. Run the focused tests named by the plan after each subtask. Run final checks required by the plan and GEMINI.md; distinguish commands actually run from results reported by another executor.
2. Inspect the final diff and status, including untracked files. Confirm unrelated work is still present and no sensitive data was added to fixtures or logs.
3. Append a final execution entry with completed subtasks, files changed, verification results, acceptance-criteria status, and remaining risks or blockers. Do not rewrite earlier handoff history.
4. Stop for the requested review gate. Do not claim final feature PASS before the plan's whole-feature review is complete.
5. Do not commit, push, merge, or rebase automatically. Follow the user's explicit instructions and repository approval rules before any such operation.

Report the plan path, completed subtasks, key behavior changes, tests actually run, remaining blockers, and the handoff path.
