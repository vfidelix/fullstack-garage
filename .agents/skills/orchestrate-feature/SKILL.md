---
name: orchestrate-feature
description: Orchestrate end-to-end implementation of a repository feature through feature planning, explicit user approval, bounded worker tasks, senior review, and reviewer-driven fixes. Use when Codex is asked to implement or deliver a new feature with the project feature-planner, feature-worker, and feature-reviewer agents.
---

# Orchestrate Feature

Coordinate the feature agents while keeping requirements, approval, implementation, and review in separate stages. Do not implement production code in the orchestrator thread.

## 1. Plan

Spawn `feature-planner` with the original feature request and paths to relevant feature, architecture, and design documentation. Instruct it to inspect the repository, clarify poorly formed requirements, and produce or update one canonical task breakdown and progress document. Require a plan revision, stable task IDs, dependencies, acceptance criteria, validation, status, and validation outcome for every task. Require a review findings table with stable finding ID, disposition, linked fix task, and verification outcome fields.

Wait for the planner. If it reports ambiguity, relay its questions to the user and stop. Do not infer missing product behavior or start a worker.

## 2. Obtain Approval

Present the planner's task breakdown, assumptions, risks, and unresolved decisions to the user. Ask for explicit approval and stop the workflow until it is received.

Treat requested plan changes as a return to planning. Silence, prior feature approval, or approval of a different plan does not authorize implementation.

After approval, record the approval in the canonical document with the approved plan revision, approved task IDs, and date, then preserve those values in every worker and reviewer prompt. Keep the approved task definitions unchanged. Any change to scope, dependencies, or acceptance criteria must increment the plan revision, clear the approval record, and return to user approval. Progress, validation outcomes, and reviewer dispositions may be updated without changing the plan revision.

## 3. Implement

After approval, execute tasks in dependency order. Run independent read-only investigation in parallel when useful, but do not run write tasks in parallel.

For each task:

1. Spawn a new `feature-worker` thread so the task starts with fresh context.
2. Send the stable task ID, canonical plan path, approved plan revision, approved task IDs, acceptance criteria, completed dependencies, relevant document paths, expected files when known, and required validation.
3. Require the worker to verify that the document's current and approved revisions match and that the task ID is approved, re-read current files, keep changes scoped, run relevant checks, and update the task status and concrete validation outcome in the canonical progress document.
4. Wait for the result and verify that the task and validation completed before dispatching the next task.

If a worker finds ambiguous requirements, an architecture mismatch, or scope beyond the approved plan, stop and return the issue to the user or planner. Do not let a worker redesign the feature.

## 4. Review

After all approved tasks complete, spawn `feature-reviewer`. Send the feature documentation, approved plan, implementation diff or baseline, worker summaries, and validation results.

Require stable finding IDs, findings first, severity ordering, and file and line references. The review must cover correctness, regressions, security, architecture, migrations, tests, maintainability, overengineering, and unnecessary boilerplate. Keep the reviewer read-only.

## 5. Fix And Re-review

When the reviewer reports actionable findings:

1. Record every finding in the canonical findings table. Convert actionable findings into the smallest dependency-aware fix tasks, highest severity first, and preserve each finding ID in its fix task ID and disposition. A finding-derived fix may use the current approval only when it preserves the approved scope; otherwise return to planning and approval.
2. Send each fix to a new `feature-worker` thread with the canonical plan path, explicit approval statement, reviewer evidence, intended outcome, scope limits, and validation required.
3. Require simpler code when a finding identifies unjustified abstractions, indirection, generic scaffolding, or boilerplate.
4. After all fixes complete, spawn a fresh `feature-reviewer` to review the full updated feature again.
5. Repeat until no actionable findings remain.

Do not automatically fix reviewer questions that require a product decision, contradict the approved plan, or materially expand scope. Present those to the user and wait for direction. Persist every finding as fixed, rejected with a concrete reason, or awaiting user decision in the canonical document, including its linked fix task and verification outcome, and include that disposition list in the next review prompt.

## Completion

Finish only when all approved tasks are complete, required repository checks pass or their failures are explicitly documented, and the latest reviewer reports no actionable findings. Summarize delivered behavior, changed areas, validation, review rounds, and any residual risks.
