---
name: git-advanced
description: Use when a git task goes beyond add/commit/push — interactive-free rebase, bisect, reflog recovery, conflict resolution, or safe history inspection in this pnpm repo.
---

# git-advanced

## Trigger
A git operation that is not a plain commit/push: recovering a lost commit,
finding a regression, rebasing a feature branch, or resolving conflicts.

## Inputs / Outputs
- Inputs: the goal (recover / bisect / rebase / resolve) and any refs involved.
- Outputs: the resulting git state plus the exact commands run.

## Procedure
1. Inspect first, never guess: `git status`, `git log --oneline -20`,
   `git reflog -20`.
2. Recover a lost commit: find it in `git reflog`, then
   `git cherry-pick <sha>` or `git branch rescue <sha>`.
3. Find a regression: `git bisect start`, `git bisect bad`,
   `git bisect good <sha>`, run `pnpm test` at each step, `git bisect reset`.
4. Rebase without an editor (interactive rebase is unsupported here):
   `git rebase --onto <base> <from> <branch>`; resolve, then
   `git rebase --continue`.
5. Resolve conflicts: edit files, `git add <file>`, continue the operation.
   Verify with `pnpm typecheck && pnpm test`.

## Error handling
- Mid-rebase and stuck: `git rebase --abort` returns to the pre-rebase state.
- Never `git push --force` to master/main — the guardrail blocks it; push to a
  feature branch and open a PR.
- Never `git commit --no-verify` — the pre-commit gate is there on purpose.

## Negative example (do NOT use this skill)
For a routine `git add -A && git commit`, just commit — no advanced flow needed.
