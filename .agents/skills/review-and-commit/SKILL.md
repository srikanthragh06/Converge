---
name: review-and-commit
description: Use when the user asks to run review-and-commit, review changes and commit them, or follow the workflow defined in `.opencode/commands/review-and-commit.md`.
---

# Review And Commit

This skill mirrors the repo's OpenCode command at `.opencode/commands/review-and-commit.md`.

## Workflow

1. Read `.opencode/commands/review-and-commit.md` in full before doing any work.
2. Treat that file as the source of truth for the workflow, including its context gathering, review standards, confirmation gate, and commit requirements.
3. Execute the workflow in order.
4. Do not commit until the user explicitly confirms after you summarise the findings and changes.
5. If the markdown command and this skill ever diverge, follow `.opencode/commands/review-and-commit.md`.
